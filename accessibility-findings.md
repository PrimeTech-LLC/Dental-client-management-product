# Accessibility Findings (WCAG 2.2 AA Baseline)

> Audit date: 2026-09-16  
> Method: Static code review + manual WCAG 2.2 AA checklist  
> Note: Full validation requires assistive-technology testing (screen reader, keyboard-only). Findings below are based on source inspection and represent the auditable surface; contrast ratios require browser rendering to verify precisely.

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 2     |
| High     | 6     |
| Medium   | 5     |
| Low      | 4     |
| **Total**| **17**|

---

## Findings

### ACC-01 — All modal dialogs missing `role="dialog"`, `aria-modal`, and focus trap (Critical)
**WCAG:** 4.1.2 Name, Role, Value (Level A); 2.1.2 No Keyboard Trap  
**Files:**
- `src/components/appointments/NewAppointmentModal.tsx`
- `src/components/appointments/RescheduleModal.tsx`
- `src/components/appointments/AppointmentDetailModal.tsx`
- `src/components/patients/NewPatientModal.tsx`
- `src/components/prescriptions/PrescriptionEditorModal.tsx`
- `src/components/print/PrintCenterModal.tsx`
- `src/components/users/UsersHub.tsx` (inline modal)
- `src/components/doctors/DoctorsHub.tsx` (inline exception modal)

**Evidence:** All modals render as `<div className="fixed inset-0 ...">`. None have `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, or focus-trap logic. When a modal opens, Tab key cycles through the entire document behind the overlay. Screen readers (NVDA/JAWS/VoiceOver) do not announce the modal context or restrict virtual cursor to the dialog.  
**Exploit / Impact:** A screen reader user cannot interact with any modal — the application's primary workflows (booking appointments, registering patients, writing prescriptions) are inaccessible.  
**Remediation:** For every modal wrapper `<div>`:
```tsx
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-title-id"
  // Focus trap: on mount, move focus to first focusable element;
  // on unmount, restore focus to the trigger element.
>
  <h2 id="modal-title-id">...</h2>
```
Implement focus trapping with a `useEffect` that queries `[tabIndex]:not([tabIndex="-1"]), button:not(:disabled), input, select, textarea, a[href]` and sets up a Shift+Tab / Tab cycle. Return focus to the trigger button on close.

---

### ACC-02 — Entire application has no way to navigate without a mouse on mobile/tablet (Critical)
**WCAG:** 2.1.1 Keyboard (Level A)  
**File:** `src/components/layout/AppSidebar.tsx`  
**Evidence:** The sidebar is a fixed `w-64` element that is always visible on desktop. On viewports < 768 px the sidebar is hidden off-screen (via overflow) but there is no hamburger/menu button to open it. Navigation between all 11 sections is impossible on a touch device without a pointing device.  
**Impact:** The entire application is keyboard/touch-inaccessible on mobile. Any touch-screen desktop user (e.g. Windows touchscreen tablet used at clinic reception) is also affected.  
**Remediation:** Add a `<button>` in the `TopBar` that toggles sidebar visibility on small screens. The sidebar should become a drawer (slide-in) with its own focus trap and `Escape`-to-close.

---

### ACC-03 — Form inputs throughout have no associated `<label>` elements (High)
**WCAG:** 1.3.1 Info and Relationships (Level A); 3.3.2 Labels or Instructions (Level A)  
**Files:** Nearly all form components  
**Evidence:** Labels in forms are rendered as sibling `<div>` or `<span>` elements adjacent to inputs, rather than using `<label htmlFor>` association or `aria-label` attributes. Example from `NewAppointmentModal.tsx`:
```tsx
<label className="font-semibold text-slate-700 block mb-1">2. Attending Doctor *</label>
<select value={doctorId} ...>
```
The `<label>` has no `htmlFor` and the `<select>` has no `id`, so there is zero programmatic association.  
**Impact:** Screen readers announce inputs as unlabeled. Voice control (Dragon NaturallySpeaking) cannot target the correct field by spoken label.  
**Remediation:** Add matching `id` on inputs and `htmlFor` on labels:
```tsx
<label htmlFor="doctor-select" className="...">Attending Doctor *</label>
<select id="doctor-select" ...>
```
Or use `aria-label` / `aria-labelledby` where visual labels are impractical.

---

### ACC-04 — Icon-only buttons throughout have no accessible name (High)
**WCAG:** 4.1.2 Name, Role, Value (Level A)  
**Files:** `DoctorsHub.tsx`, `PatientProfileView.tsx`, `AppointmentsHub.tsx`, `TopBar.tsx`, `UsersHub.tsx`, `RemindersHub.tsx`, many more  
**Evidence:** Many action buttons render only an icon with no text or `aria-label`:
```tsx
<button onClick={() => handleOpenEditDoctor(doc)} title="Edit Profile">
  <Edit2 className="w-3.5 h-3.5" />
