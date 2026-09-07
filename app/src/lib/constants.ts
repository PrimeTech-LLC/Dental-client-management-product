/**
 * Application-wide constants.
 *
 * All domain-specific arrays that power dropdowns, selects, and UI logic live
 * here so they are defined in exactly one place and imported everywhere else.
 * Nothing in this file contains clinic-specific or user-specific data — that
 * must always come from the database via the API.
 */

import type { AppointmentType, BloodGroup, ToothCondition } from '../types/index.js';

// ─── Appointment ──────────────────────────────────────────────────────────────

export const APPOINTMENT_TYPES: AppointmentType[] = [
  'Consultation',
  'Follow-up',
  'Cleaning',
  'Filling',
  'Extraction',
  'Root Canal',
  'Crown',
  'Implant',
  'Orthodontic',
  'Emergency',
  'Other',
];

export const APPOINTMENT_STATUSES = [
  { value: 'ALL',          label: 'All Statuses' },
  { value: 'SCHEDULED',    label: 'Scheduled' },
  { value: 'CONFIRMED',    label: 'Confirmed' },
  { value: 'ARRIVED',      label: 'Arrived' },
  { value: 'IN_PROGRESS',  label: 'In Progress' },
  { value: 'COMPLETED',    label: 'Completed' },
  { value: 'CANCELLED',    label: 'Cancelled' },
  { value: 'NO_SHOW',      label: 'No Show' },
  { value: 'RESCHEDULED',  label: 'Rescheduled' },
] as const;

export const DURATION_OPTIONS = [
  { value: 15,  label: '15 mins (Brief check)' },
  { value: 30,  label: '30 mins (Standard)' },
  { value: 45,  label: '45 mins (Endo / Filling)' },
  { value: 60,  label: '60 mins (Surgery / Crown)' },
  { value: 90,  label: '90 mins (Complex / Multiple)' },
] as const;

// ─── Time slots ───────────────────────────────────────────────────────────────
// Generated from 08:00 to 19:30 in 30-minute increments so the list adapts to
// any clinic's operating hours rather than being hard-wired to 09:00–17:00.

