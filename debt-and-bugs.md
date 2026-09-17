# Bugs, Technical Debt & Feature Gaps

> Audit date: 2026-09-16  
> Method: Static source review + logic analysis

---

## Summary

| Category | Count |
|----------|-------|
| Bugs (logic errors / unhandled errors) | 11 |
| Technical Debt | 12 |
| Feature Gaps | 7  |
| **Total** | **30** |

---

## Bugs

### BUG-01 — `PatientProfileView` async handlers have no try/catch — errors are swallowed silently
**File:** `src/components/patients/PatientProfileView.tsx` lines 222–300  
**Evidence:** `handleAddAllergy`, `handleDeleteAllergy`, `handleAddTreatment`, `handleAddVisit` are all `async` functions with no `try/catch`. If the API call throws (network error, 400/500 response), the `await` will throw an unhandled promise rejection. React does not surface this to the UI. The user sees nothing — no error message, no rollback of optimistic state.
```ts
const handleAddAllergy = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!newAllergen) return;
  const newItem = await api.addAllergy(...); // throws → silent failure
  setPatient((prev: any) => ...); // never runs
};
```
**Reproduction:** Submit "Add Allergy" with a duplicate allergen name (or with no network) — form dismisses, no allergy appears, no error shown.  
**Fix:** Wrap each handler in `try/catch`, maintain per-modal error state, and show an inline error message in each inline modal form.

---

### BUG-02 — `handleUpdateToothCondition` in `PatientProfileView` shows an error but optimistic state is inconsistent
**File:** `src/components/patients/PatientProfileView.tsx` lines 189–200  
**Evidence:**
```ts
const handleUpdateToothCondition = async (toothNumber: number, condition: ToothCondition, notes?: string) => {
  const updated = await api.updateToothCondition(...);
  setPatient((prev: any) => { ... }); // optimistic update
};
```
The function has no `try/catch`. If `api.updateToothCondition` throws, the optimistic state is NOT applied (because the throw happens before `setPatient`), which is correct behaviour — but `DentalChart.tsx` already has its own `try/catch` around `onUpdateToothCondition()` that shows `saveError`. So the error IS displayed in the chart editor. The mismatch: if the API call succeeds but the response data is malformed, `setPatient` can receive `undefined` as `updated`, corrupting the local dental history array.  
**Fix:** Guard against `undefined` updated value:
```ts
if (updated) setPatient(...);
```

---

### BUG-03 — `RemindersHub` uses bare `alert()` for send errors
**File:** `src/components/reminders/RemindersHub.tsx` line 34  
**Evidence:**
```ts
alert(`Failed to send reminder: ${err.message}`);
```
`alert()` is synchronous, blocks the UI thread, and is inaccessible to screen readers. It also leaks raw error messages (including database error strings) directly to the user. The `Toast` component exists specifically to replace this pattern.  
**Fix:** Import `useToast` from `../ui/Toast.js` and use `showToast(err.message, 'error')`.

---

### BUG-04 — `TreatmentsHub` uses bare `alert()` for status update errors
**File:** `src/components/treatments/TreatmentsHub.tsx` line 47  
**Evidence:**
```ts
alert(`Error updating treatment: ${err.message}`);
```
Same issue as BUG-03.  
**Fix:** Use `useToast` / `showToast`.

---

### BUG-05 — `PrescriptionEditorModal` calls `onSuccess(rx)` before the allergy warning is acknowledged
**File:** `src/components/prescriptions/PrescriptionEditorModal.tsx` lines 148–163  
**Evidence:**
```ts
if ((rx as any).allergyWarnings) {
  setServerAllergyWarning((rx as any).allergyWarnings);
  onSuccess(rx);  // ← called here
  if (shouldPrint && onOpenPrintCenter) { ... }
  return; // stay open so user sees the warning
}
```
`onSuccess(rx)` fires immediately when an allergy warning exists, which in the calling context (`App.tsx`) closes the modal (`setIsNewPrescriptionOpen(false)`). But the `return` statement on the next line tries to keep the modal open. These two actions conflict: the parent closes the modal before the warning can be read.  
**Reproduction:** Create a prescription for a patient with a documented allergy matching a prescribed drug. The warning panel briefly appears then the modal closes.  
**Fix:** Do not call `onSuccess` until the user explicitly acknowledges the warning. Add an "Acknowledged — Save & Close" button that calls `onSuccess(rx); onClose()`.

