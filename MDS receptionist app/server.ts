import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { createServer as createViteServer } from 'vite';

import * as db from './src/server/db/database.js';
import type { User } from './src/types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET || 'apex-dental-dev-secret';
const JWT_EXPIRY = '12h';
const IS_PROD    = process.env.NODE_ENV === 'production';

// ─── Auth helpers ────────────────────────────────────────────────────────────

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
    maxAge: 12 * 60 * 60 * 1000, // 12 h
    path: '/',
  });
}

function clearAuthCookie(res: express.Response) {
  res.clearCookie('auth_token', { path: '/' });
}

/** Express middleware — attaches req.currentUser from JWT cookie */
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
      return res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Session expired' } });
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

// ─── Server bootstrap ────────────────────────────────────────────────────────

async function startServer(): Promise<express.Express> {
  const app = express();

  app.use(express.json());
  app.use(cookieParser());

  // ── Auth API (no requireAuth on these) ────────────────────────

  /** GET /api/auth/me — returns current user from cookie, or guest info */
  app.get('/api/auth/me', async (req, res) => {
    const token = req.cookies?.auth_token;
    if (!token) {
      const users = await db.getUsers();
      return res.json({ success: true, data: { user: null, availableUsers: users } });
    }
    try {
      const payload = jwt.verify(token, JWT_SECRET) as { id: string };
      const user = await db.getUserById(payload.id);
      const users = await db.getUsers();
      return res.json({ success: true, data: { user: user || null, availableUsers: users } });
    } catch {
      clearAuthCookie(res);
      const users = await db.getUsers();
      return res.json({ success: true, data: { user: null, availableUsers: users } });
    }
  });

  /** POST /api/auth/switch-role — "log in" as a user by ID (dev/demo mode) */
  app.post('/api/auth/switch-role', async (req, res) => {
    const { userId } = req.body;
    const user = await db.getUserById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found' } });
    }
    if (!user.isActive) {
      return res.status(403).json({ success: false, error: { code: 'USER_INACTIVE', message: 'User account is inactive' } });
    }
    await db.updateUserLastLogin(user.id);
    const token = signToken(user);
    setAuthCookie(res, token);
    await db.logAudit({ userId: user.id, userName: user.name, userRole: user.role, action: 'USER_LOGIN', entityType: 'USER', entityId: user.id, entityName: user.name });
    return res.json({ success: true, data: { user } });
  });

  /** POST /api/auth/logout */
  app.post('/api/auth/logout', (req, res) => {
    clearAuthCookie(res);
    res.json({ success: true });
  });

  // Apply auth to all /api/* routes below
  app.use('/api', requireAuth);

  // ── Patients ──────────────────────────────────────────────────

  app.get('/api/patients', async (req, res) => {
    try {
      const search = (req.query.search as string) || '';
      const limit  = Math.min(parseInt(req.query.limit as string) || 50, 200);
      const offset = parseInt(req.query.offset as string) || 0;
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

  app.post('/api/patients', async (req, res) => {
    try {
      const patient = await db.addPatient(req.body, currentUser(req).name);
      res.status(201).json({ success: true, data: patient });
    } catch (err: any) { res.status(400).json({ success: false, error: { code: 'CREATION_FAILED', message: err.message } }); }
  });

  app.put('/api/patients/:id', async (req, res) => {
    try {
      const updated = await db.updatePatient(req.params.id, req.body, currentUser(req).name);
      if (!updated) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Patient not found' } });
      res.json({ success: true, data: updated });
    } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
  });

  app.post('/api/patients/:id/medical-history', async (req, res) => {
    try {
      const item = await db.addPatientMedicalHistory({ patientId: req.params.id, createdBy: currentUser(req).name, ...req.body });
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
      const item = await db.updateToothCondition(req.params.id, Number(toothNumber), condition, notes, currentUser(req).name);
      res.json({ success: true, data: item });
    } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
  });

  // ── Doctors ───────────────────────────────────────────────────

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

  app.post('/api/doctors', async (req, res) => {
    try {
      const doc = await db.addDoctor(req.body, currentUser(req).name);
      res.status(201).json({ success: true, data: doc });
    } catch (err: any) { res.status(400).json({ success: false, error: { code: 'CREATION_FAILED', message: err.message } }); }
  });

  app.put('/api/doctors/:id', async (req, res) => {
    try {
      const updated = await db.updateDoctor(req.params.id, req.body, currentUser(req).name);
      if (!updated) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Doctor not found' } });
      res.json({ success: true, data: updated });
    } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
  });

  app.put('/api/doctors/:id/availability', async (req, res) => {
    try {
      await db.updateDoctorAvailability(req.params.id, req.body.availability);
      const availability = await db.getDoctorAvailability(req.params.id);
      res.json({ success: true, data: availability });
    } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
  });

  app.post('/api/doctors/:id/exceptions', async (req, res) => {
    try {
      const ex = await db.addDoctorException({ doctorId: req.params.id, ...req.body });
      res.status(201).json({ success: true, data: ex });
    } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
  });

  app.delete('/api/doctors/exceptions/:exId', async (req, res) => {
    try {
      await db.deleteDoctorException(req.params.exId);
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
  });

  // ── Appointments ──────────────────────────────────────────────

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
      const result = await db.checkAppointmentConflict(doctorId, appointmentDate, startTime, endTime, excludeAppointmentId);
      res.json({ success: true, data: result });
    } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
  });

  app.post('/api/appointments', async (req, res) => {
    try {
      const allowOverride = req.body.allowOverride === true;
      const { allowOverride: _, ...apptData } = req.body;
      apptData.createdBy = currentUser(req).name;
      const result = await db.createAppointment(apptData, allowOverride, currentUser(req).name);
      if (result.conflict) {
        return res.status(409).json({ success: false, error: { code: 'APPOINTMENT_CONFLICT', message: result.conflict.conflictReason, details: result.conflict } });
      }
      res.status(201).json({ success: true, data: result.appointment });
    } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
  });

  app.put('/api/appointments/:id/status', async (req, res) => {
    try {
      const { status } = req.body;
      const updated = await db.updateAppointmentStatus(req.params.id, status, currentUser(req).name);
      if (!updated) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Appointment not found' } });
      res.json({ success: true, data: updated });
    } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
  });

  app.post('/api/appointments/:id/reschedule', async (req, res) => {
    try {
      const { newDate, newStartTime, newEndTime, reason, allowOverride } = req.body;
      const result = await db.rescheduleAppointment(
        req.params.id, newDate, newStartTime, newEndTime,
        reason || 'Patient request', allowOverride === true, currentUser(req).name
      );
      if (result.conflict) {
        return res.status(409).json({ success: false, error: { code: 'RESCHEDULE_CONFLICT', message: result.conflict.conflictReason, details: result.conflict } });
      }
      res.json({ success: true, data: result.appointment });
    } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
  });

  // ── Visits ────────────────────────────────────────────────────

  app.get('/api/visits', async (req, res) => {
    try {
      const visits = await db.getVisits(req.query.patientId as string | undefined);
      res.json({ success: true, data: visits });
    } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
  });

  app.post('/api/visits', async (req, res) => {
    try {
      const visit = await db.createVisit(req.body, currentUser(req).name);
      res.status(201).json({ success: true, data: visit });
    } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
  });

  // ── Treatments ────────────────────────────────────────────────

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
      const treatment = await db.createTreatment(req.body, currentUser(req).name);
      res.status(201).json({ success: true, data: treatment });
    } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
  });

  app.put('/api/treatments/:id', async (req, res) => {
    try {
      const updated = await db.updateTreatment(req.params.id, req.body, currentUser(req).name);
      if (!updated) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Treatment not found' } });
      res.json({ success: true, data: updated });
    } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
  });

  // ── Prescriptions ─────────────────────────────────────────────

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

  app.post('/api/prescriptions', async (req, res) => {
    try {
      const { items, ...rxData } = req.body;
      if (!items || !items.length) {
        return res.status(400).json({ success: false, error: { code: 'ITEMS_REQUIRED', message: 'At least one medicine item is required' } });
      }
      const rx = await db.createPrescription(rxData, items, currentUser(req).name);
      res.status(201).json({ success: true, data: rx });
    } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
  });

  // ── Reminders ─────────────────────────────────────────────────

  app.get('/api/reminders', async (req, res) => {
    try {
      const reminders = await db.getReminders(req.query.patientId as string | undefined);
      res.json({ success: true, data: reminders });
    } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
  });

  app.post('/api/reminders/:id/send', async (req, res) => {
    try {
      const reminder = await db.triggerManualReminder(req.params.id, currentUser(req).name);
      if (!reminder) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Reminder not found' } });
      res.json({ success: true, data: reminder });
    } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
  });

  // ── Reports ───────────────────────────────────────────────────

  app.get('/api/reports', async (req, res) => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const startDate = (req.query.startDate as string) || today;
      const endDate   = (req.query.endDate   as string) || today;
      const doctorId  =  req.query.doctorId  as string | undefined;
      const reports = await db.getReports(startDate, endDate, doctorId);
      res.json({ success: true, data: reports });
    } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
  });

  // ── Settings ──────────────────────────────────────────────────

  app.get('/api/settings', async (req, res) => {
    try {
      const settings = await db.getSettings();
      res.json({ success: true, data: settings });
    } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
  });

  app.put('/api/settings', async (req, res) => {
    try {
      const updated = await db.updateSettings(req.body, currentUser(req).name);
      res.json({ success: true, data: updated });
    } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
  });

  // ── Audit Logs ────────────────────────────────────────────────

  app.get('/api/audit-logs', async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
      const entityType = req.query.entityType as string | undefined;
      const logs = await db.getAuditLogs(limit, entityType);
      res.json({ success: true, data: logs });
    } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
  });

  app.post('/api/audit-logs/print', async (req, res) => {
    try {
      const { documentType, documentId, patientName } = req.body;
      const cu = currentUser(req);
      await db.logAudit({
        userId: cu.id, userName: cu.name, userRole: cu.role,
        action: 'PRINT_DOCUMENT',
        entityType: 'DOCUMENT',
        entityId: documentId,
        entityName: `${documentType}${patientName ? ` — ${patientName}` : ''}`,
      });
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
  });

  // ── Vite Dev / Static Serve ───────────────────────────────────

  if (!IS_PROD) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  return app;
}

// ── Start server (local dev / production node process) ──────────
// When running on Vercel, this module is imported as a handler —
// startServer() is called once and the app is exported.
let _app: express.Express | undefined;

async function getApp() {
  if (!_app) _app = await startServer();
  return _app;
}

// Export for Vercel serverless
export default async function handler(req: any, res: any) {
  const app = await getApp();
  app(req, res);
}

// Start listening when executed directly (npm run dev / npm start)
if (process.argv[1] && (process.argv[1].endsWith('server.ts') || process.argv[1].endsWith('server.cjs') || process.argv[1].endsWith('server.js'))) {
  getApp().then(app => {
    const PORT = Number(process.env.PORT) || 3000;
    app.listen(PORT, () => {
      console.log(`🦷  Apex Dental server running → http://localhost:${PORT}`);
      console.log(`   Mode: ${IS_PROD ? 'production' : 'development'}`);
    });
  }).catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}
