import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, User, Stethoscope, AlertTriangle, Check, UserPlus, FileText } from 'lucide-react';
import { Doctor, Patient, AppointmentType, ConflictCheckResult } from '../../types/index.js';
import { api } from '../../lib/api.js';
import { formatTime, formatDate } from '../../lib/utils.js';

interface NewAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialPatientId?: string;
  initialDoctorId?: string;
  initialDate?: string;
  onOpenNewPatientInline?: () => void;
}

const APPOINTMENT_TYPES: AppointmentType[] = [
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
  'Other'
];

const TIME_SLOTS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00'
];

export const NewAppointmentModal: React.FC<NewAppointmentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialPatientId,
  initialDoctorId,
  initialDate,
  onOpenNewPatientInline
}) => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  
  const [doctorId, setDoctorId] = useState('');
  const [appointmentDate, setAppointmentDate] = useState(initialDate || new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('09:00');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [appointmentType, setAppointmentType] = useState<AppointmentType>('Consultation');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  // Conflict Checking State
  const [conflictResult, setConflictResult] = useState<ConflictCheckResult | null>(null);
  const [allowOverride, setAllowOverride] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Calculate End Time
  const calculateEndTime = (start: string, duration: number): string => {
    const [h, m] = start.split(':').map(Number);
    const totalMinutes = h * 60 + m + duration;
    const endH = Math.floor(totalMinutes / 60);
    const endM = totalMinutes % 60;
    return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
  };

  const endTime = calculateEndTime(startTime, durationMinutes);

  // Load initial doctors and patients
  useEffect(() => {
    if (!isOpen) return;

    async function loadData() {
      try {
        setLoadingInitial(true);
        const [docs, patientsData] = await Promise.all([
          api.getDoctors(false),
          api.getPatients('', 20)
        ]);
        setDoctors(docs);
        setPatients(patientsData.patients);

        if (initialDoctorId) {
          setDoctorId(initialDoctorId);
        } else if (docs.length > 0) {
          setDoctorId(docs[0].id);
        }

        if (initialPatientId) {
          const pt = await api.getPatientById(initialPatientId);
          setSelectedPatient(pt);
        }
      } catch (err) {
        console.error('Error initializing form:', err);
      } finally {
        setLoadingInitial(false);
      }
    }
    loadData();
  }, [isOpen, initialPatientId, initialDoctorId]);

  // Debounced Patient Search
  useEffect(() => {
    if (!patientSearch.trim()) return;
    const timer = setTimeout(async () => {
      try {
        const res = await api.getPatients(patientSearch, 10);
        setPatients(res.patients);
      } catch (err) {
        console.error(err);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [patientSearch]);

  // Real-time Conflict Checker
  useEffect(() => {
    if (!doctorId || !appointmentDate || !startTime) {
      setConflictResult(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const check = await api.checkConflict({
          doctorId,
          appointmentDate,
          startTime,
          endTime
        });
        setConflictResult(check);
        if (!check.hasConflict) {
          setAllowOverride(false);
        }
      } catch (err) {
        console.error('Conflict check error:', err);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [doctorId, appointmentDate, startTime, durationMinutes, endTime]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) {
      alert('Please select or search for a patient.');
      return;
    }
    if (!doctorId) {
      alert('Please select a doctor.');
      return;
    }

    if (conflictResult?.hasConflict && !allowOverride) {
      alert(`Cannot schedule due to conflict: ${conflictResult.conflictReason}`);
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
        allowOverride
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to create appointment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
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
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Step 1: Patient Selection */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-700 uppercase tracking-wider text-[11px] flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-slate-500" />
                <span>1. Select Patient *</span>
              </label>
              {onOpenNewPatientInline && (
                <button
                  type="button"
                  onClick={onOpenNewPatientInline}
                  className="text-teal-700 hover:text-teal-800 font-semibold text-[11px] flex items-center gap-1"
                >
                  <UserPlus className="w-3 h-3" />
                  <span>+ Quick Register Patient</span>
                </button>
              )}
            </div>

            {selectedPatient ? (
              <div className="p-3 rounded-lg bg-teal-50/80 border border-teal-200 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-900 flex items-center gap-2">
                    <span>{selectedPatient.firstName} {selectedPatient.lastName}</span>
                    <span className="font-mono text-[10px] text-teal-800 bg-teal-100 px-1.5 py-0.5 rounded">
                      {selectedPatient.patientNumber}
                    </span>
                    {selectedPatient.allergies && (
                      <span className="text-[10px] bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded font-medium">
                        Allergy: {selectedPatient.allergies}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Phone: {selectedPatient.phone} · DOB: {selectedPatient.dateOfBirth} · Blood: {selectedPatient.bloodGroup}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPatient(null)}
                  className="text-slate-400 hover:text-slate-600 text-[11px] underline px-2"
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Search patient by name, phone, or PT-000001..."
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-teal-500"
                />
                {patients.length > 0 && (
                  <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 bg-white">
                    {patients.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setSelectedPatient(p);
                          setPatientSearch('');
                        }}
                        className="w-full text-left p-2 hover:bg-slate-50 flex items-center justify-between text-xs cursor-pointer"
                      >
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

          {/* Step 2: Doctor Selection & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                2. Attending Doctor *
              </label>
              <select
                value={doctorId}
                onChange={(e) => setDoctorId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-teal-500 focus:outline-hidden"
              >
                {doctors.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.fullName} ({d.specialization})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Appointment Date *
              </label>
              <input
                type="date"
                value={appointmentDate}
                onChange={(e) => setAppointmentDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-teal-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Step 3: Time Slot & Duration */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Start Time *
              </label>
              <select
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono focus:ring-1 focus:ring-teal-500 focus:outline-hidden"
              >
                {TIME_SLOTS.map(t => (
                  <option key={t} value={t}>{formatTime(t)} ({t})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Duration (Minutes)
              </label>
              <select
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-teal-500 focus:outline-hidden"
              >
                <option value={15}>15 mins (Brief check)</option>
                <option value={30}>30 mins (Standard)</option>
                <option value={45}>45 mins (Endo / Filling)</option>
                <option value={60}>60 mins (Surgery / Crown)</option>
                <option value={90}>90 mins (Complex / Multiple)</option>
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1 text-slate-500">
                Calculated End Time
              </label>
              <div className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-xs font-mono font-semibold text-slate-700">
                {formatTime(endTime)} ({endTime})
              </div>
            </div>
          </div>

          {/* Real-Time Double-Booking Conflict Alert Box */}
          {conflictResult?.hasConflict && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-300 text-rose-900 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <span className="font-bold">Double-Booking Conflict Warning: </span>
                  {conflictResult.conflictReason}
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs font-medium text-rose-950 pt-1 border-t border-rose-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowOverride}
                  onChange={(e) => setAllowOverride(e.target.checked)}
                  className="rounded text-teal-600 focus:ring-teal-500"
                />
                <span>Receptionist / Admin Permission Override (Force double-booking)</span>
              </label>
            </div>
          )}

          {conflictResult && !conflictResult.hasConflict && (
            <div className="p-2 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span>Operatory and Doctor Slot available. No conflicts detected.</span>
            </div>
          )}

          {/* Step 4: Procedure & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Procedure / Appointment Type *
              </label>
              <select
                value={appointmentType}
                onChange={(e) => setAppointmentType(e.target.value as AppointmentType)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-teal-500 focus:outline-hidden"
              >
                {APPOINTMENT_TYPES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Chief Complaint / Reason
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Sensitivity lower right molar, scaling, aligners"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-teal-500 focus:outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">
              Internal Reception Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Patient prefers morning slots, requested latex-free operatory"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-teal-500 focus:outline-hidden"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || (conflictResult?.hasConflict && !allowOverride)}
              className="px-5 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-lg text-xs font-medium shadow-xs transition-colors flex items-center gap-1.5"
            >
              {submitting ? 'Creating Appointment...' : 'Confirm Appointment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
