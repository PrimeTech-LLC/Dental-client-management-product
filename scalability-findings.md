# Scalability & Performance Findings

> Audit date: 2026-09-16  
> Method: Static source analysis — no load test run (Neon serverless DB not accessible from audit environment)

---

## Summary

| Severity | Count |
|----------|-------|
| High     | 5     |
| Medium   | 6     |
| Low      | 3     |
| **Total**| **14**|

---

## Capacity Estimate

**Current ceiling (rough):**
- Neon Postgres free tier: 10 GB storage, 1 compute unit, 0.25 vCPU active. Concurrent connection limit is handled by the HTTP driver (no TCP connections) — effectively unlimited reads, ~5–10 concurrent writes before latency increases.
- Vercel serverless: 1000 concurrent invocations (Hobby). Cold starts ~200–800ms for Node.js.
- With ~50 patients and 8–20 daily appointments, the app runs comfortably.
- **Top three bottlenecks before hitting scale:** (1) unbounded `getTreatments` / `getReminders` with no pagination, (2) prescription editor loading all patients into a dropdown, (3) in-memory rate limiter reset on each serverless cold start.

---

## Findings

### SCAL-01 — `getTreatments`, `getVisits`, `getReminders` are completely unbounded (High)
**File:** `src/server/db/database.ts` lines 1318–1340, 1352–1380, 1588–1603  
**Evidence:** None of these three queries have a `LIMIT` clause:
```ts
// getVisits
`SELECT v.* ... FROM visits v ... ORDER BY v.visit_date DESC`
// getTreatments
`SELECT t.* ... FROM treatments t ... ORDER BY t.created_at DESC`
// getReminders
`SELECT r.* ... FROM appointment_reminders r ... ORDER BY r.created_at DESC`
```
A clinic with 5,000 patients × 10 average visits = 50,000 visit rows returned to Node.js on every `GET /api/visits` request (no patientId filter).  
**Impact:** Memory exhaustion on the serverless function, timeout (> 30s Vercel limit), and client-side RAM spike when rendering an unvirtualised list.  
**Remediation:** Add `LIMIT $N OFFSET $M` with server-validated pagination parameters to all three functions. Pass `limit` and `offset` query params from the frontend.

---

### SCAL-02 — `PrescriptionEditorModal` fetches all patients (up to 100) into a dropdown on every open (High)
**File:** `src/components/prescriptions/PrescriptionEditorModal.tsx` lines 54–71  
**Evidence:**
```ts
api.getPatients('', 100)
```
100 patient records (with all fields) are fetched and rendered as `<option>` elements in a `<select>` every time the prescription modal opens. At scale (1,000+ patients), this dropdown is unusable — users cannot find the correct patient by scrolling through 1,000 options, and the fetch transfers >1MB of JSON.  
**Remediation:** Replace the `<select>` with a searchable combobox / typeahead (same pattern as `NewAppointmentModal` which already does debounced patient search). Use the existing `/api/patients?search=&limit=10` endpoint.

---

### SCAL-03 — `PatientsHub` fetches `limit=100` on every search keystroke (High)
**File:** `src/lib/api.ts` line ~65; `src/components/patients/PatientsHub.tsx`  
**Evidence:**
```ts
getPatients: (search = '', limit = 100, offset = 0) =>
  fetchJson<...>(`/api/patients?search=...&limit=${limit}&offset=${offset}`)
```
The hub passes `limit=100` (hardcoded in `api.ts` default). There is a 500ms debounce which is good, but 100 full patient records are returned and rendered as a full table. For a clinic with 500+ patients, every search transfers and renders 100 rows of patient PII.  
**Remediation:** Reduce default to `limit=50`. Add server-side cursor pagination (page/offset controls in the UI) — the backend already supports `offset`.

---

### SCAL-04 — `getReports` loads every appointment and treatment row into Node.js for aggregation (High)
**File:** `src/server/db/database.ts` lines 1685–1728  
**Evidence:**
```ts
const [apptRows, treatRows, doctorRows] = await Promise.all([
  query(`SELECT a.status, a.appointment_type, a.doctor_id, d.full_name ... FROM appointments a ... WHERE a.appointment_date BETWEEN $1 AND $2 ...`),
  query(`SELECT t.cost FROM treatments t WHERE t.created_at::date BETWEEN $1 AND $2 ...`)
])
```
All matching rows are transferred to Node.js and aggregated in JavaScript (`apptRows.filter`, `treatRows.reduce`). A 1-year report for a busy clinic (10,000 appointments) transfers all rows to the application server before counting them.  
**Impact:** Slow reports (>5s), high memory usage, potential Vercel 30s timeout exceeded.  
**Remediation:** Push aggregation into SQL:
```sql
SELECT status, appointment_type, doctor_id, COUNT(*) as count
FROM appointments
WHERE appointment_date BETWEEN $1 AND $2
GROUP BY status, appointment_type, doctor_id
```
Use `SUM(cost)` for revenue in a single SQL query rather than `Array.reduce()`.

---

### SCAL-05 — Dashboard makes 4 concurrent API calls on every load/refresh (High)
**File:** `src/components/dashboard/ReceptionistDashboard.tsx` lines 66–72  
**Evidence:**
```ts
const [apptsData, yesterdayData, docsData, setsData] = await Promise.all([
  api.getAppointments({ date: todayStr }),
  api.getAppointments({ date: yesterdayStr }),
  api.getDoctors(),
  api.getSettings()
]);
```
4 API round-trips on every dashboard load and manual refresh. On Vercel cold starts, each call triggers a DB connection. Settings and doctor list are essentially static within a session — they do not need to be refetched on every refresh.  
**Remediation:**
- Cache `settings` and `doctors` in React state at `App.tsx` level (already done for `clinicSettings`). Pass as props to Dashboard.
- Remove the `yesterdayData` API call — the comparison can be computed from a lightweight `COUNT` query added to the daily appointments response.

