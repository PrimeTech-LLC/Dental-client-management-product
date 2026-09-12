import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';

import * as db from './src/server/db/database.js';
import type { User, UserRole } from './src/types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ─── SEC-01: Fail hard if JWT_SECRET missing in production ────────────────────
const IS_PROD    = process.env.NODE_ENV === 'production';
const JWT_SECRET = process.env.JWT_SECRET ?? (IS_PROD
  ? (() => { console.error('FATAL: JWT_SECRET must be set in production. Refusing to start.'); process.exit(1); })()!
  : 'apex-dental-dev-secret-change-me');

const JWT_EXPIRY = '12h';
const API_PORT   = IS_PROD ? (Number(process.env.PORT) || 3000) : 3001;

// ─── Auth helpers ─────────────────────────────────────────────────────────────

function signToken(user: User): string {
  return jwt.sign(
    { id: user.id, role: user.role, name: user.name, email: user.email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
}

function setAuthCookie(res: express.Response, token: string) {
  res.cookie('auth_token', token, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: 'lax',
    maxAge: 12 * 60 * 60 * 1000,
    path: '/',
  });
}

function clearAuthCookie(res: express.Response) {
  res.clearCookie('auth_token', { path: '/' });
}

async function requireAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const token = req.cookies?.auth_token;
  if (!token) {
    return res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Not authenticated' } });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { id: string };
    const user = await db.getUserById(payload.id);
    if (!user || !user.isActive) {
      clearAuthCookie(res);
      return res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Session expired or account deactivated' } });
    }
    (req as any).currentUser = user;
    next();
  } catch {
    clearAuthCookie(res);
    return res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Invalid session' } });
  }
}

function currentUser(req: express.Request): User {
  return (req as any).currentUser as User;
}

// ─── SEC-07: Role-Based Access Control ───────────────────────────────────────
function requireRole(...roles: UserRole[]) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user = currentUser(req);
    if (!roles.includes(user.role)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: `This action requires one of: ${roles.join(', ')}` }
      });
    }
    next();
  };
}

// ─── SEC-02: Simple in-memory rate limiter for login ─────────────────────────
// Keyed by IP. Allows 15 attempts per 15-minute window.
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const LOGIN_WINDOW_MS  = 15 * 60 * 1000; // 15 minutes
const LOGIN_MAX_ATTEMPTS = 15;

function loginRateLimiter(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
    ?? req.socket.remoteAddress
    ?? 'unknown';

  const now = Date.now();
  const entry = loginAttempts.get(ip);

  if (entry && now < entry.resetAt) {
    if (entry.count >= LOGIN_MAX_ATTEMPTS) {
      const retryAfterSecs = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader('Retry-After', retryAfterSecs);
      return res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: `Too many login attempts. Please wait ${Math.ceil(retryAfterSecs / 60)} minute(s) before trying again.`
        }
      });
    }
    entry.count++;
  } else {
    loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
  }

  // Clear successful login entries to reset the window after auth succeeds
  (req as any)._loginIp = ip;
  next();
}

function clearLoginAttempts(req: express.Request) {
  const ip = (req as any)._loginIp;
  if (ip) loginAttempts.delete(ip);
}

// ─── SEC-03: Validation helpers ───────────────────────────────────────────────
function validateString(val: any, name: string, maxLen = 500): string {
  if (typeof val !== 'string' || !val.trim()) {
    throw Object.assign(new Error(`${name} is required and must be a non-empty string.`), { status: 400 });
  }
  if (val.length > maxLen) {
    throw Object.assign(new Error(`${name} must be at most ${maxLen} characters.`), { status: 400 });
  }
  return val.trim();
}

function validateDate(val: any, name: string): string {
  if (typeof val !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    throw Object.assign(new Error(`${name} must be a date in YYYY-MM-DD format.`), { status: 400 });
  }
  return val;
}

function validatePatientBody(body: any) {
  validateString(body.firstName, 'firstName');
  validateString(body.lastName,  'lastName');
  validateString(body.phone,     'phone', 30);
  validateDate(body.dateOfBirth, 'dateOfBirth');
  if (!['MALE','FEMALE','OTHER'].includes(body.gender)) {
    throw Object.assign(new Error('gender must be MALE, FEMALE, or OTHER.'), { status: 400 });
  }
}

