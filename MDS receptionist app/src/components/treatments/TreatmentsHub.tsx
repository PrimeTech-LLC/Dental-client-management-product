import React, { useState, useEffect } from 'react';
import { UserRoundCheck, Plus, Search, Filter, Stethoscope, CheckCircle2, Clock } from 'lucide-react';
import { Treatment, Doctor, TreatmentStatus } from '../../types/index.js';
import { api } from '../../lib/api.js';
import { formatDate, getStatusBadgeClasses } from '../../lib/utils.js';

interface TreatmentsHubProps {
  onSelectPatient: (patientId: string) => void;
}

export const TreatmentsHub: React.FC<TreatmentsHubProps> = ({ onSelectPatient }) => {
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [doctorFilter, setDoctorFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const [treats, docs] = await Promise.all([
        api.getTreatments(
          undefined,
          doctorFilter !== 'ALL' ? doctorFilter : undefined
        ),
        api.getDoctors(false)
      ]);
      setTreatments(treats);
      setDoctors(docs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [doctorFilter]); // Re-fetch when doctor filter changes

  const handleUpdateStatus = async (id: string, newStatus: TreatmentStatus) => {
    try {
      const updated = await api.updateTreatment(id, { status: newStatus });
      setTreatments(prev => prev.map(t => t.id === id ? updated : t));
    } catch (err: any) {
      alert(`Error updating treatment: ${err.message}`);
    }
  };

  const filtered = treatments.filter(t => {
    if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchPatient = t.patient?.firstName?.toLowerCase().includes(q) ||
                           t.patient?.lastName?.toLowerCase().includes(q) ||
                           t.patient?.patientNumber?.toLowerCase().includes(q);
      const matchProc = t.treatmentName?.toLowerCase().includes(q);
      if (!matchPatient && !matchProc) return false;
    }
    return true;
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <UserRoundCheck className="w-5 h-5 text-teal-600" />
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">
              Clinical Treatments & Procedures Register
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Tracking planned, in-progress, and completed restorative, endodontic, and surgical dental procedures.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search treatments by patient, procedure, PT#..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-teal-500"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-700 focus:outline-hidden"
          >
            <option value="ALL">All Statuses</option>
            <option value="PLANNED">Planned</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
          </select>

          <select
            value={doctorFilter}
            onChange={(e) => setDoctorFilter(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-700 focus:outline-hidden"
          >
            <option value="ALL">All Doctors</option>
            {doctors.map(d => (
              <option key={d.id} value={d.id}>{d.fullName}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Treatments Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center text-xs text-slate-400">Loading treatment records...</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-slate-400">No treatment records found matching filter.</div>
          ) : (
            <table className="w-full text-left text-xs text-slate-700">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/70 text-[11px] uppercase font-semibold text-slate-600">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Patient</th>
                  <th className="py-3 px-4">Procedure</th>
                  <th className="py-3 px-4">Tooth #</th>
                  <th className="py-3 px-4">Attending Doctor</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Cost</th>
                  <th className="py-3 px-4 text-right">Update Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap text-slate-500 font-mono">
                      {formatDate(t.createdAt)}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <button
                        onClick={() => onSelectPatient(t.patientId)}
                        className="font-bold text-slate-900 hover:text-teal-700 underline text-left"
                      >
                        {t.patient?.firstName} {t.patient?.lastName}
                      </button>
                      <div className="text-[10px] text-slate-400 font-mono">{t.patient?.patientNumber}</div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800">{t.treatmentName}</div>
                      {t.notes && <div className="text-[11px] text-slate-500 truncate max-w-xs">{t.notes}</div>}
                    </td>

                    <td className="py-3 px-4 font-mono font-bold text-slate-700">
                      {t.toothNumber ? `#${t.toothNumber}` : '—'}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap text-slate-700">
                      {t.doctor?.fullName}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className={`inline-block px-2.5 py-0.5 rounded-md text-[11px] font-semibold border ${getStatusBadgeClasses(t.status)}`}>
                        {t.status}
                      </span>
                    </td>

                    <td className="py-3 px-4 font-mono font-bold text-slate-800">
                      ${t.cost || 0}
                    </td>

                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        {t.status === 'PLANNED' && (
                          <button
                            onClick={() => handleUpdateStatus(t.id, 'IN_PROGRESS')}
                            className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded text-[11px] font-medium border border-blue-200"
                          >
                            Start
                          </button>
                        )}
                        {t.status === 'IN_PROGRESS' && (
                          <button
                            onClick={() => handleUpdateStatus(t.id, 'COMPLETED')}
                            className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded text-[11px] font-semibold border border-emerald-200"
                          >
                            Complete
                          </button>
                        )}
                        {t.status === 'COMPLETED' && (
                          <span className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Done
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
