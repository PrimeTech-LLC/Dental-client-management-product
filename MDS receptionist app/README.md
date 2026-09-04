# Apex Dental Care — Clinic Management System

A professional receptionist-facing clinic management application for dental practices. Built with React, TypeScript, Express, and Neon Postgres.

---

## Features

- **Dashboard** — Live daily schedule with real-time appointment status workflow (Scheduled → Confirmed → Arrived → In Progress → Completed)
- **Appointments** — Day grid, week view, and master list with double-booking conflict detection and reschedule tracking
- **Patients** — Full patient profiles with medical history, allergy alerts, dental chart (32-tooth interactive), treatment plans, prescriptions, and visit notes. Edit profile inline.
- **Prescriptions** — Clinical Rx pad with common dental formulary presets, allergy cross-check warnings, and print-ready output
- **Treatments** — Procedure register with status tracking (Planned → In Progress → Completed) and revenue tracking
- **Doctors** — Doctor profiles, weekly availability schedules, and date-specific schedule exceptions
- **Reminders** — SMS / Email / WhatsApp appointment reminder queue
- **Reports** — Appointment analytics, doctor caseload, procedure breakdown, and estimated revenue
- **Audit Logs** — Full audit trail of every action taken by clinic staff
- **Print Center** — Print-ready templates: daily schedule, appointment slip, prescription pad, patient history card, blank dental chart
- **Auth** — JWT httpOnly cookie session with role switching (Receptionist / Doctor / Admin) and sign-out

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Tailwind CSS v4, Vite 6 |
| Backend | Express 4, Node.js, tsx (dev) |
| Database | Neon Postgres (serverless) |
| DB Driver | `@neondatabase/serverless` with `node-fetch` |
| Auth | JWT (`jsonwebtoken`) with httpOnly cookies |
| Icons | Lucide React |
| Date handling | date-fns |

---

## Project Structure

```
├── server.ts                  # Express API server (port 3001 in dev)
├── vite.config.ts             # Vite dev server (port 3000, proxies /api → 3001)
├── scripts/
│   └── migrate.js             # Database migration and seed script
├── src/
│   ├── App.tsx                # Root component — auth gate, routing, global modals
│   ├── components/
│   │   ├── auth/              # LoginScreen
│   │   ├── layout/            # AppSidebar, TopBar, GlobalSearchModal
│   │   ├── dashboard/         # ReceptionistDashboard
│   │   ├── appointments/      # AppointmentsHub, NewAppointmentModal, RescheduleModal, AppointmentDetailModal
│   │   ├── patients/          # PatientsHub, PatientProfileView, NewPatientModal, DentalChart
│   │   ├── prescriptions/     # PrescriptionsHub, PrescriptionEditorModal
│   │   ├── treatments/        # TreatmentsHub
│   │   ├── doctors/           # DoctorsHub
│   │   ├── reminders/         # RemindersHub
│   │   ├── reports/           # ReportsHub
│   │   ├── audit/             # AuditLogsHub
│   │   ├── settings/          # SettingsHub
│   │   └── print/             # PrintCenterModal
│   ├── lib/
│   │   ├── api.ts             # Typed fetch API client
│   │   └── utils.ts           # Date, time, and badge helpers
│   ├── server/
│   │   └── db/
│   │       ├── connection.ts  # Neon Postgres query helper
│   │       ├── database.ts    # All DB operations (CRUD, conflict engine, reports)
│   │       └── schema.sql     # Full Postgres schema
│   └── types/
│       └── index.ts           # All TypeScript domain types and enums
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- A [Neon](https://neon.tech) Postgres database (free tier works)

### 1. Clone and install

```bash
git clone <repo-url>
cd "MDS receptionist app"
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in:

```env
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require&channel_binding=require
JWT_SECRET=your-long-random-secret-here
NODE_ENV=development
PORT=3001
```

Get your `DATABASE_URL` from: [console.neon.tech](https://console.neon.tech) → your project → **Connection Details** → **Pooled connection**.

Generate a JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### 3. Run the database migration

First time only — creates all tables and inserts demo data:

```bash
npm run migrate:seed
```

Other migration commands:
```bash
npm run migrate          # Create tables only (no seed data)
npm run migrate:reset    # DROP all tables, recreate, and re-seed (dev only — destructive)
```

### 4. Start the development servers

**Option A — Single command (recommended):**
```bash
npm run dev
```
This starts both the API server and Vite dev server concurrently.

**Option B — Separate terminals:**
```bash
# Terminal 1: API server
npm run dev:api    # → http://localhost:3001

# Terminal 2: Frontend
npm run dev:ui     # → http://localhost:3000
```

Open **http://localhost:3000** in your browser. You'll see a login screen — click any staff account to sign in.

---

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start API + Vite concurrently |
| `npm run dev:api` | Start Express API server only (port 3001) |
| `npm run dev:ui` | Start Vite dev server only (port 3000) |
| `npm run build` | Build frontend + bundle server for production |
| `npm start` | Run production build |
| `npm run migrate` | Run DB schema migrations |
| `npm run migrate:seed` | Migrate + insert demo data |
| `npm run migrate:reset` | Drop all tables, recreate, re-seed |
| `npm run lint` | TypeScript type check |

---

## Demo Data

The seed script inserts:

- **4 staff accounts** — Receptionist (Emma Watson), 2 Doctors, Admin
- **6 patients** with full medical profiles, allergies, and dental history
- **2 doctors** with Mon–Sat availability schedules
- **8 appointments** scheduled for the migration date
- **5 treatments**, **2 prescriptions** with medication items
- **3 reminders** in the notification queue

---

## Deployment (Vercel)

1. Build the project:
   ```bash
   npm run build
   ```

2. Add environment variables in the Vercel dashboard:
   - `DATABASE_URL` — your Neon pooler connection string
   - `JWT_SECRET` — same secret as your local `.env`
   - `NODE_ENV` is set to `production` automatically by Vercel

3. Deploy:
   ```bash
   vercel deploy
   ```

The production build serves the Vite static output directly from Express. No separate Vite process is needed.

---

## Architecture Notes

**Dev vs Production:**
- In development, Vite runs on port 3000 and proxies all `/api/*` requests to the Express API on port 3001. This prevents Vite's middleware from interfering with Express body parsing.
- In production, Express serves the static Vite build directly on a single port.

**Database:**
- Uses `@neondatabase/serverless` HTTP driver (not raw TCP `pg`). This avoids SSL channel-binding timeouts on Node 18 and works correctly on Vercel's serverless edge environment.
- `node-fetch` is injected as the HTTP transport to bypass Node 18's undici fetch timeout issues in certain environments.

**Auth:**
- Sessions are JWT tokens stored in httpOnly cookies (12-hour expiry).
- In demo/dev mode, any staff account can be selected from the login screen without a password. Production deployments should add password hashing.

**Conflict detection:**
- Appointment scheduling checks doctor availability (weekly schedule + date exceptions) and existing appointments before confirming. Double-booking can be overridden with explicit receptionist permission.
