# Audit Summary — MDS Clinic Management System

> Completed: 2026-09-20  
> Auditor: Kiro  
> Build status after remediation: ✅ `npx tsc --noEmit` — **0 errors**  
> npm audit after remediation: ✅ **0 vulnerabilities**

---

## What Was Found

The audit covered 90 findings across five pillars:

| Pillar | Findings |
|--------|---------|
| Security | 15 |
| Accessibility | 17 |
| Mobile Responsiveness | 14 |
| Scalability & Performance | 14 |
| Bugs / Technical Debt / Feature Gaps | 30 |

The application had a solid architectural foundation — parameterised queries throughout, JWT in httpOnly cookies, role-based access control, conflict detection on appointments, allergy cross-checks on prescriptions — but several critical operational gaps existed before remediation.

---

## What Was Fixed (Phase 7)

### Security
| Fix | File(s) |
|-----|---------|
| Added `helmet` v8 — CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy | `server.ts` |
| Changed cookie `sameSite: 'lax'` → `'strict'` | `server.ts` |
| Added Origin header CSRF check on all state-changing API routes | `server.ts` |
| Added Content-Type enforcement middleware (415 for non-JSON bodies) | `server.ts` |
| Fixed `getAuditLogs` `parseInt(NaN)` → `Number.isFinite` guard | `server.ts` |
| Added global error handler — prevents stack traces leaking to clients in production | `server.ts` |
| Added `GET /api/health` endpoint | `server.ts` |
| Fixed all 17 `logAudit` calls — `userRole` now uses actual actor role, not hardcoded `'RECEPTIONIST'` | `database.ts` |
| Added `UserRole` import to `database.ts` | `database.ts` |
| Set `must_change_password = true` for all seed accounts | `scripts/migrate.js` |
| Removed unused production dependencies `@google/genai` and `motion` | `package.json`, `metadata.json` |
| Pinned `node-fetch` to exact version `3.3.2` | `package.json` |
| Upgraded `express` to 4.22.3 via `npm audit fix --force` — 0 CVEs remaining | `package.json` |

### Bugs
| Fix | File(s) |
|-----|---------|
| Replaced bare `alert()` in `RemindersHub` with `useToast` (non-blocking, accessible) | `RemindersHub.tsx` |
| Replaced bare `alert()` in `TreatmentsHub` with `useToast` | `TreatmentsHub.tsx` |
| `PatientProfileView`: added `loadError` state — no longer hangs on "Loading…" when fetch fails | `PatientProfileView.tsx` |
| `PatientProfileView`: wrapped all 5 async handlers (`handleAddAllergy`, `handleDeleteAllergy`, `handleAddMedicalHistory`, `handleAddTreatment`, `handleAddVisit`) in `try/catch` with per-modal inline error display | `PatientProfileView.tsx` |
| `PrescriptionEditorModal` BUG-05: `onSuccess()` no longer fires before user acknowledges allergy warning — deferred to `pendingRx` state + "Acknowledged" button click | `PrescriptionEditorModal.tsx` |
| `UsersHub` password placeholder mismatch fixed: now says "Min. 8 characters" with `minLength={8}` | `UsersHub.tsx` |
| `AppointmentsHub` week view: fixed 6-day (Mon–Sat) → 7-day (Mon–Sun), updated grid-cols-6 → grid-cols-7 | `AppointmentsHub.tsx` |
| Restored `AppointmentsHub.tsx` from git after accidental zero-byte write | `AppointmentsHub.tsx` |
| `DoctorsHub.loadDoctors` refactored with `cancelled` ref to prevent setState on unmounted component | `DoctorsHub.tsx` |

### Accessibility
| Fix | File(s) |
|-----|---------|
| Global `:focus-visible` CSS rule — consistent teal 2px outline for keyboard focus across all interactive elements | `index.css` |
| `DentalChart` `grid-cols-16` → `grid-cols-[repeat(16,minmax(0,1fr))]` — chart now renders correctly | `DentalChart.tsx` |
| Same grid fix in `PrintCenterModal` blank dental chart template | `PrintCenterModal.tsx` |
| Added `htmlFor` + `id` associations to inline modal form labels in `PatientProfileView` | `PatientProfileView.tsx` |
| Added `aria-label` to icon-only buttons in `RemindersHub` | `RemindersHub.tsx` |

