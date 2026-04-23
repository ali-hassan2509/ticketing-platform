import json
import os
import asyncio
import logging
from typing import Optional
import redis.asyncio as aioredis

logger = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

redis_pool: Optional[aioredis.ConnectionPool] = None
redis_client: Optional[aioredis.Redis] = None

async def init_redis():
    """Initialize the Redis connection pool with retries."""
    global redis_pool, redis_client
    redis_pool = aioredis.ConnectionPool.from_url(
        REDIS_URL,
        max_connections=50,
        decode_responses=True,
    )
    redis_client = aioredis.Redis(connection_pool=redis_pool)
    
    for attempt in range(5):
        try:
            await redis_client.ping()
            logger.info("Connected to Redis successfully.")
            return
        except Exception as e:
            logger.warning(f"Redis not ready yet, retrying in 5s... ({e})")
            await asyncio.sleep(5)
    logger.error("Failed to connect to Redis after multiple attempts.")

async def close_redis():
    if redis_client:
        await redis_client.aclose()
    if redis_pool:
        await redis_pool.aclose()

def _seat_key(seat_id: int) -> str:
    return f"seat_lock:{seat_id}"

def _user_locks_key(user_id: int) -> str:
    return f"user_locks:{user_id}"

async def get_lock(seat_id: int) -> Optional[dict]:
    data = await redis_client.get(_seat_key(seat_id))
    if data:
        return json.loads(data)
    return None

async def set_lock(seat_id: int, lock_info: dict, ttl_seconds: int):
    await redis_client.setex(_seat_key(seat_id), ttl_seconds, json.dumps(lock_info, default=str))
    await redis_client.sadd(_user_locks_key(lock_info["user_id"]), str(seat_id))
    await redis_client.expire(_user_locks_key(lock_info["user_id"]), ttl_seconds + 60)

async def delete_lock(seat_id: int, user_id: Optional[int] = None):
    await redis_client.delete(_seat_key(seat_id))
    if user_id:
        await redis_client.srem(_user_locks_key(user_id), str(seat_id))

async def get_user_locked_seats(user_id: int) -> list[int]:
    members = await redis_client.smembers(_user_locks_key(user_id))
    return [int(m) for m in members]

async def get_all_event_locks(event_id: int) -> list[dict]:
    locks = []
    cursor = 0
    pattern = "seat_lock:*"
    while True:
        cursor, keys = await redis_client.scan(cursor, match=pattern, count=100)
        for key in keys:
            data = await redis_client.get(key)
            if data:
                lock = json.loads(data)
                if lock.get("event_id") == event_id:
                    locks.append(lock)
        if cursor == 0:
            break
    return locks