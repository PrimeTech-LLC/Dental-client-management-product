import React, { useState, useEffect } from 'react';
import { X, UserPlus, AlertCircle, Check, Phone, ShieldAlert, ArrowRight } from 'lucide-react';
import { Patient, Gender, BloodGroup } from '../../types/index.js';
import { api } from '../../lib/api.js';

interface NewPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newPatient: Patient) => void;
  onSelectExistingPatient?: (patientId: string) => void;
}

const BLOOD_GROUPS: BloodGroup[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'UNKNOWN'];

export const NewPatientModal: React.FC<NewPatientModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onSelectExistingPatient
}) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('1990-01-01');
  const [gender, setGender] = useState<Gender>('MALE');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [occupation, setOccupation] = useState('');
  const [bloodGroup, setBloodGroup] = useState<BloodGroup>('UNKNOWN');
  
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
  
  const [allergies, setAllergies] = useState('');
  const [medicalNotes, setMedicalNotes] = useState('');

  // Duplicate Check
  const [duplicates, setDuplicates] = useState<Patient[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Live duplicate checking
  useEffect(() => {
    if (!firstName.trim() || !lastName.trim() || phone.length < 5) {
      setDuplicates([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await api.checkDuplicatePatient(firstName, lastName, phone, dateOfBirth);
        setDuplicates(res.duplicates || []);
      } catch (err) {
        console.error('Duplicate check error:', err);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [firstName, lastName, phone, dateOfBirth]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName || !phone) {
      alert('First Name, Last Name, and Phone number are required.');
      return;
    }

    try {
      setSubmitting(true);
      const patient = await api.createPatient({
        firstName,
        lastName,
        dateOfBirth,
        gender,
        phone,
        email: email || undefined,
        address: address || undefined,
        occupation: occupation || undefined,
        bloodGroup,
        emergencyContactName: emergencyContactName || undefined,
        emergencyContactPhone: emergencyContactPhone || undefined,
        allergies: allergies || undefined,
        generalMedicalNotes: medicalNotes || undefined
      });

      // If medical conditions were added, add to medical history
      if (medicalNotes) {
        await api.addMedicalHistory(patient.id, {
          conditionName: 'Initial Intake Notes',
          notes: medicalNotes,
          diagnosedDate: new Date().toISOString().split('T')[0]
        });
      }

      // If allergy added, add to allergies table
      if (allergies) {
        await api.addAllergy(patient.id, {
          allergen: allergies,
          severity: 'HIGH',
          reactionNotes: 'Reported during registration'
        });
      }

      onSuccess(patient);
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to register patient');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-teal-600" />
            <div>
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                Register New Patient
              </h2>
              <p className="text-[11px] text-slate-500">Auto-assigns unique PT-ID and creates clinical record</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Live Duplicate Warning Alert */}
        {duplicates.length > 0 && (
          <div className="bg-amber-50 p-3.5 border-b border-amber-200 text-amber-900 space-y-2">
            <div className="flex items-center gap-2 font-bold text-xs">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Potential Duplicate Patient Record Detected:</span>
            </div>
            <div className="space-y-1 pl-6">
              {duplicates.map(d => (
                <div key={d.id} className="flex items-center justify-between text-xs bg-white/80 p-2 rounded border border-amber-200">
                  <div>
                    <strong className="text-slate-800">{d.firstName} {d.lastName}</strong>
                    <span className="ml-2 font-mono text-[10px] text-slate-600">({d.patientNumber})</span>
                    <span className="ml-2 text-slate-500">Phone: {d.phone} · DOB: {d.dateOfBirth}</span>
                  </div>
                  {onSelectExistingPatient && (
                    <button
                      type="button"
                      onClick={() => {
                        onSelectExistingPatient(d.id);
                        onClose();
                      }}
                      className="text-xs font-semibold text-teal-700 hover:underline flex items-center gap-1"
                    >
                      <span>Open Existing</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Section 1: Demographics */}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              1. Basic Demographics & Contact
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  First Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white focus:ring-1 focus:ring-teal-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Last Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Smith"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white focus:ring-1 focus:ring-teal-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. +1 555-0199"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white focus:ring-1 focus:ring-teal-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="e.g. john.smith@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-teal-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Date of Birth *
                </label>
                <input
                  type="date"
                  required
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-teal-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Gender *
                </label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as Gender)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-teal-500 focus:outline-hidden"
                >
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Blood Group
                </label>
                <select
                  value={bloodGroup}
                  onChange={(e) => setBloodGroup(e.target.value as BloodGroup)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-teal-500 focus:outline-hidden"
                >
                  {BLOOD_GROUPS.map(bg => (
                    <option key={bg} value={bg}>{bg}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Occupation
                </label>
                <input
                  type="text"
                  placeholder="e.g. Software Engineer"
                  value={occupation}
                  onChange={(e) => setOccupation(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-teal-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="mt-3">
              <label className="font-semibold text-slate-700 block mb-1">
                Residential Address
              </label>
              <input
                type="text"
                placeholder="e.g. 742 Evergreen Terrace, Springfield"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-teal-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Section 2: Emergency Contact */}
          <div className="pt-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              2. Emergency Contact
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Emergency Contact Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Jane Smith (Spouse)"
                  value={emergencyContactName}
                  onChange={(e) => setEmergencyContactName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-teal-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Emergency Phone Number
                </label>
                <input
                  type="tel"
                  placeholder="e.g. +1 555-0198"
                  value={emergencyContactPhone}
                  onChange={(e) => setEmergencyContactPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-teal-500 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Critical Medical & Allergy Alerts */}
          <div className="pt-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              3. Critical Medical & Allergy Alerts
            </div>
            
            <div className="space-y-3">
              <div className="p-3 bg-rose-50/50 border border-rose-200 rounded-lg">
                <label className="font-bold text-rose-900 block mb-1 flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                  <span>Known Drug Allergies / Contraindications</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Penicillin, Latex, NSAIDs, Local Anesthetic (Leave blank if none)"
                  value={allergies}
                  onChange={(e) => setAllergies(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-rose-300 rounded-lg text-xs focus:ring-1 focus:ring-rose-500 focus:outline-hidden text-rose-900"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Systemic Medical History / Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Hypertension (controlled), Type 2 Diabetes, on Aspirin, Pacemaker"
                  value={medicalNotes}
                  onChange={(e) => setMedicalNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-teal-500 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-lg text-xs font-medium shadow-xs flex items-center gap-1.5"
            >
              {submitting ? 'Creating Patient...' : 'Register Patient'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