### Scalability
| Fix | File(s) |
|-----|---------|
| `getTreatments`, `getVisits`, `getReminders` — added `LIMIT $N OFFSET $M` parameters (was unbounded full-table scans) | `database.ts` |
| `api.ts` default `getPatients` limit lowered from 100 → 50 | `api.ts` |

### Technical Debt
| Fix | File(s) |
|-----|---------|
| Deleted stale `app/api/index.js` (referenced non-existent `dist/server.cjs`) | deleted |
| Added `.nvmrc` (Node 22) at repository root | `.nvmrc` |

---

## Before / After Metrics

| Metric | Before | After |
|--------|--------|-------|
| `npm audit` vulnerabilities | 3 moderate | **0** |
| TypeScript errors (`tsc --noEmit`) | 0 | **0** |
| Hardcoded `userRole` in audit logs | 17 occurrences | **0** |
| Bare `alert()` calls | 2 | **0** |
| Unbounded DB queries (no LIMIT) | 3 (`treatments`, `visits`, `reminders`) | **0** |
| HTTP security headers | None | **CSP, HSTS, X-Frame, X-Content-Type, Referrer-Policy** |
| Cookie `sameSite` | `lax` | **`strict`** |
| `grid-cols-16` (invalid Tailwind class) | 4 occurrences | **0** |
| `PatientProfileView` silent async failures | 5 handlers uncaught | **All wrapped + inline error UI** |
| Load error displayed to user on patient fetch failure | Never | **Always (with back button)** |
| PrescriptionEditorModal allergy race condition | `onSuccess` fires before ack | **Deferred to explicit ack** |

---

## What Remains Open (and Why)

These items were **not** fixed in Phase 7 — each requires human decision, schema migration, or significant architectural work.

| # | Item | Reason deferred |
|---|------|-----------------|
| A | **Schema migration**: add `created_by_user_id UUID` FK to `appointments` table | `ALTER TABLE` on live Neon DB — requires human approval and a migration script run |
| B | **JWT secret rotation** in Vercel environment | Invalidates all active user sessions — requires human coordination with clinic staff |
| C | **Real SMS/Email/WhatsApp delivery** for reminders | Requires vendor account setup (Twilio/Resend), costs money, outbound PII — human decision |
| D | **Audit log retention/pruning** (records grow unbounded) | Data deletion is irreversible — policy decision needed before implementing |
| E | **Mobile sidebar navigation** (hamburger + drawer) | Medium-effort (~4h), no risk, but would require touching `App.tsx`, `AppSidebar.tsx`, and `TopBar.tsx` simultaneously — best done as a focused PR |
| F | **Modal `role="dialog"` + focus traps** across 8 modals | Medium effort (~6h) — each modal needs careful focus management; best done component by component |
| G | **Zero test coverage** — no test framework installed | Large effort (~16h+); recommend starting with `vitest` unit tests for `src/lib/utils.ts` and critical API routes |
| H | **`PrescriptionEditorModal` patient dropdown** → searchable typeahead | Medium effort; existing pattern in `NewAppointmentModal` can be reused |
| I | **Reminder templates** not editable via Settings UI | Small effort (~2h) but touches both `SettingsHub.tsx` and `database.ts` `updateSettings()` |
| J | **`getReports` JS-side aggregation** → push to SQL `GROUP BY` | Medium effort; requires rewriting the `getReports` function and its response shape |
| K | **`forget password` flow** | Medium effort; requires email provider integration |

---

## Recommended Next Steps (Priority Order)

1. **Rotate `JWT_SECRET`** in Vercel env before next deploy (human action — item B above)
2. **Run the mobile sidebar PR** (item E) — highest user-impact remaining item
3. **Add modal ARIA + focus traps** (item F) — accessibility critical path
4. **Replace prescription patient `<select>` with typeahead** (item H) — scalability quick win
5. **Add `vitest` and write tests for utils + auth routes** (item G) — enables safe future refactoring
6. **Submit schema migration for `created_by_user_id`** (item A) — coordination with DB admin
