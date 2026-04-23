import asyncio
import json
import logging
from collections import defaultdict
from typing import Dict, List, Optional
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """
    Manages WebSocket connections grouped by event_id.
    Thread-safe via asyncio.Lock for connection mutations.
    Supports broadcasting seat state changes to all viewers of an event.
    """

    def __init__(self):
        # event_id -> list of (websocket, user_id) tuples
        self._connections: Dict[int, List[tuple[WebSocket, Optional[int]]]] = defaultdict(list)
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket, event_id: int, user_id: Optional[int] = None):
        """Accept the WebSocket and register it under the given event."""
        await websocket.accept()
        async with self._lock:
            self._connections[event_id].append((websocket, user_id))
        logger.info(f"WS connected: event={event_id} user={user_id} total={self.count(event_id)}")

    async def disconnect(self, websocket: WebSocket, event_id: int):
        """Remove a WebSocket from the event's connection pool."""
        async with self._lock:
            self._connections[event_id] = [
                (ws, uid)
                for ws, uid in self._connections[event_id]
                if ws is not websocket
            ]
            # Clean up empty event buckets
            if not self._connections[event_id]:
                del self._connections[event_id]
        logger.info(f"WS disconnected: event={event_id} remaining={self.count(event_id)}")

    async def broadcast_to_event(self, event_id: int, message: dict):
        """
        Send a message to all WebSocket clients watching a specific event.
        Dead connections are pruned silently.
        """
        if event_id not in self._connections:
            return

        payload = json.dumps(message, default=str)
        dead: list[tuple[WebSocket, Optional[int]]] = []

        for ws, user_id in list(self._connections[event_id]):
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append((ws, user_id))

        # Prune dead connections
        if dead:
            async with self._lock:
                for entry in dead:
                    try:
                        self._connections[event_id].remove(entry)
                    except ValueError:
                        pass

    async def send_personal_message(self, message: dict, websocket: WebSocket):
        """Send a message to a single WebSocket client."""
        try:
            await websocket.send_text(json.dumps(message, default=str))
        except Exception as e:
            logger.warning(f"Failed to send personal message: {e}")

    def count(self, event_id: int) -> int:
        """Number of active connections for an event."""
        return len(self._connections.get(event_id, []))

    def total_connections(self) -> int:
        """Total active WebSocket connections across all events."""
        return sum(len(conns) for conns in self._connections.values())


# Singleton instance shared across the app
manager = ConnectionManager()
