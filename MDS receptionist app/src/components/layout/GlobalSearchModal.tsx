import React, { useState, useEffect, useRef } from 'react';
import { Search, User, Calendar, Stethoscope, ArrowRight, X, Phone } from 'lucide-react';
import { api } from '../../lib/api.js';
import { Patient, Doctor, Appointment } from '../../types/index.js';
import { formatTime, formatDate, getStatusBadgeClasses } from '../../lib/utils.js';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPatient: (patientId: string) => void;
  onSelectAppointment: (appointment: Appointment) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectPatient,
  onSelectAppointment
}) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setPatients([]);
      setAppointments([]);
    }
  }, [isOpen]);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setPatients([]);
      setAppointments([]);
      setDoctors([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const today = new Date().toISOString().slice(0, 10);
        const past  = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
        const future = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);

        const [patientsRes, apptsRes, docsRes] = await Promise.all([
          api.getPatients(query, 5),
          api.getAppointments({ startDate: past, endDate: future }),
          api.getDoctors()
        ]);

        setPatients(patientsRes.patients);

        // Filter appointments by patient name or doctor
        const q = query.toLowerCase();
        const filteredAppts = apptsRes.filter(a =>
          a.patient?.firstName.toLowerCase().includes(q) ||
          a.patient?.lastName.toLowerCase().includes(q) ||
          a.patient?.patientNumber.toLowerCase().includes(q) ||
          a.doctor?.fullName.toLowerCase().includes(q) ||
          a.appointmentType.toLowerCase().includes(q)
        ).slice(0, 5);
        setAppointments(filteredAppts);

        // Filter doctors
        const filteredDocs = docsRes.filter(d =>
          d.fullName.toLowerCase().includes(q) ||
          d.specialization.toLowerCase().includes(q) ||
          d.licenseNumber.toLowerCase().includes(q)
        );
        setDoctors(filteredDocs);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  // Close on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const hasResults = patients.length > 0 || appointments.length > 0 || doctors.length > 0;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-start justify-center pt-20 px-4">
      <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[80vh]">
        {/* Search Header Input */}
        <div className="p-3 border-b border-slate-200 flex items-center gap-3 bg-slate-50/50">
          <Search className="w-5 h-5 text-slate-400 shrink-0 ml-2" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by patient name, phone, PT number, doctor, appointment type..."
            className="w-full bg-transparent text-sm text-slate-800 placeholder-slate-400 focus:outline-hidden py-1"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-600 text-xs"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1 bg-slate-200/70 hover:bg-slate-200 rounded"
          >
            Esc
          </button>
        </div>

        {/* Results Container */}
        <div className="overflow-y-auto p-4 space-y-4">
          {loading && (
            <div className="py-8 text-center text-xs text-slate-500">
              Searching clinic records...
            </div>
          )}

          {!loading && !query && (
            <div className="py-10 text-center text-xs text-slate-400">
              Type a patient name, phone number, doctor, or PT ID to search records.
            </div>
          )}

          {!loading && query && !hasResults && (
            <div className="py-10 text-center text-xs text-slate-500">
              No clinical records matching <span className="font-semibold text-slate-700">"{query}"</span>
            </div>
          )}

          {/* Patients section */}
          {patients.length > 0 && (
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                <User className="w-3 h-3" />
                <span>Patients ({patients.length})</span>
              </div>
              <div className="space-y-1">
                {patients.map(p => (
                  <button
                    key={p.id}
                    onClick={() => {
                      onSelectPatient(p.id);
                      onClose();
                    }}
                    className="w-full text-left p-2.5 rounded-lg hover:bg-teal-50/70 border border-transparent hover:border-teal-200 transition-colors flex items-center justify-between group cursor-pointer"
                  >
                    <div>
                      <div className="text-xs font-semibold text-slate-800 flex items-center gap-2">
                        <span>{p.firstName} {p.lastName}</span>
                        <span className="font-mono text-[10px] text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">
                          {p.patientNumber}
                        </span>
                        {p.allergies && (
                          <span className="text-[10px] bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded border border-rose-200">
                            Allergy Alert
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <Phone className="w-2.5 h-2.5" />
                          {p.phone}
                        </span>
                        <span>DOB: {p.dateOfBirth}</span>
                        <span>Blood: {p.bloodGroup}</span>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-teal-600 opacity-0 group-hover:opacity-100 transition-all" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Appointments section */}
          {appointments.length > 0 && (
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                <Calendar className="w-3 h-3" />
                <span>Appointments ({appointments.length})</span>
              </div>
              <div className="space-y-1">
                {appointments.map(a => (
                  <button
                    key={a.id}
                    onClick={() => {
                      onSelectAppointment(a);
                      onClose();
                    }}
                    className="w-full text-left p-2.5 rounded-lg hover:bg-slate-100 border border-transparent hover:border-slate-200 transition-colors flex items-center justify-between group cursor-pointer"
                  >
                    <div>
                      <div className="text-xs font-semibold text-slate-800 flex items-center gap-2">
                        <span>{a.appointmentType}</span>
                        <span className="text-slate-400 font-normal">for</span>
                        <span>{a.patient?.firstName} {a.patient?.lastName}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${getStatusBadgeClasses(a.status)}`}>
                          {a.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {formatDate(a.appointmentDate)} at {formatTime(a.startTime)} · {a.doctor?.fullName}
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700 opacity-0 group-hover:opacity-100 transition-all" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Doctors section */}
          {doctors.length > 0 && (
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                <Stethoscope className="w-3 h-3" />
                <span>Doctors ({doctors.length})</span>
              </div>
              <div className="space-y-1">
                {doctors.map(d => (
                  <div
                    key={d.id}
                    className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs font-semibold text-slate-800 flex items-center gap-2">
                        <span>{d.fullName}</span>
                        <span className="text-[10px] text-slate-500 font-mono">({d.licenseNumber})</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {d.specialization} · {d.phone}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="p-2.5 bg-slate-100 border-t border-slate-200 text-[11px] text-slate-500 flex items-center justify-between px-4">
          <span>Tip: Press <kbd className="px-1 py-0.5 bg-white border border-slate-300 rounded font-mono text-[10px]">Esc</kbd> anytime to dismiss search</span>
          <span className="font-medium text-teal-700">Apex Dental Search Index</span>
        </div>
      </div>
    </div>
  );
};
