"""Initial migration: users, events, seats, seat_locks

Revision ID: 001
Create Date: 2024-01-01
"""

from alembic import op
import sqlalchemy as sa

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("picture", sa.Text(), nullable=True),
        sa.Column("google_id", sa.String(255), nullable=False, unique=True),
        sa.Column("is_active", sa.Boolean(), default=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.func.now()),
    )
    op.create_index("ix_users_email", "users", ["email"])
    op.create_index("ix_users_google_id", "users", ["google_id"])

    op.create_table(
        "events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("venue_name", sa.String(255), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("event_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("venue_layout", sa.Text(), nullable=True),
        sa.Column("lock_duration_minutes", sa.Integer(), default=10),
        sa.Column(
            "status",
            sa.Enum("draft", "active", "sold_out", "cancelled", name="eventstatus"),
            default="active",
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "seats",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("event_id", sa.Integer(), sa.ForeignKey("events.id", ondelete="CASCADE"), nullable=False),
        sa.Column("row", sa.String(10), nullable=False),
        sa.Column("number", sa.Integer(), nullable=False),
        sa.Column("section", sa.String(50), nullable=True),
        sa.Column("price", sa.Numeric(10, 2), nullable=False),
        sa.Column(
            "status",
            sa.Enum("available", "locked", "booked", name="seatstatus"),
            default="available",
        ),
    )
    op.create_index("ix_seats_event_id", "seats", ["event_id"])
    op.create_index("ix_seats_event_row_number", "seats", ["event_id", "row", "number"], unique=True)

    op.create_table(
        "seat_locks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("seat_id", sa.Integer(), sa.ForeignKey("seats.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("locked_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("lock_token", sa.String(36), nullable=False, unique=True),
    )
    op.create_index("ix_seat_locks_lock_token", "seat_locks", ["lock_token"], unique=True)
    op.create_index("ix_seat_locks_seat_expires", "seat_locks", ["seat_id", "expires_at"])
    op.create_index("ix_seat_locks_user_id", "seat_locks", ["user_id"])


def downgrade():
    op.drop_table("seat_locks")
    op.drop_table("seats")
    op.drop_table("events")
    op.drop_table("users")
    op.execute("DROP TYPE IF EXISTS eventstatus")
    op.execute("DROP TYPE IF EXISTS seatstatus")