export const TIME_SLOTS: string[] = (() => {
  const slots: string[] = [];
  for (let h = 8; h <= 19; h++) {
    for (const m of [0, 30]) {
      if (h === 19 && m === 30) break; // stop at 19:30
      slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return slots;
})();

// ─── Patient ──────────────────────────────────────────────────────────────────

export const BLOOD_GROUPS: BloodGroup[] = [
  'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'UNKNOWN',
];

export const BLOOD_GROUPS_WITH_ALL: (BloodGroup | 'ALL')[] = [
  'ALL', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-',
];

export const GENDER_OPTIONS = [
  { value: 'MALE',   label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'OTHER',  label: 'Other' },
] as const;

export const ALLERGY_SEVERITIES = [
  { value: 'LOW',    label: 'Low (Mild rash)' },
  { value: 'MEDIUM', label: 'Medium (Hives, swelling)' },
  { value: 'HIGH',   label: 'High (Severe reaction)' },
  { value: 'SEVERE', label: 'Severe (Anaphylaxis)' },
] as const;

export const MEDICAL_CONDITION_STATUSES = [
  { value: 'ACTIVE',   label: 'Active' },
  { value: 'CHRONIC',  label: 'Chronic / Ongoing' },
  { value: 'RESOLVED', label: 'Resolved' },
] as const;

// ─── Dental chart ─────────────────────────────────────────────────────────────

export const TOOTH_CONDITIONS: {
  value: ToothCondition;
  label: string;
  color: string;
  bg: string;
}[] = [
  { value: 'HEALTHY',              label: 'Sound / Healthy',           color: '#10b981', bg: 'bg-emerald-50 text-emerald-800 border-emerald-300' },
  { value: 'CARIES',               label: 'Dental Caries (Cavity)',    color: '#ef4444', bg: 'bg-rose-50 text-rose-800 border-rose-300' },
  { value: 'FILLED',               label: 'Restoration / Filled',      color: '#3b82f6', bg: 'bg-blue-50 text-blue-800 border-blue-300' },
  { value: 'CROWN',                label: 'Crown / Bridge Abutment',   color: '#f59e0b', bg: 'bg-amber-50 text-amber-800 border-amber-300' },
  { value: 'ROOT_CANAL',           label: 'Root Canal Treated (RCT)',  color: '#8b5cf6', bg: 'bg-purple-50 text-purple-800 border-purple-300' },
  { value: 'MISSING',              label: 'Missing / Extracted',       color: '#64748b', bg: 'bg-slate-100 text-slate-700 border-slate-300' },
  { value: 'IMPLANT',              label: 'Dental Implant',            color: '#06b6d4', bg: 'bg-cyan-50 text-cyan-800 border-cyan-300' },
  { value: 'EXTRACTION_INDICATED', label: 'Extraction Indicated',      color: '#dc2626', bg: 'bg-red-50 text-red-900 border-red-300' },
  { value: 'FRACTURED',            label: 'Fractured / Cracked',       color: '#ea580c', bg: 'bg-orange-50 text-orange-800 border-orange-300' },
  { value: 'BRIDGE',               label: 'Bridge Pontic',             color: '#0284c7', bg: 'bg-sky-50 text-sky-800 border-sky-300' },
];

// ─── Doctor / Schedule ────────────────────────────────────────────────────────

export const DAYS_OF_WEEK = [
  { day: 1, label: 'Monday' },
  { day: 2, label: 'Tuesday' },
  { day: 3, label: 'Wednesday' },
  { day: 4, label: 'Thursday' },
  { day: 5, label: 'Friday' },
  { day: 6, label: 'Saturday' },
  { day: 0, label: 'Sunday' },
] as const;

export const DOCTOR_DEFAULT_COLOR = '#0d9488';

// ─── Prescription quick-add formulary ────────────────────────────────────────
// These are common dental medications shown as quick-add presets.
// The receptionist/doctor can still type any medicine manually.

export const COMMON_MEDS = [
  { name: 'Amoxicillin',                          strength: '500mg',  route: 'Oral',  freq: '1-1-1 (TDS)',      dur: '5 days',  instructions: 'Take after food with water' },
  { name: 'Amoxicillin + Clavulanic Acid (Augmentin)', strength: '625mg', route: 'Oral',  freq: '1-0-1 (BD)',       dur: '5 days',  instructions: 'Take with food' },
  { name: 'Metronidazole',                        strength: '400mg',  route: 'Oral',  freq: '1-1-1 (TDS)',      dur: '5 days',  instructions: 'Strictly avoid alcohol during course' },
  { name: 'Ibuprofen',                            strength: '400mg',  route: 'Oral',  freq: '1-0-1 (BD)',       dur: '3 days',  instructions: 'Take strictly after meals' },
  { name: 'Paracetamol (Acetaminophen)',           strength: '500mg',  route: 'Oral',  freq: '1-1-1 (TDS)',      dur: '3 days',  instructions: 'For pain or fever SOS' },
  { name: 'Chlorhexidine Gluconate Mouthwash',    strength: '0.12%',  route: 'Rinse', freq: '1-0-1 (BD)',       dur: '14 days', instructions: 'Rinse 10ml for 60s, do not eat for 30m' },
  { name: 'Ketorolac Tromethamine',               strength: '10mg',   route: 'Oral',  freq: 'SOS (Max 3/day)',  dur: '2 days',  instructions: 'For severe post-op dental pain' },
  { name: 'Azithromycin',                         strength: '500mg',  route: 'Oral',  freq: '1-0-0 (OD)',       dur: '3 days',  instructions: 'Take 1 hr before or 2 hr after food' },
] as const;

// ─── Slot interval options (used in SettingsHub) ──────────────────────────────

export const SLOT_DURATION_OPTIONS = [
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 45, label: '45 minutes' },
  { value: 60, label: '60 minutes' },
] as const;
