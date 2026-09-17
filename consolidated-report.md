# Consolidated Audit Report — MDS Clinic Management System

> Audit date: 2026-09-16  
> Auditor: Kiro  
> Phases covered: 0 (Orientation) → 5 (Bugs/Debt/Gaps)

---

## System Snapshot

| Dimension | Value |
|-----------|-------|
| Frontend | React 19, TypeScript, Tailwind CSS v4, Vite 6 |
| Backend | Express 4, Node.js 18+, tsx (dev) |
| Database | Neon Postgres (serverless HTTP driver) |
| Auth | JWT httpOnly cookies, 12h expiry, bcrypt via pgcrypto |
| Deployment | Vercel (monorepo) — single serverless function |
| Test coverage | **0%** — no test framework configured |
| npm vulnerabilities | 3 moderate (all auto-fixable) |
| Total findings | **90 across all five pillars** |

---

## Prioritized Backlog

Sorted by: **Severity first → Effort second** (S = Small ≤ 2h, M = Medium 2–8h, L = Large > 8h)

Findings marked ⚠️ **Breaking / Schema change** require a DB migration or a public API contract change.

---

### CRITICAL — Fix before next deployment

| # | Pillar | Finding | Severity | Effort | File(s) | Recommended Fix |
|---|--------|---------|----------|--------|---------|-----------------|
| 1 | Security | No HTTP security headers (no CSP, HSTS, X-Frame-Options, X-Content-Type-Options) | **Critical** | S | `server.ts` | Add `helmet` middleware before all routes |
| 2 | Accessibility | All modals missing `role="dialog"`, `aria-modal`, focus trap — primary workflows inaccessible to screen readers | **Critical** | M | `NewAppointmentModal`, `RescheduleModal`, `AppointmentDetailModal`, `NewPatientModal`, `PrescriptionEditorModal`, `PrintCenterModal`, `UsersHub`, `DoctorsHub` | Add `role="dialog" aria-modal="true" aria-labelledby` to every modal root; implement focus trap `useEffect` |
| 3 | Mobile | No mobile navigation — sidebar completely inaccessible below ~1024px | **Critical** | M | `AppSidebar.tsx`, `App.tsx`, `TopBar.tsx` | Add hamburger button + slide-in drawer with backdrop and `Escape`-to-close |
| 4 | Bugs | `PatientProfileView` async handlers (`handleAddAllergy`, `handleDeleteAllergy`, `handleAddTreatment`, `handleAddVisit`) have no `try/catch` — errors swallowed silently | **High** | S | `PatientProfileView.tsx` lines 222–300 | Wrap each handler in `try/catch`, add per-modal `errorState`, show inline error message |
| 5 | Bugs | `loadPatientData` error leaves UI in permanent "Loading…" state when patient fetch fails | **High** | S | `PatientProfileView.tsx` lines 115–126 | Add `loadError` state; show error + "Back to Patients" button when `!patient && !loading` |

---

### HIGH — Fix in current sprint

