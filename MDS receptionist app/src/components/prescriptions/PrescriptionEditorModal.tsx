import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, FileText, AlertTriangle, Printer, Check, User, Stethoscope } from 'lucide-react';
import { Patient, Doctor, PrescriptionItem } from '../../types/index.js';
import { api } from '../../lib/api.js';

interface PrescriptionEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (prescription: any) => void;
  initialPatientId?: string;
  initialDoctorId?: string;
  onOpenPrintCenter?: (docType: string, appt?: any, patientId?: string, prescription?: any) => void;
}

const COMMON_MEDS = [
  { name: 'Amoxicillin', strength: '500mg', route: 'Oral', freq: '1-1-1 (TDS)', dur: '5 days', instructions: 'Take after food with water' },
  { name: 'Amoxicillin + Clavulanic Acid (Augmentin)', strength: '625mg', route: 'Oral', freq: '1-0-1 (BD)', dur: '5 days', instructions: 'Take with food' },
  { name: 'Metronidazole', strength: '400mg', route: 'Oral', freq: '1-1-1 (TDS)', dur: '5 days', instructions: 'Strictly avoid alcohol during course' },
  { name: 'Ibuprofen', strength: '400mg', route: 'Oral', freq: '1-0-1 (BD)', dur: '3 days', instructions: 'Take strictly after meals' },
  { name: 'Paracetamol (Acetaminophen)', strength: '500mg', route: 'Oral', freq: '1-1-1 (TDS)', dur: '3 days', instructions: 'For pain or fever SOS' },
  { name: 'Chlorhexidine Gluconate Mouthwash', strength: '0.12%', route: 'Rinse', freq: '1-0-1 (BD)', dur: '14 days', instructions: 'Rinse 10ml for 60s, do not eat for 30m' },
  { name: 'Ketorolac Tromethamine', strength: '10mg', route: 'Oral', freq: 'SOS (Max 3/day)', dur: '2 days', instructions: 'For severe post-op dental pain' },
  { name: 'Azithromycin', strength: '500mg', route: 'Oral', freq: '1-0-0 (OD)', dur: '3 days', instructions: 'Take 1 hr before or 2 hr after food' }
];

