import uuid
import logging
from datetime import datetime, timedelta
from typing import Optional, List

from fastapi import HTTPException, status
from sqlalchemy import select, delete, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Seat, SeatLock, Event, SeatStatus
from app.schemas import SeatLockResponse, SeatWithLock, LockInfo
from app import redis_client as rc
from app import kafka_producer as kp

logger = logging.getLogger(__name__)

async def get_event_seats(event_id: int, db: AsyncSession, current_user_id: Optional[int] = None, guest_id: Optional[str] = None) -> List[SeatWithLock]:
    result = await db.execute(select(Seat).where(Seat.event_id == event_id).order_by(Seat.row, Seat.number))
    seats = result.scalars().all()
    now = datetime.utcnow()
    lock_result = await db.execute(select(SeatLock).join(Seat).where(and_(Seat.event_id == event_id, SeatLock.expires_at > now)))
    locks_by_seat = {lock.seat_id: lock for lock in lock_result.scalars().all()}

    output = []
    for seat in seats:
        active_lock = locks_by_seat.get(seat.id)
        lock_info = None
        if active_lock:
            # Check if locked by me (either user_id or guest_session_id)
            locked_by_me = False
            if current_user_id and active_lock.user_id == current_user_id: locked_by_me = True
            if guest_id and active_lock.guest_session_id == guest_id: locked_by_me = True

            lock_info = LockInfo(
                lock_token=active_lock.lock_token, user_id=active_lock.user_id,
                locked_at=active_lock.locked_at, expires_at=active_lock.expires_at, locked_by_me=locked_by_me
            )
        output.append(SeatWithLock.model_validate({**seat.__dict__, "lock": lock_info}))
    return output

async def lock_seat(event_id: int, seat_id: int, user_id: Optional[int], guest_id: Optional[str], db: AsyncSession) -> SeatLockResponse:
    event = (await db.execute(select(Event).where(Event.id == event_id))).scalar_one_or_none()
    if not event: raise HTTPException(status_code=404, detail="Event not found")

    seat = (await db.execute(select(Seat).where(and_(Seat.id == seat_id, Seat.event_id == event_id)).with_for_update(skip_locked=True))).scalar_one_or_none()
    if not seat: raise HTTPException(status_code=409, detail="Seat is locked by another user")
    if seat.status == SeatStatus.BOOKED: raise HTTPException(status_code=409, detail="Seat is already booked")

    now = datetime.utcnow()
    existing = (await db.execute(select(SeatLock).where(and_(SeatLock.seat_id == seat_id, SeatLock.expires_at > now)))).scalar_one_or_none()

    if existing:
        if (user_id and existing.user_id == user_id) or (guest_id and existing.guest_session_id == guest_id):
            return SeatLockResponse(seat_id=seat_id, lock_token=existing.lock_token, expires_at=existing.expires_at, locked_at=existing.locked_at, user_id=user_id)
        raise HTTPException(status_code=409, detail="Seat is locked")

    lock_token = str(uuid.uuid4())
    locked_at = datetime.utcnow()
    expires_at = locked_at + timedelta(minutes=event.lock_duration_minutes)

    new_lock = SeatLock(seat_id=seat_id, user_id=user_id, guest_session_id=guest_id, locked_at=locked_at, expires_at=expires_at, lock_token=lock_token)
    db.add(new_lock)
    seat.status = SeatStatus.LOCKED
    await db.commit()

    ttl = int((expires_at - locked_at).total_seconds())
    await rc.set_lock(seat_id, {"lock_token": lock_token, "user_id": user_id or guest_id, "event_id": event_id, "locked_at": locked_at.isoformat(), "expires_at": expires_at.isoformat()}, ttl)
    await kp.publish_seat_locked(event_id, seat_id, user_id or 0, lock_token, expires_at, locked_at)
    return SeatLockResponse(seat_id=seat_id, lock_token=lock_token, expires_at=expires_at, locked_at=locked_at, user_id=user_id)

async def release_seat(lock_token: str, user_id: Optional[int], guest_id: Optional[str], db: AsyncSession, reason: str = "manual"):
    lock = (await db.execute(select(SeatLock).where(SeatLock.lock_token == lock_token))).scalar_one_or_none()
    if not lock: return {"released": False, "reason": "lock_not_found"}

    if (user_id and lock.user_id != user_id) and (guest_id and lock.guest_session_id != guest_id):
        raise HTTPException(status_code=403, detail="You do not own this lock")

    seat_id = lock.seat_id
    seat = (await db.execute(select(Seat).where(Seat.id == seat_id).with_for_update())).scalar_one_or_none()
    await db.execute(delete(SeatLock).where(SeatLock.lock_token == lock_token))

    if seat and seat.status == SeatStatus.LOCKED: seat.status = SeatStatus.AVAILABLE
    await db.commit()
    await rc.delete_lock(seat_id, user_id or guest_id)
    await kp.publish_seat_released(seat.event.id if seat else 0, seat_id, user_id or 0, reason)
    return {"released": True, "seat_id": seat_id, "reason": reason}

async def expire_lock(lock_token: str, db: AsyncSession):
    # Logic remains same for Kafka expiry
    lock = (await db.execute(select(SeatLock).where(SeatLock.lock_token == lock_token))).scalar_one_or_none()
    if not lock or lock.expires_at.replace(tzinfo=None) > datetime.utcnow(): return
    seat_id, user_id = lock.seat_id, lock.user_id
    seat = (await db.execute(select(Seat).where(Seat.id == seat_id).with_for_update())).scalar_one_or_none()
    await db.execute(delete(SeatLock).where(SeatLock.lock_token == lock_token))
    if seat and seat.status == SeatStatus.LOCKED: seat.status = SeatStatus.AVAILABLE
    await db.commit()
    await rc.delete_lock(seat_id, user_id)
    await kp.publish_seat_expired(seat.event_id if seat else 0, seat_id, lock_token, user_id or 0)