| # | Pillar | Finding | Severity | Effort | File(s) | Recommended Fix |
|---|--------|---------|----------|--------|---------|-----------------|
| 6 | Security | Memory-only login rate limiter resets on every Vercel cold start — no brute-force protection in production | **High** | M | `server.ts` lines 102–125 | Replace `Map` with persistent counter in Neon Postgres or Vercel KV |
| 7 | Security | No CSRF protection — `sameSite: 'lax'` is insufficient for state-changing API calls | **High** | S | `server.ts` line 45 | Change to `sameSite: 'strict'`; validate `Origin` header on POST/PUT/DELETE |
| 8 | Security | Sensitive-operation API routes (`/api/patients`, `/api/treatments`, etc.) not restricted to specific roles — DOCTOR role can mutate all data | **High** | S | `server.ts` lines 375–830 | Add explicit `requireRole` guards to write routes |
| 9 | Accessibility | Form inputs across all components have no `<label htmlFor>` association — unlabeled to screen readers | **High** | M | All form components | Add `id` to every input; add `htmlFor` to every `<label>` |
| 10 | Accessibility | Icon-only buttons throughout have no `aria-label` — invisible to screen readers and voice control | **High** | S | `DoctorsHub`, `PatientProfileView`, `AppointmentsHub`, `TopBar`, `UsersHub` | Add `aria-label` to every icon-only `<button>` |
| 11 | Accessibility | No skip-navigation link — keyboard users must Tab through 11 sidebar items on every page | **High** | S | `App.tsx`, `AppSidebar.tsx` | Add visually-hidden skip link as first body child; add `id="main-content"` to `<main>` |
| 12 | Accessibility | No `aria-live` region for dynamic status updates — `ToastContainer` exists but is never mounted | **High** | S | `App.tsx`, `Toast.tsx` | Mount `useToast` + `<ToastContainer aria-live="polite">` in `App.tsx`; connect all error/success paths |
| 13 | Mobile | Day timeline (700px) and week view (900px) force horizontal scroll — unusable on tablets | **High** | M | `AppointmentsHub.tsx` lines 257, 350 | Render condensed day-list on `< md`; collapse week to 3-day or list on `< lg` |
| 14 | Scalability | `getTreatments`, `getVisits`, `getReminders` have no `LIMIT` — entire table returned on global fetch | **High** | S | `database.ts` lines 1318, 1352, 1588 | Add `LIMIT $N OFFSET $M` parameters; add pagination query params to API routes |
| 15 | Scalability | `getReports` loads all appointment/treatment rows into Node.js for JS aggregation — will timeout at scale | **High** | M | `database.ts` lines 1685–1728 | Push `GROUP BY`, `COUNT(*)`, `SUM(cost)` aggregations into SQL |
| 16 | Bugs | `alert()` in `RemindersHub` — blocks UI thread, inaccessible, leaks error message | **High** | S | `RemindersHub.tsx` line 34 | Replace with `useToast` / `showToast(err.message, 'error')` |
| 17 | Bugs | `alert()` in `TreatmentsHub` — same issue | **High** | S | `TreatmentsHub.tsx` line 47 | Replace with `useToast` / `showToast` |
| 18 | Bugs | `PrescriptionEditorModal` calls `onSuccess()` before allergy warning is acknowledged — modal closes before user can read warning | **High** | S | `PrescriptionEditorModal.tsx` lines 148–163 | Gate `onSuccess` / `onClose` behind explicit "Acknowledged" button click |
| 19 | Bugs | Dashboard status update errors silently swallowed (only `console.error`) | **High** | S | `ReceptionistDashboard.tsx` lines 88–92 | Surface via toast or inline error banner |
| 20 | Security | `npm audit` — 3 moderate vulns in `qs` / `express` / `body-parser` (DoS vectors) | **High** | S | `package.json` | Run `npm audit fix` to upgrade `express` to `≥ 4.22.x` |

---

### MEDIUM — Fix in next sprint