export const PrescriptionEditorModal: React.FC<PrescriptionEditorModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialPatientId,
  initialDoctorId,
  onOpenPrintCenter
}) => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState(initialPatientId || '');
  const [selectedDoctorId, setSelectedDoctorId] = useState(initialDoctorId || '');
  const [diagnosis, setDiagnosis] = useState('Acute Pulpitis & Post-operative care');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [generalAdvice, setGeneralAdvice] = useState('Maintain oral hygiene, avoid hard foods on treated quadrant, warm salt water rinses after 24 hrs.');
  const [followUpDays, setFollowUpDays] = useState(7);
  
  const [items, setItems] = useState<Partial<PrescriptionItem>[]>([
    { medicineName: 'Amoxicillin', strength: '500mg', dosage: '1 Capsule', frequency: '1-1-1', duration: '5 days', route: 'Oral', instructions: 'After food' },
    { medicineName: 'Ibuprofen', strength: '400mg', dosage: '1 Tablet', frequency: '1-0-1', duration: '3 days', route: 'Oral', instructions: 'After food for pain relief' }
  ]);

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    async function load() {
      try {
        const [docs, pts] = await Promise.all([
          api.getDoctors(false),
          api.getPatients('', 100)
        ]);
        setDoctors(docs);
        setPatients(pts.patients);

        if (!selectedDoctorId && docs.length > 0) setSelectedDoctorId(docs[0].id);
        if (!selectedPatientId && pts.patients.length > 0) setSelectedPatientId(pts.patients[0].id);
      } catch (err) {
        console.error(err);
      }
    }
    load();
  }, [isOpen]);

  const selectedPatient = patients.find(p => p.id === selectedPatientId);
  const selectedDoctor = doctors.find(d => d.id === selectedDoctorId);

  // Check if patient has allergy to any prescribed item (e.g. penicillin / amoxicillin)
  const allergyWarning = (() => {
    if (!selectedPatient?.allergies) return null;
    const allTxt = selectedPatient.allergies.toLowerCase();
    for (const it of items) {
      if (it.medicineName) {
        const med = it.medicineName.toLowerCase();
        if (allTxt.includes('penicillin') && (med.includes('amox') || med.includes('penicillin') || med.includes('augmentin'))) {
          return `CRITICAL: Patient has Penicillin allergy, but "${it.medicineName}" is prescribed!`;
        }
        if (allTxt.includes('nsaid') && (med.includes('ibu') || med.includes('ketorolac') || med.includes('aspirin'))) {
          return `CRITICAL: Patient has NSAID allergy, but "${it.medicineName}" is prescribed!`;
        }
      }
    }
    return null;
  })();

  const handleAddItem = () => {
    setItems(prev => [
      ...prev,
      { medicineName: '', strength: '', dosage: '1 Tab', frequency: '1-0-1', duration: '5 days', route: 'Oral', instructions: 'After food' }
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateItem = (index: number, field: string, value: string) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const handleSelectPreset = (preset: typeof COMMON_MEDS[0]) => {
    setItems(prev => [
      ...prev,
      {
        medicineName: preset.name,
        strength: preset.strength,
        dosage: '1 Dose',
        frequency: preset.freq,
        duration: preset.dur,
        route: preset.route,
        instructions: preset.instructions
      }
    ]);
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent, shouldPrint = false) => {
    e.preventDefault();
    if (!selectedPatientId || !selectedDoctorId) {
      alert('Please select patient and doctor.');
      return;
    }
    if (items.length === 0 || !items[0].medicineName) {
      alert('At least one medicine is required.');
      return;
    }

    try {
      setSubmitting(true);
      const rx = await api.createPrescription({
        patientId: selectedPatientId,
        doctorId: selectedDoctorId,
        prescriptionDate: new Date().toISOString().split('T')[0],
        diagnosis,
        chiefComplaint,
        generalAdvice,
        followUpDays: Number(followUpDays),
        items: items.map(it => ({
          medicineName: it.medicineName || 'Medicine',
          strength: it.strength || '',
          dosage: it.dosage || '1 Tab',
          frequency: it.frequency || '1-0-1',
          duration: it.duration || '5 days',
          route: it.route || 'Oral',
          instructions: it.instructions || 'As directed'
        }))
      });

      onSuccess(rx);
      if (shouldPrint && onOpenPrintCenter) {
        onOpenPrintCenter('Prescription', undefined, selectedPatientId, rx);
      }
      onClose();
    } catch (err: any) {
      alert(`Failed to create prescription: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-teal-600" />
            <div>
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                Issue Clinical Prescription (Rx)
              </h2>
              <p className="text-[11px] text-slate-500">Official medical prescription pad with dosage, frequency & advice</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Allergy Warning Banner */}
        {allergyWarning && (
          <div className="p-3 bg-rose-50 border-b border-rose-300 text-rose-900 text-xs font-bold flex items-center gap-2 animate-pulse">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{allergyWarning}</span>
          </div>
        )}

        {/* Body Form */}
        <form onSubmit={(e) => handleSubmit(e, false)} className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Patient & Doctor Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Patient *</label>
              <select
                value={selectedPatientId}
                onChange={(e) => setSelectedPatientId(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg text-xs"
              >
                {patients.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.firstName} {p.lastName} ({p.patientNumber}) {p.allergies ? `[⚠️ Allergy: ${p.allergies}]` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Prescribing Doctor *</label>
              <select
                value={selectedDoctorId}
                onChange={(e) => setSelectedDoctorId(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg text-xs"
              >
                {doctors.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.fullName} ({d.specialization})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Clinical Findings & Diagnosis */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Clinical Diagnosis *</label>
              <input
                type="text"
                required
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                placeholder="e.g. Acute Irreversible Pulpitis, Periapical Abscess"
                className="w-full p-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Chief Complaint / Tooth Notation</label>
              <input
                type="text"
                value={chiefComplaint}
                onChange={(e) => setChiefComplaint(e.target.value)}
                placeholder="e.g. Throbbing pain tooth #19, sensitivity to hot"
                className="w-full p-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>
          </div>

          {/* Quick Preset Prescriptions */}
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1.5">
              Quick Dental Formulary Presets (Click to add)
            </span>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_MEDS.map((m, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectPreset(m)}
                  className="px-2 py-1 bg-slate-100 hover:bg-teal-50 hover:text-teal-900 border border-slate-200 rounded text-[11px] text-slate-700 transition-colors"
                >
                  + {m.name} {m.strength}
                </button>
              ))}
            </div>
          </div>

          {/* Medicines Multi-Row Table */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 uppercase tracking-wider text-xs">
                Prescribed Medicines & Posology
              </span>
              <button
                type="button"
                onClick={handleAddItem}
                className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded font-semibold text-xs border border-teal-200 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                <span>Add Medicine</span>
              </button>
            </div>

            <div className="border border-slate-200 rounded-lg overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[650px]">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 border-b border-slate-200 text-[11px] uppercase font-semibold">
                    <th className="p-2 w-1/4">Medicine Name</th>
                    <th className="p-2 w-24">Strength</th>
                    <th className="p-2 w-28">Dosage</th>
                    <th className="p-2 w-28">Frequency</th>
                    <th className="p-2 w-24">Duration</th>
                    <th className="p-2">Instructions</th>
                    <th className="p-2 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-1.5">
                        <input
                          type="text"
                          required
                          placeholder="e.g. Amoxicillin"
                          value={item.medicineName || ''}
                          onChange={(e) => handleUpdateItem(idx, 'medicineName', e.target.value)}
                          className="w-full p-1.5 border border-slate-300 rounded text-xs font-semibold"
                        />
                      </td>
                      <td className="p-1.5">
                        <input
                          type="text"
                          placeholder="500mg"
                          value={item.strength || ''}
                          onChange={(e) => handleUpdateItem(idx, 'strength', e.target.value)}
                          className="w-full p-1.5 border border-slate-300 rounded text-xs"
                        />
                      </td>
                      <td className="p-1.5">
                        <input
                          type="text"
                          placeholder="1 Tab"
                          value={item.dosage || ''}
                          onChange={(e) => handleUpdateItem(idx, 'dosage', e.target.value)}
                          className="w-full p-1.5 border border-slate-300 rounded text-xs"
                        />
                      </td>
                      <td className="p-1.5">
                        <input
                          type="text"
                          placeholder="1-0-1"
                          value={item.frequency || ''}
                          onChange={(e) => handleUpdateItem(idx, 'frequency', e.target.value)}
                          className="w-full p-1.5 border border-slate-300 rounded text-xs font-mono"
                        />
                      </td>
                      <td className="p-1.5">
                        <input
                          type="text"
                          placeholder="5 days"
                          value={item.duration || ''}
                          onChange={(e) => handleUpdateItem(idx, 'duration', e.target.value)}
                          className="w-full p-1.5 border border-slate-300 rounded text-xs"
                        />
                      </td>
                      <td className="p-1.5">
                        <input
                          type="text"
                          placeholder="After food"
                          value={item.instructions || ''}
                          onChange={(e) => handleUpdateItem(idx, 'instructions', e.target.value)}
                          className="w-full p-1.5 border border-slate-300 rounded text-xs text-slate-600"
                        />
                      </td>
                      <td className="p-1.5 text-center">
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Advice & Follow-up */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="sm:col-span-2">
              <label className="font-semibold text-slate-700 block mb-1">General Post-Op Advice</label>
              <input
                type="text"
                value={generalAdvice}
                onChange={(e) => setGeneralAdvice(e.target.value)}
                placeholder="e.g. Soft diet, avoid hot drinks for 24h, rinse with warm salt water"
                className="w-full p-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Follow-up in (Days)</label>
              <input
                type="number"
                min={0}
                max={90}
                value={followUpDays}
                onChange={(e) => setFollowUpDays(Number(e.target.value))}
                className="w-full p-2 border border-slate-300 rounded-lg text-xs font-mono"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium text-xs"
            >
              Cancel
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={(e) => handleSubmit(e, true)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-lg font-semibold text-xs flex items-center gap-1.5 shadow-2xs"
              >
                <Printer className="w-3.5 h-3.5 text-slate-600" />
                <span>Save & Print Rx Pad</span>
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-semibold text-xs shadow-xs flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{submitting ? 'Saving...' : 'Save Prescription'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