---

### SCAL-06 — `AppointmentsHub` fetches a 44-day window on every `refreshKey` change (Medium)
**File:** `src/components/appointments/AppointmentsHub.tsx` lines 54–65  
**Evidence:**
```ts
const startDate = format(subDays(new Date(), 30), 'yyyy-MM-dd');
const endDate   = format(addDays(new Date(), 14),  'yyyy-MM-dd');
const [appts, docs] = await Promise.all([
  api.getAppointments({ startDate, endDate }),
  ...
]);
```
Every time `refreshKey` increments (after a new booking), 44 days of appointments (potentially hundreds of records) are re-fetched. Client-side filtering handles doctor/status/date, so the user sees their selected day's view from a pre-fetched 44-day buffer.  
**Remediation:** Keep the rolling-window approach (it reduces subsequent API calls) but debounce or cancel in-flight fetches before starting a new one (an `AbortController` pattern similar to `NewAppointmentModal`'s conflict check).

---

### SCAL-07 — No connection pooling configuration for the Neon HTTP driver (Medium)
**File:** `src/server/db/connection.ts`  
**Evidence:**
```ts
const sql = neon(process.env.DATABASE_URL);
```
`neon()` creates one HTTP client instance per module load. Neon's HTTP driver is stateless (each query is an HTTP POST to Neon's edge), so traditional connection pool limits don't apply. However, concurrent heavy-write operations (e.g., mass appointment import) would spawn many simultaneous HTTP requests to Neon. No retry logic or backoff is implemented.  
**Remediation:** Wrap the `query()` helper with a simple retry + exponential backoff for transient Neon `503` / connection errors:
```ts
async function queryWithRetry<T>(text: string, params?: any[], attempts = 3): Promise<T[]> {
  for (let i = 0; i < attempts; i++) {
    try { return await sql(text, params ?? []); }
    catch (err: any) {
      if (i === attempts - 1 || !isRetryable(err)) throw err;
      await new Promise(r => setTimeout(r, 200 * 2 ** i));
    }
  }
}
```

---

### SCAL-08 — Audit log table has no retention/pruning mechanism (Medium)
**File:** `src/server/db/database.ts` `logAudit()`; `schema.sql`  
**Evidence:** Every user action writes a row to `audit_logs`. There is no `DELETE WHERE created_at < NOW() - INTERVAL '1 year'` scheduled job, no archive strategy, and the table's `LIMIT 100` UI cap means old logs are simply hidden rather than pruned. On a busy clinic, audit_logs can grow to millions of rows in 1–2 years.  
**Remediation:** Add a scheduled Postgres function or a Vercel cron job to archive/delete audit records older than a configurable retention period (default: 2 years).

---

### SCAL-09 — Prescription reminder messages template substitution runs per-appointment in JavaScript (Medium)
**File:** `src/server/db/database.ts` `createAppointment()` lines 1232–1250  
**Evidence:**
```ts
const msg = tpl
  .replace('{{patientName}}', ...)
  .replace('{{doctorName}}', ...)
  ...
await query(`INSERT INTO appointment_reminders ...`, [...]);
```
Every appointment creation fetches patient, doctor, and settings records (3 extra queries) to build a reminder message. This adds 3 sequential round-trips per appointment booking.  
**Remediation:** The reminder can be built lazily when it is actually sent, rather than at creation time. Or batch-load settings into the function signature at server start.

---

### SCAL-10 — No HTTP caching headers on API responses (Medium)
**File:** `server.ts` — all GET handlers  
**Evidence:** No `Cache-Control`, `ETag`, or `Last-Modified` headers are set on any GET response. Stable resources (clinic settings, doctor list, appointment types) are re-fetched on every component mount with no browser or CDN caching.  
**Remediation:** Set `Cache-Control: no-store` on sensitive patient data. Set `Cache-Control: public, max-age=60, stale-while-revalidate=300` on stable resources like `GET /api/settings` and `GET /api/doctors`.

---

### SCAL-11 — No health check endpoint (Low)
**File:** `server.ts`  
**Evidence:** No `GET /health` or `GET /api/health` endpoint exists. Vercel Deployments and monitoring tools cannot perform a lightweight liveness check without triggering a DB query.  
**Remediation:**
```ts
app.get('/api/health', (_req, res) => res.json({ status: 'ok', ts: Date.now() }));
```

---

### SCAL-12 — Frontend bundle has no code-splitting (Low)
**File:** `app/vite.config.ts`  
**Evidence:** The Vite config has no `build.rollupOptions.output.manualChunks`. The entire app (React, Lucide icons, date-fns, all components) is bundled into a single chunk. Lucide React alone adds ~2MB+ of icon SVGs.  
**Remediation:** Add manual chunk splitting:
```ts
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        vendor: ['react', 'react-dom'],
        icons: ['lucide-react'],
        dateFns: ['date-fns'],
      }
    }
  }
}
```
Also add `React.lazy()` / `<Suspense>` for the heavier hub components (PatientProfileView, PrintCenterModal).

---

### SCAL-13 — `@neondatabase/serverless` version is pinned to `0.10.4` — check for updates (Low)
**File:** `app/package.json`  
**Evidence:** `"@neondatabase/serverless": "0.10.4"` — pinned exactly. At time of audit this is current but the package has frequent minor releases with performance and HTTP/2 improvements.  
**Remediation:** Test compatibility with latest minor version and update. Use exact pinning (already doing this) which is correct.