---

### BUG-06 — `DoctorsHub.loadDoctors` re-fetches selected doctor on every refresh, resetting schedule view
**File:** `src/components/doctors/DoctorsHub.tsx` lines 24–42  
**Evidence:**
```ts
const loadDoctors = async () => {
  const docs = await api.getDoctors(true);
  setDoctors(docs);
  if (docs.length > 0 && !selectedDoctor) {
    const fullDoc = await api.getDoctorById(docs[0].id);
    setSelectedDoctor(fullDoc);
  } else if (selectedDoctor) {
    const fullDoc = await api.getDoctorById(selectedDoctor.id);
    setSelectedDoctor(fullDoc); // ← always re-fetches
  }
};
```
Every time `loadDoctors()` is called (e.g., after saving a doctor), the selected doctor's full profile is re-fetched and state is replaced. If the user had scrolled the exceptions list or had an exception modal open, the state reset closes it.  
**Fix:** Only re-fetch the selected doctor if its `id` is still in the returned list. Use the existing `refreshed` pattern already used in `handleToggleDayAvailability`.

---

### BUG-07 — `AppointmentsHub` week view only shows Mon–Sat; Sunday appointments are invisible
**File:** `src/components/appointments/AppointmentsHub.tsx` lines 113–115  
**Evidence:**
```ts
const weekDays = Array.from({ length: 6 }).map((_, i) => addDays(weekStart, i)); // Mon to Sat
```
The comment says "Mon to Sat" and this is intentional for the clinic, but appointments created on Sundays (which the conflict check allows when `doctor.availability` has Sunday = available) will never appear in the week view. The list view shows them correctly.  
**Fix (if Sunday clinic is possible):** Change `{ length: 6 }` to `{ length: 7 }` to include Sunday. Otherwise document clearly that Sunday is not a working day and add a backend constraint.

---

### BUG-08 — `ReceptionistDashboard` status update errors are silently swallowed
**File:** `src/components/dashboard/ReceptionistDashboard.tsx` lines 88–92  
**Evidence:**
```ts
} catch (err: any) {
  // surface inline in the future; for now log to console — never block UI with alert()
  console.error(`Error updating appointment status: ${err.message}`);
}
```
The `TODO`-style comment acknowledges this is incomplete. Status update failures on the dashboard (e.g. 400 from invalid transition, 401 from expired session) are invisible to the user.  
**Fix:** Add a dismissable inline error banner at the top of the schedule table, or mount and use the `Toast` system.

---

### BUG-09 — `UsersHub` password minimum length mismatch — placeholder says 6 characters, server enforces 8
**File:** `src/components/users/UsersHub.tsx` line ~196; `server.ts` lines 334–336  
**Evidence:**
```tsx
placeholder={editingUser ? 'Leave blank to keep unchanged' : 'Min. 6 characters'}
```
vs.
```ts
if (password.length < 8) {
  return res.status(400).json({ ..., message: 'Password must be at least 8 characters.' });
}
```
A user entering a 7-character password sees no client-side error, submits, then gets a server error. Confusing UX.  
**Fix:** Change placeholder to "Min. 8 characters" and add `minLength={8}` to the password input.

---

### BUG-10 — `getPatientById` can query by `patient_number` but IDOR guard is only by `id`
**File:** `src/server/db/database.ts` lines ~761–765  
**Evidence:**
```ts
const ptRows = await query(
  'SELECT * FROM patients WHERE id = $1 OR patient_number = $1',
  [id]
);
```
The endpoint `GET /api/patients/:id` accepts both UUIDs and `PT-xxxxxx` patient numbers. This is intentional for convenience, but the route parameter can be any string a user types in the URL. There is no constraint on what `req.params.id` values are checked — a user could enumerate patients by guessing sequential `PT-000001`, `PT-000002`, etc.  
**Fix:** Accept only UUID format for the REST endpoint. Expose a separate `GET /api/patients?patientNumber=PT-000001` search endpoint with auth and rate limiting.

