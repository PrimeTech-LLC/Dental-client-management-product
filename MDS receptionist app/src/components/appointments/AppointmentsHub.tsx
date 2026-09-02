import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  User,
  Filter,
  Plus,
  ChevronLeft,
  ChevronRight,
  Printer,
  RefreshCw,
  Search,
  CheckCircle2,
  CalendarDays,
  LayoutGrid,
  List
} from 'lucide-react';
import { Appointment, Doctor, Patient } from '../../types/index.js';
import { api } from '../../lib/api.js';
import { formatTime, formatDate, getStatusBadgeClasses } from '../../lib/utils.js';
import { format, addDays, subDays, startOfWeek, endOfWeek, parseISO, isSameDay } from 'date-fns';

interface AppointmentsHubProps {
  onOpenNewAppointment: (initialDoctorId?: string, initialDate?: string) => void;
  onSelectPatient: (patientId: string) => void;
  onRescheduleAppointment: (appointment: Appointment) => void;
  onSelectAppointment: (appointment: Appointment) => void;
  onOpenPrintCenter: (docType: string, appointment?: Appointment) => void;
}

type ViewMode = 'day' | 'week' | 'list';

const TIME_SLOTS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00', '17:30'
];

export const AppointmentsHub: React.FC<AppointmentsHubProps> = ({
  onOpenNewAppointment,
  onSelectPatient,
  onRescheduleAppointment,
  onSelectAppointment,
  onOpenPrintCenter
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const dateStr = format(selectedDate, 'yyyy-MM-dd');

  // Load appointments with a rolling date window (30 days back → 14 days forward)
  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const startDate = format(subDays(new Date(), 30), 'yyyy-MM-dd');
      const endDate   = format(addDays(new Date(), 14),  'yyyy-MM-dd');
      const [appts, docs] = await Promise.all([
        api.getAppointments({ startDate, endDate }),
        api.getDoctors(false)
      ]);
      setAppointments(appts);
      setDoctors(docs);
    } catch (err) {
      console.error('Failed to load appointments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, []);

  // Filter appointments
  const filteredAppointments = appointments.filter(a => {
    if (selectedDoctorId !== 'ALL' && a.doctorId !== selectedDoctorId) return false;
    if (selectedStatus !== 'ALL' && a.status !== selectedStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchPatient = a.patient?.firstName.toLowerCase().includes(q) ||
                           a.patient?.lastName.toLowerCase().includes(q) ||
                           a.patient?.patientNumber.toLowerCase().includes(q) ||
                           a.patient?.phone.includes(q);
      const matchDoc = a.doctor?.fullName.toLowerCase().includes(q);
      const matchType = a.appointmentType.toLowerCase().includes(q);
      if (!matchPatient && !matchDoc && !matchType) return false;
    }
    return true;
  });

  // Date Navigation handlers
  const handlePrev = () => {
    if (viewMode === 'day') setSelectedDate(prev => subDays(prev, 1));
    else if (viewMode === 'week') setSelectedDate(prev => subDays(prev, 7));
  };

  const handleNext = () => {
    if (viewMode === 'day') setSelectedDate(prev => addDays(prev, 1));
    else if (viewMode === 'week') setSelectedDate(prev => addDays(prev, 7));
  };

  const handleToday = () => setSelectedDate(new Date());

  // Week days
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 6 }).map((_, i) => addDays(weekStart, i)); // Mon to Sat

  // Filter for single day view
  const dayAppointments = filteredAppointments.filter(a => a.appointmentDate === dateStr);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header & View Mode Switcher */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-teal-600" />
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">
              Appointment Schedule & Operatories
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Multi-doctor timeline, weekly chair capacity, and double-booking conflict control.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* View switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
            <button
              onClick={() => setViewMode('day')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                viewMode === 'day' ? 'bg-white text-slate-800 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Day Grid
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                viewMode === 'week' ? 'bg-white text-slate-800 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Week View
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                viewMode === 'list' ? 'bg-white text-slate-800 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Master List
            </button>
          </div>

          <button
            onClick={() => onOpenPrintCenter('DailySchedule')}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium border border-slate-300 shadow-2xs transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Schedule</span>
          </button>

          <button
            onClick={() => onOpenNewAppointment(selectedDoctorId !== 'ALL' ? selectedDoctorId : undefined, dateStr)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-medium shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Book Appointment</span>
          </button>
        </div>
      </div>

      {/* Date Navigation & Filter Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        {/* Date Navigator */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrev}
            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200"
            title="Previous"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <button
            onClick={handleToday}
            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium border border-slate-200"
          >
            Today
          </button>

          <button
            onClick={handleNext}
            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200"
            title="Next"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <div className="font-bold text-slate-800 text-sm ml-2">
            {viewMode === 'day' && format(selectedDate, 'EEEE, MMMM dd, yyyy')}
            {viewMode === 'week' && `Week of ${format(weekStart, 'MMM dd')} - ${format(addDays(weekStart, 5), 'MMM dd, yyyy')}`}
            {viewMode === 'list' && 'All Scheduled Appointments'}
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Doctor filter */}
          <select
            value={selectedDoctorId}
            onChange={(e) => setSelectedDoctorId(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-700 focus:outline-hidden"
          >
            <option value="ALL">All Doctors</option>
            {doctors.map(d => (
              <option key={d.id} value={d.id}>{d.fullName}</option>
            ))}
          </select>

          {/* Status filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-700 focus:outline-hidden"
          >
            <option value="ALL">All Statuses</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="ARRIVED">Arrived</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search schedule..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-md text-xs focus:bg-white focus:outline-hidden w-44"
            />
          </div>
        </div>
      </div>

      {/* VIEW 1: DAY TIMELINE MATRIX */}
      {viewMode === 'day' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-x-auto">
          <div className="min-w-[700px]">
            {/* Header: Doctors Column */}
            <div className="grid grid-cols-[100px_repeat(auto-fit,minmax(280px,1fr))] border-b border-slate-200 bg-slate-100 text-xs font-semibold text-slate-700">
              <div className="p-3 border-r border-slate-200 text-slate-400 font-mono text-center">
                TIME
              </div>
              {doctors.filter(d => selectedDoctorId === 'ALL' || d.id === selectedDoctorId).map(doc => (
                <div key={doc.id} className="p-3 border-r border-slate-200 last:border-r-0 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: doc.color }}></span>
                    <span className="font-bold text-slate-800">{doc.fullName}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-normal">
                    {doc.specialization}
                  </span>
                </div>
              ))}
            </div>

            {/* Time Slot Rows */}
            <div className="divide-y divide-slate-100">
              {TIME_SLOTS.map(time => {
                const activeDoctors = doctors.filter(d => selectedDoctorId === 'ALL' || d.id === selectedDoctorId);

                return (
                  <div key={time} className="grid grid-cols-[100px_repeat(auto-fit,minmax(280px,1fr))] min-h-[64px] hover:bg-slate-50/50 transition-colors">
                    {/* Time Label */}
                    <div className="p-2.5 border-r border-slate-200 text-center font-mono text-xs text-slate-500 bg-slate-50/70 flex items-center justify-center">
                      {formatTime(time)}
                    </div>

                    {/* Doctor Slot Cells */}
                    {activeDoctors.map(doc => {
                      // Find appointment starting at or covering this slot for this doctor on this day
                      const apptsInSlot = dayAppointments.filter(a =>
                        a.doctorId === doc.id && a.startTime === time
                      );

                      return (
                        <div
                          key={doc.id}
                          className="p-1.5 border-r border-slate-200 last:border-r-0 relative group"
                        >
                          {apptsInSlot.length > 0 ? (
                            <div className="space-y-1.5">
                              {apptsInSlot.map(appt => (
                                <div
                                  key={appt.id}
                                  onClick={() => onSelectAppointment(appt)}
                                  className="p-2.5 rounded-lg bg-white border border-slate-200 shadow-2xs hover:border-teal-400 hover:shadow-xs transition-all cursor-pointer text-xs"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-slate-900 truncate">
                                      {appt.patient?.firstName} {appt.patient?.lastName}
                                    </span>
                                    <span className={`text-[10px] px-1.5 py-0.2 rounded border font-medium ${getStatusBadgeClasses(appt.status)}`}>
                                      {appt.status}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-600 font-medium mt-0.5">
                                    {appt.appointmentType}
                                  </div>
                                  <div className="text-[10px] text-slate-400 flex items-center justify-between mt-1">
                                    <span>{formatTime(appt.startTime)} - {formatTime(appt.endTime)}</span>
                                    <span className="font-mono">{appt.patient?.patientNumber}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                onOpenNewAppointment(doc.id, dateStr);
                              }}
                              className="w-full h-full min-h-[50px] rounded border border-dashed border-transparent hover:border-slate-300 hover:bg-teal-50/30 transition-all flex items-center justify-center text-slate-300 hover:text-teal-700 text-xs opacity-0 group-hover:opacity-100"
                            >
                              + Book {formatTime(time)}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: WEEK VIEW */}
      {viewMode === 'week' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-x-auto">
          <div className="min-w-[900px]">
            {/* Days Header */}
            <div className="grid grid-cols-6 border-b border-slate-200 bg-slate-100 text-xs font-semibold text-slate-700 text-center">
              {weekDays.map(d => {
                const isToday = isSameDay(d, new Date());
                const dayAppts = filteredAppointments.filter(a => a.appointmentDate === format(d, 'yyyy-MM-dd'));

                return (
                  <div key={d.toISOString()} className={`p-3 border-r border-slate-200 last:border-r-0 ${isToday ? 'bg-teal-50/80 text-teal-900' : ''}`}>
                    <div className="font-bold text-sm">{format(d, 'EEE')}</div>
                    <div className="text-xs text-slate-500">{format(d, 'MMM dd')}</div>
                    <div className="text-[10px] font-mono mt-1 text-slate-400">
                      {dayAppts.length} booked
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Days Content Matrix */}
            <div className="grid grid-cols-6 divide-x divide-slate-200 min-h-[450px]">
              {weekDays.map(d => {
                const currentDayStr = format(d, 'yyyy-MM-dd');
                const dayAppts = filteredAppointments.filter(a => a.appointmentDate === currentDayStr);

                return (
                  <div key={currentDayStr} className="p-2 space-y-2 bg-slate-50/30">
                    {dayAppts.length === 0 ? (
                      <div className="text-center py-10 text-slate-300 text-xs">
                        No appointments
                      </div>
                    ) : (
                      dayAppts.map(appt => (
                        <div
                          key={appt.id}
                          onClick={() => onSelectAppointment(appt)}
                          className="p-2 rounded-lg bg-white border border-slate-200 shadow-2xs hover:border-teal-400 transition-all cursor-pointer text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[10px] font-bold text-slate-700">
                              {formatTime(appt.startTime)}
                            </span>
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: appt.doctor?.color }}
                              title={appt.doctor?.fullName}
                            ></span>
                          </div>
                          <div className="font-semibold text-slate-900 truncate">
                            {appt.patient?.firstName} {appt.patient?.lastName}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">
                            {appt.appointmentType}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: MASTER LIST */}
      {viewMode === 'list' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/70 text-[11px] uppercase font-semibold text-slate-600">
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Patient</th>
                  <th className="py-3 px-4">Doctor</th>
                  <th className="py-3 px-4">Procedure</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAppointments.map(appt => (
                  <tr key={appt.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-semibold text-slate-800">
                        {formatDate(appt.appointmentDate)}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {formatTime(appt.startTime)} - {formatTime(appt.endTime)}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <button
                        onClick={() => onSelectPatient(appt.patientId)}
                        className="font-medium text-slate-900 hover:text-teal-700 underline text-left"
                      >
                        {appt.patient?.firstName} {appt.patient?.lastName}
                      </button>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {appt.patient?.patientNumber} · {appt.patient?.phone}
                      </div>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 font-medium text-slate-800">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: appt.doctor?.color }}></span>
                        <span>{appt.doctor?.fullName}</span>
                      </div>
                      <div className="text-[10px] text-slate-400">{appt.doctor?.specialization}</div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-800">{appt.appointmentType}</div>
                      {appt.reason && <div className="text-[11px] text-slate-500 truncate max-w-xs">{appt.reason}</div>}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-medium border ${getStatusBadgeClasses(appt.status)}`}>
                        {appt.status}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => onSelectAppointment(appt)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-medium"
                        >
                          Details
                        </button>
                        <button
                          onClick={() => onRescheduleAppointment(appt)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-medium"
                        >
                          Reschedule
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