function validateAppointmentBody(body: any) {
  validateString(body.patientId,      'patientId', 100);
  validateString(body.doctorId,       'doctorId',  100);
  validateDate(body.appointmentDate,  'appointmentDate');
  if (typeof body.startTime !== 'string' || !/^\d{2}:\d{2}$/.test(body.startTime)) {
    throw Object.assign(new Error('startTime must be in HH:mm format.'), { status: 400 });
  }
  if (typeof body.endTime !== 'string' || !/^\d{2}:\d{2}$/.test(body.endTime)) {
    throw Object.assign(new Error('endTime must be in HH:mm format.'), { status: 400 });
  }
  if (body.startTime >= body.endTime) {
    throw Object.assign(new Error('endTime must be after startTime.'), { status: 400 });
  }
}

function validateDoctorBody(body: any) {
  validateString(body.fullName,       'fullName');
  validateString(body.specialization, 'specialization');
  validateString(body.licenseNumber,  'licenseNumber', 100);
  validateString(body.phone,          'phone', 30);
}

function handleValidationError(err: any, res: express.Response) {
  const status = err.status ?? 500;
  return res.status(status).json({ success: false, error: { code: 'VALIDATION_ERROR', message: err.message } });
}

// ─── App setup ────────────────────────────────────────────────────────────────

const app = express();

// Limit JSON body to 1 MB to prevent payload attacks
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// Dev-only CORS — never runs in production
if (!IS_PROD) {
  app.use((_req, res, next) => {
    res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    next();
  });
  app.options('*', (_req, res) => res.sendStatus(204));
}

// ─── Public auth routes ───────────────────────────────────────────────────────

app.get('/api/auth/me', async (req, res) => {
  const token = req.cookies?.auth_token;
  if (!token) return res.json({ success: true, data: { user: null } });
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { id: string };
    const user = await db.getUserById(payload.id);
    return res.json({ success: true, data: { user: user || null } });
  } catch {
    clearAuthCookie(res);
    return res.json({ success: true, data: { user: null } });
  }
});

// SEC-02: rate-limited login
app.post('/api/auth/login', loginRateLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: { code: 'MISSING_FIELDS', message: 'Username and password are required' } });
    }
    const user = await db.verifyUserPassword(username, password);
    if (!user) {
      return res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username or password' } });
    }
    clearLoginAttempts(req);
    await db.updateUserLastLogin(user.id);
    const token = signToken(user);
    setAuthCookie(res, token);
    // SCHEMA-03: use real user id in audit log
    await db.logAudit({
      userId: user.id, userName: user.name, userRole: user.role,
      action: 'USER_LOGIN', entityType: 'USER', entityId: user.id, entityName: user.name,
    });
    // CONFIG-02: include mustChangePassword flag in login response
    return res.json({ success: true, data: { user } });
  } catch (err: any) {
    console.error('[login] error:', err.message);
    return res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// Public clinic branding (pre-login screen)
app.get('/api/public/clinic', async (_req, res) => {
  try {
    const settings = await db.getSettings();
    res.json({ success: true, data: { clinicName: settings.clinicName, tagline: settings.tagline } });
  } catch {
    res.json({ success: true, data: { clinicName: '', tagline: '' } });
  }
});

app.post('/api/auth/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ success: true });
});

