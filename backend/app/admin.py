from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import insert, select, func
from typing import List
from pydantic import BaseModel
from passlib.context import CryptContext
from datetime import datetime

from app.database import get_db
from app.auth import get_current_user, create_access_token
from app.models import User, Event, Seat, SeatStatus, Booking, AuditLog, TicketType, AddOn
from app.schemas import EventCreateRequest

router = APIRouter(prefix="/api/admin", tags=["admin"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class AdminLoginRequest(BaseModel):
    email: str
    password: str

async def get_admin_user(current_user: User = Depends(get_current_user)):
    if not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required.")
    return current_user

async def log_admin_action(db: AsyncSession, admin_id: int, action: str, target: str):
    db.add(AuditLog(admin_id=admin_id, action=action, target_entity=target))
    await db.commit()

def get_char_range(start: str, end: str) -> List[str]:
    return [chr(c) for c in range(ord(start.upper()), ord(end.upper()) + 1)]

# ─── ADMIN LOGIN ────────────────────────────────────────────────
@router.post("/login")
async def admin_login(req: AdminLoginRequest, db: AsyncSession = Depends(get_db)):
    user = (await db.execute(select(User).where(User.email == req.email, User.is_admin == True))).scalar_one_or_none()
    if not user or not user.hashed_password or not pwd_context.verify(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid admin credentials")
    
    await log_admin_action(db, user.id, "LOGIN", "System")
    return {"token": create_access_token(user.id, user.email), "user": {"id": user.id, "email": user.email, "name": user.name, "is_admin": True}}

# ─── ADMIN METRICS DASHBOARD ────────────────────────────────────
@router.get("/metrics")
async def get_dashboard_metrics(db: AsyncSession = Depends(get_db), admin: User = Depends(get_admin_user)):
    total_revenue = (await db.execute(select(func.sum(Booking.total_amount)).where(Booking.status == "confirmed"))).scalar() or 0.0
    total_bookings = (await db.execute(select(func.count(Booking.id)).where(Booking.status == "confirmed"))).scalar() or 0
    total_users = (await db.execute(select(func.count(User.id)))).scalar() or 0
    
    total_seats = (await db.execute(select(func.count(Seat.id)))).scalar() or 0
    booked_seats = (await db.execute(select(func.count(Seat.id)).where(Seat.status == SeatStatus.BOOKED))).scalar() or 0
    occupancy_rate = round((booked_seats / total_seats * 100), 1) if total_seats > 0 else 0.0

    return {
        "total_revenue": float(total_revenue),
        "total_bookings": total_bookings,
        "total_users": total_users,
        "occupancy_rate": occupancy_rate
    }

# ─── USER MANAGEMENT ───────────────────────────────────────────
@router.get("/users")
async def get_all_users(db: AsyncSession = Depends(get_db), admin: User = Depends(get_admin_user)):
    users = (await db.execute(select(User).order_by(User.id.desc()))).scalars().all()
    return [{"id": u.id, "email": u.email, "name": u.name, "is_active": u.is_active, "is_admin": u.is_admin, "created_at": u.created_at} for u in users]

@router.post("/users/{user_id}/toggle-status")
async def toggle_user_status(user_id: int, db: AsyncSession = Depends(get_db), admin: User = Depends(get_admin_user)):
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user: raise HTTPException(status_code=404, detail="User not found")
    if user.is_admin: raise HTTPException(status_code=400, detail="Cannot block other admins")
    
    user.is_active = not user.is_active
    await db.commit()
    action = "UNBLOCKED" if user.is_active else "BLOCKED"
    await log_admin_action(db, admin.id, action, f"User {user.email}")
    return {"message": f"User {action.lower()} successfully", "is_active": user.is_active}

# ─── BOOKINGS LEDGER ───────────────────────────────────────────
@router.get("/bookings")
async def get_all_bookings(db: AsyncSession = Depends(get_db), admin: User = Depends(get_admin_user)):
    bookings = (await db.execute(select(Booking).order_by(Booking.created_at.desc()))).scalars().all()
    res = []
    for b in bookings:
        user = (await db.execute(select(User).where(User.id == b.user_id))).scalar_one_or_none() if b.user_id else None
        res.append({
            "id": b.id, "reference": b.booking_reference, 
            "purchaser": user.email if user else (b.guest_email or "Guest"),
            "amount": float(b.total_amount), "status": b.status, "date": b.created_at
        })
    return res

# ─── CREATE EVENT ───────────────────────────────────────────────
@router.post("/events")
async def create_event(req: EventCreateRequest, db: AsyncSession = Depends(get_db), admin: User = Depends(get_admin_user)):
    new_event = Event(
        name=req.name, category=req.category, destination=req.destination, language=req.language,
        venue_name=req.venue_name, description=req.description, cancellation_policy=req.cancellation_policy,
        event_date=req.event_date.replace(tzinfo=None) if req.event_date else None, lock_duration_minutes=req.lock_duration_minutes, status="active"
    )
    db.add(new_event)
    await db.flush() 

    seats_to_insert = []
    for config in req.rows_config:
        rows = get_char_range(config.row_start, config.row_end)
        for row_letter in rows:
            for seat_num in range(1, config.seats_per_row + 1):
                seats_to_insert.append({
                    "event_id": new_event.id, "row": row_letter, "number": seat_num,
                    "section": config.section, "seat_class": config.seat_class,
                    "is_wheelchair_accessible": config.is_wheelchair_accessible,
                    "price": config.price, "status": SeatStatus.AVAILABLE
                })

    if seats_to_insert: await db.execute(insert(Seat).values(seats_to_insert))
    
    # Default Tickets & Add-ons
    db.add_all([
        TicketType(event_id=new_event.id, name="Adult", price_modifier=0.00),
        TicketType(event_id=new_event.id, name="Child", price_modifier=-10.00),
        AddOn(event_id=new_event.id, name="Parking", price=20.00)
    ])
    
    await db.commit()
    await log_admin_action(db, admin.id, "CREATED_EVENT", f"Event #{new_event.id}: {new_event.name}")
    return {"message": "Event created", "event_id": new_event.id, "total_seats": len(seats_to_insert)}

# ─── AUDIT LOGS ───────────────────────────────────────────────
@router.get("/audit-logs")
async def get_audit_logs(db: AsyncSession = Depends(get_db), admin: User = Depends(get_admin_user)):
    logs = (await db.execute(select(AuditLog).order_by(AuditLog.created_at.desc()).limit(100))).scalars().all()
    res = []
    for l in logs:
        admin_user = (await db.execute(select(User).where(User.id == l.admin_id))).scalar_one_or_none()
        res.append({"id": l.id, "admin": admin_user.email if admin_user else "Unknown", "action": l.action, "target": l.target_entity, "date": l.created_at})
    return res