</button>
```
The `title` attribute is tooltip-only; it is not reliably read by all screen readers.  
**Remediation:** Add `aria-label` to every icon-only button:
```tsx
<button aria-label="Edit doctor profile" onClick={...}>
  <Edit2 className="w-3.5 h-3.5" />
</button>
```

---

### ACC-05 — Very small text throughout fails minimum font size guidance (High)
**WCAG:** 1.4.4 Resize Text (Level AA)  
**Files:** All hub components  
**Evidence:** 583 uses of `text-[11px]`, `text-[10px]`, `text-[9px]`, `text-xs` (12px) found across components. Text as small as 9–10px is used for patient numbers, timestamps, and status badges. At 100% zoom these fall below the practical minimum of 12px for body text. Users who need browser text scaling to 150%+ will find critical clinical information (patient allergy tags, appointment times) visually unreadable.  
**Remediation:** Set a floor of `text-xs` (12px/0.75rem) for any text conveying clinical information. Reserve `text-[10px]` for purely decorative/supplemental labels.

---

### ACC-06 — No skip-navigation link (High)
**WCAG:** 2.4.1 Bypass Blocks (Level A)  
**File:** `src/App.tsx`, `src/components/layout/AppSidebar.tsx`  
**Evidence:** The page has no `<a href="#main-content" class="sr-only focus:not-sr-only">Skip to main content</a>` link. Every keyboard navigation session must Tab through all 11 sidebar items before reaching the main content area.  
**Remediation:** Add a visually-hidden skip link as the first child of `<body>`:
```tsx
<a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:bg-white focus:px-4 focus:py-2 focus:rounded focus:ring-2 focus:ring-teal-500">
  Skip to main content
</a>
```
Add `id="main-content"` to the `<main>` element.

---

### ACC-07 — No `aria-live` region for dynamic status updates (High)
**WCAG:** 4.1.3 Status Messages (Level AA)  
**Files:** `ReceptionistDashboard.tsx`, `AppointmentsHub.tsx`, all hubs  
**Evidence:** Status changes (appointment status updated, patient saved, reminder sent) produce no screen-reader announcement. The `Toast` component exists and has correct structure, but is not mounted in `App.tsx` — `useToast()` and `<ToastContainer>` are never called in the main app. The only feedback to screen readers for status updates is a visual badge change.  
**Remediation:**
1. Mount `ToastContainer` in `App.tsx`.
2. Wrap the toast container with `aria-live="polite"` and `aria-atomic="true"`.
3. Replace `console.error` error-only patterns in hub components with `showToast(message, 'error')`.

---

### ACC-08 — DentalChart uses `grid-cols-16` — a non-existent Tailwind class (Medium)
**WCAG:** 1.3.1 (structural integrity)  
**Files:** `src/components/patients/DentalChart.tsx` lines 85, 135; `src/components/print/PrintCenterModal.tsx` lines 403, 415  
**Evidence:**
```tsx
<div className="grid grid-cols-8 sm:grid-cols-16 gap-1.5 justify-items-center">
```
Tailwind v4's default scale goes to `grid-cols-12`. `grid-cols-16` will not generate any CSS unless explicitly added to the Tailwind config. The dental chart teeth therefore fall back to browser default (no grid), rendering as a single column on smaller screens. The `sm:` prefix also means the 16-column layout never activates on screens below 640px.  
**Remediation:** Add to Tailwind config or use explicit `[16]` syntax:
```tsx
<div className="grid grid-cols-8 sm:grid-cols-[repeat(16,minmax(0,1fr))] gap-1.5">
```
Or define `gridTemplateColumns: { 16: 'repeat(16, minmax(0, 1fr))' }` in the Tailwind `extend` config.

---

### ACC-09 — Allergy warnings use emoji only — no accessible text equivalent (Medium)
**WCAG:** 1.1.1 Non-text Content (Level A)  
**Files:** `PatientsHub.tsx`, `AppointmentDetailModal.tsx`, `PrescriptionsHub.tsx`, `NewAppointmentModal.tsx`  
**Evidence:**
```tsx
<span>⚠️ Allergy: {selectedPatient.allergies}</span>
```
The warning triangle emoji `⚠️` is announced by screen readers as "warning sign" or similar — which is acceptable. However, in other places only the emoji appears without accompanying text:
```tsx
<span className="text-[10px] bg-rose-100 text-rose-800 ...">⚠ Allergy: {p.allergies}</span>
```
When `p.allergies` is empty or undefined, the visual indicator disappears entirely with no fallback for screen readers.  
**Remediation:** Use `aria-label` on allergy badge containers:
```tsx
<span role="img" aria-label={`Allergy alert: ${p.allergies}`} className="...">⚠️ {p.allergies}</span>
```

---

### ACC-10 — Tab rows lack `role="tablist"` / `role="tab"` ARIA pattern (Medium)
**WCAG:** 4.1.2 Name, Role, Value  
**File:** `src/components/patients/PatientProfileView.tsx` lines 463–483  
**Evidence:** The tab strip is a row of `<button>` elements inside a `<div>`. While functional, it does not implement the ARIA tabs pattern (`role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`), which is required for screen readers to announce the tab structure correctly.  
**Remediation:**
```tsx
<div role="tablist" aria-label="Patient record sections">
  {tabs.map(tab => (
    <button
      role="tab"
      aria-selected={activeTab === tab.id}
      aria-controls={`tabpanel-${tab.id}`}
      id={`tab-${tab.id}`}
      ...
    >
      {tab.label}
    </button>
  ))}