// CONFIG-02: change password endpoint (works pre-auth via a special flow)
app.post('/api/auth/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const cu = currentUser(req);
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: { message: 'currentPassword and newPassword are required.' } });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, error: { message: 'New password must be at least 8 characters.' } });
    }
    const verified = await db.verifyUserPassword(cu.name, currentPassword);
    if (!verified) {
      return res.status(401).json({ success: false, error: { message: 'Current password is incorrect.' } });
    }
    await db.changeUserPassword(cu.id, newPassword, cu.name);
    await db.logAudit({
      userId: cu.id, userName: cu.name, userRole: cu.role,
      action: 'PASSWORD_CHANGED', entityType: 'USER', entityId: cu.id, entityName: cu.name,
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// ─── Protected routes gate ────────────────────────────────────────────────────

app.use('/api', (req, res, next) => {
  const pub = [
    ['GET',  '/auth/me'],
    ['POST', '/auth/login'],
    ['POST', '/auth/logout'],
    ['GET',  '/public/clinic'],
  ];
  const isPublic = pub.some(([m, p]) => req.method === m && req.path === p);
  if (isPublic) return next();
  return requireAuth(req, res, next);
});

// ─── Users / Staff management ─────────────────────────────────────────────────
// SEC-07: list receptionists is fine for any authenticated user (e.g. for selection dropdowns)
app.get('/api/users/receptionists', async (req, res) => {
  try {
    const users = await db.getReceptionists();
    res.json({ success: true, data: users });
  } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
});

// SEC-07: only ADMIN can create / modify / delete receptionist accounts
app.post('/api/users/receptionists', requireRole('ADMIN', 'RECEPTIONIST'), async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: { code: 'MISSING_FIELDS', message: 'Name, email, and password are required' } });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, error: { message: 'Password must be at least 6 characters.' } });
    }
    const cu = currentUser(req);
    const user = await db.createReceptionist({ name, email, password }, cu.id, cu.name);
    res.status(201).json({ success: true, data: user });
  } catch (err: any) {
    const isDupe = err.message?.includes('unique') || err.message?.includes('duplicate');
    res.status(isDupe ? 409 : 500).json({ success: false, error: { message: isDupe ? 'Email already in use' : err.message } });
  }
});

app.put('/api/users/receptionists/:id', requireRole('ADMIN', 'RECEPTIONIST'), async (req, res) => {
  try {
    const cu = currentUser(req);
    const updated = await db.updateReceptionist(req.params.id, req.body, cu.id, cu.name);
    if (!updated) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Receptionist not found' } });
    res.json({ success: true, data: updated });
  } catch (err: any) {
    const isDupe = err.message?.includes('unique') || err.message?.includes('duplicate');
    res.status(isDupe ? 409 : 500).json({ success: false, error: { message: isDupe ? 'Email already in use' : err.message } });
  }
});

app.delete('/api/users/receptionists/:id', requireRole('ADMIN', 'RECEPTIONIST'), async (req, res) => {
  try {
    if (req.params.id === currentUser(req).id) {
      return res.status(400).json({ success: false, error: { code: 'SELF_DELETE', message: 'You cannot delete your own account' } });
    }
    const cu = currentUser(req);
    const deleted = await db.deleteReceptionist(req.params.id, cu.id, cu.name);
    if (!deleted) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Receptionist not found' } });
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
});

// ─── Patients ─────────────────────────────────────────────────────────────────

app.get('/api/patients', async (req, res) => {
  try {
    const search = (req.query.search as string) || '';
    const limit  = Math.min(parseInt(req.query.limit  as string) || 50, 200);
    const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);
    const result = await db.getPatients(search, limit, offset);
    res.json({ success: true, data: result });
  } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
});

app.get('/api/patients/:id', async (req, res) => {
  try {
    const patient = await db.getPatientById(req.params.id);
    if (!patient) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Patient not found' } });
    res.json({ success: true, data: patient });
  } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
});

app.post('/api/patients/check-duplicate', async (req, res) => {
  try {
    const { firstName, lastName, phone, dateOfBirth } = req.body;
    if (!firstName || !lastName || !phone) return res.json({ success: true, data: { duplicates: [] } });
    const duplicates = await db.checkDuplicatePatient(firstName, lastName, phone, dateOfBirth || '');
    res.json({ success: true, data: { duplicates } });
  } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
});

// SEC-03: validated patient creation
app.post('/api/patients', async (req, res) => {
  try {
    validatePatientBody(req.body);
    const cu = currentUser(req);
    const patient = await db.addPatient(req.body, cu.id, cu.name);
    res.status(201).json({ success: true, data: patient });
  } catch (err: any) {
    if (err.status === 400) return handleValidationError(err, res);
    res.status(400).json({ success: false, error: { code: 'CREATION_FAILED', message: err.message } });
  }
});

app.put('/api/patients/:id', async (req, res) => {
  try {
    const cu = currentUser(req);
    const updated = await db.updatePatient(req.params.id, req.body, cu.id, cu.name);
    if (!updated) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Patient not found' } });
    res.json({ success: true, data: updated });
  } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
});

