import json
import os
import asyncio
import logging
from typing import Optional
from datetime import datetime

from aiokafka import AIOKafkaProducer

logger = logging.getLogger(__name__)

KAFKA_BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")

# Topics
TOPIC_SEAT_LOCKED = "seat.locked"
TOPIC_SEAT_RELEASED = "seat.released"
TOPIC_SEAT_EXPIRED = "seat.expired"
TOPIC_PAYMENT_SUCCESS = "payment.success"
TOPIC_NOTIFICATION_SEND = "notification.send"

producer: Optional[AIOKafkaProducer] = None

async def init_producer():
    """Start the Kafka producer with retries."""
    global producer
    producer = AIOKafkaProducer(
        bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
        value_serializer=lambda v: json.dumps(v, default=str).encode("utf-8"),
        key_serializer=lambda k: str(k).encode("utf-8") if k else None,
        acks="all",
        compression_type="gzip",
    )
    
    for attempt in range(8):
        try:
            await producer.start()
            logger.info("Kafka producer started successfully.")
            return
        except Exception as e:
            logger.warning(f"Kafka producer start failed, retrying in 5s... ({e})")
            await asyncio.sleep(5)
    logger.error("Failed to start Kafka producer after multiple attempts.")

async def stop_producer():
    """Flush and stop the producer. Called at app shutdown."""
    if producer:
        await producer.stop()
        logger.info("Kafka producer stopped")

async def publish_seat_locked(event_id: int, seat_id: int, user_id: int, lock_token: str, expires_at: datetime, locked_at: datetime):
    if not producer: return
    message = {"event_id": event_id, "seat_id": seat_id, "user_id": user_id, "lock_token": lock_token, "expires_at": expires_at.isoformat(), "locked_at": locked_at.isoformat()}
    await producer.send_and_wait(TOPIC_SEAT_LOCKED, value=message, key=str(event_id))

async def publish_seat_released(event_id: int, seat_id: int, user_id: int, reason: str):
    if not producer: return
    message = {"event_id": event_id, "seat_id": seat_id, "user_id": user_id, "reason": reason, "released_at": datetime.utcnow().isoformat()}
    await producer.send_and_wait(TOPIC_SEAT_RELEASED, value=message, key=str(event_id))

async def publish_seat_expired(event_id: int, seat_id: int, lock_token: str, user_id: int):
    if not producer: return
    message = {"event_id": event_id, "seat_id": seat_id, "lock_token": lock_token, "user_id": user_id, "expired_at": datetime.utcnow().isoformat()}
    await producer.send_and_wait(TOPIC_SEAT_EXPIRED, value=message, key=str(event_id))

async def publish_payment_success(event_id: int, user_id: int, seat_ids: list[int], amount: float):
    """Publish a successful payment to trigger booking."""
    if not producer: return
    message = {"event_id": event_id, "user_id": user_id, "seat_ids": seat_ids, "amount": amount, "paid_at": datetime.utcnow().isoformat()}
    await producer.send_and_wait(TOPIC_PAYMENT_SUCCESS, value=message, key=str(event_id))

async def publish_notification(user_id: int, title: str, message: str, notification_type: str = "email"):
    """Publish a notification request (e.g., send ticket email)."""
    if not producer: return
    payload = {"user_id": user_id, "title": title, "message": message, "type": notification_type, "created_at": datetime.utcnow().isoformat()}
    await producer.send_and_wait(TOPIC_NOTIFICATION_SEND, value=payload, key=str(user_id))