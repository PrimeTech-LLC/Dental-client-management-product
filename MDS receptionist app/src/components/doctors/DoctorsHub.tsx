import React, { useState, useEffect } from 'react';
import {
  Stethoscope,
  Plus,
  Edit2,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Phone,
  Mail,
  Shield,
  Trash2,
  Save,
  X
} from 'lucide-react';
import { Doctor, DoctorAvailability, DoctorScheduleException } from '../../types/index.js';
import { api } from '../../lib/api.js';
import { formatDate, formatTime } from '../../lib/utils.js';

const DAYS_OF_WEEK = [
  { day: 1, label: 'Monday' },
  { day: 2, label: 'Tuesday' },
  { day: 3, label: 'Wednesday' },
  { day: 4, label: 'Thursday' },
  { day: 5, label: 'Friday' },
  { day: 6, label: 'Saturday' },
  { day: 0, label: 'Sunday' }
];

export const DoctorsHub: React.FC = () => {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<(Doctor & { availability?: DoctorAvailability[]; exceptions?: DoctorScheduleException[] }) | null>(null);
  const [loading, setLoading] = useState(true);

  // Add / Edit Doctor Modal
  const [showDoctorModal, setShowDoctorModal] = useState(false);
  const [editingDoctorId, setEditingDoctorId] = useState<string | null>(null);
  const [formFullName, setFormFullName] = useState('');
  const [formSpecialization, setFormSpecialization] = useState('General & Cosmetic Dentistry');
  const [formLicense, setFormLicense] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formColor, setFormColor] = useState('#0d9488');
  const [formActive, setFormActive] = useState(true);

  // Exception Form
  const [showExceptionModal, setShowExceptionModal] = useState(false);
  const [exceptionDate, setExceptionDate] = useState('');
  const [exceptionReason, setExceptionReason] = useState('Annual Leave');

  const loadDoctors = async () => {
    try {
      setLoading(true);
      const docs = await api.getDoctors(true);
      setDoctors(docs);
      if (docs.length > 0 && !selectedDoctor) {
        const fullDoc = await api.getDoctorById(docs[0].id);
        setSelectedDoctor(fullDoc);
      } else if (selectedDoctor) {
        const fullDoc = await api.getDoctorById(selectedDoctor.id);
        setSelectedDoctor(fullDoc);
      }
    } catch (err) {
      console.error('Error loading doctors:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDoctors();
  }, []);

  const handleSelectDoctor = async (docId: string) => {
    const fullDoc = await api.getDoctorById(docId);
    setSelectedDoctor(fullDoc);
  };

  // Open Create Doctor
  const handleOpenCreateDoctor = () => {
    setEditingDoctorId(null);
    setFormFullName('');
    setFormSpecialization('General Dentistry');
    setFormLicense('');
    setFormPhone('');
    setFormEmail('');
    setFormColor('#0d9488');
    setFormActive(true);
    setShowDoctorModal(true);
  };

  // Open Edit Doctor
  const handleOpenEditDoctor = (doc: Doctor) => {
    setEditingDoctorId(doc.id);
    setFormFullName(doc.fullName);
    setFormSpecialization(doc.specialization);
    setFormLicense(doc.licenseNumber);
    setFormPhone(doc.phone);
    setFormEmail(doc.email);
    setFormColor(doc.color);
    setFormActive(doc.isActive);
    setShowDoctorModal(true);
  };

  // Save Doctor
  const handleSaveDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingDoctorId) {
        await api.updateDoctor(editingDoctorId, {
          fullName: formFullName,
          specialization: formSpecialization,
          licenseNumber: formLicense,
          phone: formPhone,
          email: formEmail,
          color: formColor,
          isActive: formActive
        });
      } else {
        await api.createDoctor({
          fullName: formFullName,
          specialization: formSpecialization,
          licenseNumber: formLicense,
          phone: formPhone,
          email: formEmail,
          color: formColor,
          isActive: formActive
        });
      }
      setShowDoctorModal(false);
      await loadDoctors();
    } catch (err: any) {
      alert(`Error saving doctor: ${err.message}`);
    }
  };

  // Toggle Doctor Active
  const handleToggleActive = async (doc: Doctor) => {
    const willDeactivate = doc.isActive;
    if (willDeactivate && !confirm(`Are you sure you want to deactivate ${doc.fullName}? Deactivated doctors will not be available for new appointments.`)) {
      return;
    }
    await api.updateDoctor(doc.id, { isActive: !doc.isActive });
    await loadDoctors();
  };

  // Update Availability Slot
  const handleToggleDayAvailability = async (dayOfWeek: number, isAvailable: boolean) => {
    if (!selectedDoctor || !selectedDoctor.availability) return;
    const updated = selectedDoctor.availability.map(a => {
      if (a.dayOfWeek === dayOfWeek) {
        return { ...a, isAvailable };
      }
      return a;
    });
    // If not found, add
    if (!selectedDoctor.availability.find(a => a.dayOfWeek === dayOfWeek)) {
      updated.push({
        id: `av-${Date.now()}`,
        doctorId: selectedDoctor.id,
        dayOfWeek,
        startTime: '09:00',
        endTime: '17:00',
        slotDurationMinutes: 30,
        isAvailable
      });
    }

    await api.updateDoctorAvailability(selectedDoctor.id, updated);
    const refreshed = await api.getDoctorById(selectedDoctor.id);
    setSelectedDoctor(refreshed);
  };

  // Add Exception / Time-off
  const handleAddException = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoctor || !exceptionDate) return;
    await api.addDoctorException(selectedDoctor.id, {
      exceptionDate,
      isAvailable: false,
      reason: exceptionReason
    });
    setShowExceptionModal(false);
    setExceptionDate('');
    const refreshed = await api.getDoctorById(selectedDoctor.id);
    setSelectedDoctor(refreshed);
  };

  // Delete Exception
  const handleDeleteException = async (exId: string) => {
    if (!selectedDoctor) return;
    await api.deleteDoctorException(selectedDoctor.id, exId);
    const refreshed = await api.getDoctorById(selectedDoctor.id);
    setSelectedDoctor(refreshed);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-teal-600" />
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">
              Doctor Roster & Operatory Schedules
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Dynamic provider management, custom working hours, and time-off blackout calendars.
          </p>
        </div>

        <button
          onClick={handleOpenCreateDoctor}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-medium shadow-xs transition-colors self-start md:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>+ Add New Doctor</span>
        </button>
      </div>

      {/* Grid: Doctor List on Left, Schedule on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Col: Doctors Directory */}
        <div className="space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 px-1">
            Clinical Providers ({doctors.length})
          </div>

          <div className="space-y-2">
            {doctors.map(doc => {
              const isSelected = selectedDoctor?.id === doc.id;

              return (
                <div
                  key={doc.id}
                  onClick={() => handleSelectDoctor(doc.id)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer bg-white shadow-2xs ${
                    isSelected
                      ? 'border-teal-500 ring-2 ring-teal-500/20'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: doc.color }}
                      ></span>
                      <div>
                        <div className="font-bold text-slate-900 text-xs flex items-center gap-2">
                          <span>{doc.fullName}</span>
                          {!doc.isActive && (
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded">
                              Inactive
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500">{doc.specialization}</div>
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenEditDoctor(doc);
                      }}
                      className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 text-xs"
                      title="Edit Profile"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                    <span className="font-mono">Lic: {doc.licenseNumber}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleActive(doc);
                      }}
                      className={`text-[10px] font-semibold underline ${
                        doc.isActive ? 'text-rose-600 hover:text-rose-700' : 'text-teal-700 hover:text-teal-800'
                      }`}
                    >
                      {doc.isActive ? 'Deactivate' : 'Reactivate'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right 2 Cols: Selected Doctor Working Hours & Exception Calendar */}
        {selectedDoctor ? (
          <div className="lg:col-span-2 space-y-6">
            {/* Doctor Profile Banner */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-2xs"
                  style={{ backgroundColor: selectedDoctor.color }}
                >
                  {selectedDoctor.fullName.replace('Dr. ', '').charAt(0)}
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">{selectedDoctor.fullName}</h2>
                  <p className="text-xs text-slate-500">
                    {selectedDoctor.specialization} · License: {selectedDoctor.licenseNumber}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-slate-600 mt-1">
                    <span className="flex items-center gap-1"><Phone className="w-3 h-3 text-slate-400" /> {selectedDoctor.phone}</span>
                    <span className="flex items-center gap-1"><Mail className="w-3 h-3 text-slate-400" /> {selectedDoctor.email}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleOpenEditDoctor(selectedDoctor)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium border border-slate-200 flex items-center gap-1.5"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit Doctor</span>
              </button>
            </div>

            {/* Weekly Operating Hours Configuration */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Weekly Working Schedule
                  </h3>
                  <p className="text-[11px] text-slate-500">Operating hours used by appointment conflict engine.</p>
                </div>
              </div>

              <div className="divide-y divide-slate-100 text-xs">
                {DAYS_OF_WEEK.map(({ day, label }) => {
                  const avail = selectedDoctor.availability?.find(a => a.dayOfWeek === day);
                  const isAvailable = avail?.isAvailable ?? false;

                  return (
                    <div key={day} className="py-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isAvailable}
                          onChange={(e) => handleToggleDayAvailability(day, e.target.checked)}
                          className="rounded text-teal-600 focus:ring-teal-500"
                        />
                        <span className={`font-semibold ${isAvailable ? 'text-slate-800' : 'text-slate-400'}`}>
                          {label}
                        </span>
                      </div>

                      {isAvailable ? (
                        <div className="flex items-center gap-2 font-mono text-slate-600 text-xs">
                          <span>{formatTime(avail?.startTime || '09:00')}</span>
                          <span>–</span>
                          <span>{formatTime(avail?.endTime || '17:00')}</span>
                          <span className="text-[10px] text-slate-400 font-sans ml-2">(30m slots)</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">Off Duty</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Schedule Exceptions & Leaves */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Schedule Exceptions & Vacation Dates
                  </h3>
                  <p className="text-[11px] text-slate-500">Dates when doctor is unavailable for booking.</p>
                </div>
                <button
                  onClick={() => setShowExceptionModal(true)}
                  className="px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded-lg text-xs font-medium border border-teal-200 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add Time Off</span>
                </button>
              </div>

              {selectedDoctor.exceptions && selectedDoctor.exceptions.length > 0 ? (
                <div className="space-y-2 text-xs">
                  {selectedDoctor.exceptions.map(ex => (
                    <div key={ex.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-800">{formatDate(ex.exceptionDate)}</span>
                        <span className="ml-2 text-slate-600 text-[11px]">— {ex.reason}</span>
                      </div>
                      <button
                        onClick={() => handleDeleteException(ex.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded"
                        title="Remove"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center text-slate-400 text-xs">
                  No upcoming leaves or blackout exceptions.
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {/* Modal: Create / Edit Doctor */}
      {showDoctorModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSaveDoctor} className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md p-5 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h3 className="font-bold text-sm text-slate-800">
                {editingDoctorId ? 'Edit Doctor Profile' : 'Add New Clinical Doctor'}
              </h3>
              <button type="button" onClick={() => setShowDoctorModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Full Name & Title *</label>
              <input
                type="text"
                required
                placeholder="e.g. Dr. Emily Thorne, DDS"
                value={formFullName}
                onChange={(e) => setFormFullName(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Specialization *</label>
              <input
                type="text"
                required
                placeholder="e.g. Endodontics, Orthodontics, Oral Surgery"
                value={formSpecialization}
                onChange={(e) => setFormSpecialization(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">License # *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. DENT-77821"
                  value={formLicense}
                  onChange={(e) => setFormLicense(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Calendar Color</label>
                <input
                  type="color"
                  value={formColor}
                  onChange={(e) => setFormColor(e.target.value)}
                  className="w-full h-8 p-1 border border-slate-300 rounded-lg cursor-pointer"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Phone</label>
                <input
                  type="tel"
                  placeholder="+1 555-0190"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  placeholder="doctor@apex.com"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 pt-1">
              <input
                type="checkbox"
                checked={formActive}
                onChange={(e) => setFormActive(e.target.checked)}
                className="rounded text-teal-600"
              />
              <span>Doctor is Active on Clinical Schedule</span>
            </label>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={() => setShowDoctorModal(false)} className="px-3 py-1.5 bg-slate-100 rounded text-slate-700">Cancel</button>
              <button type="submit" className="px-4 py-1.5 bg-teal-600 text-white rounded font-semibold shadow-xs">Save Doctor</button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Add Exception */}
      {showExceptionModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form onSubmit={handleAddException} className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md p-5 space-y-4 text-xs">
            <h3 className="font-bold text-sm text-slate-800">Add Date Blackout / Time Off</h3>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Date of Leave *</label>
              <input
                type="date"
                required
                value={exceptionDate}
                onChange={(e) => setExceptionDate(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Reason / Note</label>
              <input
                type="text"
                required
                placeholder="e.g. Annual Dental Conference, Personal Leave"
                value={exceptionReason}
                onChange={(e) => setExceptionReason(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowExceptionModal(false)} className="px-3 py-1.5 bg-slate-100 rounded text-slate-700">Cancel</button>
              <button type="submit" className="px-4 py-1.5 bg-teal-600 text-white rounded font-medium">Add Exception</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
