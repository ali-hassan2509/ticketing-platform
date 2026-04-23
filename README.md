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
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)

---

## ✨ Features

<table>
  <tr>
    <td width="50%">
      <h3>🎯 Real-time Seat Map</h3>
      <p>WebSocket connections per event with live seat status updates across all connected clients.</p>
    </td>
    <td width="50%">
      <h3>⏱️ 10-Minute Temporary Locks</h3>
      <p>Kafka-scheduled tasks with automatic expiry — seats release automatically when timer runs out.</p>
    </td>
  </tr>
  <tr>
    <td>
      <h3>⚡ Race Condition Prevention</h3>
      <p>PostgreSQL <code>SELECT FOR UPDATE SKIP LOCKED</code> ensures only one user can lock a seat at a time.</p>
    </td>
    <td>
      <h3>🚀 Redis Cache Layer</h3>
      <p>Fast seat availability checks with TTL-based lock caching, reducing database load.</p>
    </td>
  </tr>
  <tr>
    <td>
      <h3>🔐 Google OAuth 2.0</h3>
      <p>Secure authentication with JWT tokens (24-hour expiry) and automatic user profile sync.</p>
    </td>
    <td>
      <h3>👑 Admin Dashboard</h3>
      <p>Dynamic event creation with configurable pricing tiers and automatic seat generation.</p>
    </td>
  </tr>
  <tr>
    <td>
      <h3>📱 Responsive Seat Grid</h3>
      <p>Support for 1000+ seats with tooltips, visual status indicators, and animated countdown timers.</p>
    </td>
    <td>
      <h3>🧪 Load Testing Suite</h3>
      <p>Built-in concurrent locking simulation to validate race condition handling.</p>
    </td>
  </tr>
</table>

---

## 🏗️ Architecture

```mermaid
graph TB
    subgraph Client["🖥️ Client Layer"]
        React["React + Vite<br/>Zustand State"]
    end
    
    subgraph Gateway["🌐 Gateway Layer"]
        Nginx["Nginx<br/>Reverse Proxy"]
    end
    
    subgraph Backend["⚙️ Backend Layer"]
        FastAPI["FastAPI<br/>Async Endpoints"]
        WS["WebSocket Manager<br/>Event Broadcasting"]
        Auth["JWT Auth<br/>Google OAuth"]
    end
    
    subgraph Services["🗄️ Services Layer"]
        PG[("PostgreSQL 15<br/>SKIP LOCKED")]
        Redis[("Redis 7<br/>Lock Cache")]
        Kafka["Kafka<br/>Message Queue"]
    end
    
    subgraph Processing["🔄 Processing Layer"]
        Consumer["Kafka Consumer<br/>Expiry Scheduler"]
    end
    
    React -->|REST/WS| Nginx
    Nginx --> FastAPI
    Nginx --> WS
    FastAPI --> Auth
    FastAPI --> PG
    FastAPI --> Redis
    FastAPI -->|publish| Kafka
    Kafka --> Consumer
    Consumer -->|expire| PG
    Consumer -->|broadcast| WS
    WS -->|updates| React
    
    style Client fill:#1a1a2e,stroke:#16213e,color:#fff
    style Gateway fill:#16213e,stroke:#0f3460,color:#fff
    style Backend fill:#0f3460,stroke:#e94560,color:#fff
    style Services fill:#533483,stroke:#e94560,color:#fff
    style Processing fill:#e94560,stroke:#533483,color:#fff




Data Flow: Seat Locking

┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  User    │     │ Frontend │     │ Backend  │     │    DB    │     │  Kafka   │
│ Clicks   │     │(Optimistic│    │(SKIP     │     │(Row Lock)│     │Consumer  │
│ Seat     │────▶│ Update)   │────▶│ LOCKED)  │────▶│          │────▶│          │
└──────────┘     └──────────┘     └──────────┘     └──────────┘     └──────────┘
                                                                           │
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐           │
│  User    │     │  Other   │     │ WebSocket│     │  Redis   │           │
│ Sees     │◀────│ Clients  │◀────│ Broadcast│◀────│  Cache   │◀──────────┘
│ Lock     │     │ Update   │     │          │     │  Set TTL  │    Schedule
└──────────┘     └──────────┘     └──────────┘     └──────────┘   10min Expiry
                                                                           │
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐           │
│  Seat    │     │  Kafka   │     │ Backend  │     │  Lock    │           │
│ Released │◀────│ Consumer │◀────│ Expires  │◀────│ Expires  │◀──────────┘
│          │     │ (Timer)  │     │ Lock     │     │          │    Trigger
└──────────┘     └──────────┘     └──────────┘     └──────────┘    Expiry
