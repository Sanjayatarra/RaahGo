# RaahGo Platform: Comprehensive Technical Documentation & Architecture Manual

> **Document Version:** 2.4.0
> **System Classification:** Real-Time Ride-Hailing, Courier Logistics, & Fleet Management System
> **Target Environment:** Development, Staging & Production Deployment
> **Last Updated:** October 2026

---

## Table of Contents

1. [Executive Overview &amp; Platform Vision](#1-executive-overview--platform-vision)
2. [End-to-End System Architecture](#2-end-to-end-system-architecture)
3. [Technology Stack &amp; Infrastructure](#3-technology-stack--infrastructure)
4. [Complete Project Directory Structure](#4-complete-project-directory-structure)
5. [Database Architecture &amp; Entity-Relationship Model](#5-database-architecture--entity-relationship-model)
6. [Core Technical Pipelines](#6-core-technical-pipelines)
   - 6.1 [Geospatial &amp; Presence Telemetry Pipeline](#61-geospatial--presence-telemetry-pipeline)
   - 6.2 [Matching &amp; Auto-Dispatch Pipeline](#62-matching--auto-dispatch-pipeline)
   - 6.3 [Transactional Outbox &amp; Event-Driven Push Pipeline](#63-transactional-outbox--event-driven-push-pipeline)
7. [System Processors &amp; User Journey Lifecycles](#7-system-processors--user-journey-lifecycles)
   - 7.1 [Customer Lifecycle Processor](#71-customer-lifecycle-processor)
   - 7.2 [Driver (Captain) Lifecycle Processor](#72-driver-captain-lifecycle-processor)
   - 7.3 [Admin Operations &amp; Governance Processor](#73-admin-operations--governance-processor)
8. [Comprehensive Security Vulnerability Assessment](#8-comprehensive-security-vulnerability-assessment)
   - 8.1 [Vulnerability Summary &amp; Risk Matrix](#81-vulnerability-summary--risk-matrix)
   - 8.2 [Detailed Vulnerability Breakdown &amp; Code Proof-of-Concepts](#82-detailed-vulnerability-breakdown--code-proof-of-concepts)
   - 8.3 [Production Remediation &amp; Hardening Roadmap](#83-production-remediation--hardening-roadmap)
9. [Project Progress Scorecard: Completed vs. Pending](#9-project-progress-scorecard-completed-vs-pending)
10. [High-Scale Traffic Management &amp; Concurrency Blueprint](#10-high-scale-traffic-management--concurrency-blueprint)
    - 10.1 [Load Balancing &amp; Ingress Architecture](#101-load-balancing--ingress-architecture)
    - 10.2 [WebSocket &amp; Real-Time Telemetry Scaling](#102-websocket--real-time-telemetry-scaling)
    - 10.3 [Database Read/Write Splitting &amp; Caching Layer](#103-database-readwrite-splitting--caching-layer)
    - 10.4 [Rate Limiting &amp; Abuse Prevention](#104-rate-limiting--abuse-prevention)
11. [Operations &amp; Deployment Runbook](#11-operations--deployment-runbook)

---

## 1. Executive Overview & Platform Vision

**RaahGo** is a multi-modal on-demand mobility and logistics ecosystem engineered to support point-to-point passenger transit (Bikes, Autos, Cabs, Premium Sedans), parcel courier deliveries, and moving services.

The architecture is built upon high-throughput asynchronous communication, real-time spatial indexing, atomic resource reservation, and transactional outbox event distribution to ensure zero lost state across rides, payments, and driver locations.

### Key Capabilities

- **Sub-100ms Driver Location Ingestion:** Low-latency driver coordinates streaming via WebSockets and Redis in-memory storage, decoupling write-heavy GPS pulses from the relational database.
- **Atomic Multi-Candidate Dispatch:** Radius-expansion matching engine with Redis `SET NX EX` distributed lock reservations to prevent multiple drivers from colliding over identical ride offers.
- **Guaranteed Event Delivery:** Relational Transactional Outbox pattern that eliminates distributed race conditions across MySQL, Redis, WebSockets, and Firebase Cloud Messaging (FCM).
- **Automated Captain Onboarding:** OCR-driven driver KYC pipeline with document parsing and automated compliance checks (license validity, vehicle registration, minimum age).
- **Comprehensive Administration:** Real-time situational map, tariff controls, dynamic surge configuration, financial ledgers, and emergency SOS incident dispatch.

---

## 2. End-to-End System Architecture

RaahGo adopts a modern decoupled architecture where asynchronous WebSocket connections, long-running background daemons, synchronous REST API calls, and in-memory spatial caches function in harmony.

```mermaid
flowchart TB
    subgraph Clients["Client Ecosystem"]
        CustWeb["Customer Web App\n(React 19 + Vite)"]
        DrivWeb["Driver Web App\n(React 19 + Vite)"]
        AdminWeb["Admin Operations Portal\n(React 19 + Vite)"]
        CustMob["Customer Mobile App\n(Planned React Native)"]
        DrivMob["Driver Mobile App\n(Planned React Native)"]
    end

    subgraph Gateway["Edge & Ingress"]
        Nginx["Nginx Reverse Proxy / SSL Termination"]
    end

    subgraph AppServers["Application Runtime Layer"]
        Daphne["Daphne ASGI Server\n(:8000)"]
        Gunicorn["Gunicorn WSGI Cluster\n(API Endpoints)"]
    end

    subgraph CoreServices["Django Application Core (Apps/)"]
        AuthApp["users\n(JWT & Auth)"]
        BookingApp["bookings\n(Lifecycle & Dispatch)"]
        DriverApp["drivers\n(Onboarding & KYC)"]
        TrackingApp["tracking\n(WebSocket Consumers)"]
        PaymentApp["payments & wallets\n(Transactions)"]
    end

    subgraph BackgroundWorkers["Background Daemons"]
        MatchingWorker["Matching Worker Daemon\n(run_matching_worker)"]
        OutboxWorker["Transactional Outbox Worker\n(process_outbox)"]
    end

    subgraph Persistence["Storage & Messaging Infrastructure"]
        RedisSpatial["Redis In-Memory Engine\n- Redis Channels (Pub/Sub)\n- Geospatial Index (GEOADD/GEOSEARCH)\n- Ephemeral Presence & Heartbeats\n- Atomic Locks (SET NX EX)"]
        MySQLDB["MySQL Primary Database (InnoDB)\n- Users, Drivers, Vehicles\n- Bookings, Tracking History\n- Outbox Messages, Wallets\n- Financial Transactions"]
        FCM["Firebase Cloud Messaging (FCM)\n(Push Notifications)"]
    end

    CustWeb <-->|REST & WS| Nginx
    DrivWeb <-->|REST & WS| Nginx
    AdminWeb <-->|REST & WS| Nginx
    CustMob -.->|Future WS/REST| Nginx
    DrivMob -.->|Future WS/REST| Nginx

    Nginx -->|WebSocket /ws/v1/*| Daphne
    Nginx -->|HTTP /api/v1/*| Daphne

    Daphne --> TrackingApp
    Daphne --> CoreServices

    TrackingApp <-->|Presence / Live Coordinates| RedisSpatial
    CoreServices <-->|Read / Write ACID State| MySQLDB
    CoreServices -->|Outbox Insertion| MySQLDB

    MatchingWorker -->|Poll Searching Rides| MySQLDB
    MatchingWorker -->|GEOSEARCH & Lock Reservation| RedisSpatial
    MatchingWorker -->|Trigger Push Events| OutboxWorker

    OutboxWorker -->|Read Pending Outbox| MySQLDB
    OutboxWorker -->|Dispatch WebSocket Events| RedisSpatial
    OutboxWorker -->|Dispatch Mobile Alerts| FCM
    RedisSpatial -->|Broadcast to Groups| Daphne
```

---

## 3. Technology Stack & Infrastructure

| Layer                         | Component                     | Version / Specification | Role in System                                    |
| ----------------------------- | ----------------------------- | ----------------------- | ------------------------------------------------- |
| **Backend Framework**   | Django                        | 5.2 / 6.0               | Primary backend web application & ORM             |
| **API Layer**           | Django REST Framework         | 3.17.1                  | RESTful JSON endpoints for client applications    |
| **Authentication**      | djangorestframework-simplejwt | 5.5.1                   | Single-device JWT authentication with rotation    |
| **Asynchronous Engine** | Django Channels + Daphne      | 4.x / 3.x               | Real-time WebSocket connection handling           |
| **Channel Layer**       | channels-redis                | 4.x                     | Redis-backed distributed pub/sub broker           |
| **In-Memory Store**     | Redis                         | 7.x                     | Spatial indexing (`GEOSEARCH`), presence, locks |
| **Relational Database** | MySQL                         | 8.0+ (InnoDB)           | ACID authoritative storage (`raahgo_db`)        |
| **OCR Service**         | PaddleOCR                     | v2.6+                   | Automated KYC driver license & document scanning  |
| **Push Notifications**  | Firebase Admin SDK            | 6.x                     | Push notifications for mobile devices             |
| **Admin Frontend**      | React + Vite + TailwindCSS    | React 19, Vite 6        | Real-time Operations & Governance Dashboard       |
| **Customer Web**        | React + Vite + TailwindCSS    | React 19, Vite 6        | Booking interface, ride tracking & wallet         |
| **Driver Web**          | React + Vite + TailwindCSS    | React 19, Vite 6        | Captain shift toggle, offer acceptance, trip HUD  |

---

## 4. Complete Project Directory Structure

```text
RaahGo/
├── Apps/
│   ├── bookings/                       # Core ride request lifecycle & dispatch
│   │   ├── management/commands/
│   │   │   ├── process_outbox.py       # Outbox event distributor background daemon
│   │   │   └── run_matching_worker.py  # Spatial search & offer lifecycle worker
│   │   ├── matching_service.py         # Geo-proximity matching & reservation logic
│   │   ├── models.py                   # Booking, RideOffer, OutboxMessage, Details
│   │   ├── outbox_service.py           # Transactional event recorder & dispatcher
│   │   ├── serializers.py              # DRF serialization models
│   │   ├── urls.py                     # /api/v1/bookings/ endpoints
│   │   └── views.py                    # Ride CRUD, Fare Calculation, Start/Complete
│   ├── common/                         # Shared utilities, base models, pagination
│   ├── coupons/                        # Discounts, coupon codes, and campaigns
│   ├── drivers/                        # Driver registry, KYC verification, fleet
│   │   ├── driver_api_urls.py          # /api/v1/driver/ endpoints (dedicated app)
│   │   ├── driver_api_views.py         # Driver shift, offers, earnings, telemetry
│   │   ├── models.py                   # Driver, DriverDocument, BankAccount, Contact
│   │   ├── urls.py                     # Generic /api/v1/drivers/ CRUD routes
│   │   └── views.py                    # Onboarding, OCR parser integration
│   ├── notifications/                  # In-app alerts and push services
│   │   ├── fcm_service.py              # Firebase Admin SDK notification client
│   │   └── models.py                   # Notification persistence
│   ├── payments/                       # Gateway integration & refunds
│   │   ├── models.py                   # Payment, Refund records
│   │   ├── urls.py                     # /api/v1/payments/ routes
│   │   └── views.py                    # Order creation and verification
│   ├── reviews/                        # Rating stars and customer/driver feedback
│   ├── services/                       # Service categories (City Ride, Parcel, Movers)
│   ├── tracking/                       # Real-time WebSocket communications & Redis
│   │   ├── channels_middleware.py      # JWT authentication for WebSockets
│   │   ├── consumers.py                # DriverSocketConsumer & CustomerSocketConsumer
│   │   ├── redis_client.py             # Spatial index (GEOADD), Presence, Locks
│   │   ├── routing.py                  # ws/v1/driver/socket & ws/v1/customer/socket
│   │   └── urls.py                     # Fallback HTTP tracking endpoints
│   ├── users/                          # User identity, address books, and Admin APIs
│   │   ├── admin_api_views.py          # Complete suite of operations admin APIs
│   │   ├── admin_urls.py               # /api/admin/ endpoints
│   │   ├── authentication.py           # SingleDeviceJWTAuthentication handler
│   │   ├── customer_api_views.py       # Customer addresses, rides, wallet, coins
│   │   ├── customer_urls.py            # /api/v1/customer/ endpoints
│   │   ├── customer_views.py           # Customer OTP & Auth lifecycle
│   │   ├── driver_auth_views.py        # Driver OTP & registration controllers
│   │   └── models.py                   # User, UserAddress, OTPVerification, SystemSetting
│   ├── vehicles/                       # Vehicle types, tariffs, vehicle registration
│   └── wallets/                        # Wallet balance, deposits, ledger transactions
├── frontend/
│   ├── admin-frontend/                 # Full Operations Dashboard (Vite + React)
│   ├── customer-frontend/              # Rider Web Interface (Vite + React)
│   ├── driver-frontend/                # Captain Web HUD (Vite + React)
│   ├── mobile-customer/                # Mobile customer skeleton
│   └── mobile-driver/                  # Mobile driver skeleton
├── project/                            # Django project configuration
│   ├── asgi.py                         # ASGI router (ProtocolTypeRouter: HTTP + WS)
│   ├── settings.py                     # Core settings, database, channels, JWT
│   ├── urls.py                         # Root URL routing hub
│   └── wsgi.py                         # WSGI deployment hook
├── manage.py                           # Django CLI entrypoint
├── requirement.txt                     # Python pip dependency definitions
└── .env                                # Environment configurations & secrets
```

---

## 5. Database Architecture & Entity-Relationship Model

The MySQL database schema (`raahgo_db`) models relationships between user identities, specialized driver profiles, vehicle types, bookings, real-time tracking audit logs, wallets, and outbox messages.

```mermaid
erDiagram
    User ||--o{ Booking : "requests as customer"
    User ||--o| Driver : "operates as captain"
    User ||--o{ UserAddress : "saved places"
    User ||--o{ OTPVerification : "receives"
    User ||--o{ UserDevice : "registers device"
    User ||--o| Wallet : "owns"
    User ||--o{ Notification : "receives"

    Driver ||--o{ DriverDocument : "uploads KYC"
    Driver ||--o{ DriverBankAccount : "bank accounts"
    Driver ||--o{ DriverEmergencyContact : "contacts"
    Driver ||--o{ Vehicle : "operates"
    Driver ||--o{ Booking : "fulfills as driver"
    Driver ||--o{ DriverLocation : "location history"
    Driver ||--o{ RideOffer : "receives offers"
    Driver ||--o{ Rating : "rated by customers"

    VehicleType ||--o{ Vehicle : "categorizes"
    VehicleType ||--o{ Booking : "determines tariff"
    Service ||--o{ Booking : "specifies service mode"

    Booking ||--o| RideDetail : "passenger count & notes"
    Booking ||--o| ParcelDetail : "courier info"
    Booking ||--o| MovingDetail : "relocation specs"
    Booking ||--o{ BookingTracking : "audit trail"
    Booking ||--o{ RideOffer : "broadcasts offers"
    Booking ||--o{ Payment : "generates payment"
    Booking ||--o{ Rating : "reviewed upon complete"

    Payment ||--o{ Refund : "can be refunded"
    Wallet ||--o{ WalletTransaction : "ledger entries"
```

### Key Data Models & Schemas

| Model              | Table                | Core Fields                                                                                                                             | Primary Function                                                       |
| ------------------ | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `User`           | `users`            | `id`, `phone_number`, `email`, `role`, `is_active`, `is_verified`                                                           | Core identity for Customers, Drivers, and Admins                       |
| `Driver`         | `drivers`          | `id`, `user_id`, `license_number`, `approval_status`, `availability_status`, `rating`                                       | Captain verification status, online state, and telemetry cache         |
| `VehicleType`    | `vehicle_types`    | `name`, `base_fare`, `per_km_rate`, `per_minute_rate`, `capacity_passengers`                                                  | Fare pricing matrix and vehicle categorization                         |
| `Booking`        | `bookings`         | `booking_number`, `customer_id`, `driver_id`, `status`, `pickup_latitude`, `pickup_longitude`, `total_fare`, `ride_pin` | Authoritative state machine for rides and deliveries                   |
| `RideOffer`      | `ride_offers`      | `booking_id`, `driver_id`, `status`, `reservation_token`, `expires_at`                                                        | Tracks broadcasted offers and prevents double-booking                  |
| `OutboxMessage`  | `outbox_messages`  | `event_type`, `payload`, `status`, `retry_count`, `created_at`, `processed_at`                                              | Durable transactional queue for reliable asynchronous pushes           |
| `DriverDocument` | `driver_documents` | `driver_id`, `document_type`, `document_url`, `expiry_date`, `verification_status`                                            | Storage and verification audit for driving licenses, RC, and insurance |
| `Wallet`         | `wallets`          | `user_id`, `balance`, `currency`                                                                                                  | User and captain digital account balance                               |

---

## 6. Core Technical Pipelines

### 6.1 Geospatial & Presence Telemetry Pipeline

High-frequency driver GPS pings must never overload the relational database. RaahGo implements a decoupled spatial telemetry pipeline using Redis:

```mermaid
sequenceDiagram
    autonumber
    actor DriverApp as Driver App
    participant WS as WebSocket Consumer (DriverSocketConsumer)
    participant Redis as Redis Engine (Presence & GEO)
    participant Outbox as Outbox Dispatcher
    actor CustApp as Customer App

    DriverApp->>WS: Send JSON: { type: "location_update", lat, lng, speed, heading, active_ride_id }
    WS->>Redis: RedisPresenceService.update_driver_location()
    Note over Redis: 1. GEOADD drivers:geo <lng> <lat> <driver_id><br/>2. GEOADD drivers:geo:<vehicle> <lng> <lat> <driver_id><br/>3. HSET driver:presence:<driver_id> (TTL 60s)
    WS-->>DriverApp: ACK: { event: "location_ack", status: "received" }

    opt Driver is on Active Ride
        WS->>Redis: channel_layer.group_send(ride_<booking_id>, payload)
        Redis->>CustApp: Push live coordinates to Customer WebSocket
    end
```

1. **Sub-Second Telemetry Ingestion:** The driver client transmits coordinates over `/ws/v1/driver/socket/`.
2. **In-Memory Spatial Indexing:** `RedisPresenceService` records the position in `drivers:geo` and `drivers:geo:<vehicle_type>` using high-performance 52-bit geohashes.
3. **Presence Freshness & Heartbeats:** Driver state is stored in a Redis Hash with a strict 60-second TTL. If a driver loses internet connection, their presence automatically expires without manual intervention.
4. **Stale Member Eviction:** `run_matching_worker` runs a background task every 15 seconds to purge members whose last heartbeat exceeds 30 seconds (`ZREM` from GEO keys).

---

### 6.2 Matching & Auto-Dispatch Pipeline

When a customer confirms a ride, the matching engine executes an automated multi-candidate dispatch loop designed to ensure fast pick-ups and fair distribution:

```mermaid
flowchart TD
    Start([Booking Created: Status = Searching]) --> ReadConfig[Read Matching Config:\nRadius: 2.0km -> 5.0km\nWindow: 15s | Deadline: 60s\nBatch Size: Top 3 Drivers]
    ReadConfig --> GeoSearch[Redis GEOSEARCH around Pickup Coordinates]
    GeoSearch --> FilterEligible{Filter Candidates:\n1. Vehicle Type matches\n2. Status == ONLINE\n3. Heartbeat Fresh (<30s)\n4. Not currently reserved\n5. Not rejected in earlier batch}
  
    FilterEligible -- Less than 3 drivers & Radius < 5km --> ExpandRadius[Expand Search Radius to 5.0 km]
    ExpandRadius --> GeoSearch
  
    FilterEligible -- Candidates Found --> AtomicLock[Acquire Redis Distributed Reservation:\nSET driver:reservation:driver_id token NX EX 18s]
    AtomicLock --> CreateOffers[Create MySQL RideOffer Records\nStatus: Pending | ExpiresAt: Now + 15s]
    CreateOffers --> PushAlerts[Dispatch WebSocket 'ride_offer'\n& Trigger FCM Background Push]
  
    PushAlerts --> MonitorWindow{Monitor 15s Window}
  
    MonitorWindow -- Driver Accepts --> RideAssigned[Mark Booking = Accepted\nRelease other reservations\nSend 'ride_assigned' to Customer]
    MonitorWindow -- Customer Cancels --> AbortRide[Mark Booking = Cancelled\nRelease all reservations]
    MonitorWindow -- 15s Expired & No Acceptance --> ExpireBatch[Expire batch offers\nRelease Redis reservations\nAdd drivers to rejected list]
  
    ExpireBatch --> CheckDeadline{Overall Deadline > 60s?}
    CheckDeadline -- No --> GeoSearch
    CheckDeadline -- Yes --> TerminalTimeout[Mark Booking = Cancelled\nDispatch 'no_driver_available' to Customer]
```

#### Atomic Multi-Offer Reservation Algorithm

- To prevent a driver from receiving multiple overlapping offers while deciding, an atomic distributed lock is registered in Redis:
  ```redis
  SET driver:reservation:<driver_id> <uuid_token> NX EX 18
  ```
- If another matching loop attempts to evaluate the same driver, the `NX` condition fails, skipping that driver and preserving candidate isolation.
- When an offer is expired or rejected, a Lua script ensures safe deletion only if the active token matches:
  ```lua
  if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
  else
      return 0
  end
  ```

---

### 6.3 Transactional Outbox & Event-Driven Push Pipeline

Directly dispatching WebSockets and FCM network calls inside an active database transaction creates latency and vulnerability to partial failures (e.g., database commits but push fails, or push succeeds but database rolls back).

RaahGo solves this with the **Transactional Outbox Pattern**:

```mermaid
sequenceDiagram
    autonumber
    participant App as API Controller / Service
    participant DB as MySQL Database
    participant OutboxService as Outbox Dispatcher
    participant Worker as Background process_outbox
    participant WS as Channels Redis Layer
    participant FCM as Firebase Cloud Messaging

    App->>DB: BEGIN TRANSACTION
    App->>DB: UPDATE bookings SET status = 'Accepted', driver_id = '...'
    App->>DB: INSERT INTO outbox_messages (event_type, payload, status='Pending')
    App->>DB: COMMIT TRANSACTION
  
    Note over App,OutboxService: Post-Commit Hook triggers immediate dispatch
    App->>OutboxService: transaction.on_commit(dispatch_message_safely)
  
    alt Immediate Dispatch Succeeds
        OutboxService->>WS: Push to driver_<id> & customer_<id>
        OutboxService->>FCM: Transmit Mobile Push Notification
        OutboxService->>DB: UPDATE outbox_messages SET status = 'Processed'
    else Worker Crash or Network Glitch
        Note over Worker,DB: Fallback Worker sweeps unprocessed events every 1 second
        Worker->>DB: SELECT * FROM outbox_messages WHERE status = 'Pending' LIMIT 50
        Worker->>WS: Push to Channels Group
        Worker->>FCM: Transmit Push Notification
        Worker->>DB: UPDATE outbox_messages SET status = 'Processed'
    end
```

---

## 7. System Processors & User Journey Lifecycles

### 7.1 Customer Lifecycle Processor

```mermaid
stateDiagram-v2
    [*] --> Unauthenticated
    Unauthenticated --> Authenticated : OTP Verified via /api/v1/customer/auth/verify-otp/
    Authenticated --> SelectingRide : Enter Pickup/Dropoff, Query /rides/fare-estimate/
    SelectingRide --> Searching : POST /api/v1/bookings/ (Create Ride)
  
    state Searching {
        [*] --> PollingNearbyCaptains
        PollingNearbyCaptains --> RadiusExpansion : <3 Captains Available
        RadiusExpansion --> WaitingForAcceptance : Broadcast Offer to Captains
    }

    Searching --> Cancelled : Customer Aborts OR 60s Deadline Elapsed (No Driver)
    Searching --> Accepted : Captain Accepts Offer
  
    Accepted --> Arrived : Captain Reaches Pickup Location
    Arrived --> InTrip : Captain Inputs Customer Ride PIN (4 Digits)
    InTrip --> Completed : Captain Reaches Dropoff & Triggers Complete
    Completed --> Rated : Customer Submits Rating & Review
    Rated --> [*]
    Cancelled --> [*]
```

#### Detailed Customer Journey Breakdown:

1. **Authentication:** Customer provides phone or email. System issues a 4-digit OTP. Upon verification, client receives access & refresh JWT tokens.
2. **Ride Configuration & Estimation:**
   - Geocoding and reverse geocoding via `/api/v1/customer/location/reverse-geocode/`.
   - Client calls `/api/v1/customer/rides/fare-estimate/` with coordinates to get calculated fares for Bike, Auto, Sedan, and SUV.
3. **Dispatch & Tracking:**
   - Client executes `POST /api/v1/bookings/`.
   - Ride status initializes to `Searching`. The customer web socket `/ws/v1/customer/socket/` joins group `customer_<customer_id>`.
   - Matching engine dispatches offers to nearby captains and streams `ride_searching` progress updates.
4. **Driver Assigned & Telemetry:**
   - When a captain accepts, customer receives `ride_assigned` payload containing captain name, phone, vehicle model, license plate, and rating.
   - Customer joins `ride_<booking_id>` to receive real-time driver coordinates on the map.
5. **Pickup, Verification & Ride:**
   - Captain arrives at the pickup spot (`Arrived`).
   - Customer shares secret 4-digit `ride_pin` with the captain.
   - Trip enters `In Trip` state upon PIN verification.
6. **Completion & Settlement:**
   - Captain completes trip.
   - Customer pays via Cash, Razorpay Gateway, or RaahGo Wallet.
   - Customer submits review (1 to 5 stars + comments).

---

### 7.2 Driver (Captain) Lifecycle Processor

```mermaid
stateDiagram-v2
    [*] --> Unregistered
    Unregistered --> KYC_Pending : Register & Upload DL, RC, Aadhaar, Insurance
    KYC_Pending --> KYC_Approved : Admin Verification / PaddleOCR Validation
    KYC_Pending --> KYC_Rejected : Invalid / Expired Documents
    KYC_Rejected --> KYC_Pending : Re-upload Documents
  
    KYC_Approved --> Offline : Onboarding Complete
    Offline --> Online : Toggle Online (Validates Docs, Active Vehicle, Rating)
  
    state Online {
        [*] --> Idle_StreamingGPS
        Idle_StreamingGPS --> OfferReceived : WebSocket Receives 'ride_offer' (15s Window)
        OfferReceived --> OfferRejected : Driver Rejects or 15s Times Out
        OfferRejected --> Idle_StreamingGPS : Reservation Released
        OfferReceived --> RideAssigned : Driver Accepts Offer
    }
  
    Online --> Offline : Toggle Offline OR Daily Duty Limit (12h) Reached
  
    RideAssigned --> EnRoutePickup : Navigate to Pickup
    EnRoutePickup --> Arrived : Click "Arrived at Pickup"
    Arrived --> ActiveTrip : Verify Rider 4-digit PIN -> Click "Start Trip"
    ActiveTrip --> CompleteRide : Reached Destination -> Click "Complete Trip"
    CompleteRide --> SettlePayment : Collect Cash / Verify Online Settlement
    SettlePayment --> Online : Ready for Next Request
```

#### Detailed Captain Journey Breakdown:

1. **Onboarding & Document OCR:** Captain registers and submits Driving License, Vehicle RC, Aadhaar card, and Vehicle details. PaddleOCR extracts license numbers and expiration dates to accelerate verification.
2. **KYC Compliance Gate:** Captain cannot toggle online until:
   - Account is active.
   - All compliance documents are `Verified` and not expired.
   - Vehicle is approved by Admin.
   - Driver rating exceeds platform floor (default 3.5).
3. **Shift Execution & Heartbeat:**
   - Going online initiates real-time GPS telemetry over `/ws/v1/driver/socket/` every 2 to 3 seconds.
   - System enforces maximum daily online limit (default 12 hours) to avoid driver fatigue.
4. **Offer Evaluation:**
   - Captain receives a 15-second modal with pickup address, trip distance, and estimated fare.
   - Driver can Accept or Reject. Rejection automatically releases the candidate lock.
5. **Trip Execution:**
   - Captain drives to pickup and signals arrival.
   - Captain asks customer for their 4-digit PIN and submits to `/api/v1/driver/rides/<ride_id>/start/`.
   - System updates booking to `In Trip`. Live GPS coordinates stream to the customer's active map.
6. **Trip Conclusion & Wallet Payout:**
   - Captain terminates the ride.
   - If Cash (COD), driver collects cash. Platform commission is deducted from the captain's digital wallet.
   - Captain can review daily/weekly earnings and trigger bank account payouts.

---

### 7.3 Admin Operations & Governance Processor

```mermaid
flowchart TD
    AdminLogin[Admin Signs in to Operations Dashboard] --> Dashboard[Live Overview: Active Rides, Online Fleet, Daily Revenue]
  
    Dashboard --> OpsMap[Live Map: Real-Time Fleet & Active Booking Heatmap]
    Dashboard --> DriverKYC[Driver Approvals: Review Uploaded Documents, Verify OCR Data, Approve/Reject]
    Dashboard --> RideMonitor[Ride Operations: Inspect Ongoing, Completed, and Cancelled Trips]
    Dashboard --> TariffPricing[Tariff & Surge: Configure Base Fares, Per-KM Rates, Surge Multipliers]
    Dashboard --> UserGovernance[Customer & Driver Governance: Block/Unblock, Wallet Adjustments, Remote Logout]
    Dashboard --> DisputesSOS[Support & Emergency: Resolve Safety SOS Triggers, Customer Complaints]
    Dashboard --> AuditReports[Audit Logs & Revenue Reports: Financial Reconciliation & Tax Analytics]
```

#### Detailed Operations Capabilities:

- **Live Fleet Monitoring:** Displays spatial pins of all online drivers with vehicle types and current operational state (Available vs. Engaged in Ride).
- **Driver Verification Pipeline:** Two-step approval for documents (DL, Aadhaar, Insurance, Vehicle RC) and vehicle inspection.
- **Dynamic Pricing Engine:** Control base fares, per-km rates, wait time rates, cancellation fees, and peak-hour surge multipliers across operating cities.
- **User Governance:** One-click account suspension, force device logout (clearing JWT tokens), and manual wallet adjustments for compensation.
- **Safety & Incident Response:** Priority emergency monitoring interface tracking SOS triggers and route deviations.

---

## 8. Comprehensive Security Vulnerability Assessment

A comprehensive source code review identified critical security vulnerabilities that must be resolved prior to public production deployment.

### 8.1 Vulnerability Summary & Risk Matrix

| Vulnerability ID  | Vulnerability Classification        | CWE     | Severity           | Impacted Source Code                                | Risk Description                                                                     |
| ----------------- | ----------------------------------- | ------- | ------------------ | --------------------------------------------------- | ------------------------------------------------------------------------------------ |
| **VULN-01** | Plaintext OTP in API Responses      | CWE-312 | **CRITICAL** | `customer_views.py:88driver_auth_views.py:110`    | OTP code returned in API JSON response; allows unauthorized account takeover         |
| **VULN-02** | JWT Signature Verification Bypass   | CWE-347 | **CRITICAL** | `driver_api_views.py:114`                         | Explicit `verify_signature: False`; allows forged JWT impersonation                |
| **VULN-03** | Broken Object-Level Auth (BOLA)     | CWE-639 | **CRITICAL** | `customer_api_views.py:44driver_api_views.py:129` | Unauthenticated fallback to first user in database; exposes private user data        |
| **VULN-04** | Unverified Wallet Credit            | CWE-285 | **CRITICAL** | `customer_api_views.py:929`                       | Direct wallet balance increase without payment gateway verification                  |
| **VULN-05** | Mock Payment Gateway & Verification | CWE-353 | **HIGH**     | `customer_api_views.py:878payments/views.py:18`   | Payment verification endpoint generates fake success status                          |
| **VULN-06** | Unauthenticated Booking Endpoints   | CWE-306 | **HIGH**     | `bookings/views.py:44drivers/views.py:90`         | `AllowAny` permission classes allow unauthenticated ride creation and modification |
| **VULN-07** | Hardcoded Secrets & Debug Mode      | CWE-798 | **HIGH**     | `project/settings.py:34, 37`                      | Hardcoded `SECRET_KEY`, `DEBUG = True`, and wildcard CORS enabled                |
| **VULN-08** | Hardcoded Ride Verification PIN     | CWE-259 | **MEDIUM**   | `bookings/views.py:428`                           | Default PIN fallback `'4829'` enables trip initiation without customer consent     |
| **VULN-09** | Concurrency Race in Ride Accept     | CWE-362 | **MEDIUM**   | `bookings/views.py:400-422`                       | Direct REST accept endpoint lacks `select_for_update()` row locking                |
| **VULN-10** | Missing Rate Limiting on OTP        | CWE-799 | **MEDIUM**   | `customer_views.py:45driver_auth_views.py:55`     | Unlimited OTP requests allow SMS/Email spamming and resource exhaustion              |

---

### 8.2 Detailed Vulnerability Breakdown & Code Proof-of-Concepts

#### VULN-01: Plaintext OTP Leakage in JSON Response

- **Location:** [customer_views.py:84-89](file:///d:/Sanjay/my_dir/testing/RaahGo/Apps/users/customer_views.py#L84-L89), [driver_auth_views.py:106-111](file:///d:/Sanjay/my_dir/testing/RaahGo/Apps/users/driver_auth_views.py#L106-L111)
- **Vulnerable Code:**
  ```python
  # Apps/users/customer_views.py line 84
  return Response({
      'status': 'OTP sent successfully',
      'otp_id': otp_record.id,
      'target': email or phone_number,
      'otp': otp_code  # <-- CRITICAL LEAK
  }, status=status.HTTP_201_CREATED)
  ```
- **Exploit:** An attacker posts any victim's phone number to `/api/v1/customer/auth/send-otp/`. The server returns the generated OTP directly in the response payload. The attacker submits that code to `/verify-otp/` and gains complete access to the victim's account.

#### VULN-02: JWT Signature Verification Explicitly Disabled

- **Location:** [driver_api_views.py:112-115](file:///d:/Sanjay/my_dir/testing/RaahGo/Apps/drivers/driver_api_views.py#L112-L115)
- **Vulnerable Code:**
  ```python
  # Apps/drivers/driver_api_views.py line 112
  token_str = str(auth_header).split(' ')[1]
  payload = jwt.decode(token_str, options={"verify_signature": False})  # <-- CRITICAL
  user_id = payload.get('user_id')
  ```
- **Exploit:** An attacker creates an unsigned JWT token with `{"user_id": "<admin_or_driver_uuid>"}` and sends it in the `Authorization: Bearer <token>` header. The system accepts the token without verifying the secret key signature, granting full driver privileges.

#### VULN-03: Broken Object-Level Authorization & Arbitrary First-User Fallback

- **Location:** [customer_api_views.py:32-45](file:///d:/Sanjay/my_dir/testing/RaahGo/Apps/users/customer_api_views.py#L32-L45)
- **Vulnerable Code:**
  ```python
  # Apps/users/customer_api_views.py line 38
  customer_id = request.query_params.get('customer_id') or request.data.get('customer_id')
  if customer_id:
      c = User.objects.filter(id=customer_id, role=CUSTOMER_ROLE).first()
      if c:
          return c
  # If no customer specified, defaults to the FIRST customer in DB!
  return User.objects.filter(role=CUSTOMER_ROLE).first()
  ```
- **Exploit:** Anyone calling `/api/v1/customer/profile/` or `/api/v1/customer/rides/` without an Authorization header automatically views the profile, address, and ride history of the first registered customer in the database.

#### VULN-04: Arbitrary Wallet Credit via Unverified API Call

- **Location:** [customer_api_views.py:919-943](file:///d:/Sanjay/my_dir/testing/RaahGo/Apps/users/customer_api_views.py#L919-L943)
- **Vulnerable Code:**
  ```python
  class CustomerWalletAddMoneyView(APIView):
      permission_classes = [permissions.AllowAny]
      def post(self, request):
          amount = Decimal(str(request.data.get('amount', '100.00')))
          wallet, _ = Wallet.objects.get_or_create(user=customer)
          wallet.balance += amount  # <-- Directly increments balance!
          wallet.save()
  ```
- **Exploit:** A user makes a POST request to `/api/v1/customer/wallet/add-money/` with `{"amount": 50000}`. The server increments the wallet by ₹50,000 without contacting any payment gateway.

#### VULN-07: Insecure Production Configuration

- **Location:** [project/settings.py:34, 37, 91-92](file:///d:/Sanjay/my_dir/testing/RaahGo/project/settings.py#L34-L92)
- **Vulnerable Code:**
  ```python
  SECRET_KEY = 'django-insecure-e6q5#tm1v_ue2i1-$%6a(j*1s-ejrih&76@ceyz=u0uqz!+z%!'
  DEBUG = True
  CORS_ALLOW_ALL_ORIGINS = True
  CORS_ALLOW_CREDENTIALS = True
  ```
- **Impact:**
  - Hardcoded secret key allows session forgery and token falsification.
  - `DEBUG = True` exposes interactive tracebacks with environmental secrets upon any 500 exception.
  - Wildcard CORS with credentials enabled allows cross-site script request exploitation.

---

### 8.3 Production Remediation & Hardening Roadmap

```mermaid
flowchart LR
    Phase1[Phase 1: Immediate Hotfixes\n- Strip OTP from JSON\n- Enforce JWT verification\n- Remove default user fallback\n- Lock wallet endpoints]
    Phase2[Phase 2: Authentication Hardening\n- Replace AllowAny with IsAuthenticated\n- Move secrets to .env\n- Enforce strict CORS whitelist\n- Set DEBUG=False]
    Phase3[Phase 3: Financial & Concurrency Integrity\n- Razorpay HMAC verification\n- select_for_update DB locks\n- Redis token bucket rate limiting]

    Phase1 --> Phase2 --> Phase3
```

1. **OTP Sanitization:** Remove `'otp': otp_code` from all API response dictionaries. Deliver OTPs exclusively via SMS (e.g., Twilio / Fast2SMS) or verified SMTP email.
2. **Standardize JWT Authentication:** Enforce DRF `IsAuthenticated` across all views. Remove `jwt.decode(..., verify_signature=False)`. Rely strictly on Django SimpleJWT authentication classes.
3. **Eliminate Arbitrary IDOR Fallbacks:** Restrict queries to `request.user`. If unauthenticated, return `HTTP 401 Unauthorized` instead of falling back to `User.objects.first()`.
4. **Secure Payment Gateways:** Implement Webhook signature verification (HMAC SHA256) for Razorpay/Stripe before altering booking payment status or crediting wallets.
5. **Secure Configuration Management:** Load `SECRET_KEY`, database credentials, and `DEBUG` exclusively from environment variables. Set `DEBUG = False` and specify explicit domains in `CORS_ALLOWED_ORIGINS`.

---

## 9. Project Progress Scorecard: Completed vs. Pending

| Functional Domain                | Component / Feature                | Current Implementation Status | Completion %   | Notes / Remaining Work                                            |
| -------------------------------- | ---------------------------------- | ----------------------------- | -------------- | ----------------------------------------------------------------- |
| **Identity & Access**      | Customer & Driver OTP Auth         | Operational (Dev mode)        | **90%**  | Requires removing plaintext OTP leak and hooking real SMS gateway |
|                                  | Single-Device JWT Rotation         | Operational                   | **100%** | Blacklists previous tokens upon refresh                           |
|                                  | Google OAuth Integration           | Implemented                   | **85%**  | Ready; requires production Google Client ID                       |
| **Driver Management**      | Onboarding & Profile Registry      | Operational                   | **100%** | Comprehensive profile tracking                                    |
|                                  | KYC Document Upload & OCR          | Operational                   | **90%**  | PaddleOCR integration active; fallback in place                   |
|                                  | Driver Shift (Online/Offline)      | Operational                   | **95%**  | Enforces document compliance, vehicle check, and duty limits      |
| **Geospatial & Telemetry** | Redis GEO Ingestion                | Operational                   | **100%** | High-throughput `GEOADD` and `GEOSEARCH` active               |
|                                  | WebSocket Location Streaming       | Operational                   | **95%**  | Real-time map coordinate streaming                                |
|                                  | Stale Member Eviction              | Operational                   | **100%** | Background cleaning runs every 15s in worker                      |
| **Matching Engine**        | Spatial Driver Discovery           | Operational                   | **100%** | Proximity search by coordinates                                   |
|                                  | Dynamic Radius Expansion           | Operational                   | **100%** | Automatically expands from 2.0 km to 5.0 km                       |
|                                  | Atomic Distributed Locks           | Operational                   | **100%** | Redis `SET NX EX` prevents candidate collisions                 |
|                                  | Timeout & Cleanup Worker           | Operational                   | **100%** | `run_matching_worker` daemon active                             |
| **Booking Lifecycle**      | Ride Creation, Accept, Start, Done | Operational                   | **90%**  | Needs `select_for_update()` concurrency lock                    |
|                                  | PIN Verification (Start Ride)      | Operational                   | **90%**  | Implemented; needs dynamic per-ride random PIN                    |
|                                  | Parcel & Courier Deliveries        | Data Model Complete           | **75%**  | Model exists; specialized frontend UI pending                     |
|                                  | Moving & Relocation Services       | Data Model Complete           | **70%**  | Model exists; booking UI pending                                  |
| **Payments & Wallets**     | Wallet System & Ledgers            | Data Model Complete           | **80%**  | Ledger functional; requires real gateway top-up                   |
|                                  | Razorpay / Gateway Integration     | Mocked                        | **40%**  | Currently generates mock order IDs; webhook verification needed   |
|                                  | Automated Cancellation Refunds     | Implemented                   | **90%**  | Configured via Admin System Settings                              |
| **Notifications**          | Transactional Outbox Worker        | Operational                   | **100%** | `process_outbox` daemon active                                  |
|                                  | In-App WebSocket Events            | Operational                   | **100%** | Real-time push to driver and customer groups                      |
|                                  | Firebase Mobile Push (FCM)         | Integrated                    | **75%**  | Service complete; needs production `firebase-credentials.json`  |
| **Frontends**              | Admin Operations Dashboard         | Operational                   | **95%**  | Full Vite + React dashboard with live map and governance          |
|                                  | Customer Web Application           | Operational                   | **85%**  | Booking flow, map tracking, and profile functional                |
|                                  | Driver Web HUD                     | Operational                   | **85%**  | Shift toggle, active trip screen, and earnings view               |
|                                  | Mobile Apps (Android / iOS)        | Skeleton Folders              | **15%**  | React Native/Flutter wrappers need to be built                    |
| **Testing & CI/CD**        | Automated Unit / Integration Tests | Minimal                       | **25%**  | Basic test files present; comprehensive test suite needed         |
|                                  | Docker & Production Deployment     | In Progress                   | **30%**  | Requires Dockerfiles, Docker Compose, and Nginx configs           |

### Overall Project Completion Metric: **~82% Core Platform Maturity**

---

## 10. High-Scale Traffic Management & Concurrency Blueprint

To scale RaahGo to handle **100,000+ concurrent drivers** and **1,000,000+ daily booking requests**, the following infrastructure design must be applied:

```mermaid
flowchart TD
    DNS[Route 53 / Cloudflare CDN & WAF] --> ALB[AWS Application Load Balancer]
  
    subgraph Cluster["Horizontal Application Cluster"]
        ALB -->|Path: /ws/* (Sticky Sessions)| DaphneCluster[Daphne ASGI Cluster\n4-8 Nodes (WebSocket Traffic)]
        ALB -->|Path: /api/* (Stateless)| GunicornCluster[Gunicorn/Uvicorn Cluster\n6-12 Nodes (REST API Traffic)]
    end

    subgraph RedisTier["High-Availability Redis Tier"]
        RedisSentinel[Redis Sentinel / Cluster]
        RedisPubSub[Channels Layer Broker\n(DB 1)]
        RedisGEO[Geospatial Index & Presence\n(DB 0 - Clustered by Zone)]
    end

    subgraph DBTier["Database Scaling Tier"]
        ProxySQL[ProxySQL Database Load Balancer]
        PrimaryDB[(MySQL Primary Master\nWrite Operations)]
        Replica1[(MySQL Read Replica 1\nSearch & History)]
        Replica2[(MySQL Read Replica 2\nAdmin Analytics)]
    end

    DaphneCluster <--> RedisPubSub
    DaphneCluster <--> RedisGEO
    GunicornCluster <--> RedisGEO
    GunicornCluster --> ProxySQL
    ProxySQL -->|Writes| PrimaryDB
    ProxySQL -->|Reads| Replica1
    ProxySQL -->|Reads| Replica2
```

### 10.1 Load Balancing & Ingress Architecture

1. **Separation of I/O Profiles:**
   - Asynchronous persistent WebSocket connections (Daphne) must be isolated from short-lived synchronous REST HTTP requests (Gunicorn/Uvicorn).
   - This ensures heavy file uploads or large database queries never saturate the event loop responsible for driver GPS heartbeats.
2. **WebSocket Session Stickiness:** Configure the Application Load Balancer (ALB) or Nginx with ip-hash / cookie-based stickiness for the `/ws/*` endpoints to reduce TLS renegotiation overhead.

### 10.2 WebSocket & Real-Time Telemetry Scaling

- **Rate-Limiting GPS Pushes:** Driver mobile applications must throttle location updates to 1 ping per 2 to 3 seconds. Pings must not exceed 0.5 Hz during idle periods.
- **Geohash Sharding:** In large-scale operations across multiple states, partition Redis GEO keys by geographic region:

  ```text
  drivers:geo:delhi_ncr
  drivers:geo:mumbai
  drivers:geo:bengaluru
  ```

  This prevents a single Redis instance from becoming a CPU bottleneck during peak city traffic.

### 10.3 Database Read/Write Splitting & Caching Layer

- **Relational Write Decoupling:** Live driver tracking never writes directly to MySQL. GPS data remains in Redis, persisting to MySQL only upon key ride state transitions (`Arrived`, `In Trip`, `Completed`).
- **Read Replicas:** Route Admin Dashboard queries, historical customer invoices, and analytics to MySQL Read Replicas using Django multi-database routers or ProxySQL.

### 10.4 Rate Limiting & Abuse Prevention

- Deploy Redis-backed rate limiting using sliding-window counters:
  - `/api/v1/*/auth/send-otp/`: Maximum **3 requests per 10 minutes** per IP/Phone.
  - `/api/v1/bookings/`: Maximum **5 ride creations per minute** per customer account.
  - `/api/v1/customer/wallet/add-money/`: Maximum **5 requests per hour** with mandatory payment gateway pre-authorization.

---

## 11. Operations & Deployment Runbook

### Local Development Environment Setup

#### 1. Prerequisites

- Python 3.11+ / Django 5.2+
- Node.js 18+ and npm
- Redis Server (listening on `127.0.0.1:6379`)
- MySQL 8.0 Server (`raahgo_db`)

#### 2. Environment Configuration

Verify your `.env` file in the project root:

```env
DEBUG=True
SECRET_KEY=your-secure-secret-key
DATABASE_URL=mysql://root:root@127.0.0.1:3306/raahgo_db
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
MATCHING_INITIAL_RADIUS_KM=2.0
MATCHING_MAX_RADIUS_KM=5.0
MATCHING_OFFER_WINDOW_SECONDS=15
MATCHING_OVERALL_DEADLINE_SECONDS=60
MATCHING_CONCURRENT_OFFERS=3
```

#### 3. Starting the Backend Services

To run the complete platform, start the four core processes in separate terminal instances:

```powershell
# Terminal 1: Start ASGI Daphne Server (HTTP + WebSockets)
.\venv\Scripts\python.exe -m daphne -b 127.0.0.1 -p 8000 project.asgi:application

# Terminal 2: Start Transactional Outbox Background Worker
.\venv\Scripts\python.exe manage.py process_outbox --interval 1.0 --batch-size 50

# Terminal 3: Start Ride Matching & Dispatch Background Worker
.\venv\Scripts\python.exe manage.py run_matching_worker --interval 2.0
```

#### 4. Starting the Frontend Portals

```powershell
# Admin Operations Portal (Port 5173 / configured Vite port)
cd frontend/admin-frontend
npm run dev

# Customer Web Portal
cd frontend/customer-frontend
npm run dev

# Driver Web Portal
cd frontend/driver-frontend
npm run dev
```

---

### Production Deployment Architecture (Systemd / Supervisor)

In production Linux environments, configure services under systemd supervision:

```ini
# /etc/systemd/system/raahgo-outbox.service
[Unit]
Description=RaahGo Transactional Outbox Worker
After=network.target redis.service mysql.service

[Service]
Type=simple
User=raahgo
WorkingDirectory=/var/www/raahgo
ExecStart=/var/www/raahgo/venv/bin/python manage.py process_outbox --interval 1.0
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

```ini
# /etc/systemd/system/raahgo-matching.service
[Unit]
Description=RaahGo Matching & Dispatch Worker
After=network.target redis.service mysql.service

[Service]
Type=simple
User=raahgo
WorkingDirectory=/var/www/raahgo
ExecStart=/var/www/raahgo/venv/bin/python manage.py run_matching_worker --interval 2.0
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

---

*End of Platform Documentation. Maintained by the RaahGo Core Engineering & Architecture Team.*