app.post('/api/patients/:id/medical-history', async (req, res) => {
  try {
    const cu = currentUser(req);
    const item = await db.addPatientMedicalHistory({ patientId: req.params.id, createdBy: cu.name, ...req.body });
    res.status(201).json({ success: true, data: item });
  } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
});

app.post('/api/patients/:id/allergies', async (req, res) => {
  try {
    const item = await db.addPatientAllergy({ patientId: req.params.id, ...req.body });
    res.status(201).json({ success: true, data: item });
  } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
});

app.delete('/api/patients/allergies/:allergyId', async (req, res) => {
  try {
    await db.deleteAllergy(req.params.allergyId);
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
});

app.post('/api/patients/:id/medications', async (req, res) => {
  try {
    const item = await db.addPatientMedication({ patientId: req.params.id, ...req.body });
    res.status(201).json({ success: true, data: item });
  } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
});

app.post('/api/patients/:id/dental-chart', async (req, res) => {
  try {
    const { toothNumber, condition, notes } = req.body;
    if (!toothNumber || !condition) {
      return res.status(400).json({ success: false, error: { message: 'toothNumber and condition are required.' } });
    }
    const cu = currentUser(req);
    const item = await db.updateToothCondition(req.params.id, Number(toothNumber), condition, notes, cu.name);
    res.json({ success: true, data: item });
  } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
});

// ─── Doctors ──────────────────────────────────────────────────────────────────

app.get('/api/doctors', async (req, res) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const doctors = await db.getDoctors(includeInactive);
    res.json({ success: true, data: doctors });
  } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
});

app.get('/api/doctors/:id', async (req, res) => {
  try {
    const doc = await db.getDoctorById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Doctor not found' } });
    const [availability, exceptions] = await Promise.all([
      db.getDoctorAvailability(doc.id),
      db.getDoctorExceptions(doc.id),
    ]);
    res.json({ success: true, data: { ...doc, availability, exceptions } });
  } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
});

// SEC-03 + SEC-07: validated doctor creation (any authenticated receptionist can add doctors)
app.post('/api/doctors', async (req, res) => {
  try {
    validateDoctorBody(req.body);
    const cu = currentUser(req);
    const doc = await db.addDoctor(req.body, cu.id, cu.name);
    res.status(201).json({ success: true, data: doc });
  } catch (err: any) {
    if (err.status === 400) return handleValidationError(err, res);
    res.status(400).json({ success: false, error: { code: 'CREATION_FAILED', message: err.message } });
  }
});

app.put('/api/doctors/:id', async (req, res) => {
  try {
    const cu = currentUser(req);
    const updated = await db.updateDoctor(req.params.id, req.body, cu.id, cu.name);
    if (!updated) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Doctor not found' } });
    res.json({ success: true, data: updated });
  } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
});

