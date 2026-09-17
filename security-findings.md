# Security Findings

> Audit date: 2026-09-16  
> Auditor: Kiro (automated static analysis + manual code review)  
> Baseline: Phase 0 orientation complete — full source read

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0     |
| High     | 4     |
| Medium   | 7     |
| Low      | 4     |
| **Total**| **15**|

---

## Findings

### SEC-01 — No HTTP security headers (High)
**File:** `server.ts` (entire file — no header middleware present)  
**Evidence:** `grep -n "Content-Security-Policy\|X-Frame-Options\|Strict-Transport\|helmet" server.ts` returns nothing.  
**Exploit scenario:** No `Content-Security-Policy` header means any injected script (via a stored XSS or a compromised CDN script) executes freely. No `X-Frame-Options` / `frame-ancestors` means the app can be embedded in an iframe for clickjacking. No `X-Content-Type-Options: nosniff` allows MIME-type sniffing attacks. No `Strict-Transport-Security` means the first production request can be intercepted.  
**Remediation:** Add `helmet` middleware (or equivalent manual header middleware) before all routes:
```ts
import helmet from 'helmet';
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Tailwind needs this
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
    }
  },
  hsts: { maxAge: 31536000, includeSubDomains: true },
}));
```

---

### SEC-02 — Memory-only login rate limiter will not survive multiple instances (High)
**File:** `server.ts` lines 102–125  
**Evidence:**
```ts
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
```
The attempt counter is stored in process memory. On Vercel, each cold-start or concurrent invocation gets a fresh Map; the rate-limiting window resets on every invocation.  
**Exploit scenario:** An attacker making 15 login attempts per Vercel function instance per window faces effectively zero rate limiting in production.  
**Remediation:** Use a persistent atomic counter — either a Redis `INCR`/`EXPIRE` call, or a small `login_attempts` Postgres table with a `COUNT WHERE created_at > NOW() - INTERVAL '15 minutes'` check. The lightweight option is an upstash/redis free tier. Alternatively, offload to Vercel's edge WAF / middleware rate-limiting.

---

### SEC-03 — `getAuditLogs` interpolates `LIMIT` into raw SQL (High)
**File:** `src/server/db/database.ts` lines 1670–1678  
**Evidence:**
```ts
LIMIT ${entityType && entityType !== 'ALL' ? '$2' : '$1'}
```
The `$1`/`$2` placeholder tokens are *themselves* interpolated via template literal — this is fine. However, if the conditional ever changes so that a variable other than a fixed placeholder is interpolated, it becomes a direct injection vector. More practically, the `server.ts` limit handler only validates `Math.min(parseInt(...), 500)` — if `parseInt` gets `NaN` (non-numeric input), `Math.min(NaN, 500)` returns `NaN`, which PostgreSQL rejects with a query error. The value should be validated to a positive integer before passing.  
**Exploit scenario:** `GET /api/audit-logs?limit=NaN` crashes with a 500 and leaks the error message.  
**Remediation:**
```ts
const limit = Number.isFinite(Number(req.query.limit)) ? Math.min(Math.max(1, Number(req.query.limit)), 500) : 100;
```

---

### SEC-04 — Sensitive operation routes lack DOCTOR role restriction (High)
**File:** `server.ts` lines 375–830  
**Evidence:** All patient, appointment, treatment, prescription, visit, and reminder CRUD routes use only `requireAuth` (any authenticated user). The `UserRole` type allows `'DOCTOR'` as a valid role, and Doctors can log in. A logged-in doctor can therefore create/update/delete patients, reschedule appointments, modify clinic settings (requires RECEPTIONIST role only), etc.  
**Exploit scenario:** A doctor account compromised (or misused) can alter any patient record, delete treatments, or modify another doctor's schedule.  
**Remediation:** Apply `requireRole('ADMIN', 'RECEPTIONIST', 'DOCTOR')` (or appropriate subset) to all write routes. Specifically, destructive mutations (DELETE patients/doctors, update settings) should require `ADMIN` or `RECEPTIONIST`. This is a deliberate design note from the README ("receptionist-facing"), so in the minimal fix just ensure DOCTOR role access is explicitly scoped, not implicitly inherited.

---

### SEC-05 — JWT cookie is `sameSite: 'lax'` not `'strict'` — CSRF risk on state-changing POSTs (Medium)
**File:** `server.ts` lines 42–48  
**Evidence:**
```ts
sameSite: 'lax',
```
`lax` permits the cookie to be sent on top-level navigations but NOT on cross-origin sub-resource requests. Because all state-changing requests are API fetches (not top-level navigations), `lax` provides some protection, but `strict` would be stronger and there is no explicit CSRF token mechanism.  
**Remediation:** Change `sameSite: 'strict'`. Add a `CSRF-Token` header check on state-changing routes, or use the double-submit cookie pattern. At minimum, validate `Origin` or `Referer` header matches the expected host on all POST/PUT/DELETE routes.

---

### SEC-06 — No `Content-Type: application/json` validation on API inputs (Medium)
**File:** `server.ts` — all POST/PUT route handlers  
**Evidence:** The API accepts `application/json` bodies via `express.json()` but does not verify that the incoming `Content-Type` header is `application/json`. Sending a body with `Content-Type: text/plain` causes Express to ignore the body parser and `req.body` becomes `{}`, bypassing required-field checks and creating silent failures.  
**Remediation:** Add a middleware that rejects POST/PUT/PATCH requests with non-JSON content types:
```ts
app.use((req, res, next) => {
  if (['POST','PUT','PATCH'].includes(req.method) && req.path.startsWith('/api/') && !req.is('application/json')) {
    return res.status(415).json({ success: false, error: { message: 'Content-Type must be application/json' } });
  }
  next();
});
```

