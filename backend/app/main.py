import asyncio
import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime
from typing import List, Optional

from fastapi import (
    FastAPI, WebSocket, WebSocketDisconnect, Depends,
    HTTPException, status, Query
)
from app.auth import get_optional_user
from app.models import TicketType, AddOn, PromoCode
from app.schemas import TicketTypeResponse, AddOnResponse
from app.bookings import router as bookings_router


from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, asc, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db, create_tables
from app.models import Event, Seat, SeatLock
from app.auth import router as auth_router, get_current_user, get_current_user_ws
from app.checkout import router as checkout_router
from app.admin import router as admin_router
from app.schemas import (
    EventResponse, SeatWithLock, SeatSelection, SeatLockResponse,
    SeatReleaseRequest, SeatReleaseResponse
)
from app.seat_service import get_event_seats, lock_seat, release_seat
from app.websocket_manager import manager
from app.redis_client import init_redis, close_redis
from app.kafka_producer import init_producer, stop_producer
from app.kafka_consumer import init_consumer, stop_consumer

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger(__name__)

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up services...")
    await create_tables()
    await init_redis()
    await init_producer()
    await init_consumer()
    yield
    logger.info("Shutting down services...")
    await stop_consumer()
    await stop_producer()
    await close_redis()

app = FastAPI(title="TicketPro API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL, "http://localhost", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(checkout_router)
app.include_router(admin_router)
app.include_router(bookings_router)


@app.websocket("/ws/{event_id}")
async def websocket_endpoint(websocket: WebSocket, event_id: int, token: Optional[str] = Query(None), guest_id: Optional[str] = Query(None), db: AsyncSession = Depends(get_db)):
    user = await get_current_user_ws(token, db) if token else None
    await manager.connect(websocket, event_id, user.id if user else None)
    try:
        seats = await get_event_seats(event_id, db, user.id if user else None, guest_id)
        user_locks = []
        now = datetime.utcnow()
        if user:
            lock_result = await db.execute(select(SeatLock).where(SeatLock.event_id == event_id, SeatLock.user_id == user.id, SeatLock.expires_at > now))
            user_locks = lock_result.scalars().all()
        elif guest_id:
            lock_result = await db.execute(select(SeatLock).join(Seat).where(Seat.event_id == event_id, SeatLock.guest_session_id == guest_id, SeatLock.expires_at > now))
            user_locks = lock_result.scalars().all()
            
        locks_resp = [SeatLockResponse(seat_id=l.seat_id, lock_token=l.lock_token, expires_at=l.expires_at, locked_at=l.locked_at, user_id=l.user_id) for l in user_locks]
        await manager.send_personal_message({"type": "initial_state", "seats":[s.model_dump() for s in seats], "user_locks":[ul.model_dump() for ul in locks_resp]}, websocket)
        
        while True:
            await asyncio.wait_for(websocket.receive_json(), timeout=35.0)
    except Exception:
        pass
    finally:
        await manager.disconnect(websocket, event_id)

@app.get("/health")
async def health_check():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}

# FEATURE 1: Advanced Search, Discovery & Filtering
@app.get("/api/events", response_model=List[EventResponse])
async def list_events(
    search: Optional[str] = None,
    category: Optional[str] = None,
    destination: Optional[str] = None,
    sort_by: Optional[str] = "date", # date, popularity
    db: AsyncSession = Depends(get_db)
):
    query = select(Event)
    
    if search:
        query = query.where(Event.name.ilike(f"%{search}%"))
    if category and category != "all":
        query = query.where(Event.category == category)
    if destination:
        query = query.where(Event.destination.ilike(f"%{destination}%"))
        
    if sort_by == "date":
        query = query.order_by(asc(Event.event_date))
    else:
        query = query.order_by(desc(Event.id))

    result = await db.execute(query)
    return result.scalars().all()

@app.get("/api/events/{event_id}", response_model=EventResponse)
async def get_event(event_id: int, db: AsyncSession = Depends(get_db)):
    event = (await db.execute(select(Event).where(Event.id == event_id))).scalar_one_or_none()
    if not event: raise HTTPException(status_code=404, detail="Event not found")
    return event

# @app.get("/api/events/{event_id}/seats", response_model=List[SeatWithLock])
# async def get_seats(event_id: int, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
#     return await get_event_seats(event_id, db, current_user.id)
@app.get("/api/events/{event_id}/seats", response_model=List[SeatWithLock])
async def get_seats(event_id: int, db: AsyncSession = Depends(get_db), auth: dict = Depends(get_optional_user)):
    user = auth["user"]
    return await get_event_seats(event_id, db, user.id if user else None, auth["guest_id"])

@app.post("/api/events/{event_id}/seats/lock", response_model=SeatLockResponse)
async def lock_seat_endpoint(event_id: int, body: SeatSelection, db: AsyncSession = Depends(get_db), auth: dict = Depends(get_optional_user)):
    user = auth["user"]
    lock_response = await lock_seat(event_id, body.seat_id, user.id if user else None, auth["guest_id"], db)
    await manager.broadcast_to_event(event_id, {"type": "seat_locked", "seat_id": body.seat_id, "user_id": user.id if user else None, "expires_at": lock_response.expires_at.isoformat(), "lock_token": lock_response.lock_token, "locked_by_me": False})
    return lock_response


@app.post("/api/events/{event_id}/seats/release", response_model=SeatReleaseResponse)
async def release_seat_endpoint(event_id: int, body: SeatReleaseRequest, db: AsyncSession = Depends(get_db), auth: dict = Depends(get_optional_user)):
    user = auth["user"]
    result = await release_seat(body.lock_token, user.id if user else None, auth["guest_id"], db, reason="manual")
    if result.get("released"):
        await manager.broadcast_to_event(event_id, {"type": "seat_released", "seat_id": result["seat_id"], "user_id": user.id if user else None, "reason": "manual"})
    return SeatReleaseResponse(seat_id=result.get("seat_id", 0), released=result.get("released", False), reason=result.get("reason", "unknown"))
# Extra endpoints for Phase 2 Checkout
@app.get("/api/events/{event_id}/ticket-types", response_model=List[TicketTypeResponse])
async def get_ticket_types(event_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(TicketType).where(TicketType.event_id == event_id))
    return result.scalars().all()

@app.get("/api/events/{event_id}/add-ons", response_model=List[AddOnResponse])
async def get_add_ons(event_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AddOn).where(AddOn.event_id == event_id))
    return result.scalars().all()

@app.get("/api/promo/validate")
async def validate_promo(code: str, db: AsyncSession = Depends(get_db)):
    promo = (await db.execute(select(PromoCode).where(PromoCode.code == code.upper(), PromoCode.is_active == True))).scalar_one_or_none()
    if not promo or promo.valid_until.replace(tzinfo=None) < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Invalid or expired promo code")
    return {"code": promo.code, "discount_percentage": float(promo.discount_percentage)}


@app.get("/api/me/locks", response_model=List[SeatLockResponse])
async def get_my_locks(db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    now = datetime.utcnow()
    locks = (await db.execute(select(SeatLock).where(SeatLock.user_id == current_user.id, SeatLock.expires_at > now))).scalars().all()
    return [SeatLockResponse(seat_id=l.seat_id, lock_token=l.lock_token, expires_at=l.expires_at, locked_at=l.locked_at, user_id=l.user_id) for l in locks]