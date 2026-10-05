# Architectural Critique & Technical Review: Zew vs. Global Ride Platforms

> **Document Type:** Technical & Product Architecture Evaluation  
> **Target Platform:** Zew (Addis Ababa Ride-Sharing & Commute Pooling System)  
> **Comparators:** Uber, Lyft, BlaBlaCar, Bolt  
> **Date:** October 2026  

---

## Executive Summary

**Zew** is an everyday journey and shared commute platform tailored for Addis Ababa, Ethiopia. Unlike standard on-demand taxi-hailing apps (such as Uber or Bolt), Zew focuses on **forward-direction micro-pooling**: matching commuters with private or commercial drivers already traveling along compatible corridors.

This review critiques Zew’s current architecture, data modeling, matching engine, and user experience against global industry standards while honoring the unique behavioral, infrastructural, and economic realities of Addis Ababa.

---

## 1. Product Paradigm: Uber vs. BlaBlaCar vs. Zew

| Feature Dimension | Uber / Bolt (Global Ride-Hailing) | BlaBlaCar (Intercity Carpooling) | Zew (Addis Commute Pooling) |
| :--- | :--- | :--- | :--- |
| **Core Value Prop** | On-demand point-to-point taxi | Long-distance intercity cost sharing | Intra-city shared commute & corridor pooling |
| **Matching Model** | Nearest driver dispatch (1 driver : 1 rider) | Scheduled advance booking (Days prior) | Hybrid: Planned commutes + 120s real-time pickup |
| **Pricing Structure** | Dynamic surge pricing, distance + time | Cost-sharing seat split based on fuel | Flat / corridor seat fare with capacity discounts |
| **Route Flexibility** | Driver detours to exact rider door | Fixed highway pickup points | Corridor schematic & landmark pins (Bole, CMC, Mexico) |
| **Primary Payment** | Credit Card / Apple Pay / In-App Wallet | Credit Card / PayPal | Telebirr, CBE Birr, Cash / Automated simulated payout |

### Key Insight
Uber’s model fails in dense African cities like Addis Ababa for daily commuting due to high single-rider fares and traffic congestion. Zew’s hybrid approach—combining **scheduled commute planning** with **real-time 2-minute circle assembly**—fills the critical "missing middle" between crowded minibuses and expensive solo taxis.

---

## 2. Technical Architecture & Codebase Critique

### Strengths of the Zew Codebase

1. **Strict Session & State Isolation (Zero Client-Side Fare Tampering)**
   - Business rules, fare matrix, seat reservation locks, and state transitions belong exclusively in the Fastify API.
   - The browser never supplies price, payment outcome, or booking status directly.

2. **Deterministic Matching Engine (`backend/src/modules/matching/service.ts`)**
   - The engine provides rejection transparency: every non-matching trip returns an explicit audit reason (`Opposite direction`, `Outside 30-minute window`, `Not enough seats`, etc.).

3. **Multi-Role First-Class Architecture**
   - Clean separation of four roles: **Passenger**, **Driver**, **Customer Support (Phone Dispatch Desk)**, and **Administrator**.
   - Phone Dispatch Desk accounts for non-smartphone users by allowing support agents to order rides and issue 4-digit boarding codes (`code`).

4. **Supabase Integration & Database Migrations**
   - Structured migration tracking (`001_initial_schema.sql`, `002_seed_demo_data.sql`) with Supabase Auth (`signUp`, `signInWithPassword`, `signOut`, `onAuthStateChange`).

---

### Architectural Gaps & Comparison with Global Standards

```
                       ┌────────────────────────────────────────────────────────┐
                       │                  CURRENT STATE (DEMO)                  │
                       │  SQLite Memory Store + Polling + Schematic Distance    │
                       └───────────────────────────┬────────────────────────────┘
                                                   │
                                                   ▼
                       ┌────────────────────────────────────────────────────────┐
                       │               TARGET PILOT ARCHITECTURE                │
                       │ Fastify + PostgreSQL/PostGIS + WebSockets + Telebirr   │
                       └────────────────────────────────────────────────────────┘
```