---

### BUG-11 — `loadPatientData` error in `PatientProfileView` is console-only; user sees "Loading…" forever
**File:** `src/components/patients/PatientProfileView.tsx` lines 115–126  
**Evidence:**
```ts
} catch (err) {
  console.error('Failed to load patient:', err);
} finally {
  setLoading(false);
}
```
If `getPatientById` returns 404 or throws, `patient` remains `null` and `loading` is set to `false`. The component then renders `"Loading patient clinical chart..."` indefinitely because:
```tsx
if (loading || !patient) {
  return <div ...>Loading patient clinical chart...</div>;
}
```
This is `loading = false` AND `patient = null` — the guard passes into the loading state even though loading is done.  
**Fix:** Add a separate `loadError` state. Show an error message and a "Back to Patients" button when `!patient && !loading`.

---

## Technical Debt

### DEBT-01 — Zero test coverage
**Files:** Entire codebase  
**Evidence:** No test files (`*.test.*`, `*.spec.*`) exist. No test framework is configured (`jest`, `vitest`, `playwright`). The `"lint"` script only runs `tsc --noEmit`.  
**Impact:** Any refactor, dependency update, or feature change has no safety net.  
**Remediation:** Add `vitest` (works natively with Vite). Start with unit tests for the pure utility functions (`src/lib/utils.ts`) and DB mapper functions. Add integration tests for the most critical API routes (login, appointment creation, conflict check).

---

### DEBT-02 — `patient` state in `PatientProfileView` is typed `any`
**File:** `src/components/patients/PatientProfileView.tsx` line 26  
**Evidence:**
```ts
const [patient, setPatient] = useState<any>(null);
```
This disables TypeScript checking for the most data-heavy component in the app. Every `patient.firstName`, `patient.appointments`, etc. access is untyped.  
**Remediation:** Use the proper union type from `api.ts`:
```ts
type PatientFull = Patient & {
  medicalHistory: PatientMedicalHistory[];
  allergyList: PatientAllergy[];
  ...
};
const [patient, setPatient] = useState<PatientFull | null>(null);
```

---

### DEBT-03 — `AuditLog` userRole is always stored as `'RECEPTIONIST'` in DB functions
**File:** `src/server/db/database.ts` — 30+ `logAudit` calls  
**Evidence:** The `userRole` parameter is hardcoded to `'RECEPTIONIST'` in every DB-layer `logAudit` call, rather than using the actual role passed from `server.ts`. Audit reports are therefore inaccurate.  
**Remediation:** Thread `actorRole: UserRole` through all function signatures and use it in `logAudit`.

---

### DEBT-04 — `ClinicSettings` type has duplicate / aliased fields (`address` + `addressLine1`+`addressLine2`+`city`+`state`)
**File:** `src/types/index.ts` lines 195–210; `src/server/db/database.ts` `mapSettings()`  
**Evidence:**
```ts
address: [r.address_line1, r.address_line2, r.city, r.state].filter(Boolean).join(', ')
// + individual fields: addressLine1, addressLine2, city, state, zipCode
```
The `address` field is a computed denormalised string created in the mapper, alongside the structured individual fields. Components access both `settings.address` and `settings.addressLine1` in different places, creating inconsistency.  
**Remediation:** Remove the computed `address` string field from the type. Update components that use `settings.address` to build the display string inline or via a utility function.

---

### DEBT-05 — `server.ts` uses positional parameters in `updateSettings` with 19 `COALESCE` columns — brittle
**File:** `src/server/db/database.ts` lines 1620–1660  
**Evidence:** The `updateSettings` function uses a single UPDATE with 19 positional `$1`–`$19` parameters. Adding a new settings field requires manually updating the parameter list, the function signature, and the SQL in lockstep — a frequent source of off-by-one bugs.  
**Remediation:** Use the same dynamic SET builder pattern already used in `updatePatient()` and `updateReceptionist()`.

