import string
import random
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.auth import get_optional_user
from app.models import Seat, TicketType, AddOn, PromoCode, Booking, SeatStatus
from app.schemas import ConfirmPaymentRequest
from app import kafka_producer as kp

router = APIRouter(prefix="/api/checkout", tags=["checkout"])

def generate_booking_ref():
    return "TKT-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=8))

@router.post("/confirm")
async def confirm_payment(req: ConfirmPaymentRequest, db: AsyncSession = Depends(get_db), auth: dict = Depends(get_optional_user)):
    user = auth["user"]
    result = await db.execute(select(Seat).where(Seat.id.in_(req.seat_ids)))
    seats = {s.id: s for s in result.scalars().all()}
    if len(seats) != len(req.seat_ids):
        raise HTTPException(status_code=400, detail="Invalid seats selected.")

    # Calculate Prices
    base_amount = 0.0
    ticket_modifiers = {}
    if req.ticket_types:
        tt_result = await db.execute(select(TicketType).where(TicketType.id.in_(req.ticket_types.values())))
        ticket_modifiers = {t.id: float(t.price_modifier) for t in tt_result.scalars().all()}

    for sid in req.seat_ids:
        price = float(seats[sid].price)
        t_id = req.ticket_types.get(str(sid)) or req.ticket_types.get(sid)
        if t_id and int(t_id) in ticket_modifiers: price += ticket_modifiers[int(t_id)]
        base_amount += price

    addon_amount = 0.0
    if req.add_ons:
        addon_result = await db.execute(select(AddOn).where(AddOn.id.in_([int(k) for k in req.add_ons.keys()])))
        addons = {a.id: float(a.price) for a in addon_result.scalars().all()}
        for a_id, qty in req.add_ons.items(): addon_amount += addons.get(int(a_id), 0.0) * int(qty)

    subtotal = base_amount + addon_amount
    discount = 0.0
    if req.promo_code:
        promo = (await db.execute(select(PromoCode).where(PromoCode.code == req.promo_code.upper()))).scalar_one_or_none()
        if promo and promo.is_active: discount = subtotal * (float(promo.discount_percentage) / 100.0)

    tax_amount = (subtotal - discount) * 0.10
    total_amount = (subtotal - discount) + tax_amount

    # Save Booking & Link Seats
    booking = Booking(
        booking_reference=generate_booking_ref(),
        event_id=req.event_id,
        user_id=user.id if user else None,
        guest_email=req.guest_email,
        guest_phone=req.guest_phone,
        total_amount=total_amount,
        tax_amount=tax_amount,
        status="confirmed"
    )
    db.add(booking)
    await db.flush() # Generate booking ID

    # Link Seats to Booking directly to avoid race conditions
    for sid in req.seat_ids:
        seat = seats[sid]
        seat.booking_id = booking.id
        t_id = req.ticket_types.get(str(sid)) or req.ticket_types.get(sid)
        if t_id: seat.ticket_type_id = int(t_id)
        seat.status = SeatStatus.BOOKED

    await db.commit()
    await kp.publish_payment_success(req.event_id, user.id if user else 0, req.seat_ids, float(total_amount))

    return {"status": "success", "booking_id": booking.id, "reference": booking.booking_reference}