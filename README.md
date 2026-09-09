# TaskMate — Production Hyperlocal Task Marketplace

> **"Your Task. Your Nearby Helper."**  
> A trusted hyperlocal task marketplace featuring intelligent multi-factor matching, automatic instant reassignment upon agent rejection, atomic concurrency protection, and real-time multi-device synchronization.

---

## 🌟 Key Features

1. **Intelligent Allocation Engine**:
   - Transparent multi-factor scoring model:
     - **Distance (40%)**: Haversine formula calculation based on agent GPS coordinates and task pickup location.
     - **Rating (20%)**: Historical customer feedback (1.0 - 5.0 stars).
     - **Reliability (15%)**: Completion rate.
     - **Workload & Availability (15%)**: Prioritizes currently available agents with fewer concurrent tasks.
     - **Response Performance (10%)**: Acceptance speed and responsiveness.
2. **Automatic Realtime Reassignment**:
   - When an agent rejects an offer, the backend *instantly* excludes them, re-evaluates the remaining active agents, selects the next highest-scoring candidate (e.g. Agent B), and delivers a real-time push offer without customer intervention.
3. **Atomic Concurrency Protection**:
   - Transaction-isolated acceptance prevents two agents from claiming the same task simultaneously.
4. **Three Dedicated Dashboards**:
   - **Customer**: Task creation with GPS / city presets, live active task tracking with visual progress stepper, assigned helper card, completion confirmation, and interactive star review.
   - **Task Agent**: Live availability toggle, simulated GPS location adjuster, real-time popup offer card with 60s countdown timer, mission workflow (Start Task → Complete with photo proof), and earnings summary.
   - **Admin Command Center**: Platform-wide KPI metrics, live task stream with Deep Task Inspector (chronological event log and full agent assignment audit trail), and fleet telemetry.
5. **Real Multi-Device Synchronization**:
   - WebSocket real-time engine running on `0.0.0.0:3001` with Vite proxy on `0.0.0.0:5173`. Any device (laptops, phones, tablets) on the same Wi-Fi network can connect to the exact same live system simultaneously.
6. **Production-Ready Supabase Integration**:
   - Complete PostgreSQL migration script in `supabase/schema.sql` including Row Level Security (RLS) policies and Supabase Realtime publication setup.

---

## 🚀 Quick Start (Running Locally)

### Prerequisites
- Node.js (v18+)
- npm

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Application (Backend + Frontend)
```bash
npm run dev
```
This runs both the backend server (on `http://localhost:3001`) and the Vite client (on `http://localhost:5173`) concurrently.

Open your browser to:
```
http://localhost:5173
```

---

## 👥 Demo Accounts (Pre-Seeded & Ready)

All demo accounts use the password: `TaskMate@123`

| Role | Name | Email | Password | Location / Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Customer** | Rahul Sharma | `customer@taskmate.com` | `TaskMate@123` | Hitech City (Customer who posts tasks) |
| **Agent A** | Vikram Singh | `agent.a@taskmate.com` | `TaskMate@123` | Madhapur (~1.55 km away, Rating 4.9) |
| **Agent B** | Priya Patel | `agent.b@taskmate.com` | `TaskMate@123` | Kondapur (~2.82 km away, Rating 4.7) |
| **Agent C** | Arjun Reddy | `agent.c@taskmate.com` | `TaskMate@123` | Gachibowli (~3.03 km away, Rating 4.8) |
| **Admin** | Suresh Kumar | `admin@taskmate.com` | `TaskMate@123` | Operations HQ • Complete audit inspector |

> **Tip**: The Login screen includes an **"Instant Multi-Device Demonstration Logins"** panel with 1-click buttons to sign in as any of these accounts instantly.

---

## 💻 How to Test Across 2 or 3 Devices / Laptops

Because the server listens on `0.0.0.0`, all devices on the same local network can connect to the same live database:

1. **Find your host machine's Local IP**:
   - On Windows: run `ipconfig` (look for *IPv4 Address*, e.g. `192.168.1.50`).
2. **Device 1 (Customer Laptop)**:
   - Navigate to `http://192.168.1.50:5173` (or `http://localhost:5173`).
   - Sign in as **Customer (Rahul)**.
3. **Device 2 (Agent A Laptop)**:
   - Navigate to `http://192.168.1.50:5173`.
   - Sign in as **Agent A (Vikram)**.
4. **Device 3 (Agent B / Admin Laptop)**:
   - Navigate to `http://192.168.1.50:5173`.
   - Sign in as **Agent B (Priya)** or **Admin (Suresh)** in another browser/window.

---

## 🎯 The Live Demonstration Workflow

1. **Customer posts a task**:
   - On Laptop 1, click **"Post a New Task"**.
   - Title: `Pick up documents from office`
   - Location: `Hitech City, Hyderabad`
   - Reward: `₹200`
   - Click **"Post & Find Nearby Agent"**.
