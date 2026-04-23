"""
Seed script: Taylor Swift concert with 1000 seats (rows A-T, 50 seats each).
Run: python seed.py
"""

import asyncio
import os
from datetime import datetime, timedelta
from decimal import Decimal

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import select

# Load .env if available
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://ticketing:ticketing_pass@postgres:5432/ticketing_db"
)

engine = create_async_engine(DATABASE_URL, echo=False)
SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

ROWS = list("ABCDEFGHIJKLMNOPQRST")   # A–T (20 rows)
SEATS_PER_ROW = 50                     # 50 seats per row = 1000 total

# Pricing tiers based on row proximity to stage
PRICE_TIERS = {
    frozenset("ABCD"):   Decimal("250.00"),   # Front rows — premium
    frozenset("EFGH"):   Decimal("175.00"),
    frozenset("IJKL"):   Decimal("125.00"),
    frozenset("MNOP"):   Decimal("85.00"),
    frozenset("QRST"):   Decimal("55.00"),    # Back rows
}

def get_price(row: str) -> Decimal:
    for tier_set, price in PRICE_TIERS.items():
        if row in tier_set:
            return price
    return Decimal("75.00")

def get_section(row: str) -> str:
    idx = ROWS.index(row)
    if idx < 4:    return "Floor — Front"
    if idx < 8:    return "Floor — Mid"
    if idx < 12:   return "Lower Bowl"
    if idx < 16:   return "Upper Bowl"
    return "Upper Deck"


async def seed():
    import sys, os
    sys.path.insert(0, os.path.dirname(__file__))
    from app.database import Base
    from app.models import User, Event, Seat, TicketType, AddOn, PromoCode, EventCategory, SeatClass

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with SessionLocal() as db:
        # ── Users ────────────────────────────────────────────
        existing_user = await db.execute(select(User).where(User.email == "admin@ticketpro.com"))
        if not existing_user.scalar_one_or_none():
            from passlib.context import CryptContext
            pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
            hashed_pw = pwd_context.hash("admin123")
            admin = User(
                email="admin@ticketpro.com",
                name="Admin User",
                google_id="admin_google_id_001",
                is_admin=True,
                hashed_password=hashed_pw
            )
            db.add(admin)
            await db.flush()
            print(f"✅ Created admin (admin@ticketpro.com / admin123)")
        else:
            print("⏭  Admin already exists — skipping")

        # ── Event ────────────────────────────────────────────
        existing_event = await db.execute(select(Event).where(Event.name == "Taylor Swift — The Eras Tour"))
        event = existing_event.scalar_one_or_none()

        if not event:
            event = Event(
                name="Taylor Swift — The Eras Tour",
                category=EventCategory.EVENT,
                destination="Los Angeles, CA",
                venue_name="SoFi Stadium",
                description="A once-in-a-lifetime concert experience spanning Taylor's entire musical catalog.",
                event_date=datetime.utcnow() + timedelta(days=30),
                lock_duration_minutes=10,
                status="active",
            )
            db.add(event)
            await db.flush() # Extremely important: flushes the event to generate the event.id!
            print(f"✅ Created event: {event.name} (id={event.id})")
            
            # ── Seats ─────────────────────────────────────────────
            seat_count = 0
            for row in ROWS:
                for number in range(1, SEATS_PER_ROW + 1):
                    # Make rows A-D VIP Class, rest are Economy
                    seat_cls = SeatClass.VIP if row in "ABCD" else SeatClass.ECONOMY
                    
                    seat = Seat(
                        event_id=event.id,
                        row=row,
                        number=number,
                        section=get_section(row),
                        seat_class=seat_cls,
                        price=get_price(row),
                        status="available",
                    )
                    db.add(seat)
                    seat_count += 1
            
            # ── Ticket Types, Add-ons & Promos ────────────────────
            db.add_all([
                TicketType(event_id=event.id, name="Adult", price_modifier=0.00),
                TicketType(event_id=event.id, name="Child", price_modifier=-20.00),
                TicketType(event_id=event.id, name="VIP Upgrade", price_modifier=50.00),
                
                AddOn(event_id=event.id, name="Pre-paid Parking", price=25.00),
                AddOn(event_id=event.id, name="Fast-Track Entry", price=15.00),
                AddOn(event_id=event.id, name="Popcorn & Drink", price=12.00)
            ])

            await db.commit()
            print(f"✅ Created {seat_count} seats, along with Add-ons and Ticket Types")
        else:
            print(f"⏭  Event already exists (id={event.id}) — skipping seats")

        # Create Promo Code (Safe to run multiple times)
        existing_promo = await db.execute(select(PromoCode).where(PromoCode.code == "TICKETPRO20"))
        if not existing_promo.scalar_one_or_none():
            db.add(PromoCode(code="TICKETPRO20", discount_percentage=20.0, valid_until=datetime.utcnow() + timedelta(days=365)))
            await db.commit()
            print("✅ Created Promo Code: TICKETPRO20")

        print(f"\n🎉 Seed complete!")
        print(f"   Home URL:  http://localhost:5173")
        print(f"   API Docs:  http://localhost:8000/docs")
        print(f"   Kafka UI:  http://localhost:8080")


if __name__ == "__main__":
    asyncio.run(seed())