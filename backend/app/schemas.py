from datetime import datetime
from typing import Optional, List, Union, Literal, Dict, Any
from decimal import Decimal
from pydantic import BaseModel, EmailStr

# ─────────────────────────── User ───────────────────────────
class UserResponse(BaseModel):
    id: int
    email: str
    name: str
    picture: Optional[str] = None
    google_id: str
    phone_number: Optional[str] = None
    loyalty_points: int = 0
    is_admin: bool = False

    model_config = {"from_attributes": True}

# ─────────────────────────── Event ──────────────────────────
class EventResponse(BaseModel):
    id: int
    name: str
    category: str
    destination: Optional[str] = None
    language: Optional[str] = None
    rating: Optional[Decimal] = None
    venue_name: Optional[str] = None
    description: Optional[str] = None
    amenities: Optional[Dict[str, Any]] = None
    cancellation_policy: Optional[str] = None
    event_date: Optional[datetime] = None
    lock_duration_minutes: int
    status: str

    model_config = {"from_attributes": True}

class RowConfig(BaseModel):
    row_start: str
    row_end: str
    seats_per_row: int
    section: Optional[str] = None
    seat_class: str = "economy"
    is_wheelchair_accessible: bool = False
    price: Decimal

class EventCreateRequest(BaseModel):
    name: str
    category: str = "event"
    destination: Optional[str] = None
    language: Optional[str] = None
    venue_name: Optional[str] = None
    description: Optional[str] = None
    cancellation_policy: Optional[str] = None
    event_date: Optional[datetime] = None
    lock_duration_minutes: int = 10
    rows_config: List[RowConfig]

# ─────────────────────────── Seat ───────────────────────────
class SeatBase(BaseModel):
    id: int
    event_id: int
    row: str
    number: int
    section: Optional[str] = None
    seat_class: str
    is_wheelchair_accessible: bool
    price: Decimal
    status: str

    model_config = {"from_attributes": True}

class LockInfo(BaseModel):
    lock_token: str
    user_id: Optional[int] = None
    locked_at: datetime
    expires_at: datetime
    locked_by_me: bool = False

class SeatWithLock(SeatBase):
    lock: Optional[LockInfo] = None

class SeatSelection(BaseModel):
    seat_id: int

class SeatLockResponse(BaseModel):
    seat_id: int
    lock_token: str
    expires_at: datetime
    locked_at: datetime
    user_id: Optional[int]

class SeatReleaseRequest(BaseModel):
    lock_token: str

class SeatReleaseResponse(BaseModel):
    seat_id: int
    released: bool
    reason: str

# ─────────────────────── WebSocket Messages ─────────────────
class WSSeatLocked(BaseModel):
    type: Literal["seat_locked"] = "seat_locked"
    seat_id: int
    user_id: Optional[int]
    expires_at: str
    lock_token: str
    locked_by_me: bool = False

class WSSeatReleased(BaseModel):
    type: Literal["seat_released"] = "seat_released"
    seat_id: int
    user_id: Optional[int]
    reason: Literal["manual", "expired"]

class WSSeatExpired(BaseModel):
    type: Literal["seat_expired"] = "seat_expired"
    seat_id: int
    previously_locked_by: Optional[int]

class WSInitialState(BaseModel):
    type: Literal["initial_state"] = "initial_state"
    seats: List[SeatWithLock]
    user_locks: List[SeatLockResponse]

class WSHeartbeat(BaseModel):
    type: Literal["heartbeat"] = "heartbeat"
    timestamp: str

class WSError(BaseModel):
    type: Literal["error"] = "error"
    message: str

WebSocketMessage = Union[
    WSSeatLocked, WSSeatReleased, WSSeatExpired,
    WSInitialState, WSHeartbeat, WSError,
]

# ─────────────────────────── Phase 2: Checkout ───────────────────────────
class TicketTypeResponse(BaseModel):
    id: int
    name: str
    price_modifier: Decimal
    model_config = {"from_attributes": True}

class AddOnResponse(BaseModel):
    id: int
    name: str
    price: Decimal
    model_config = {"from_attributes": True}

class ConfirmPaymentRequest(BaseModel):
    event_id: int
    seat_ids: List[int]
    card_number: str
    guest_email: Optional[str] = None
    guest_phone: Optional[str] = None
    ticket_types: Dict[int, int] = {} # seat_id -> ticket_type_id
    add_ons: Dict[int, int] = {}      # addon_id -> quantity
    promo_code: Optional[str] = None

# ─────────────────────────── Phase 3: Bookings & Tickets ───────────────────────────
class BookingSeatInfo(BaseModel):
    id: int
    row: str
    number: int
    section: Optional[str]
    seat_class: str
    price: Decimal
    ticket_type: Optional[str]

class BookingResponse(BaseModel):
    id: int
    booking_reference: str
    event_id: int
    event_name: str
    event_date: Optional[datetime]
    venue_name: Optional[str]
    total_amount: Decimal
    status: str
    created_at: datetime
    seats: List[BookingSeatInfo]

    model_config = {"from_attributes": True}