| # | Pillar | Finding | Severity | Effort | File(s) | Recommended Fix |
|---|--------|---------|----------|--------|---------|-----------------|
| 21 | Security | JWT cookie `sameSite: 'lax'` — see #7 above | Med | — | — | Covered by #7 |
| 22 | Security | Stack traces / DB error messages exposed to API clients in production | **Med** | S | `server.ts` — all catch blocks | Return generic messages in `IS_PROD`; log full error server-side only |
| 23 | Security | Default seed password `dental123` hardcoded; `mustChangePassword = false` for seeded accounts | **Med** | S | `scripts/migrate.js` lines 60–67 | Set `must_change_password = true` for all seed accounts |
| 24 | Security | `@google/genai` production dependency — unused, adds attack surface + bundle weight | **Med** | S | `package.json` | `npm uninstall @google/genai`; remove from `metadata.json` |
| 25 | Security | Audit log `userRole` hardcoded to `'RECEPTIONIST'` in all DB functions regardless of actual role | **Med** | S | `database.ts` — 30+ `logAudit` calls | Thread `actorRole` parameter through all DB function signatures |
| 26 | Accessibility | All focus indicators inconsistent — many buttons use `focus:outline-hidden` with no custom ring | **Med** | S | `index.css`, all components | Add global `:focus-visible` rule; remove bare `focus:outline-hidden` |
| 27 | Accessibility | Tab strip in `PatientProfileView` lacks `role="tablist"` / `role="tab"` / `aria-selected` ARIA pattern | **Med** | S | `PatientProfileView.tsx` lines 463–483 | Implement proper ARIA tabs pattern |
| 28 | Accessibility | `DentalChart` uses `grid-cols-16` — non-existent Tailwind class, chart renders incorrectly | **Med** | S | `DentalChart.tsx` lines 85, 135; `PrintCenterModal.tsx` lines 403, 415 | Use `grid-cols-[repeat(16,minmax(0,1fr))]` or extend Tailwind config |
| 29 | Accessibility | Very small text (9–11px) throughout for clinical data — readability concern | **Med** | M | All hub components | Floor at `text-xs` (12px) for any clinically meaningful text |
| 30 | Accessibility | `GlobalSearchModal` missing `role="dialog"`, `aria-modal`, focus trap | **Med** | S | `GlobalSearchModal.tsx` | Same fix as #2 |
| 31 | Mobile | `TopBar` quick actions (`New Patient`, `Print Center`) hidden on mobile with no alternative | **High** | S | `TopBar.tsx` | Add overflow `...` menu or bottom action bar on `< md` |
| 32 | Mobile | Prescription editor table forces horizontal scroll on tablets (min-w-[650px]) | **High** | M | `PrescriptionEditorModal.tsx` line 338 | Convert to stacked card layout on `< sm` |
| 33 | Mobile | Patient profile tab strip overflows without visible scroll indicator | **Med** | S | `PatientProfileView.tsx` ~line 465 | Add right-edge fade gradient to signal horizontal scrollability; `<select>` fallback on `< sm` |
| 34 | Mobile | Icon-only action buttons have ~22×22px tap targets — below 44×44px minimum | **Med** | S | `DoctorsHub`, `PatientProfileView`, `AppointmentsHub` | Change icon button padding to `p-2.5` minimum |
| 35 | Scalability | `PrescriptionEditorModal` fetches 100 patients into a `<select>` dropdown on every open | **High** | M | `PrescriptionEditorModal.tsx` lines 54–71 | Replace `<select>` with searchable typeahead (same pattern as `NewAppointmentModal`) |
| 36 | Scalability | `PatientsHub` hardcoded `limit=100` — transfers 100 full patient PII records per search | **Med** | S | `api.ts` line ~65; `PatientsHub.tsx` | Lower default to 50; add pagination controls to UI |
| 37 | Scalability | No HTTP cache headers on API responses — static resources refetched on every mount | **Med** | S | `server.ts` | Set `Cache-Control: public, max-age=60` on `GET /api/settings`, `GET /api/doctors` |
| 38 | Bugs | `UsersHub` password minimum length mismatch — UI says 6, server enforces 8 | **Med** | S | `UsersHub.tsx` ~line 196 | Change placeholder to "Min. 8 characters"; add `minLength={8}` to input |
| 39 | Bugs | `DoctorsHub.loadDoctors` always re-fetches and resets selected doctor state | **Med** | S | `DoctorsHub.tsx` lines 24–42 | Only re-fetch selected doctor if its `id` changed |
| 40 | Bugs | `AppointmentsHub` week view omits Sunday — appointments on Sunday are invisible | **Med** | S | `AppointmentsHub.tsx` line 113 | Change `{ length: 6 }` to `{ length: 7 }` or document Sunday-closed policy |
| 41 | Debt | Zero test coverage — no test framework configured | **High** | L | Entire codebase | Add `vitest`; start with `utils.ts` unit tests and critical API route integration tests |
| 42 | Debt | `PatientProfileView` types `patient` as `any` — disables all type checking for the largest component | **Med** | S | `PatientProfileView.tsx` line 26 | Type as `PatientFull | null` using existing type definitions |
| 43 | Debt | `PrescriptionEditorModal.tsx` inline modals embedded in `PatientProfileView` — 1,100-line component | **Med** | L | `PatientProfileView.tsx` | Extract `AddAllergyModal`, `AddTreatmentModal`, `AddVisitModal`, `AddMedicalHistoryModal` into separate components |

