import React, { useState, useEffect } from 'react';
import { FileText, Plus, Search, Printer, Stethoscope, User, Calendar } from 'lucide-react';
import { Prescription, Doctor } from '../../types/index.js';
import { api } from '../../lib/api.js';
import { formatDate } from '../../lib/utils.js';

interface PrescriptionsHubProps {
  onOpenNewPrescription: (patientId?: string) => void;
  onOpenPrintCenter: (docType: string, appt?: any, patientId?: string, prescription?: Prescription) => void;
  onSelectPatient: (patientId: string) => void;
}

export const PrescriptionsHub: React.FC<PrescriptionsHubProps> = ({
  onOpenNewPrescription,
  onOpenPrintCenter,
  onSelectPatient
}) => {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const [rxData, docsData] = await Promise.all([
        api.getPrescriptions(),
        api.getDoctors(false)
      ]);
      setPrescriptions(rxData);
      setDoctors(docsData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = prescriptions.filter(rx => {
    if (selectedDoctorId !== 'ALL' && rx.doctorId !== selectedDoctorId) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchPatient = rx.patient?.firstName.toLowerCase().includes(q) ||
                           rx.patient?.lastName.toLowerCase().includes(q) ||
                           rx.patient?.patientNumber.toLowerCase().includes(q);
      const matchDiag = rx.diagnosis?.toLowerCase().includes(q);
      if (!matchPatient && !matchDiag) return false;
    }
    return true;
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-teal-600" />
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">
              Prescriptions & Medication Records (Rx)
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Centralized digital prescription register, medication item logs, and printable Rx stationery.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onOpenPrintCenter('BlankPrescription')}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium border border-slate-300 shadow-2xs transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Blank Rx Pad</span>
          </button>
          <button
            onClick={() => onOpenNewPrescription()}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-medium shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Issue New Prescription</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search prescriptions by patient name, PT#, diagnosis..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-teal-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedDoctorId}
            onChange={(e) => setSelectedDoctorId(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-700 focus:outline-hidden"
          >
            <option value="ALL">All Prescribing Doctors</option>
            {doctors.map(d => (
              <option key={d.id} value={d.id}>{d.fullName}</option>
            ))}
          </select>
          <span className="text-slate-400 text-[11px] font-mono">
            {filtered.length} Rx orders
          </span>
        </div>
      </div>

      {/* Prescriptions List */}
      <div className="space-y-4">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading prescription archives...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
            No prescriptions found matching criteria.
          </div>
        ) : (
          filtered.map(rx => (
            <div key={rx.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-800 font-bold flex items-center justify-center text-xs">
                    Rx
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onSelectPatient(rx.patientId)}
                        className="font-bold text-slate-900 text-xs hover:text-teal-700 underline"
                      >
                        {rx.patient?.firstName} {rx.patient?.lastName}
                      </button>
                      <span className="font-mono text-[10px] text-teal-800 bg-teal-50 px-1.5 py-0.2 rounded border border-teal-200">
                        {rx.patient?.patientNumber}
                      </span>
                      {rx.patient?.allergies && (
                        <span className="text-[10px] bg-rose-50 text-rose-700 px-1.5 py-0.2 rounded border border-rose-200">
                          ⚠️ Allergy: {rx.patient.allergies}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Doctor: <strong className="text-slate-700">{rx.doctor?.fullName}</strong> · Date: {formatDate(rx.prescriptionDate)}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => onOpenPrintCenter('Prescription', undefined, rx.patientId, rx)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200 self-start sm:self-auto transition-colors"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-600" />
                  <span>Print Rx Document</span>
                </button>
              </div>

              {/* Diagnosis */}
              <div className="text-xs">
                <span className="font-bold text-slate-700">Diagnosis: </span>
                <span className="text-slate-800">{rx.diagnosis || 'Clinical Dental Rx'}</span>
                {rx.chiefComplaint && (
                  <span className="text-slate-500 ml-2">({rx.chiefComplaint})</span>
                )}
              </div>

              {/* Medications Table */}
              <div className="border border-slate-200 rounded-lg overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 text-[10px] uppercase font-semibold border-b border-slate-200">
                      <th className="p-2">#</th>
                      <th className="p-2">Medication</th>
                      <th className="p-2">Strength</th>
                      <th className="p-2">Dosage & Frequency</th>
                      <th className="p-2">Duration</th>
                      <th className="p-2">Directions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {rx.items?.map((item, idx) => (
                      <tr key={item.id || idx}>
                        <td className="p-2 font-mono text-slate-400">{idx + 1}</td>
                        <td className="p-2 font-semibold text-slate-800">{item.medicineName}</td>
                        <td className="p-2 font-mono text-slate-600">{item.strength || '—'}</td>
                        <td className="p-2 font-mono text-slate-800">{item.dosage} ({item.frequency})</td>
                        <td className="p-2">{item.duration}</td>
                        <td className="p-2 text-slate-600">{item.instructions || 'As directed'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Advice */}
              {rx.generalAdvice && (
                <div className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded border border-slate-200">
                  <span className="font-semibold text-slate-700">Post-Op Care Advice: </span>
                  {rx.generalAdvice}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
