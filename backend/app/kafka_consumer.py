import asyncio
import json
import logging
import os
from datetime import datetime
from sqlalchemy import select, delete
from aiokafka import AIOKafkaConsumer

from app.database import AsyncSessionLocal
from app.models import Seat, SeatLock, SeatStatus, User, Booking, Event
from app import seat_service
from app.websocket_manager import manager
from app import kafka_producer as kp
from app import redis_client as rc

logger = logging.getLogger(__name__)

KAFKA_BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
CONSUMER_GROUP = "ticketing-main-consumer"
_pending_expiry_tasks: dict[str, asyncio.Task] = {}
consumer: AIOKafkaConsumer | None = None

async def init_consumer():
    global consumer
    consumer = AIOKafkaConsumer(
        "seat.locked", "payment.success", "seat.released", "notification.send",
        bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS, group_id=CONSUMER_GROUP,
        value_deserializer=lambda v: json.loads(v.decode("utf-8")),
        auto_offset_reset="earliest", enable_auto_commit=True,
    )
    for attempt in range(8):
        try:
            await consumer.start()
            logger.info("Kafka consumer started successfully.")
            asyncio.create_task(_consume_loop(), name="kafka-consumer-loop")
            return
        except Exception as e:
            logger.warning(f"Kafka consumer start failed, retrying in 5s... ({e})")
            await asyncio.sleep(5)
    logger.error("Failed to start Kafka consumer after multiple attempts.")

async def stop_consumer():
    if consumer: await consumer.stop()
    for task in _pending_expiry_tasks.values(): task.cancel()

async def _consume_loop():
    try:
        async for msg in consumer:
            data = msg.value
            if msg.topic == "seat.locked": await handle_seat_locked(data)
            elif msg.topic == "payment.success": await handle_payment_success(data)
            elif msg.topic == "seat.released": await handle_seat_released(data)
            elif msg.topic == "notification.send": await handle_notification(data)
    except asyncio.CancelledError:
        pass
    except Exception as e:
        logger.error(f"Consumer loop error: {e}", exc_info=True)

async def handle_seat_locked(data):
    lock_token, expires_at_str, seat_id, event_id, user_id = data.get("lock_token"), data.get("expires_at"), data.get("seat_id"), data.get("event_id"), data.get("user_id")
    try:
        delay = (datetime.fromisoformat(expires_at_str) - datetime.utcnow()).total_seconds()
    except Exception: return
    if delay <= 0:
        asyncio.create_task(_expire_lock_task(lock_token, seat_id, event_id, user_id, 0))
        return
    if lock_token in _pending_expiry_tasks: _pending_expiry_tasks[lock_token].cancel()
    _pending_expiry_tasks[lock_token] = asyncio.create_task(_expire_lock_task(lock_token, seat_id, event_id, user_id, delay))

async def handle_payment_success(data):
    seat_ids, user_id, event_id = data.get("seat_ids", []), data.get("user_id"), data.get("event_id")
    
    email_to = "Guest"
    booking_ref = "UNKNOWN"
    event_name = "Event"

    async with AsyncSessionLocal() as db:
        # Clear locks and update cache
        for seat_id in seat_ids:
            await db.execute(delete(SeatLock).where(SeatLock.seat_id == seat_id))
            await rc.delete_lock(seat_id, user_id)
            await manager.broadcast_to_event(event_id, {"type": "seat_booked", "seat_id": seat_id, "user_id": user_id})
        
        # Fetch Booking Info for Email
        if seat_ids:
            seat = (await db.execute(select(Seat).where(Seat.id == seat_ids[0]))).scalar_one_or_none()
            if seat and seat.booking_id:
                booking = (await db.execute(select(Booking).where(Booking.id == seat.booking_id))).scalar_one()
                event = (await db.execute(select(Event).where(Event.id == booking.event_id))).scalar_one()
                booking_ref = booking.booking_reference
                event_name = event.name
                
                if booking.user_id:
                    user = (await db.execute(select(User).where(User.id == booking.user_id))).scalar_one()
                    email_to = user.email
                else:
                    email_to = booking.guest_email

        await db.commit()

    # Trigger Email Dispatch
    await kp.publish_notification(
        user_id=user_id,
        title="🎟️ Ticket Confirmation: " + booking_ref,
        message=f"Success! Your {len(seat_ids)} tickets for '{event_name}' are confirmed. Your reference is {booking_ref}. Download your digital ticket from your dashboard.",
        notification_type="email",
        target_contact=email_to
    )

async def handle_seat_released(data):
    """Trigger cancellation refund emails if releasing a cancelled booking."""
    reason = data.get("reason")
    if reason == "booking_cancelled":
        # In a real app, you would fetch the booking and email the user about the refund here.
        await kp.publish_notification(
            user_id=data.get("user_id"), title="🔄 Booking Cancelled",
            message=f"Your booking has been successfully cancelled and refunded. The seats are now available to the public.",
            notification_type="email", target_contact="User/Guest"
        )

async def handle_notification(data):
    """Simulates sending an Email or SMS using an external provider (e.g. SendGrid/Twilio)."""
    target = data.get("target_contact", "Unknown User")
    title = data.get("title")
    message = data.get("message")
    ntype = data.get("type", "email").upper()
    
    print("\n" + "="*60)
    print(f"🚀 [{ntype} DISPATCHED] To: {target}")
    print(f"   SUBJECT: {title}")
    print(f"   BODY:    {message}")
    print("="*60 + "\n")

async def _expire_lock_task(lock_token, seat_id, event_id, user_id, delay):
    try:
        if delay > 0: await asyncio.sleep(delay)
        async with AsyncSessionLocal() as db:
            await seat_service.expire_lock(lock_token, db)
        await manager.broadcast_to_event(event_id, {"type": "seat_expired", "seat_id": seat_id, "previously_locked_by": user_id})
        await manager.broadcast_to_event(event_id, {"type": "seat_released", "seat_id": seat_id, "user_id": user_id, "reason": "expired"})
    except asyncio.CancelledError: pass