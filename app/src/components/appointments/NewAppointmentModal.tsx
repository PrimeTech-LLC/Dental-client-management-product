import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Calendar, Clock, User, Stethoscope, AlertTriangle, Check, UserPlus } from 'lucide-react';
import { Doctor, Patient, AppointmentType, ConflictCheckResult } from '../../types/index.js';
import { api } from '../../lib/api.js';
import { formatTime } from '../../lib/utils.js';
import { APPOINTMENT_TYPES, TIME_SLOTS, DURATION_OPTIONS } from '../../lib/constants.js';
import { ConfirmDialog } from '../ui/Toast.js';

interface NewAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialPatientId?: string;
  initialDoctorId?: string;
  initialDate?: string;
  onOpenNewPatientInline?: () => void;
}

export const NewAppointmentModal: React.FC<NewAppointmentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialPatientId,
  initialDoctorId,
  initialDate,
  onOpenNewPatientInline,
}) => {
  const today = new Date().toISOString().split('T')[0];

  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  const [doctorId, setDoctorId] = useState('');
  const [appointmentDate, setAppointmentDate] = useState(initialDate || today);
  const [startTime, setStartTime] = useState('09:00');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [appointmentType, setAppointmentType] = useState<AppointmentType>('Consultation');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  // BUG-02: warn when date is in the past
  const isPastDate = appointmentDate < today;

  // Conflict checking
  const [conflictResult, setConflictResult] = useState<ConflictCheckResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // UX-01: override confirmation dialog state (replaces bare checkbox)
  const [showOverrideConfirm, setShowOverrideConfirm] = useState(false);
  const [pendingOverride, setPendingOverride] = useState(false); // true once user confirmed override

  // PERF-02: AbortController ref so in-flight conflict checks are cancelled on new input
  const conflictAbortRef = useRef<AbortController | null>(null);

  // ── Calculate end time ─────────────────────────────────────────────────────
  const calculateEndTime = (start: string, duration: number): string => {
    const [h, m] = start.split(':').map(Number);
    const total = h * 60 + m + duration;
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  };
  const endTime = calculateEndTime(startTime, durationMinutes);

  // ── Load initial data ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    // Reset state on open
    setPatientSearch('');
    setConflictResult(null);
    setPendingOverride(false);
    setReason('');
    setNotes('');
    setAppointmentType('Consultation');

    async function loadData() {
      try {
        setLoadingInitial(true);
        const [docs, patientsData] = await Promise.all([
          api.getDoctors(false),
          api.getPatients('', 20),
        ]);
        setDoctors(docs);
        setPatients(patientsData.patients);

        setDoctorId(initialDoctorId || docs[0]?.id || '');
        setAppointmentDate(initialDate || today);

        if (initialPatientId) {
          const pt = await api.getPatientById(initialPatientId);
          setSelectedPatient(pt);
        } else {
          setSelectedPatient(null);
        }
      } catch (err) {
        console.error('Error initialising appointment form:', err);
      } finally {
        setLoadingInitial(false);
      }
    }
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialPatientId, initialDoctorId, initialDate]);

  // ── UX-03: patient search — reset list when query is cleared ──────────────
  useEffect(() => {
    if (!patientSearch.trim()) {
      // Re-load default list instead of showing stale search results
      api.getPatients('', 20).then(r => setPatients(r.patients)).catch(() => {});
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await api.getPatients(patientSearch, 10);
        setPatients(res.patients);
      } catch (err) {
        console.error(err);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [patientSearch]);

  // ── PERF-02: conflict check — 500 ms debounce + AbortController ───────────
  useEffect(() => {
    if (!doctorId || !appointmentDate || !startTime) {
      setConflictResult(null);
      return;
    }

    // Cancel any in-flight check
    if (conflictAbortRef.current) {
      conflictAbortRef.current.abort();
    }

    const timer = setTimeout(async () => {
      const controller = new AbortController();
      conflictAbortRef.current = controller;
      try {
        const check = await api.checkConflict({ doctorId, appointmentDate, startTime, endTime });
        if (!controller.signal.aborted) {
          setConflictResult(check);
          // If the slot is now clear, drop any previous override confirmation
          if (!check.hasConflict) setPendingOverride(false);
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') console.error('Conflict check error:', err);
      }
    }, 500); // PERF-02: 500 ms debounce (was 150 ms)

    return () => {
      clearTimeout(timer);
      if (conflictAbortRef.current) conflictAbortRef.current.abort();
    };
  }, [doctorId, appointmentDate, startTime, endTime]);

  if (!isOpen) return null;

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent, forceOverride = false) => {
    e.preventDefault();
    if (!selectedPatient) return;
    if (!doctorId) return;

    // UX-01: if there's a conflict and override hasn't been confirmed yet, show dialog
    if (conflictResult?.hasConflict && !forceOverride && !pendingOverride) {
      setShowOverrideConfirm(true);
      return;
    }

    try {
      setSubmitting(true);
      await api.createAppointment({
        patientId: selectedPatient.id,
        doctorId,
        appointmentDate,
        startTime,
        endTime,
        durationMinutes,
        appointmentType,
        status: 'SCHEDULED',
        reason,
        notes,
        allowOverride: forceOverride || pendingOverride,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      // Surface as inline error rather than alert()
      setConflictResult({ hasConflict: true, conflictReason: err.message || 'Failed to create appointment.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleOverrideConfirmed = async () => {
    setShowOverrideConfirm(false);
    setPendingOverride(true);
    // Submit with override flag immediately
    const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
    await handleSubmit(fakeEvent, true);
  };

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-teal-600" />
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                Schedule New Appointment
              </h2>
            </div>
            <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-200">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs">

            {/* Step 1: Patient */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-slate-700 uppercase tracking-wider text-[11px] flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  <span>1. Select Patient *</span>
                </label>
                {onOpenNewPatientInline && (
                  <button type="button" onClick={onOpenNewPatientInline}
                    className="text-teal-700 hover:text-teal-800 font-semibold text-[11px] flex items-center gap-1">
                    <UserPlus className="w-3 h-3" /><span>+ Quick Register</span>
                  </button>
                )}
              </div>

              {selectedPatient ? (
                <div className="p-3 rounded-lg bg-teal-50/80 border border-teal-200 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-900 flex items-center gap-2 flex-wrap">
                      <span>{selectedPatient.firstName} {selectedPatient.lastName}</span>
                      <span className="font-mono text-[10px] text-teal-800 bg-teal-100 px-1.5 py-0.5 rounded">
                        {selectedPatient.patientNumber}
                      </span>
                      {selectedPatient.allergies && (
                        <span className="text-[10px] bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded font-medium">
                          ⚠ Allergy: {selectedPatient.allergies}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {selectedPatient.phone} · DOB: {selectedPatient.dateOfBirth} · Blood: {selectedPatient.bloodGroup}
                    </div>
                  </div>
                  <button type="button" onClick={() => setSelectedPatient(null)}
                    className="text-slate-400 hover:text-slate-600 text-[11px] underline px-2">
                    Change
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <input type="text" placeholder="Search by name, phone, or PT-000001…"
                    value={patientSearch} onChange={e => setPatientSearch(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-500" />
                  {patients.length > 0 && (
                    <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 bg-white">
                      {patients.map(p => (
                        <button key={p.id} type="button"
                          onClick={() => { setSelectedPatient(p); setPatientSearch(''); }}
                          className="w-full text-left p-2 hover:bg-slate-50 flex items-center justify-between text-xs">
                          <div>
                            <span className="font-semibold text-slate-800">{p.firstName} {p.lastName}</span>
                            <span className="ml-2 font-mono text-[10px] text-slate-500">{p.patientNumber}</span>
                            <span className="ml-3 text-[11px] text-slate-400">{p.phone}</span>
                          </div>
                          <span className="text-[10px] text-teal-700 font-medium">Select</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Step 2: Doctor + Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">2. Attending Doctor *</label>
                <select value={doctorId} onChange={e => setDoctorId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-teal-500 focus:outline-none">
                  {doctors.map(d => (
                    <option key={d.id} value={d.id}>{d.fullName} ({d.specialization})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Appointment Date *</label>
                {/* BUG-02: min=today so past dates require deliberate choice */}
                <input type="date" value={appointmentDate} min={today}
                  onChange={e => { setAppointmentDate(e.target.value); setPendingOverride(false); }}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-teal-500 focus:outline-none" />
                {/* BUG-02: show warning for past dates (still allow them for backfilling) */}
                {isPastDate && (
                  <p className="mt-1 text-[10px] text-amber-700 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    This date is in the past. Continuing will create a back-dated appointment.
                  </p>
                )}
              </div>
            </div>

            {/* Step 3: Time + Duration */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Start Time *</label>
                <select value={startTime} onChange={e => setStartTime(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono focus:ring-1 focus:ring-teal-500 focus:outline-none">
                  {TIME_SLOTS.map(t => <option key={t} value={t}>{formatTime(t)} ({t})</option>)}
                </select>
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Duration</label>
                <select value={durationMinutes} onChange={e => setDurationMinutes(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-teal-500 focus:outline-none">
                  {DURATION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1 text-slate-500">End Time</label>
                <div className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-xs font-mono font-semibold text-slate-700">
                  {formatTime(endTime)} ({endTime})
                </div>
              </div>
            </div>

            {/* Conflict result */}
            {conflictResult?.hasConflict && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-300 text-rose-900 space-y-1">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <span className="font-bold">Schedule Conflict: </span>
                    {conflictResult.conflictReason}
                  </div>
                </div>
                {/* UX-01: no bare checkbox — override requires a confirmation dialog (see below) */}
                <p className="text-[11px] text-rose-700 pl-6">
                  Submitting this form will prompt you to confirm the override.
                </p>
              </div>
            )}

            {conflictResult && !conflictResult.hasConflict && (
              <div className="p-2 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Slot is clear — no conflicts detected.</span>
              </div>
            )}

            {pendingOverride && (
              <div className="p-2 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-[11px] flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <span>Scheduling with conflict override authorised.</span>
              </div>
            )}

            {/* Appointment type + reason */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Appointment Type *</label>
                <select value={appointmentType} onChange={e => setAppointmentType(e.target.value as AppointmentType)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-teal-500 focus:outline-none">
                  {APPOINTMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Reason / Chief Complaint</label>
                <input type="text" value={reason} onChange={e => setReason(e.target.value)}
                  placeholder="e.g. Tooth pain, routine cleaning…"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-teal-500 focus:outline-none" />
              </div>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Internal Notes</label>
              <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Any internal scheduling notes…"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-teal-500 focus:outline-none" />
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button type="button" onClick={onClose}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium">
                Cancel
              </button>
              <button type="submit"
                disabled={submitting || !selectedPatient || !doctorId || loadingInitial}
                className="px-5 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5">
                {submitting
                  ? <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /><span>Saving…</span></>
                  : <><Check className="w-3.5 h-3.5" /><span>Book Appointment</span></>
                }
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* UX-01: Override confirmation dialog */}
      <ConfirmDialog
        isOpen={showOverrideConfirm}
        title="Confirm Schedule Override"
        message={`This slot has a conflict: ${conflictResult?.conflictReason ?? ''}\n\nAre you sure you want to override and schedule this appointment anyway? This may create a double-booking.`}
        confirmLabel="Override & Schedule"
        cancelLabel="Go Back"
        variant="warning"
        onConfirm={handleOverrideConfirmed}
        onCancel={() => setShowOverrideConfirm(false)}
      />
    </>
  );
};