---

### DEBT-06 — `Appointment.createdBy` is stored as the user's *name*, not their *id*
**File:** `schema.sql` line ~80; `server.ts` `createAppointment()` — `apptData.createdBy = cu.name`  
**Evidence:**
```ts
apptData.createdBy = cu.name;
```
The appointments table `created_by` column is `TEXT NOT NULL DEFAULT 'Receptionist'` and stores the user name string. If a receptionist's name is changed, historical appointments still reference the old name. The audit log correctly stores `user_id`; appointments should too.  
**Remediation:** Add a `created_by_user_id UUID REFERENCES users(id)` column alongside the existing `created_by TEXT` (for display). Schema migration required.

---

### DEBT-07 — `app/api/index.js` loads `dist/server.cjs` but build produces `.mjs`
**File:** `app/api/index.js`  
**Evidence:**
```js
const app = require(path.join(__dirname, '..', 'dist', 'server.cjs'));
```
The `package.json` build command outputs `server.mjs` (ESM format):
```json
"build": "... esbuild server.ts --bundle --format=esm ... --outfile=dist/server.mjs"
```
The root `api/index.js` (used by Vercel) loads `app/dist/server.mjs` correctly (via dynamic `import()`), but the `app/api/index.js` still references `.cjs` — this is a stale file that would fail if Vercel ever routed to it.  
**Remediation:** Delete `app/api/index.js` (dead code) and ensure `api/index.js` at the root is the only Vercel entry point.

---

### DEBT-08 — Components load data in separate `useEffect` calls without abort cleanup
**Files:** Most hub components  
**Evidence:** Many `useEffect` + `async function load()` patterns do not use `AbortController` or check if the component is still mounted before calling state setters. If a user navigates away while a fetch is in progress, they get a React "can't update state on unmounted component" warning in dev.  
**Remediation:** Use the `useEffect` cleanup return to set a `cancelled` flag or use `AbortController`:
```ts
useEffect(() => {
  let cancelled = false;
  loadData().catch(err => { if (!cancelled) console.error(err); });
  return () => { cancelled = true; };
}, []);
```

---

### DEBT-09 — All inline modals in `PatientProfileView` are rendered in the middle of the component body
**File:** `src/components/patients/PatientProfileView.tsx` lines 960–1120  
**Evidence:** Inline modal JSX for Add Medical Condition, Add Allergy, Add Treatment, Add Visit, Delete Allergy confirm — all rendered inside the main component's return block as conditionally shown `<div className="fixed inset-0 ...">` elements. This bloats the component to 1,100+ lines.  
**Remediation:** Extract each inline modal into its own component (e.g., `AddAllergyModal`, `AddTreatmentModal`). This also allows proper focus trapping per modal (see ACC-01).

---

### DEBT-10 — `metadata.json` references `MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API` but Gemini is not used
**File:** `app/metadata.json`  
**Evidence:**
```json
{ "majorCapabilities": ["MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API"] }
```
The `@google/genai` package is present in `package.json` but never imported. This capability declaration is misleading and triggers an unnecessary external dependency.  
**Remediation:** Remove from `metadata.json`. Remove `@google/genai` from `package.json`.

---

### DEBT-11 — No `.nvmrc` in repo root — only in `app/`
**File:** `app/.nvmrc`  
**Evidence:** The `.nvmrc` file specifying Node version is inside `app/`. Developers running `nvm use` at the repo root get no version pin, risking mismatched Node versions.  
**Remediation:** Add `.nvmrc` (or `.node-version`) at the repository root, or document the required Node version in the root `README.md`.

---

### DEBT-12 — No `prettier` or `eslint` config — code style consistency relies on convention
**File:** Root and `app/` directory  
**Evidence:** No `.eslintrc`, `.prettierrc`, `.eslintignore` found. The `"lint"` script is only `tsc --noEmit` (type checking only). Code style is manually consistent but unenforceable.  
**Remediation:** Add `eslint` with `@typescript-eslint/eslint-plugin` and `eslint-plugin-react-hooks`. Add `prettier`. Wire into pre-commit hooks via `husky` + `lint-staged`.