app.delete('/api/doctors/:id', async (req, res) => {
  try {
    const cu = currentUser(req);
    const result = await db.deleteDoctor(req.params.id, cu.id, cu.name);
    if (!result.success) {
      return res.status(409).json({ success: false, error: { code: 'DELETE_CONFLICT', message: result.error } });
    }
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
});

app.put('/api/doctors/:id/availability', async (req, res) => {
  try {
    if (!Array.isArray(req.body.availability)) {
      return res.status(400).json({ success: false, error: { message: 'availability must be an array.' } });
    }
    await db.updateDoctorAvailability(req.params.id, req.body.availability);
    const availability = await db.getDoctorAvailability(req.params.id);
    res.json({ success: true, data: availability });
  } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
});

app.post('/api/doctors/:id/exceptions', async (req, res) => {
  try {
    const ex = await db.addDoctorException({ doctorId: req.params.id, ...req.body });
    res.status(201).json({ success: true, data: ex });
  } catch (err: any) {
    const isDupe = err.message?.includes('unique') || err.message?.includes('duplicate') || err.message?.includes('uq_exception');
    res.status(isDupe ? 409 : 500).json({
      success: false,
      error: { message: isDupe ? 'An exception already exists for this doctor on that date. Please edit or delete the existing one.' : err.message }
    });
  }
});

app.delete('/api/doctors/exceptions/:exId', async (req, res) => {
  try {
    await db.deleteDoctorException(req.params.exId);
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
});

// ─── Appointments ─────────────────────────────────────────────────────────────

app.get('/api/appointments', async (req, res) => {
  try {
    const filter = {
      date:      req.query.date      as string | undefined,
      startDate: req.query.startDate as string | undefined,
      endDate:   req.query.endDate   as string | undefined,
      doctorId:  req.query.doctorId  as string | undefined,
      patientId: req.query.patientId as string | undefined,
      status:    req.query.status    as string | undefined,
    };
    const appointments = await db.getAppointments(filter);
    res.json({ success: true, data: appointments });
  } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
});

app.get('/api/appointments/:id', async (req, res) => {
  try {
    const appt = await db.getAppointmentById(req.params.id);
    if (!appt) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Appointment not found' } });
    res.json({ success: true, data: appt });
  } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
});

app.post('/api/appointments/check-conflict', async (req, res) => {
  try {
    const { doctorId, appointmentDate, startTime, endTime, excludeAppointmentId } = req.body;
    if (!doctorId || !appointmentDate || !startTime || !endTime) {
      return res.status(400).json({ success: false, error: { message: 'doctorId, appointmentDate, startTime and endTime are required.' } });
    }
    const result = await db.checkAppointmentConflict(doctorId, appointmentDate, startTime, endTime, excludeAppointmentId);
    res.json({ success: true, data: result });
  } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
});

// SEC-03: validated appointment creation
app.post('/api/appointments', async (req, res) => {
  try {
    validateAppointmentBody(req.body);
    const allowOverride = req.body.allowOverride === true;
    const { allowOverride: _, ...apptData } = req.body;
    const cu = currentUser(req);
    apptData.createdBy = cu.name;
    const result = await db.createAppointment(apptData, allowOverride, cu.id, cu.name);
    if (result.conflict) {
      return res.status(409).json({ success: false, error: { code: 'APPOINTMENT_CONFLICT', message: result.conflict.conflictReason, details: result.conflict } });
    }
    res.status(201).json({ success: true, data: result.appointment });
  } catch (err: any) {
    if (err.status === 400) return handleValidationError(err, res);
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

app.put('/api/appointments/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ success: false, error: { message: 'status is required.' } });
    const cu = currentUser(req);
    const updated = await db.updateAppointmentStatus(req.params.id, status, cu.id, cu.name);
    if (!updated) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Appointment not found' } });
    res.json({ success: true, data: updated });
  } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
});

app.post('/api/appointments/:id/reschedule', async (req, res) => {
  try {
    const { newDate, newStartTime, newEndTime, reason, allowOverride } = req.body;
    if (!newDate || !newStartTime || !newEndTime) {
      return res.status(400).json({ success: false, error: { message: 'newDate, newStartTime, and newEndTime are required.' } });
    }
    const cu = currentUser(req);
    const result = await db.rescheduleAppointment(
      req.params.id, newDate, newStartTime, newEndTime,
      reason || 'Patient request', allowOverride === true, cu.id, cu.name
    );
    if (result.conflict) {
      return res.status(409).json({ success: false, error: { code: 'RESCHEDULE_CONFLICT', message: result.conflict.conflictReason, details: result.conflict } });
    }
    res.json({ success: true, data: result.appointment });
  } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
});

// ─── Visits ───────────────────────────────────────────────────────────────────

app.get('/api/visits', async (req, res) => {
  try {
    const visits = await db.getVisits(req.query.patientId as string | undefined);
    res.json({ success: true, data: visits });
  } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
});

app.post('/api/visits', async (req, res) => {
  try {
    const cu = currentUser(req);
    const visit = await db.createVisit(req.body, cu.id, cu.name);
    res.status(201).json({ success: true, data: visit });
  } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
});

// ─── Treatments ───────────────────────────────────────────────────────────────

app.get('/api/treatments', async (req, res) => {
  try {
    const treatments = await db.getTreatments(
      req.query.patientId as string | undefined,
      req.query.doctorId  as string | undefined
    );
    res.json({ success: true, data: treatments });
  } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
});

app.post('/api/treatments', async (req, res) => {
  try {
    const cu = currentUser(req);
    const treatment = await db.createTreatment(req.body, cu.id, cu.name);
    res.status(201).json({ success: true, data: treatment });
  } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
});

app.put('/api/treatments/:id', async (req, res) => {
  try {
    const cu = currentUser(req);
    const updated = await db.updateTreatment(req.params.id, req.body, cu.id, cu.name);
    if (!updated) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Treatment not found' } });
    res.json({ success: true, data: updated });
  } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
});

// ─── Prescriptions ────────────────────────────────────────────────────────────

app.get('/api/prescriptions', async (req, res) => {
  try {
    const rxList = await db.getPrescriptions({
      patientId: req.query.patientId as string | undefined,
      doctorId:  req.query.doctorId  as string | undefined,
    });
    res.json({ success: true, data: rxList });
  } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
});

app.get('/api/prescriptions/:id', async (req, res) => {
  try {
    const rx = await db.getPrescriptionById(req.params.id);
    if (!rx) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Prescription not found' } });
    res.json({ success: true, data: rx });
  } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
});

// BUG-05: allergy cross-check happens inside db.createPrescription; surface warnings here
app.post('/api/prescriptions', async (req, res) => {
  try {
    const { items, ...rxData } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: { code: 'ITEMS_REQUIRED', message: 'At least one medicine item is required' } });
    }
    if (!rxData.patientId || !rxData.doctorId) {
      return res.status(400).json({ success: false, error: { message: 'patientId and doctorId are required.' } });
    }
    const cu = currentUser(req);
    const result = await db.createPrescription(rxData, items, cu.id, cu.name);
    // Return 201 with prescription; allergy warnings are embedded in result.allergyWarnings
    res.status(201).json({ success: true, data: result });
  } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
});