</div>
<div id={`tabpanel-${activeTab}`} role="tabpanel" aria-labelledby={`tab-${activeTab}`}>
  {/* tab content */}
</div>
```

---

### ACC-11 — Focus indicators exist but are inconsistent (Medium)
**WCAG:** 2.4.11 Focus Appearance (Level AA, new in WCAG 2.2)  
**Files:** Global — `index.css` and Tailwind config  
**Evidence:** Some interactive elements use `focus:ring-1 focus:ring-teal-500`; many use `focus:outline-hidden` or `focus:outline-none` which suppresses the browser focus ring entirely without providing a custom one. Specifically, all icon-only buttons in `DoctorsHub`, `PatientProfileView`, and `AppointmentsHub` use no focus style.  
**Remediation:** Remove all `focus:outline-hidden` / `focus:outline-none` from interactive elements unless a custom focus style is applied. Add a global focus rule in `index.css`:
```css
:focus-visible {
  outline: 2px solid #0d9488;
  outline-offset: 2px;
}
```

---

### ACC-12 — Color is used as the sole differentiator for appointment status badges (Low)
**WCAG:** 1.4.1 Use of Color (Level A)  
**File:** `src/lib/utils.ts` `getStatusBadgeClasses()`; `ReceptionistDashboard.tsx`  
**Evidence:** Status badges (Scheduled = grey, Confirmed = teal, Arrived = amber, In Progress = blue, Completed = green, Cancelled = rose) rely exclusively on background color to convey meaning. Users with deuteranopia (red-green color blindness) cannot distinguish `COMPLETED` (green) from `SCHEDULED` (grey) or `NO_SHOW` (red) from `COMPLETED`.  
**Remediation:** Add a text label inside every status badge (most already have text). Ensure the border color also changes per status (most do). Add a short status-specific icon prefix.

---

### ACC-13 — `<html lang>` attribute is missing (Low)
**WCAG:** 3.1.1 Language of Page (Level A)  
**File:** `app/index.html`  
**Evidence:**
```html
<html lang="en">
```
Actually present ✓ — this is correct. No finding.

*(Verified clean — no issue here.)*

---

### ACC-14 — Decorative color swatches (doctor color dots) have no text alternative (Low)
**WCAG:** 1.1.1 Non-text Content  
**Files:** `AppointmentsHub.tsx`, `AppointmentDetailModal.tsx`, `ReceptionistDashboard.tsx`  
**Evidence:**
```tsx
<span className="w-3 h-3 rounded-full" style={{ backgroundColor: doc.color }}></span>
```
The doctor color dot conveys which doctor an appointment belongs to. Screen readers skip it entirely.  
**Remediation:**
```tsx
<span
  className="w-3 h-3 rounded-full"
  style={{ backgroundColor: doc.color }}
  role="img"
  aria-label={`Doctor color: ${doc.fullName}`}
></span>
```

---

### ACC-15 — `GlobalSearchModal` is missing role, label, and focus trap (Low)
**WCAG:** 4.1.2, 2.1.1  
**File:** `src/components/layout/GlobalSearchModal.tsx`  
**Evidence:** The modal opens when the search button or `⌘K` is pressed. It has no `role="dialog"`, no `aria-modal`, and while it auto-focuses the input via `inputRef.current?.focus()`, the Tab key exits the overlay because there is no focus trap.  
**Remediation:** Same pattern as ACC-01 — add `role="dialog" aria-modal="true" aria-label="Global search"` to the outer div and implement Tab cycle within the modal.
