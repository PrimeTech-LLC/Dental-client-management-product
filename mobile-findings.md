# Mobile Responsiveness Findings

> Audit date: 2026-09-16  
> Method: Static CSS class analysis + layout reasoning across breakpoints  
> Breakpoints tested (Tailwind defaults): 320px, 375px, 640px (sm), 768px (md), 1024px (lg), 1280px (xl)

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 2     |
| High     | 5     |
| Medium   | 4     |
| Low      | 3     |
| **Total**| **14**|

---

## Findings

### MOB-01 — No mobile navigation — sidebar is completely inaccessible below ~1024px (Critical)
**Files:** `src/components/layout/AppSidebar.tsx`, `src/App.tsx`  
**Evidence:**
```tsx
<aside className="w-64 bg-slate-900 ... h-screen">
```
The sidebar is a fixed `w-64` (256px) permanent aside. The main layout in `App.tsx` is `<div className="h-screen ... flex overflow-hidden">` — the sidebar occupies 256px of horizontal space on every viewport. On a 375px phone, the main content area receives only 119px — too narrow for any readable content. There is no `hidden sm:flex`, no hamburger button, no drawer overlay.  
**Impact:** The entire application is unusable on phones and most tablets in portrait mode. This is the most severe mobile deficiency.  
**Remediation:**
1. Add `isOpen` state to `AppSidebar`.
2. On `< md` viewports, hide sidebar by default (`hidden md:flex`) and render a hamburger button in `TopBar`.
3. When open on mobile, render sidebar as an overlay (`fixed z-40 inset-y-0 left-0`) with a backdrop that closes on click.
4. Add `Escape` key to close.

---

### MOB-02 — Day timeline grid and week view force horizontal scroll on all mobile viewports (Critical)
**File:** `src/components/appointments/AppointmentsHub.tsx` lines 257, 350  
**Evidence:**
```tsx
<div className="min-w-[700px]">   {/* day view */}
<div className="min-w-[900px]">   {/* week view */}
```
These containers force the day timeline to be 700px wide and the week view 900px wide, guaranteeing horizontal overflow on any device below 900px. The `overflow-x-auto` on the parent container is correct, but it means the entire schedule is a horizontal scroll experience on tablet — unusable in practice.  
**Remediation:**
- **Day view:** On `< md`, show a condensed list of appointments for the selected day instead of a full time × doctor matrix.
- **Week view:** On `< lg`, collapse to a 3-day view or a vertical list grouped by day.
- **List view:** Already mobile-friendly; make it the default view on `< md`.

---

### MOB-03 — `TopBar` quick-action buttons hidden on small screens — no mobile equivalent (High)
**File:** `src/components/layout/TopBar.tsx`  
**Evidence:**
```tsx
<button className="hidden md:flex ...">Print Center</button>
<button className="hidden lg:flex ...">New Patient</button>
```
"Print Center" and "New Patient" are hidden below 768px and 1024px respectively. The only visible actions are the search bar and "+ New Appointment". Receptionists on tablets cannot register new patients from the top bar, and cannot access the Print Center without navigating into the sidebar (which is also inaccessible on mobile — see MOB-01).  
**Remediation:** Add a `...` overflow menu or bottom action bar on `< md` that exposes the hidden actions.

---

### MOB-04 — Prescription editor table forces horizontal scroll — unusable on tablets (High)
**File:** `src/components/prescriptions/PrescriptionEditorModal.tsx` line 338  
**Evidence:**
```tsx
<table className="w-full text-left text-xs min-w-[650px]">
```
A 7-column medicine table with `min-w-[650px]` inside a modal. On a 768px tablet the modal is `max-w-4xl` with padding, leaving ~700px for the table — borderline functional. On a 375px phone, the table overflows the modal viewport entirely.  
**Remediation:** On `< sm`, convert the table rows to a card-based stacked layout (each medicine item rendered as a vertical card) rather than a wide table.

---

### MOB-05 — Dental chart 16-column grid collapses to 8 columns on mobile — teeth too small to tap (High)
**File:** `src/components/patients/DentalChart.tsx` lines 85, 135  
**Evidence:**
```tsx
<div className="grid grid-cols-8 sm:grid-cols-16 gap-1.5 justify-items-center">
```
On `< sm` (< 640px), the grid is 8 columns. Each tooth button is `w-10 h-14` (40×56px) — adequate for tapping. On `sm`+, it tries `grid-cols-16` which doesn't generate CSS (see ACC-08), so the 8-column fallback applies everywhere. This means the chart always renders 8 columns — 16 teeth per row isn't achievable, so teeth #1–8 (upper left) and #9–16 (upper right) display as two separate rows rather than a full arch.  
**Remediation:** Fix the `grid-cols-16` class (see ACC-08). On mobile, keep the 8-column layout but increase touch target size and add tooth number labels. Consider a scrollable horizontal arch layout.

---