---

## Feature Gaps

### GAP-01 — No offline / network-error state handling
**Files:** All hub components  
**Evidence:** When the API is unreachable (network offline, Vercel cold start timeout), all loading states stay as `"Loading..."` indefinitely. No retry button, no "you appear to be offline" message.  
**Remediation:** Add a global `onUnhandledRejection` handler or an `ErrorBoundary` that detects network errors and shows a friendly offline state with a retry button.

---

### GAP-02 — No pagination in the UI for Patients, Treatments, Reminders, Visits
**Files:** `PatientsHub.tsx`, `TreatmentsHub.tsx`, `RemindersHub.tsx`  
**Evidence:** These views show all returned records without pagination controls (Next/Previous or infinite scroll). As data grows, these become unusable walls of records.  
**Remediation:** Add page controls using the existing `limit`/`offset` backend support (for patients). Add the same to treatments and reminders.

---

### GAP-03 — `ToastContainer` is built but never mounted in the app
**File:** `src/components/ui/Toast.tsx`; `src/App.tsx`  
**Evidence:** `useToast()` and `<ToastContainer>` are defined and used in `DoctorsHub` (for `ConfirmDialog`) but the toast system itself is never wired at the app root level. Success/error toasts are not possible without component-level `useState` workarounds.  
**Remediation:** Add `useToast()` to `App.tsx` and pass `showToast` down as a prop or via React Context.

---

### GAP-04 — Reminders are created in the DB but never actually sent
**File:** `src/server/db/database.ts` `triggerManualReminder()`; `RemindersHub.tsx`  
**Evidence:**
```ts
UPDATE appointment_reminders SET status = 'SENT', sent_at = NOW() WHERE id = $1
```
"Sending" a reminder only marks it as `SENT` in the database. No SMS gateway, email provider, or WhatsApp API is called. The README states "SMS / Email / WhatsApp appointment reminder queue" but the actual delivery is simulated.  
**Remediation:** Integrate a real messaging provider (Twilio for SMS/WhatsApp, SendGrid/Resend for email). Gate behind a feature flag so the mock behavior continues in development.

---

### GAP-05 — No password reset / "forgot password" flow
**File:** `src/components/auth/LoginScreen.tsx`; `server.ts`  
**Evidence:** The login screen has no "Forgot Password" link. An admin must manually reset a password via `UsersHub` → Edit. Users who forget their password are locked out.  
**Remediation:** Add a "Reset Password" flow: admin generates a reset token, emails a link, user sets a new password via a token-authenticated endpoint.

---

### GAP-06 — No confirmation before destructive actions in most hubs
**Files:** `RemindersHub.tsx` (resend), `PatientProfileView.tsx` (delete allergy without confirm)  
**Evidence:** Deleting an allergy record calls `handleDeleteAllergy` directly without a confirmation step. The `ConfirmDialog` component exists and is used in `DoctorsHub` and `UsersHub`, but not in allergy deletion or other destructive medical record operations.  
**Remediation:** Use `ConfirmDialog` before deleting medical history entries, allergies, and medications.

---

### GAP-07 — Settings `reminderTemplates` JSONB field cannot be edited via the SettingsHub UI
**File:** `src/components/settings/SettingsHub.tsx`; `src/server/db/database.ts` `updateSettings()`  
**Evidence:** The `SettingsHub` has fields for clinic info, address, hours — but no UI to edit the `reminderTemplates` (`confirmation`, `reminder`, `followup` template strings). The `updateSettings` DB function also does not include `reminder_templates` in its UPDATE clause. The templates are hardcoded in the schema DEFAULT and cannot be customised without direct DB access.  
**Remediation:** Add three `<textarea>` fields to `SettingsHub` for the reminder templates. Update `updateSettings()` to accept and persist `reminderTemplates`.
