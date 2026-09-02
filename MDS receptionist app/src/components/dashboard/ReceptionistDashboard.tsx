import React, { useState, useEffect } from 'react';
import {
  CalendarCheck2,
  Clock,
  UserCheck,
  UserX,
  PlayCircle,
  CheckCircle2,
  AlertCircle,
  Phone,
  Printer,
  CalendarPlus,
  UserPlus,
  RefreshCw,
  MoreHorizontal,
  Stethoscope,
  Filter,
  ArrowRight,
  Eye,
  Calendar,
  FileText
} from 'lucide-react';
import { format } from 'date-fns';
import { Appointment, Doctor, Patient, ClinicSettings } from '../../types/index.js';
import { api } from '../../lib/api.js';
import { formatTime, formatDate, getStatusBadgeClasses } from '../../lib/utils.js';

interface ReceptionistDashboardProps {
  onOpenNewAppointment: () => void;
  onOpenNewPatient: () => void;
  onSelectPatient: (patientId: string) => void;
  onRescheduleAppointment: (appointment: Appointment) => void;
  onOpenPrintCenter: (docType?: string, appointment?: Appointment, patientId?: string) => void;
  onSelectAppointment: (appointment: Appointment) => void;
}

export const ReceptionistDashboard: React.FC<ReceptionistDashboardProps> = ({
  onOpenNewAppointment,
  onOpenNewPatient,
  onSelectPatient,
  onRescheduleAppointment,
  onOpenPrintCenter,
  onSelectAppointment
}) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [settings, setSettings] = useState<ClinicSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [doctorFilter, setDoctorFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [refreshing, setRefreshing] = useState(false);
  const [yesterdayCount, setYesterdayCount] = useState<number | null>(null);

  const todayStr = new Date().toISOString().split('T')[0];
  const yesterdayStr = (() => {
    const d = new Date(); d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  })();

  const loadDashboardData = async () => {
    try {
      setRefreshing(true);
      const [apptsData, yesterdayData, docsData, setsData] = await Promise.all([
        api.getAppointments({ date: todayStr }),
        api.getAppointments({ date: yesterdayStr }),
        api.getDoctors(),
        api.getSettings()
      ]);
      setAppointments(apptsData);
      setYesterdayCount(yesterdayData.length);
      setDoctors(docsData);
      setSettings(setsData);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Status update handler
  const handleStatusUpdate = async (apptId: string, newStatus: string) => {
    try {
      const updated = await api.updateAppointmentStatus(apptId, newStatus);
      setAppointments(prev => prev.map(a => a.id === apptId ? updated : a));
    } catch (err: any) {
      alert(`Error updating status: ${err.message}`);
    }
  };

  // Filtered Appointments
  const filteredAppointments = appointments.filter(a => {
    if (doctorFilter !== 'ALL' && a.doctorId !== doctorFilter) return false;
    if (statusFilter !== 'ALL' && a.status !== statusFilter) return false;
    return true;
  });

  // Calculate Metrics
  const totalToday = appointments.length;
  const waitingPatients = appointments.filter(a => a.status === 'ARRIVED');
  const inProgressPatients = appointments.filter(a => a.status === 'IN_PROGRESS');
  const completedPatients = appointments.filter(a => a.status === 'COMPLETED');
  const cancelledPatients = appointments.filter(a => a.status === 'CANCELLED' || a.status === 'NO_SHOW');

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Dashboard Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Today's Appointments</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{totalToday}</span>
            <span className="text-xs text-teal-600 font-medium">
              {yesterdayCount !== null
                ? (totalToday - yesterdayCount > 0
                    ? `+${totalToday - yesterdayCount} from yesterday`
                    : totalToday - yesterdayCount < 0
                    ? `${totalToday - yesterdayCount} from yesterday`
                    : 'Same as yesterday')
                : '—'}
            </span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Waiting Patients</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{waitingPatients.length}</span>
            <span className="text-xs text-orange-600 font-medium">Est. wait 15m</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Completed Visits</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{completedPatients.length}</span>
            <span className="text-xs text-slate-500 font-medium">
              {totalToday > 0 ? `${Math.round((completedPatients.length / totalToday) * 100)}% of daily total` : '0% of daily total'}
            </span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Cancellations</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{cancelledPatients.length}</span>
            <span className="text-xs text-red-600 font-medium">
              {cancelledPatients.length > 0 ? 'Requires follow-up' : '0 today'}
            </span>
          </div>
        </div>
      </div>

      {/* Content Grid: Active Schedule & Administrative Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Table Section (2 Cols) */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h2 className="font-bold text-slate-800 text-base">Active Daily Schedule</h2>
              <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full border border-slate-200">
                {filteredAppointments.length} Total
              </span>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={doctorFilter}
                onChange={(e) => setDoctorFilter(e.target.value)}
                className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer"
              >
                <option value="ALL">All Doctors</option>
                {doctors.map(d => (
                  <option key={d.id} value={d.id}>{d.fullName}</option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                <option value="SCHEDULED">Scheduled</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="ARRIVED">Arrived (Waiting)</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>

              <button
                onClick={loadDashboardData}
                disabled={refreshing}
                title="Refresh schedule"
                className="p-1.5 text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto flex-1">
            {filteredAppointments.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <CalendarCheck2 className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                <p className="text-sm font-medium text-slate-700">No appointments found</p>
                <p className="text-xs text-slate-400 mt-1">Try adjusting the filter criteria or create a new booking.</p>
                <button
                  onClick={onOpenNewAppointment}
                  className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-md text-xs font-medium transition-colors cursor-pointer"
                >
                  <CalendarPlus className="w-3.5 h-3.5" />
                  <span>+ New Appointment</span>
                </button>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 sticky top-0">
                  <tr className="text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-100">
                    <th className="px-6 py-3 font-semibold">Time</th>
                    <th className="px-6 py-3 font-semibold">Patient</th>
                    <th className="px-6 py-3 font-semibold">Doctor</th>
                    <th className="px-6 py-3 font-semibold">Treatment</th>
                    <th className="px-6 py-3 font-semibold">Status</th>
                    <th className="px-6 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-sm divide-y divide-slate-100">
                  {filteredAppointments.map(appt => {
                    const isArrived = appt.status === 'ARRIVED';
                    const isInProgress = appt.status === 'IN_PROGRESS';
                    const isCompleted = appt.status === 'COMPLETED';

                    return (
                      <tr
                        key={appt.id}
                        className={`transition-colors hover:bg-slate-50/80 ${
                          isInProgress ? 'bg-teal-50/30' : isArrived ? 'bg-amber-50/30' : ''
                        }`}
                      >
                        {/* Time */}
                        <td className="px-6 py-4 font-mono text-slate-600 text-xs whitespace-nowrap">
                          <div className="font-semibold text-slate-800">{formatTime(appt.startTime)}</div>
                          <div className="text-[10px] text-slate-400">{appt.durationMinutes} min ({appt.endTime})</div>
                        </td>

                        {/* Patient */}
                        <td className="px-6 py-4">
                          <div
                            onClick={() => onSelectPatient(appt.patientId)}
                            className="font-medium text-slate-900 hover:text-teal-600 hover:underline cursor-pointer"
                          >
                            {appt.patient?.firstName} {appt.patient?.lastName}
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                            <span>{appt.patient?.patientNumber || 'PT-000'}</span>
                            <span>•</span>
                            <span>{appt.patient?.phone}</span>
                          </div>
                          {appt.patient?.allergies && (
                            <div className="text-[10px] text-red-600 font-bold uppercase tracking-wider mt-1">
                              Allergy: {appt.patient.allergies}
                            </div>
                          )}
                        </td>

                        {/* Doctor */}
                        <td className="px-6 py-4 text-slate-700 text-xs whitespace-nowrap">
                          <div className="font-medium flex items-center gap-1.5">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: appt.doctor?.color || '#0d9488' }}
                            ></span>
                            <span>{appt.doctor?.fullName}</span>
                          </div>
                          <div className="text-[10px] text-slate-400">{appt.doctor?.specialization}</div>
                        </td>

                        {/* Treatment */}
                        <td className="px-6 py-4 text-slate-600 text-xs">
                          <div className="font-medium text-slate-800">{appt.appointmentType}</div>
                          {appt.reason && (
                            <div className="text-[11px] text-slate-400 truncate max-w-xs">{appt.reason}</div>
                          )}
                        </td>

                        {/* Status Badge */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          {isCompleted ? (
                            <span className="px-2 py-1 bg-green-50 text-green-700 text-[10px] font-bold rounded uppercase border border-green-200">
                              Completed
                            </span>
                          ) : isInProgress ? (
                            <span className="px-2 py-1 bg-teal-600 text-white text-[10px] font-bold rounded uppercase border border-teal-700 shadow-xs">
                              In Progress
                            </span>
                          ) : isArrived ? (
                            <span className="px-2 py-1 bg-orange-100 text-orange-700 text-[10px] font-bold rounded uppercase border border-orange-200">
                              Arrived
                            </span>
                          ) : appt.status === 'CONFIRMED' ? (
                            <span className="px-2 py-1 bg-teal-50 text-teal-700 text-[10px] font-bold rounded uppercase border border-teal-200">
                              Confirmed
                            </span>
                          ) : appt.status === 'CANCELLED' ? (
                            <span className="px-2 py-1 bg-rose-50 text-rose-700 text-[10px] font-bold rounded uppercase border border-rose-200">
                              Cancelled
                            </span>
                          ) : (
                            <span className="px-2 py-1 bg-slate-100 text-slate-500 text-[10px] font-bold rounded uppercase border border-slate-200">
                              Scheduled
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            {appt.status === 'SCHEDULED' && (
                              <button
                                onClick={() => handleStatusUpdate(appt.id, 'ARRIVED')}
                                className="text-teal-600 hover:text-teal-800 hover:underline font-medium text-xs cursor-pointer"
                              >
                                Arrival
                              </button>
                            )}

                            {appt.status === 'CONFIRMED' && (
                              <button
                                onClick={() => handleStatusUpdate(appt.id, 'ARRIVED')}
                                className="text-teal-600 hover:text-teal-800 hover:underline font-medium text-xs cursor-pointer"
                              >
                                Arrival
                              </button>
                            )}

                            {appt.status === 'ARRIVED' && (
                              <button
                                onClick={() => handleStatusUpdate(appt.id, 'IN_PROGRESS')}
                                className="text-teal-600 hover:text-teal-800 hover:underline font-medium text-xs cursor-pointer"
                              >
                                Start Visit
                              </button>
                            )}

                            {appt.status === 'IN_PROGRESS' && (
                              <button
                                onClick={() => handleStatusUpdate(appt.id, 'COMPLETED')}
                                className="text-emerald-600 hover:text-emerald-800 hover:underline font-medium text-xs cursor-pointer"
                              >
                                Finish
                              </button>
                            )}

                            {/* View / Detail */}
                            <button
                              onClick={() => onSelectAppointment(appt)}
                              className="text-slate-500 hover:text-slate-800 font-medium text-xs cursor-pointer"
                            >
                              {isInProgress ? 'Details' : 'View'}
                            </button>

                            {/* Print Token */}
                            <button
                              onClick={() => onOpenPrintCenter('AppointmentCard', appt, appt.patientId)}
                              className="text-slate-400 hover:text-teal-600 p-1 cursor-pointer"
                              title="Print Card"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>

                            {/* Reschedule */}
                            {!isCompleted && appt.status !== 'CANCELLED' && (
                              <button
                                onClick={() => onRescheduleAppointment(appt)}
                                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                                title="Reschedule"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right Panels (1 Col) */}
        <div className="flex flex-col gap-6">
          {/* Doctor Status Panel */}
          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-800">Doctor Status</h3>
              <span className="text-[11px] text-slate-400 font-mono">
                {doctors.filter(d => d.isActive).length} active
              </span>
            </div>

            <div className="space-y-4">
              {doctors.map((doc, idx) => {
                const docAppts = appointments.filter(a => a.doctorId === doc.id);
                const inSession = docAppts.find(a => a.status === 'IN_PROGRESS');
                const nextAppt = docAppts.find(a => a.status === 'SCHEDULED' || a.status === 'CONFIRMED' || a.status === 'ARRIVED');
                const isOffDuty = !doc.isActive;

                return (
                  <div key={doc.id} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          isOffDuty
                            ? 'bg-slate-300'
                            : inSession
                            ? 'bg-orange-500'
                            : 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]'
                        }`}
                      ></div>
                      <div>
                        <span className={`font-medium ${isOffDuty ? 'text-slate-400' : 'text-slate-700'}`}>
                          {doc.fullName}
                        </span>
                        {inSession && (
                          <p className="text-[10px] text-slate-400">
                            In chair: {inSession.patient?.firstName} {inSession.patient?.lastName}
                          </p>
                        )}
                      </div>
                    </div>

                    <div>
                      {isOffDuty ? (
                        <span className="text-[10px] text-slate-400 italic font-medium uppercase">Off-Duty</span>
                      ) : inSession ? (
                        <span className="text-[10px] font-mono text-orange-600 bg-orange-50 px-2 py-0.5 rounded border border-orange-200">
                          {formatTime(inSession.startTime)} Session
                        </span>
                      ) : (
                        <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-medium">
                          {`Room 0${(idx % 4) + 1}`}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Administrative Hub Quick Actions */}
          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col">
            <h3 className="text-sm font-bold text-slate-800 mb-4">Administrative Hub</h3>
            <div className="space-y-2 flex-1">
              <button
                onClick={() => onOpenPrintCenter('Prescription')}
                className="w-full text-left p-3 text-xs font-medium hover:bg-slate-50 border border-slate-100 rounded flex items-center justify-between group cursor-pointer"
              >
                <span className="text-slate-700">Print Prescriptions</span>
                <Printer className="w-3.5 h-3.5 text-slate-400 group-hover:text-teal-600 transition-colors" />
              </button>

              <button
                onClick={() => onOpenPrintCenter('AppointmentCard')}
                className="w-full text-left p-3 text-xs font-medium hover:bg-slate-50 border border-slate-100 rounded flex items-center justify-between group cursor-pointer"
              >
                <span className="text-slate-700">Appointment Cards</span>
                <Calendar className="w-3.5 h-3.5 text-slate-400 group-hover:text-teal-600 transition-colors" />
              </button>

              <button
                onClick={() => onOpenPrintCenter('MedicalHistoryCard')}
                className="w-full text-left p-3 text-xs font-medium hover:bg-slate-50 border border-slate-100 rounded flex items-center justify-between group cursor-pointer"
              >
                <span className="text-slate-700">Patient Histories</span>
                <FileText className="w-3.5 h-3.5 text-slate-400 group-hover:text-teal-600 transition-colors" />
              </button>

              <button
                onClick={() => onOpenPrintCenter('DailySchedule')}
                className="w-full text-left p-3 text-xs font-medium hover:bg-slate-50 border border-slate-100 rounded flex items-center justify-between group cursor-pointer"
              >
                <span className="text-slate-700">Daily Audit Logs</span>
                <Clock className="w-3.5 h-3.5 text-slate-400 group-hover:text-teal-600 transition-colors" />
              </button>
            </div>

            <div className="mt-4 p-3 bg-slate-50 rounded-lg text-center border border-slate-100">
              <p className="text-[10px] text-slate-500 font-medium">Connected to Local Database</p>
              <p className="text-[10px] text-teal-600 font-mono">Sync Active: {format(new Date(), 'HH:mm:ss')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