### MOB-06 — Patient profile view tabs overflow horizontally — tab labels cut off on phones (High)
**File:** `src/components/patients/PatientProfileView.tsx` line ~465  
**Evidence:**
```tsx
<div className="border-b border-slate-200 ... flex gap-2 overflow-x-auto text-xs font-medium">
```
Eight tab buttons are laid out in a single `flex` row with `overflow-x-auto`. On 375px, the tab labels ("Dental Chart (32 Teeth)", "Medical History (0)", etc.) are truncated and require horizontal scrolling to discover all tabs. No visual indicator shows that more tabs exist to the right.  
**Remediation:** Add a `::after` pseudo-element fade/gradient on the right edge to indicate scrollable content. Consider collapsing into a `<select>` dropdown on `< sm`.

---

### MOB-07 — `ReceptionistDashboard` doctor status panel columns break below 640px (Medium)
**File:** `src/components/dashboard/ReceptionistDashboard.tsx`  
**Evidence:**
```tsx
<div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
```
Below 1024px the main schedule table and the right-side panel stack vertically — this is correct. However, the schedule table inside the grid has no `overflow-x-auto` on the container directly wrapping the `<table>`, so wide patient names / notes can push the layout wider than the screen.  
**Remediation:** Verify `overflow-x-auto` exists on the table wrapper div. Add `min-w-[600px]` on the inner table so it stays constrained.

---

### MOB-08 — KPI stat cards grid breaks to 1-column instead of 2-column on 320px (Medium)
**File:** `src/components/dashboard/ReceptionistDashboard.tsx`  
**Evidence:**
```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
```
On 320px, cards are 1-column (full width) — fine. On 375px the `sm` breakpoint (640px) hasn't triggered so still 1-column. This is acceptable but the cards stack very tall (4 cards × ~80px) which pushes the schedule table off-screen on small phones.  
**Remediation:** Use `grid-cols-2` starting at 375px by adding a custom breakpoint or using `min-[375px]:grid-cols-2`.

---

### MOB-09 — `PatientsHub` table horizontal scroll loses header context on narrow screens (Medium)
**File:** `src/components/patients/PatientsHub.tsx`  
**Evidence:** The patients table has `overflow-x-auto` on its wrapper. On screens below ~900px, scrolling right shows columns (Blood Group, Medical Alert, Actions) but the "Patient Name" column scrolls off-screen, losing context of which row you're editing.  
**Remediation:** Freeze the first two columns (PT ID + Patient Name) with `position: sticky; left: 0` styling and a background color. This is achievable with Tailwind's `sticky` class on `<td>` / `<th>`.

---

### MOB-10 — Print Center modal document preview collapses below 800px — content too small to read (Medium)
**File:** `src/components/print/PrintCenterModal.tsx`  
**Evidence:**
```tsx
<div className="bg-white text-slate-900 w-full max-w-[800px] p-8 ... min-h-[850px]">
```
The print canvas is designed for A4 preview (800px). On a 375px phone this scales to 375px wide, making A4 content (designed at 800px) effectively 47% scale — unreadable text at 5px. The modal has `max-h-[95vh] flex flex-col overflow-hidden` which means the user cannot scroll to see the full preview.  
**Remediation:** The print modal is primarily a desktop feature, but on mobile it should render a simplified "tap to print" confirmation rather than a full A4 preview.

---

### MOB-11 — Tap targets for action icon-buttons are below 44×44px minimum on mobile (Low)
**Files:** `DoctorsHub.tsx`, `PatientProfileView.tsx`, `AppointmentsHub.tsx`  
**Evidence:**
```tsx
<button className="p-1 hover:bg-slate-100 rounded text-slate-400" title="Edit Profile">
  <Edit2 className="w-3.5 h-3.5" />
</button>
```
`p-1` = 4px padding. Icon = 14px. Total target: ~22×22px — below the WCAG 2.5.5 / Apple HIG / Material Design 44×44px minimum.  
**Remediation:** Change icon button padding from `p-1` to `p-2` (minimum) or `p-2.5` for critical actions. Alternatively use `min-w-[44px] min-h-[44px]` on touchscreen-specific layouts.

---

### MOB-12 — No `viewport` meta tag sets `user-scalable=no` (not a finding — this is correct) (Low)
**File:** `app/index.html`  
**Evidence:**
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
```
This is the correct setting. `user-scalable=no` is intentionally absent, allowing users to zoom — correct for accessibility. No remediation needed.

---

### MOB-13 — Reports hub date range inputs unworkable on iOS Safari (Low)
**File:** `src/components/reports/ReportsHub.tsx`  
**Evidence:** `<input type="date">` on iOS Safari 16 and earlier does not support the standard date picker UI and instead falls back to a spinner wheel. The layout of date inputs (`flex items-center gap-2`) is fine, but the `From:` and `To:` labels are plain `<label>` elements without `htmlFor` — on iOS, tapping the label does not focus the date input.  
**Remediation:** Add `htmlFor` associations (fixes the label tap issue). For the spinner vs. calendar UX difference, this is a browser limitation — document it.
