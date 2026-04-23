from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from app.database import get_db
from app.auth import get_current_user
from app.models import Booking, Seat, User, SeatStatus, Event
from app.schemas import BookingResponse, BookingSeatInfo
from app import kafka_producer as kp

router = APIRouter(prefix="/api/bookings", tags=["bookings"])

@router.get("", response_model=List[BookingResponse])
async def get_my_bookings(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Fetch all past and upcoming bookings for the logged-in user."""
    # We use a join to pre-load the Event and Seats
    result = await db.execute(
        select(Booking)
        .where(Booking.user_id == current_user.id)
        .order_by(Booking.created_at.desc())
    )
    bookings = result.scalars().all()
    
    response_list = []
    for b in bookings:
        # Load event and seats manually for the response dict
        event = (await db.execute(select(Event).where(Event.id == b.event_id))).scalar_one()
        seats = (await db.execute(select(Seat).where(Seat.booking_id == b.id))).scalars().all()
        
        seat_infos = [
            BookingSeatInfo(
                id=s.id, row=s.row, number=s.number, section=s.section, 
                seat_class=s.seat_class.value, price=s.price, 
                ticket_type=s.ticket_type.name if s.ticket_type else "Standard"
            ) for s in seats
        ]
        
        response_list.append(BookingResponse(
            id=b.id, booking_reference=b.booking_reference, event_id=b.event_id,
            event_name=event.name, event_date=event.event_date, venue_name=event.venue_name,
            total_amount=b.total_amount, status=b.status, created_at=b.created_at, seats=seat_infos
        ))
    return response_list

@router.get("/{booking_id}", response_model=BookingResponse)
async def get_booking_ticket(booking_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Fetch a specific booking for rendering the PDF/Digital Ticket."""
    booking = (await db.execute(select(Booking).where(Booking.id == booking_id, Booking.user_id == current_user.id))).scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    event = (await db.execute(select(Event).where(Event.id == booking.event_id))).scalar_one()
    seats = (await db.execute(select(Seat).where(Seat.booking_id == booking.id))).scalars().all()
    
    seat_infos = [
        BookingSeatInfo(id=s.id, row=s.row, number=s.number, section=s.section, seat_class=s.seat_class.value, price=s.price, ticket_type=s.ticket_type.name if s.ticket_type else "Standard") 
        for s in seats
    ]
    
    return BookingResponse(
        id=booking.id, booking_reference=booking.booking_reference, event_id=booking.event_id,
        event_name=event.name, event_date=event.event_date, venue_name=event.venue_name,
        total_amount=booking.total_amount, status=booking.status, created_at=booking.created_at, seats=seat_infos
    )

@router.post("/{booking_id}/cancel")
async def cancel_booking(booking_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Cancel a booking and release all associated seats."""
    booking = (await db.execute(select(Booking).where(Booking.id == booking_id, Booking.user_id == current_user.id))).scalar_one_or_none()
    if not booking: raise HTTPException(status_code=404, detail="Booking not found")
    if booking.status == "cancelled": raise HTTPException(status_code=400, detail="Already cancelled")

    # Release Seats
    seats = (await db.execute(select(Seat).where(Seat.booking_id == booking.id))).scalars().all()
    for seat in seats:
        seat.status = SeatStatus.AVAILABLE
        seat.booking_id = None
        seat.ticket_type_id = None
        # Inform Kafka to notify WebSockets so the map updates live for everyone else!
        await kp.publish_seat_released(booking.event_id, seat.id, current_user.id, reason="booking_cancelled")

    booking.status = "cancelled"
    await db.commit()
    
    return {"message": "Booking cancelled successfully. Seats have been released.", "refund_amount": float(booking.total_amount)}