---

### LOW — Fix in backlog / as-you-go

| # | Pillar | Finding | Severity | Effort | File(s) | Recommended Fix |
|---|--------|---------|----------|--------|---------|-----------------|
| 44 | Security | No `Content-Type: application/json` validation on POST/PUT routes | Low | S | `server.ts` | Add middleware rejecting non-JSON bodies with 415 |
| 45 | Security | `getAuditLogs` `LIMIT` can receive `NaN` from `parseInt` — 500 error | Low | S | `server.ts` line ~820; `database.ts` line 1670 | Validate limit: `Number.isFinite(n) ? Math.min(Math.max(1, n), 500) : 100` |
| 46 | Security | `node-fetch` version unpinned (`^3.3.2`) | Low | S | `package.json` | Pin to exact `3.3.2` |
| 47 | Security | `motion` package unused production dependency | Low | S | `package.json` | `npm uninstall motion` |
| 48 | Security | No global API rate limiting on non-login endpoints | Low | M | `server.ts` | Add per-IP rate limiter (requires persistent store — coordinate with #6) |
| 49 | Security | IDOR: patient records accessible by guessing sequential `PT-xxxxxx` patient numbers | Low | S | `server.ts`, `database.ts` | Accept only UUID format on `GET /api/patients/:id`; expose separate search endpoint |
| 50 | Accessibility | Allergy warning emoji `⚠️` has no `aria-label` in some placements | Low | S | `PatientsHub`, `AppointmentDetailModal` | Add `role="img" aria-label="Allergy alert: {text}"` |
| 51 | Accessibility | Color is sole differentiator for appointment status (no shape/icon distinction) | Low | S | `utils.ts` `getStatusBadgeClasses()` | Add a small status-specific icon prefix to each badge |
| 52 | Accessibility | Doctor color swatches have no text alternative | Low | S | `AppointmentsHub`, `AppointmentDetailModal`, `ReceptionistDashboard` | Add `role="img" aria-label="Doctor: {name}"` |
| 53 | Mobile | Dental chart 8-column layout — teeth too small on narrow phones | Low | M | `DentalChart.tsx` | Increase touch target size on `< sm`; add scrollable arch layout option |
| 54 | Mobile | Print Center A4 preview unreadable at 375px | Low | S | `PrintCenterModal.tsx` | On `< md`, show simplified "Tap to Print" confirmation instead of full A4 preview |
| 55 | Mobile | Report date inputs have no `htmlFor` association — tapping label does nothing on iOS | Low | S | `ReportsHub.tsx` | Add `htmlFor` to date input labels |
| 56 | Scalability | `AppointmentsHub` 44-day window refetched on every `refreshKey` with no in-flight cancellation | Low | S | `AppointmentsHub.tsx` lines 54–65 | Add `AbortController` to cancel in-flight fetch before new one starts |
| 57 | Scalability | No retry/backoff logic on Neon HTTP driver transient errors | Low | M | `connection.ts` | Add exponential backoff wrapper around `query()` |
| 58 | Scalability | Audit log table has no retention/pruning mechanism — unbounded growth | Low | M | `database.ts`; `schema.sql` | Add scheduled Postgres function or Vercel cron to archive records > 2 years |
| 59 | Scalability | Appointment reminder message template substitution adds 3 extra DB queries per booking | Low | S | `database.ts` `createAppointment()` | Build reminder lazily at send-time; cache settings at module level |
| 60 | Scalability | No health check endpoint | Low | S | `server.ts` | Add `GET /api/health` returning `{ status: 'ok', ts }` |
| 61 | Scalability | No bundle code-splitting — all components in one chunk | Low | M | `vite.config.ts` | Add `manualChunks` for vendor/icons/date-fns; add `React.lazy` for heavy components |
| 62 | Bugs | `app/api/index.js` references `dist/server.cjs` but build outputs `.mjs` — stale dead file | Low | S | `app/api/index.js` | Delete `app/api/index.js` (dead code) |
| 63 | Bugs | `getPatientById` accepts `patient_number` format — allows sequential enumeration of all patients | Low | S | `database.ts`; `server.ts` | Only accept UUID on REST endpoint; use search endpoint for PT-number lookups |
| 64 | Debt | `ClinicSettings` has duplicate `address` + structured fields (`addressLine1/2/city/state`) | Low | S | `types/index.ts`; `database.ts` `mapSettings()` | Remove computed `address` field; compute display string in components |
| 65 | Debt | `updateSettings` uses 19 positional `COALESCE` params — brittle to extend | Low | M | `database.ts` lines 1620–1660 | Use dynamic SET builder (same pattern as `updatePatient`) |
| 66 | Debt | `Appointment.createdBy` stores user name string, not ID — breaks on name change | Low | M ⚠️ | `schema.sql`; `server.ts` | Add `created_by_user_id` FK column; schema migration required |
| 67 | Debt | All hub `useEffect` data loaders lack abort cleanup — stale setState on unmount | Low | S | Most hub components | Add `let cancelled = false` / return cleanup flag |
| 68 | Debt | No `prettier` / `eslint` config — code style unenforceable | Low | S | repo root | Add `eslint` + `@typescript-eslint` + `prettier`; wire to pre-commit with `husky` |
| 69 | Debt | `.nvmrc` only in `app/` subdir, not repo root | Low | S | `app/.nvmrc` | Add `.nvmrc` at repo root |
| 70 | Gaps | `ToastContainer` built but never mounted in app — toast system non-functional globally | High | S | `App.tsx`, `Toast.tsx` | Mount `useToast` + `<ToastContainer>` in `App.tsx`; expose via Context |
| 71 | Gaps | Reminders marked "SENT" in DB but no actual SMS/email/WhatsApp delivery | High | L | `database.ts`, `RemindersHub.tsx` | Integrate Twilio (SMS/WhatsApp) + Resend/SendGrid (email); gate with feature flag |
| 72 | Gaps | No offline / network error state — users see "Loading…" indefinitely when API is down | Med | M | All hub components | Add `ErrorBoundary` + offline detection with retry button |
| 73 | Gaps | No `forgot password` / self-service password reset flow | Med | M | `LoginScreen.tsx`; `server.ts` | Admin-generated reset token → email link → token-authenticated password change endpoint |
| 74 | Gaps | `SettingsHub` cannot edit reminder templates (JSONB field not in update query or UI) | Med | S | `SettingsHub.tsx`; `database.ts` `updateSettings()` | Add 3 `<textarea>` fields in `SettingsHub`; add `reminder_templates` to `updateSettings` SQL |
| 75 | Gaps | No pagination UI for Patients, Treatments, Reminders | Med | M | `PatientsHub`, `TreatmentsHub`, `RemindersHub` | Add Previous/Next page controls using existing `limit`/`offset` backend support |
| 76 | Gaps | Destructive medical record actions (delete allergy, delete medical history) have no confirmation | Med | S | `PatientProfileView.tsx` | Use existing `ConfirmDialog` before all delete operations |

---

## Items Requiring Human Approval Before Execution

The following require explicit sign-off because they are irreversible, affect production data, or change public API contracts:

| # | Item | Why it needs approval |
|---|------|-----------------------|
| A | Schema migration: add `created_by_user_id` column to `appointments` table (DEBT-06 / #66) | Requires `ALTER TABLE` on a live table — may lock rows |
| B | Secret rotation: change `JWT_SECRET` in Vercel env and re-deploy | All existing sessions immediately invalidated |
| C | Integrate real SMS/WhatsApp/email provider (#71) | Costs money; requires vendor account setup; outbound PII |
| D | Prune/archive audit logs > 2 years (#58) | Destructive — irreversible data deletion |

---

## Breaking Changes Summary

Any fix marked ⚠️ in the table above is a breaking change or schema migration:

- **#66** — Adding `created_by_user_id` to `appointments` is an additive column addition (non-breaking for existing code, but requires a migration script and the column will be `NULL` for historical rows).
- **#35** — Replacing the patients `<select>` with a typeahead changes the prescription editor's UX contract (non-breaking API, user-visible change).
- **JWT secret rotation (B)** — Hard-breaks all active sessions.