2. **Intelligent Assignment Engine runs**:
   - Distance to Agent A is 1.55 km (Score: 95.2).
   - Distance to Agent B is 2.82 km (Score: 90.6).
   - Agent A is ranked #1.
3. **Agent A receives offer**:
   - On Laptop 2 (Agent A), a high-visibility offer popup appears with a 60-second countdown bar.
4. **Agent A declines**:
   - Agent A clicks **DECLINE (Pass)**.
5. **Instant Automatic Reassignment**:
   - Backend marks Agent A's assignment as `REJECTED`.
   - Backend re-runs allocation excluding Agent A.
   - Next best candidate (Agent B) is selected.
6. **Agent B receives offer in realtime**:
   - On Laptop 3 (Agent B), the offer modal appears *instantly* without refreshing the page!
7. **Agent B accepts**:
   - Agent B clicks **ACCEPT TASK**.
8. **Realtime updates across all screens**:
   - On Customer's screen (Laptop 1): Status updates immediately to **"Agent Assigned"** displaying Agent B's profile, rating (★ 4.7), and phone number.
   - On Admin's screen (Laptop 3): The **Live Task Stream** reflects the update. Clicking **"Inspect Engine"** shows:
     - *Attempt 1: Vikram Singh (Agent A) — DECLINED / REJECTED (Dist: 1.55 km)*
     - *Attempt 2: Priya Patel (Agent B) — ACCEPTED (Dist: 2.82 km)*
9. **Fulfillment & Review**:
   - Agent B clicks **"Start Task"** → status updates to `IN_PROGRESS`.
   - Agent B clicks **"Mark as Completed"** and submits proof.
   - Customer confirms completion and submits a 5-star review!
   - Confetti triggers and Agent B's rating updates in the database.

---

## ☁️ Supabase Cloud Deployment (Optional)

If you wish to deploy to Supabase Cloud:
1. Create a project at [supabase.com](https://supabase.com).
2. Go to **SQL Editor** in Supabase and paste the contents of `supabase/schema.sql`.
3. In `.env`, provide:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```
4. Build the frontend for Vercel or Netlify:
   ```bash
   npm run build
   ```

---

## 📁 Project Structure

```
tmate/
├── dist/                     # Production build artifacts
├── server/
│   ├── db.ts                 # SQLite persistent database schema & connection
│   ├── seed.ts               # Seed data with realistic Hyderabad coordinates & ratings
│   ├── matchingEngine.ts     # Haversine distance & multi-factor allocation engine
│   ├── websocket.ts          # Realtime WebSocket server for multi-device sync
│   ├── test-flow.ts          # Automated end-to-end integration test suite
│   └── index.ts              # Express REST API and authentication routes
├── src/
│   ├── components/
│   │   ├── agent/
│   │   │   └── TaskOfferModal.tsx        # High-visibility task offer popup with countdown
│   │   ├── common/
│   │   │   ├── Navbar.tsx                # Role badges, realtime indicator, notifications
│   │   │   ├── TaskDetailModal.tsx       # Deep Task Inspector & audit trail viewer
│   │   │   ├── TaskStatusBadge.tsx       # Status badges with icons and animations
│   │   │   └── ToastContainer.tsx        # Floating realtime alert toasts
│   │   └── customer/
│   │       ├── CreateTaskModal.tsx       # Task posting with preset coordinates & GPS
│   │       └── ReviewModal.tsx           # 5-star rating & feedback modal with confetti
│   ├── contexts/
│   │   ├── AuthContext.tsx               # Auth session management & role guard
│   │   └── RealtimeContext.tsx           # WebSocket listener & event notifications
│   ├── pages/
│   │   ├── admin/AdminDashboard.tsx      # KPI stats, live stream, fleet tracker, DB reset
│   │   ├── agent/AgentDashboard.tsx      # Availability toggle, GPS mover, mission cards
│   │   ├── auth/
│   │   │   ├── LoginPage.tsx             # 1-click multi-device demo logins
│   │   │   └── RegisterPage.tsx          # Real user registration
│   │   └── customer/CustomerDashboard.tsx# Active task stepper, agent card, history
│   ├── services/
│   │   ├── api.ts                        # Unified REST API service
│   │   └── realtime.ts                   # WebSocket client with auto-reconnect & chime
│   ├── types.ts                          # Shared TypeScript interfaces & types
│   ├── App.tsx                           # Main application router
│   ├── index.css                         # Tailwind CSS v4 styles & custom utilities
│   └── main.tsx                          # React entry point
├── supabase/
│   └── schema.sql                        # Full PostgreSQL DDL, RLS policies, and triggers
├── .env.example                          # Environment template
├── index.html                            # HTML entry point with Plus Jakarta Sans
├── package.json                          # Scripts & dependencies
├── tsconfig.json                         # TypeScript configuration
└── vite.config.ts                        # Vite configuration with proxy and Tailwind
```
