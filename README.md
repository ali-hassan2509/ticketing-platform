<div align="center">
  <img src="https://img.shields.io/badge/status-production-00C853?style=for-the-badge" alt="Status" />
  <img src="https://img.shields.io/badge/version-1.0.0-2196F3?style=for-the-badge" alt="Version" />
  <img src="https://img.shields.io/badge/license-MIT-FF9800?style=for-the-badge" alt="License" />
</div>

<br />

<div align="center">
  <h1>🎟️ TicketPro</h1>
  <p><strong>Real-Time Seat Locking System for Modern Event Ticketing</strong></p>
  <p>A production-grade platform handling concurrent seat selection with 10-minute locks, WebSocket broadcasts, and Kafka-driven timeout management.</p>
</div>

<div align="center">
  <img src="https://skillicons.dev/icons?i=fastapi,react,postgres,redis,kafka,docker,nginx,tailwind" />
</div>

<br />

---

## 📋 Table of Contents

- [✨ Features](#-features)
- [🏗️ Architecture](#️-architecture)
- [🚀 Quick Start](#-quick-start)
- [📦 Services](#-services)
- [🔌 WebSocket API](#-websocket-api)
- [📡 REST API](#-rest-api)
- [🎨 Frontend Components](#-frontend-components)
- [🛠️ Development Commands](#️-development-commands)
- [🧪 Load Testing](#-load-testing)
- [📁 Project Structure](#-project-structure)
- [🔒 Security](#-security)
- [📈 Scaling Considerations](#-scaling-considerations)

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🎯 **Real-time Seat Map** | WebSocket connections per event with live seat status updates across all connected clients |
| ⏱️ **10-Minute Temporary Locks** | Kafka-scheduled tasks with automatic expiry — seats release automatically when timer runs out |
| ⚡ **Race Condition Prevention** | PostgreSQL `SELECT FOR UPDATE SKIP LOCKED` ensures only one user can lock a seat at a time |
| 🚀 **Redis Cache Layer** | Fast seat availability checks with TTL-based lock caching, reducing database load |
| 🔐 **Google OAuth 2.0** | Secure authentication with JWT tokens (24-hour expiry) and automatic user profile sync |
| 👑 **Admin Dashboard** | Dynamic event creation with configurable pricing tiers and automatic seat generation |
| 📱 **Responsive Seat Grid** | Support for 1000+ seats with tooltips, visual status indicators, and animated countdown timers |
| 🧪 **Load Testing Suite** | Built-in concurrent locking simulation to validate race condition handling |

---

## 🏗️ Architecture

### System Components

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Client** | React + Vite + Zustand | UI rendering, state management, WebSocket client |
| **Gateway** | Nginx | Reverse proxy, static file serving, API routing |
| **Backend** | FastAPI (Async) | REST endpoints, WebSocket server, business logic |
| **Database** | PostgreSQL 15 | Persistent storage with SKIP LOCKED for race prevention |
| **Cache** | Redis 7 | In-memory lock cache with TTL |
| **Message Queue** | Apache Kafka | Event streaming, lock expiry scheduling |
| **Consumer** | Kafka Consumer | Async lock timeout processing |

### Data Flow: Seat Locking

1.User clicks seat → Frontend optimistic update

2.POST /api/events/{id}/seats/lock

3.Backend: SELECT FOR UPDATE SKIP LOCKED
 ├─ Success → Insert lock, update Redis cache
 └─ Conflict → Return 409, frontend rolls back

4.Kafka message published → Consumer schedules asyncio.sleep(600s)

5.WebSocket broadcast → All clients see locked seat

6.After 10 minutes → Kafka consumer expires lock → WS broadcast


---

## 🚀 Quick Start

### Prerequisites

| Requirement | Version | Purpose |
|-------------|---------|---------|
| Docker & Compose | v2+ | Container orchestration |
| Google OAuth Credentials | - | Authentication |
| Git | latest | Version control |
| 4GB RAM | minimum | Running all services |

---

## Installation


# 1. Clone the repository
git clone https://github.com/YOUR_USERNAME/ticketing-platform.git
cd ticketing-platform

# 2. Configure environment variables
cp .env.example .env
# Edit .env and add your Google OAuth credentials

# 3. Start all services
docker compose up --build -d

# 4. Wait for services to initialize (approx. 30 seconds)

# 5. Run database migrations
docker compose exec backend alembic upgrade head

# 6. Seed test data (Taylor Swift concert with 1000 seats)
docker compose exec backend python seed.py

# 7. Open the application
open http://localhost

Default Admin Account
After seeding, you can access the admin panel:

Field	Value
Email	admin@ticketpro.com...
Password	admin123....
Admin URL	http://localhost/admin/login

---
## 📦 Services

|Service	|URL |Description|
|-----------|----|-----------|
|🎨 Frontend|	http://localhost	|React application with Tailwind CSS|
|🔧 Backend API |	http://localhost:8000/docs	| FastAPI interactive documentation|
|📊 Kafka UI	 | http://localhost:8080	| Monitor topics and messages|
|🐘 PostgreSQL |	localhost:5432	| Primary database|
|⚡ Redis	| localhost:6379	| Lock cache|
|📨 Kafka|	localhost:9092	|Message broker|

---

## 🔌 WebSocket API

# Connection

const ws = new WebSocket(`ws://localhost:8000/ws/${eventId}?token=${jwt}`);

# Server → Client Messages

// Initial state on connection
{
  type: 'initial_state',
  seats: [
    {
      id: 1,
      row: 'A',
      number: 12,
      price: 250.00,
      status: 'available' | 'locked' | 'booked',
      lock: {
        lock_token: 'uuid',
        user_id: 42,
        expires_at: '2024-01-15T10:30:00Z',
        locked_by_me: true
      }
    }
  ],
  user_locks: [{ seat_id: 1, lock_token: 'uuid' }]
}

// Seat locked by someone
{
  type: 'seat_locked',
  seat_id: 42,
  user_id: 7,
  expires_at: '2024-01-15T10:30:00Z',
  lock_token: 'uuid-v4'
}

// Seat released (manual)
{
  type: 'seat_released',
  seat_id: 42,
  user_id: 7,
  reason: 'manual'
}

// Lock expired (automatic)
{
  type: 'seat_expired',
  seat_id: 42,
  previously_locked_by: 7
}

// Keepalive heartbeat (every 25 seconds)
{
  type: 'heartbeat',
  timestamp: '2024-01-15T10:20:00Z'
}

# Client → Server

// Keepalive ping (send every 25 seconds)
{ type: 'ping' }

---

## 📡 REST API

## Authentication

|Method |	Endpoint	|Auth	 |Description|
|-------|---------------|--------|-----------|
|GET	   | /auth/google/login|	❌	|Redirect to Google OAuth consent screen|
|GET	| /auth/me	| ✅	|Get current authenticated user|
---

## Events

|Method	| Endpoint |	Auth	| Description|
|-------|----------|------------|------------|
|GET	 | /api/events	|❌	| List all events|
|GET	| /api/events/{id} |	❌	|Get event details|
|GET	| /api/events/{id}/seats	| ✅	|Get seat map with lock status|

---

## Seat Management


|Method |	Endpoint	| Auth	| Description|
|-------|---------------|-------|------------|
|POST |	/api/events/{id}/seats/lock |	✅	|Lock a seat|
|POST |	/api/events/{id}/seats/release|	✅	|Release your lock|
|GET  |	/api/me/locks	|✅	|Get your active locks|

---

## Admin


|Method |	Endpoint	|Auth	| Description|
|-------|---------------|-------|------------|
|POST   |/api/admin/login|	❌  | Admin authentication|
|POST   |/api/admin/events|✅ |(Admin) Create event with seat generation|

## Example Request

# Lock a seat
curl -X POST http://localhost:8000/api/events/1/seats/lock \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"seat_id": 42}'


## Example Response


{
  "seat_id": 42,
  "lock_token": "550e8400-e29b-41d4-a716-446655440000",
  "expires_at": "2024-01-15T10:30:00Z",
  "locked_at": "2024-01-15T10:20:00Z",
  "user_id": 7
}

---

## 🎨 Frontend Components

|Component |	File	|Description|
|----------|------------|-----------|
|Seat	| components/Seat.jsx	|Individual seat button with tooltip, status styling, and countdown timer |
|CountdownTimer| 	components/CountdownTimer.jsx	|MM:SS display with color progression (green → yellow → orange → red)|
|SelectedSeatsSidebar |	components/SelectedSeatsSidebar.jsx	| Cart sidebar showing selected seats with total price|
|Navbar |	components/Navbar.jsx	| Navigation with user profile, admin link, and sign out|
|ConnectionStatus	| components/ConnectionStatus.jsx |	WebSocket connection indicator with reconnect button|


# Custom Hooks


|Hook |	File	| Description|
|-----|---------|------------|
|useWebSocket	| hooks/useWebSocket.js |	Auto-reconnecting WebSocket with heartbeat and exponential backoff|
|useSeatLocking	| hooks/useSeatLocking.js |	Optimistic seat lock/release with rollback on failure|


## 🛠️ Development Commands

# Service Management
docker compose up --build -d    # Start all services
docker compose down             # Stop all services

# Logging
docker compose logs -f          # Follow all logs
docker compose logs -f backend  # Backend logs only

# Database
docker compose exec backend alembic upgrade head  # Run migrations
docker compose exec backend python seed.py        # Seed test data
docker compose exec postgres psql -U ticketing -d ticketing_db  # psql shell

# Backend Development
docker compose exec backend bash  # Open bash in backend container
docker compose up -d --build backend  # Rebuild backend after changes

# Testing
docker compose exec backend python load_test.py --users 20 --event 1  # Load test

# Cleanup
docker compose down -v  # Delete all volumes (WARNING: removes all data)

# Status
docker compose ps  # Show running container status


## 🧪 Load Testing

Run the concurrent seat locking simulation:

docker compose exec backend python load_test.py --users 20 --event 1

# What It Tests


|Test |	Scenario	| Expected Result|
|Concurrent Fight |	20 users try to lock the SAME seat simultaneously |	Only 1 succeeds, 19 receive 409 Conflict|
|Spread Locking	|Each user locks a DIFFERENT seat	| All 20 succeed|
|Response Time	|Measure average and max response times |	< 200ms average|


# Sample Output

============================================================
Concurrent seat locking test
  URL:      http://localhost:8000
  Event:    1
  Users:    20
  Target:   seat 1 (all 20 users fight for it)
============================================================

Firing 20 concurrent lock requests for seat 1…

────────────────────────────────────────
Results (completed in 234ms total):
  ✅ Locked successfully: 1
  ⚡ Conflicts (409):     19
  ❌ Errors:              0

Status code breakdown: {200: 1, 409: 19}
Response times: avg=45ms, max=78ms

✅ PASS: Exactly 1 user acquired the lock (user 7)
============================================================
---
## 📁 Project Structure

### Backend Structure

| Path | Description |
|------|-------------|
| `backend/app/main.py` | FastAPI application entry point |
| `backend/app/auth.py` | Google OAuth + JWT authentication |
| `backend/app/seat_service.py` | Core seat locking logic (SKIP LOCKED) |
| `backend/app/kafka_producer.py` | Publishes seat events to Kafka |
| `backend/app/kafka_consumer.py` | Schedules 10-minute lock expiry |
| `backend/app/websocket_manager.py` | Broadcasts real-time seat updates |
| `backend/app/redis_client.py` | Lock cache with 10-minute TTL |
| `backend/app/models.py` | SQLAlchemy database models |
| `backend/seed.py` | Generates test events and 1000+ seats |
| `backend/load_test.py` | Concurrent locking simulation |

### Frontend Structure

| Path | Description |
|------|-------------|
| `frontend/src/App.jsx` | Routing and authentication state |
| `frontend/src/store/seatStore.js` | Zustand state for all seats |
| `frontend/src/hooks/useWebSocket.js` | Auto-reconnecting WebSocket |
| `frontend/src/hooks/useSeatLocking.js` | Optimistic lock with rollback |
| `frontend/src/components/Seat.jsx` | Individual seat with timer |
| `frontend/src/components/CountdownTimer.jsx` | Color-changing countdown |
| `frontend/src/pages/EventSeatMap.jsx` | Main seat grid view |
| `frontend/src/pages/Checkout.jsx` | Payment simulation |
| `frontend/src/services/api.js` | Axios with JWT interceptor |

## 🔒 Security

|Concern |	Implementation|
|--------|----------------|
|Authentication	|Google OAuth 2.0 with JWT (HS256)|
|Token Expiry	| 24 hours (configurable)|
|Lock Tokens |	UUID v4 (cryptographically random)|
|Lock Ownership	| Validated on release — users cannot release others' locks|
|Race Conditions	| PostgreSQL SELECT FOR UPDATE SKIP LOCKED|
|CORS |	Whitelist restricted to FRONTEND_URL|
|Password Hashing | bcrypt for admin accounts|
|Environment Variables |	.env excluded from version control|


## 📈 Scaling Considerations

# Horizontal Scaling Strategies

|Component| Scaling Approach|
|Backend (FastAPI)|	Stateless — add multiple instances behind load balancer|
|WebSocket| Use Redis Pub/Sub for cross-instance broadcast|
|Database|	Read replicas for seat queries; primary for writes|
|Redis| Cluster mode for high availability|
|Kafka| Increase partitions for parallel processing|

## Performance Tuning


# Database connection pool
engine = create_async_engine(
    DATABASE_URL,
    pool_size=20,        # Concurrent DB connections
    max_overflow=40,     # Additional connections under load
    pool_pre_ping=True,  # Verify connections before using
    pool_recycle=3600,   # Refresh connections hourly
)


## 📄 License

MIT License - see repository for details.

<div align="center"> <p>Built with ❤️ by the TicketPro Team</p> <p> <a href="https://github.com/YOUR_USERNAME/ticketing-platform/issues">Report Bug</a> • <a href="https://github.com/YOUR_USERNAME/ticketing-platform/issues">Request Feature</a> </p> </div> ```
