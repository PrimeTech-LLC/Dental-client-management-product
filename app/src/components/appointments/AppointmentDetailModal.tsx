import React from 'react';
import { X, Calendar, Clock, User, Stethoscope, Phone, Printer, RefreshCw, CheckCircle2, PlayCircle, AlertCircle } from 'lucide-react';
import { Appointment } from '../../types/index.js';
import { formatTime, formatDate, getStatusBadgeClasses } from '../../lib/utils.js';

interface AppointmentDetailModalProps {
  isOpen: boolean;
  appointment: Appointment | null;
  onClose: () => void;
  onSelectPatient: (patientId: string) => void;
  onReschedule: (appointment: Appointment) => void;
  onUpdateStatus: (appointmentId: string, newStatus: string) => void;
  onOpenPrintCenter: (docType: string, appointment?: Appointment, patientId?: string) => void;
}

export const AppointmentDetailModal: React.FC<AppointmentDetailModalProps> = ({
  isOpen,
  appointment,
  onClose,
  onSelectPatient,
  onReschedule,
  onUpdateStatus,
  onOpenPrintCenter
}) => {
  if (!isOpen || !appointment) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-teal-600" />
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

          {/* Patient Card */}
          <div className="p-3.5 rounded-lg border border-slate-200 bg-white space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Patient Info
              </span>
              <button
                onClick={() => {
                  onSelectPatient(appointment.patientId);
                  onClose();
                }}
                className="text-teal-700 hover:text-teal-800 font-semibold text-[11px] underline"
              >
                View Full Patient Chart →
              </button>
            </div>
            <div className="font-bold text-sm text-slate-900">
              {appointment.patient?.firstName} {appointment.patient?.lastName}
            </div>
            <div className="flex items-center gap-3 text-slate-600 text-[11px]">
              <span className="font-mono text-teal-800 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">
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

          {/* Status Workflow Action Bar */}
          <div className="space-y-1.5 pt-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Workflow Status Actions
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => onUpdateStatus(appointment.id, 'CONFIRMED')}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-medium text-xs border border-slate-200"
              >
                Mark Confirmed
              </button>
              <button
                onClick={() => onUpdateStatus(appointment.id, 'ARRIVED')}
                className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-md font-medium text-xs border border-amber-300"
              >
                Mark Arrived (In Waiting)
              </button>
              <button
                onClick={() => onUpdateStatus(appointment.id, 'IN_PROGRESS')}
                className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-900 rounded-md font-medium text-xs border border-blue-300"
              >
                Start Operatory Session
              </button>
              <button
                onClick={() => onUpdateStatus(appointment.id, 'COMPLETED')}
                className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 rounded-md font-medium text-xs border border-emerald-300"
              >
                Mark Completed
              </button>
            </div>
          </div>

          {/* Footer Print & Reschedule Action Buttons */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => onOpenPrintCenter('AppointmentCard', appointment, appointment.patientId)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium border border-slate-200"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Appointment Card</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              {appointment.status !== 'COMPLETED' && appointment.status !== 'CANCELLED' && (
                <button
                  onClick={() => {
                    onReschedule(appointment);
                    onClose();
                  }}
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