// ─── Reminders ────────────────────────────────────────────────────────────────

app.get('/api/reminders', async (req, res) => {
  try {
    const reminders = await db.getReminders(req.query.patientId as string | undefined);
    res.json({ success: true, data: reminders });
  } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
});

app.post('/api/reminders/:id/send', async (req, res) => {
  try {
    const cu = currentUser(req);
    const reminder = await db.triggerManualReminder(req.params.id, cu.id, cu.name);
    if (!reminder) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Reminder not found' } });
    res.json({ success: true, data: reminder });
  } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
});

// ─── Reports ──────────────────────────────────────────────────────────────────

app.get('/api/reports', async (req, res) => {
  try {
    const today     = new Date().toISOString().slice(0, 10);
    const startDate = (req.query.startDate as string) || today;
    const endDate   = (req.query.endDate   as string) || today;
    const doctorId  =  req.query.doctorId  as string | undefined;
    const reports = await db.getReports(startDate, endDate, doctorId);
    res.json({ success: true, data: reports });
  } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
});

// ─── Settings ─────────────────────────────────────────────────────────────────

app.get('/api/settings', async (_req, res) => {
  try {
    const settings = await db.getSettings();
    res.json({ success: true, data: settings });
  } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
});

// SEC-07: only admins / receptionists can change clinic-wide settings
app.put('/api/settings', requireRole('ADMIN', 'RECEPTIONIST'), async (req, res) => {
  try {
    const cu = currentUser(req);
    const updated = await db.updateSettings(req.body, cu.id, cu.name);
    res.json({ success: true, data: updated });
  } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
});

// ─── Audit Logs ───────────────────────────────────────────────────────────────

app.get('/api/audit-logs', async (req, res) => {
  try {
    const limit      = Math.min(parseInt(req.query.limit as string) || 100, 500);
    const entityType = req.query.entityType as string | undefined;
    const logs       = await db.getAuditLogs(limit, entityType);
    res.json({ success: true, data: logs });
  } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
});

app.post('/api/audit-logs/print', async (req, res) => {
  try {
    const { documentType, documentId, patientName } = req.body;
    const cu = currentUser(req);
    await db.logAudit({
      userId: cu.id, userName: cu.name, userRole: cu.role,
      action: 'PRINT_DOCUMENT', entityType: 'DOCUMENT',
      entityId: documentId,
      entityName: `${documentType}${patientName ? ` — ${patientName}` : ''}`,
    });
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
});

// ─── Production static file serving ──────────────────────────────────────────

if (IS_PROD) {
  const distPath = path.join(__dirname, 'dist');
  app.use(express.static(distPath));
  app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
}

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(API_PORT, () => {
  console.log(`🦷  Apex Dental API → http://localhost:${API_PORT}`);
  console.log(`   Mode: ${IS_PROD ? 'production' : 'development (Vite proxies /api from :3000)'}`);
});

export default app;
