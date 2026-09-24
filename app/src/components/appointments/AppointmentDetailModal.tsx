import React from 'react';
import { X, Calendar, Phone, Printer, RefreshCw, AlertTriangle } from 'lucide-react';
import { Appointment } from '../../types/index.js';
import { formatTime, formatDate, getStatusBadgeClasses } from '../../lib/utils.js';

// BUG-06 / BUG-08: valid forward transitions per status — mirrors server-side guard
const ALLOWED_NEXT: Record<string, string[]> = {
  SCHEDULED:   ['CONFIRMED', 'ARRIVED', 'CANCELLED', 'NO_SHOW'],
  CONFIRMED:   ['ARRIVED', 'CANCELLED', 'NO_SHOW'],
  ARRIVED:     ['IN_PROGRESS', 'CANCELLED', 'NO_SHOW'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED:   [],
  CANCELLED:   [],
  NO_SHOW:     [],
  RESCHEDULED: ['CONFIRMED', 'ARRIVED', 'CANCELLED'],
};

interface AppointmentDetailModalProps {
  isOpen: boolean;
  appointment: Appointment | null;
  // BUG-03: inline error from App-level status update handler
  statusError?: string | null;
  onClearStatusError?: () => void;
  onClose: () => void;
  onSelectPatient: (patientId: string) => void;
  onReschedule: (appointment: Appointment) => void;
  onUpdateStatus: (appointmentId: string, newStatus: string) => void;
  onOpenPrintCenter: (docType: string, appointment?: Appointment, patientId?: string) => void;
}

export const AppointmentDetailModal: React.FC<AppointmentDetailModalProps> = ({
  isOpen,
  appointment,
  statusError,
  onClearStatusError,
  onClose,
  onSelectPatient,
  onReschedule,
  onUpdateStatus,
  onOpenPrintCenter
}) => {
  if (!isOpen || !appointment) return null;

  const allowed = ALLOWED_NEXT[appointment.status] ?? [];
  const isTerminal = allowed.length === 0;

  // Helper: only render a status button if the transition is allowed
  const StatusBtn = ({
    toStatus, label, className,
  }: { toStatus: string; label: string; className: string }) => {
    if (!allowed.includes(toStatus)) return null;
    return (
      <button
        onClick={() => { onClearStatusError?.(); onUpdateStatus(appointment.id, toStatus); }}
        className={`px-2.5 py-1.5 rounded-md font-medium text-xs border ${className}`}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-800" />
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
              Appointment Details
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs">
          {/* Status Badge Banner */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Status</span>
              <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-semibold border mt-1 ${getStatusBadgeClasses(appointment.status)}`}>
                {appointment.status}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Appointment ID</span>
              <span className="font-mono text-slate-600 text-[11px]">{appointment.id}</span>
            </div>
          </div>

          {/* BUG-03: inline status-update error from App.tsx */}
          {statusError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-300 text-rose-900 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{statusError}</span>
            </div>
          )}

          {/* Patient Card */}
          <div className="p-3.5 rounded-lg border border-slate-200 bg-white space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Patient Info
              </span>
              <button
                onClick={() => { onSelectPatient(appointment.patientId); onClose(); }}
                className="text-blue-800 hover:text-blue-800 font-semibold text-[11px] underline"
              >
                View Full Patient Chart →
              </button>
            </div>
            <div className="font-bold text-sm text-slate-900">
              {appointment.patient?.firstName} {appointment.patient?.lastName}
            </div>
            <div className="flex items-center gap-3 text-slate-600 text-[11px]">
              <span className="font-mono text-blue-800 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                {appointment.patient?.patientNumber}
              </span>
              <span className="flex items-center gap-1">
                <Phone className="w-3 h-3 text-slate-400" />
                {appointment.patient?.phone}
              </span>
              <span>DOB: {appointment.patient?.dateOfBirth}</span>
            </div>
            {appointment.patient?.allergies && (
              <div className="p-2 rounded bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-medium mt-2">
                ⚠️ Allergy Flag: {appointment.patient.allergies}
              </div>
            )}
          </div>

          {/* Doctor & Timing Details */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Attending Doctor
              </span>
              <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: appointment.doctor?.color }}
                ></span>
                <span>{appointment.doctor?.fullName}</span>
              </div>
              <div className="text-[11px] text-slate-500">{appointment.doctor?.specialization}</div>
            </div>

            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Scheduled Slot
              </span>
              <div className="font-semibold text-slate-800">
                {formatDate(appointment.appointmentDate)}
              </div>
              <div className="text-[11px] text-slate-600 font-mono">
                {formatTime(appointment.startTime)} - {formatTime(appointment.endTime)} ({appointment.durationMinutes}m)
              </div>
            </div>
          </div>

          {/* Clinical Procedure & Reason */}
          <div className="p-3 rounded-lg border border-slate-200 bg-white space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Procedure / Chief Complaint
            </span>
            <div className="font-semibold text-slate-800">{appointment.appointmentType}</div>
            {appointment.reason && (
              <p className="text-slate-600 text-xs mt-1">{appointment.reason}</p>
            )}
            {appointment.notes && (
              <div className="mt-2 text-[11px] bg-slate-50 p-2 rounded border border-slate-200 text-slate-600">
                <span className="font-medium text-slate-700">Internal Notes: </span>
                {appointment.notes}
              </div>
            )}
          </div>

          {/* BUG-08 + UX-01: Status Workflow — only valid transitions shown;
              Cancel and No-Show always shown when applicable */}
          <div className="space-y-1.5 pt-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Workflow Status Actions
              {isTerminal && (
                <span className="ml-2 normal-case font-normal text-slate-400">
                  (terminal state — no further transitions)
                </span>
              )}
            </span>
            {!isTerminal && (
              <div className="flex items-center gap-2 flex-wrap">
                {/* Forward-progress actions */}
                <StatusBtn toStatus="CONFIRMED"   label="Mark Confirmed"
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200" />
                <StatusBtn toStatus="ARRIVED"     label="Mark Arrived (In Waiting)"
                  className="bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300" />
                <StatusBtn toStatus="IN_PROGRESS" label="Start Operatory Session"
                  className="bg-blue-50 hover:bg-blue-50 text-blue-800 border-blue-200" />
                <StatusBtn toStatus="COMPLETED"   label="Mark Completed"
                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border-emerald-300" />

                {/* UX-01: Cancel and No-Show — always visible when allowed */}
                <StatusBtn toStatus="NO_SHOW"   label="No Show"
                  className="bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-300" />
                <StatusBtn toStatus="CANCELLED" label="Cancel Appointment"
                  className="bg-rose-100 hover:bg-rose-200 text-rose-900 border-rose-400" />
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
            <button
              onClick={() => onOpenPrintCenter('AppointmentCard', appointment, appointment.patientId)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium border border-slate-200"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Appointment Card</span>
            </button>

            <div className="flex items-center gap-2">
              {!['COMPLETED', 'CANCELLED', 'NO_SHOW', 'RESCHEDULED'].includes(appointment.status) && (
                <button
                  onClick={() => { onReschedule(appointment); onClose(); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium border border-slate-200"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reschedule</span>
                </button>
              )}
              <button
                onClick={onClose}
                className="px-3.5 py-1.5 bg-slate-800 text-white hover:bg-slate-900 rounded-lg text-xs font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


