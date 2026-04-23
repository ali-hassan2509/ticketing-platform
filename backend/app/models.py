from datetime import datetime
from enum import Enum as PyEnum
from sqlalchemy import (
    Column, Integer, String, DateTime, ForeignKey,
    Numeric, Text, Boolean, Enum, Index, func, JSON
)
from sqlalchemy.orm import relationship
from app.database import Base
import uuid

class SeatStatus(str, PyEnum):
    AVAILABLE = "available"
    LOCKED = "locked"
    BOOKED = "booked"
    DISABLED = "disabled"

class EventStatus(str, PyEnum):
    DRAFT = "draft"
    ACTIVE = "active"
    SOLD_OUT = "sold_out"
    CANCELLED = "cancelled"

class EventCategory(str, PyEnum):
    MOVIE = "movie"
    EVENT = "event"
    TRAVEL = "travel"

class SeatClass(str, PyEnum):
    ECONOMY = "economy"
    VIP = "vip"
    PREMIUM = "premium"
    FIRST_CLASS = "first_class"

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    picture = Column(Text, nullable=True)
    google_id = Column(String(255), unique=True, nullable=False, index=True)
    phone_number = Column(String(20), nullable=True)
    loyalty_points = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    hashed_password = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    locks = relationship("SeatLock", back_populates="user", cascade="all, delete-orphan")
    bookings = relationship("Booking", back_populates="user")

class Event(Base):
    __tablename__ = "events"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    category = Column(Enum(EventCategory), default=EventCategory.EVENT, index=True)
    destination = Column(String(255), nullable=True, index=True)
    language = Column(String(50), nullable=True)
    rating = Column(Numeric(3, 1), nullable=True)
    venue_name = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    amenities = Column(JSON, nullable=True)
    cancellation_policy = Column(Text, nullable=True)
    event_date = Column(DateTime(timezone=True), nullable=True)
    venue_layout = Column(Text, nullable=True)
    lock_duration_minutes = Column(Integer, default=10)
    status = Column(Enum(EventStatus), default=EventStatus.ACTIVE, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    seats = relationship("Seat", back_populates="event", cascade="all, delete-orphan")
    ticket_types = relationship("TicketType", back_populates="event", cascade="all, delete-orphan")
    add_ons = relationship("AddOn", back_populates="event", cascade="all, delete-orphan")

class TicketType(Base):
    __tablename__ = "ticket_types"
    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(50), nullable=False)
    price_modifier = Column(Numeric(10, 2), default=0.00)
    
    event = relationship("Event", back_populates="ticket_types")

class AddOn(Base):
    __tablename__ = "add_ons"
    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    price = Column(Numeric(10, 2), nullable=False)
    
    event = relationship("Event", back_populates="add_ons")

class Booking(Base):
    __tablename__ = "bookings"
    id = Column(Integer, primary_key=True, index=True)
    booking_reference = Column(String(20), unique=True, index=True, nullable=False) # e.g. TKT-A8F9K
    event_id = Column(Integer, ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    guest_email = Column(String(255), nullable=True)
    guest_phone = Column(String(20), nullable=True)
    total_amount = Column(Numeric(10, 2), nullable=False)
    tax_amount = Column(Numeric(10, 2), nullable=False, default=0)
    status = Column(String(50), default="confirmed") # confirmed, cancelled
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    user = relationship("User", back_populates="bookings")
    event = relationship("Event")
    seats = relationship("Seat", back_populates="booking")

class Seat(Base):
    __tablename__ = "seats"
    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id", ondelete="SET NULL"), nullable=True, index=True)
    ticket_type_id = Column(Integer, ForeignKey("ticket_types.id", ondelete="SET NULL"), nullable=True)
    row = Column(String(10), nullable=False)
    number = Column(Integer, nullable=False)
    section = Column(String(50), nullable=True)
    seat_class = Column(Enum(SeatClass), default=SeatClass.ECONOMY)
    is_wheelchair_accessible = Column(Boolean, default=False)
    price = Column(Numeric(10, 2), nullable=False, default=0)
    status = Column(Enum(SeatStatus), default=SeatStatus.AVAILABLE, index=True)

    event = relationship("Event", back_populates="seats")
    booking = relationship("Booking", back_populates="seats")
    ticket_type = relationship("TicketType")
    locks = relationship("SeatLock", back_populates="seat", cascade="all, delete-orphan")
    __table_args__ = (Index("ix_seats_event_row_number", "event_id", "row", "number", unique=True),)

class SeatLock(Base):
    __tablename__ = "seat_locks"
    id = Column(Integer, primary_key=True, index=True)
    seat_id = Column(Integer, ForeignKey("seats.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    guest_session_id = Column(String(255), nullable=True)
    locked_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    lock_token = Column(String(36), unique=True, nullable=False, index=True)

    seat = relationship("Seat", back_populates="locks")
    user = relationship("User", back_populates="locks")

class PromoCode(Base):
    __tablename__ = "promo_codes"
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, nullable=False, index=True)
    discount_percentage = Column(Numeric(5, 2), nullable=False)
    valid_until = Column(DateTime(timezone=True), nullable=False)
    is_active = Column(Boolean, default=True)

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, index=True)
    admin_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    action = Column(String(255), nullable=False)
    target_entity = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())