---

### SEC-07 — Default seed password `dental123` is hardcoded in migration script and README (Medium)
**File:** `app/scripts/migrate.js` lines 60–67; `README.md`  
**Evidence:**
```js
crypt('dental123', gen_salt('bf'))
```
The password is documented publicly in the README and hardcoded in the migration script. The `mustChangePassword` flag is set to `false` for seeded users (should be `true`).  
**Remediation:** Set `must_change_password = true` for all seed accounts. The `ChangePasswordScreen` component already exists and is wired; the flag just needs to be set at seed time. Rotate the default password before production use.

---

### SEC-08 — `@google/genai ^2.4.0` is a production dependency with no visible usage (Medium)
**File:** `app/package.json`  
**Evidence:** `@google/genai` is listed as a production dependency but no import of it appears in any source file. It adds 10+ MB to the bundle and introduces a Google-controlled external dependency with broad API surface.  
**Remediation:** Remove it: `npm uninstall @google/genai`. If intended for future AI features, add it back as a dev/opt-in dependency when actually implemented.

---

### SEC-09 — IDOR: any authenticated user can read/modify any patient by UUID (Medium)
**File:** `server.ts` `GET /api/patients/:id`, `PUT /api/patients/:id`; `src/server/db/database.ts` `getPatientById`  
**Evidence:** No ownership or clinic-membership check exists on patient read/write. Any authenticated user (including a DOCTOR account from a different clinic, if multi-tenancy is ever introduced) can fetch `GET /api/patients/<uuid>` for any record.  
**Exploit scenario:** Authenticated receptionist at Clinic A, if they knew a patient UUID from Clinic B, could read PHI. Currently single-tenant so risk is lower, but worth documenting for future.  
**Remediation:** At minimum, add a comment documenting the single-tenant assumption. For production hardening, add a `clinic_id` column to patients/appointments and filter by the authenticated user's clinic.

---

### SEC-10 — Audit log `userRole` is hardcoded to `'RECEPTIONIST'` in most DB functions (Medium)
**File:** `src/server/db/database.ts` — most `logAudit` calls  
**Evidence:**
```ts
await logAudit({ ..., userRole: 'RECEPTIONIST', ... });
```
The actual `actorName` is passed from `server.ts` via `currentUser(req).name`, but `userRole` is hardcoded to `'RECEPTIONIST'` regardless of the calling user's actual role. A DOCTOR or ADMIN making a change is recorded as RECEPTIONIST.  
**Remediation:** Thread `actorRole = currentUser(req).role` through all DB function signatures and use it in `logAudit` calls.

---

### SEC-11 — Stack traces leak to client on 500 errors (Low)
**File:** `server.ts` — catch blocks in route handlers  
**Evidence:**
```ts
res.status(500).json({ success: false, error: { message: err.message } });
```
`err.message` from Postgres includes table names, column names, constraint names, and query fragments (e.g. `"duplicate key value violates unique constraint "users_email_key"`"). In production, this reveals the data model.  
**Remediation:** In `IS_PROD` mode, map error messages to generic user-facing strings. Keep the full error in server-side logs only:
```ts
const userMsg = IS_PROD ? 'An internal error occurred.' : err.message;
res.status(500).json({ success: false, error: { message: userMsg } });
```

---

### SEC-12 — No `Retry-After` header on non-login endpoints (Low)
**File:** `server.ts` — no global rate-limiting middleware  
**Evidence:** Only the `loginRateLimiter` function applies rate limiting. All other endpoints (patient search, appointment creation, report generation) are unlimited.  
**Remediation:** Add a lightweight per-IP rate limiter on the API as a whole (e.g. 200 req/min). For serverless, this requires a persistent store (see SEC-02).

---

### SEC-13 — `node-fetch` is injected as HTTP transport but its version is unpinned (Low)
**File:** `app/package.json`: `"node-fetch": "^3.3.2"`  
**Evidence:** The caret allows minor updates. `node-fetch` v3.3.2 is current but the range accepts future breaking minor versions.  
**Remediation:** Pin to exact version: `"node-fetch": "3.3.2"`.

---

### SEC-14 — `motion` library (`^12.23.24`) is imported in package.json but not visible in component code (Low)
**File:** `app/package.json`  
**Evidence:** No `import ... from 'motion'` found in any source file. Dead production dependency inflates bundle.  
**Remediation:** Remove or audit; if used, document where. `npm uninstall motion` if unused.

---

## npm audit results

| Package | Severity | CVE/Advisory | Fix |
|---------|----------|--------------|-----|
| `qs` (indirect via `express` 4.21.2) | Moderate | GHSA-x5fp-wj9c-mxmx — array-limit bypass | `npm audit fix` |
| `qs` (indirect) | Moderate | GHSA-4mjr-xmp4-gh2g — DoS via isBuffer | `npm audit fix` |
| `body-parser` (indirect) | Moderate | Same `qs` chain | `npm audit fix` |

All three are auto-fixable: `npm audit fix` upgrades `express` to `4.22.x`+ which bundles `qs ≥ 6.16.0`.
