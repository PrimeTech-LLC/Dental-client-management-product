import React, { useState, useEffect } from 'react';
import { X, RefreshCw, Calendar, Clock, AlertTriangle, Check } from 'lucide-react';
import { Appointment, ConflictCheckResult } from '../../types/index.js';
import { api } from '../../lib/api.js';
import { formatTime, formatDate } from '../../lib/utils.js';

interface RescheduleModalProps {
  isOpen: boolean;
  appointment: Appointment | null;
  onClose: () => void;
  onSuccess: () => void;
}

const TIME_SLOTS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00'
];

export const RescheduleModal: React.FC<RescheduleModalProps> = ({
  isOpen,
  appointment,
  onClose,
  onSuccess
}) => {
  const [newDate, setNewDate] = useState('');
  const [newStartTime, setNewStartTime] = useState('09:00');
  const [reason, setReason] = useState('Patient requested change in time');
  const [allowOverride, setAllowOverride] = useState(false);
  const [conflictResult, setConflictResult] = useState<ConflictCheckResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (appointment) {
      setNewDate(appointment.appointmentDate);
      setNewStartTime(appointment.startTime);
      setAllowOverride(false);
    }
  }, [appointment, isOpen]);

  // Calculate new end time based on original duration
  const duration = appointment?.durationMinutes || 30;
  const calculateEndTime = (start: string, dur: number): string => {
    const [h, m] = start.split(':').map(Number);
    const totalMinutes = h * 60 + m + dur;
    const endH = Math.floor(totalMinutes / 60);
    const endM = totalMinutes % 60;
    return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
  };
  const newEndTime = calculateEndTime(newStartTime, duration);

  // Check Conflict in real-time
  useEffect(() => {
    if (!appointment || !newDate || !newStartTime) return;

    const timer = setTimeout(async () => {
      try {
        const check = await api.checkConflict({
          doctorId: appointment.doctorId,
          appointmentDate: newDate,
          startTime: newStartTime,
          endTime: newEndTime,
          excludeAppointmentId: appointment.id
        });
        setConflictResult(check);
        if (!check.hasConflict) setAllowOverride(false);
      } catch (err) {
        console.error('Error checking conflict:', err);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [appointment, newDate, newStartTime, newEndTime]);

  if (!isOpen || !appointment) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (conflictResult?.hasConflict && !allowOverride) {
      alert(`Cannot reschedule due to conflict: ${conflictResult.conflictReason}`);
      return;
    }

    try {
      setSubmitting(true);
      await api.rescheduleAppointment(appointment.id, {
        newDate,
        newStartTime,
        newEndTime,
        reason,
        allowOverride
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to reschedule appointment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-teal-600" />
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
              Reschedule Appointment
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {/* Current Details */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Original Slot
            </div>
            <div className="font-semibold text-slate-800 text-xs">
              {appointment.patient?.firstName} {appointment.patient?.lastName} ({appointment.patient?.patientNumber})
            </div>
            <div className="text-slate-600">
              Doctor: {appointment.doctor?.fullName} · {appointment.appointmentType}
            </div>
            <div className="text-slate-500 font-mono text-[11px]">
              {formatDate(appointment.appointmentDate)} from {formatTime(appointment.startTime)} to {formatTime(appointment.endTime)}
            </div>
          </div>

          {/* New Slot Inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                New Date *
              </label>
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-teal-500 focus:outline-hidden"
                required
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                New Start Time *
              </label>
              <select
                value={newStartTime}
                onChange={(e) => setNewStartTime(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono focus:ring-1 focus:ring-teal-500 focus:outline-hidden"
              >
                {TIME_SLOTS.map(t => (
                  <option key={t} value={t}>{formatTime(t)} ({t})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="text-[11px] text-slate-500 font-mono">
            New Estimated End Time: <strong className="text-slate-700">{formatTime(newEndTime)} ({newEndTime})</strong>
          </div>

          {/* Conflict Alert Box */}
          {conflictResult?.hasConflict && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-300 text-rose-900 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <span className="font-bold">Schedule Conflict: </span>
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
                <span>Authorized Override (Allow Conflict)</span>
              </label>
            </div>
          )}

          {conflictResult && !conflictResult.hasConflict && (
            <div className="p-2 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span>Target slot is clear for Dr. {appointment.doctor?.fullName}.</span>
            </div>
          )}

          {/* Reason */}
          <div>
            <label className="font-semibold text-slate-700 block mb-1">
              Reason for Rescheduling *
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Patient called to delay by 2 days, Doctor schedule adjustment"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-teal-500 focus:outline-hidden"
              required
            />
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || (conflictResult?.hasConflict && !allowOverride)}
              className="px-5 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-lg text-xs font-medium shadow-xs"
            >
              {submitting ? 'Updating...' : 'Confirm Reschedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