#### A. Geospatial Indexing & Routing (Haversine vs. OSRM / H3 Indexing)
- **Current Zew State:** Uses straight-line Haversine distance (`getDistanceKm`) or schematic stop ordering along fixed corridors (`Bole → City centre`, `CMC → City centre`).
- **Global Standard (Uber/Lyft):** Uses **H3 Hexagonal Spatial Indexing** (Uber’s open-source spatial index) combined with **OSRM (Open Source Routing Machine)** or Mapbox Matrix API for actual road network distance, traffic delays, and turn-by-turn routing.
- **Addis Context Reality:** Road topology in Addis Ababa includes frequent ring roads, underpasses, and construction detours where straight-line distance misleads ETAs.
- **Recommendation:** Integrate an **OSRM / GraphHopper** instance server-side to calculate true road distance and ETA before pilot launch.

#### B. Concurrency & Real-Time Data (REST Polling vs. WebSockets / SSE)
- **Current Zew State:** Frontend relies on HTTP REST requests (`/dashboard`, `/matches`, `/bookings`).
- **Global Standard (Uber/Lyft):** Uses persistent **WebSockets / gRPC** stream connections to stream driver GPS coordinates every 3–5 seconds and broadcast match acceptances instantaneously.
- **Addis Context Reality:** Mobile network jitter (3G/4G dropouts) is common in Addis Ababa.
- **Recommendation:** Implement **Server-Sent Events (SSE)** or WebSockets for driver location streams and booking status changes, with offline fallback caching on the PWA client.

#### C. Payment Infrastructure (Stripe vs. Telebirr / CBE Birr)
- **Current Zew State:** Simulated payment transitions (`payment: 'not_due' | 'simulated'`) and demo wallet balances.
- **Global Standard (Uber/Lyft):** Tokenized credit card pre-authorization with instant post-trip capture.
- **Addis Context Reality:** Telebirr and CBE Birr dominate digital transactions in Ethiopia.
- **Recommendation:** Create a dedicated Fastify payment plugin (`backend/src/plugins/telebirr.ts`) supporting Telebirr Webhook callbacks, Hashing/RSA signature verification, and USSD push payment requests.

---

## 3. Ethiopian Realities & Localization Evaluation

### 1. Landmark & Area-Based Navigation
Addis Ababa relies heavily on landmark names (e.g. *Edna Mall*, *Wollo Sefer*, *Estifanos*, *Sarbet*, *Megenagna*) rather than street numbers.
- **Zew Solution:** Integrated Photon place search with customizable map pin selection, keeping stop labels natural to local commuters.

### 2. Low-Tech & Offline Accessibility (Call-in Support Desk)
In Ethiopia, a significant portion of daily commuters may lack active mobile data or smartphones.
- **Zew Solution:** The **Customer Support Desk** module allows call center agents to book rides on behalf of callers and issue 4-digit boarding codes (`code`), bridging the digital divide.

### 3. Verification & Trust Framework
Driver trust is paramount in carpooling.
- **Zew Solution:** System enforces driver verification labels, plate numbers, and 4-digit boarding code confirmation before automated payout calculation occurs.

---

## 4. Prioritized Action Plan & Roadmap

```
 ┌──────────────────────┐    ┌──────────────────────┐    ┌──────────────────────┐
 │       PHASE 1        │    │       PHASE 2        │    │       PHASE 3        │
 │  PostgreSQL/PostGIS  │───>│  Telebirr Integration│───>│ WebSockets & OSRM    │
 │  Database Migration  │    │  & Verification SDK  │    │ Real Road Routing    │
 └──────────────────────┘    └──────────────────────┘    └──────────────────────┘
```

1. **Phase 1: Persistence Upgrade**
   - Transition from SQLite in-memory `store.ts` to PostgreSQL + PostGIS container to handle spatial queries natively.
2. **Phase 2: Payment Webhook Integration**
   - Connect Telebirr and CBE Birr merchant APIs with server-side signature verification.
3. **Phase 3: Real Road Routing Engine**
   - Replace Haversine distance with server-side OSRM matrix routing for accurate road ETAs.
4. **Phase 4: Real-time Drivers Stream**
   - Replace polling with Server-Sent Events (SSE) for live radar driver updates.

---

## 5. Conclusion

Zew’s architecture is exceptionally well-aligned with the needs of Addis Ababa. By prioritizing **forward-direction micro-pooling**, **dynamic fare transparency**, **multi-role access**, and **call-in dispatch support**, Zew avoids the cost traps of Western ride-hailing models while maintaining enterprise-grade safety and API state isolation.

Implementing the recommended PostGIS and Telebirr integrations will elevate Zew from a robust interactive demo to a production-ready urban transport solution.
