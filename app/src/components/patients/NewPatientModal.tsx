import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, UserPlus, AlertCircle, ShieldAlert, ArrowRight, Upload, FileX, AlertTriangle } from 'lucide-react';
import { Patient, Gender, BloodGroup } from '../../types/index.js';
import { api } from '../../lib/api.js';
import { BLOOD_GROUPS, GENDER_OPTIONS } from '../../lib/constants.js';

// ─── X-ray upload constants (mirrors XRaysTab) ────────────────────────────────
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB
const MAX_XRAY_FILES = 10;
const ACCEPT_XRAY = 'image/jpeg,image/jpg,image/png,image/gif,image/webp,image/bmp,image/tiff,application/dicom,.dcm,.tif,.tiff';

interface QueuedXRay {
  file: File;
  previewUrl: string | null;
  error?: string;
}

function validateXRayFile(file: File): string | null {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `Too large (max 20 MB): ${file.name}`;
  }
  const mime = file.type.toLowerCase();
  const isDcm = file.name.toLowerCase().endsWith('.dcm');
  if (!isDcm && !mime.startsWith('image/') && mime !== 'application/dicom') {
    return `Not a supported image type: ${file.name}`;
  }
  return null;
}

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface NewPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newPatient: Patient) => void;
  onSelectExistingPatient?: (patientId: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const NewPatientModal: React.FC<NewPatientModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onSelectExistingPatient,
}) => {
  // ── Demographics ────────────────────────────────────────────────────────────
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

  // ── Duplicate check ─────────────────────────────────────────────────────────
  const [duplicates, setDuplicates] = useState<Patient[]>([]);

  // ── X-ray queue ─────────────────────────────────────────────────────────────
  const [xrayQueue, setXrayQueue] = useState<QueuedXRay[]>([]);
  const [xrayNotes, setXrayNotes] = useState('');
  const [xrayTakenAt, setXrayTakenAt] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const xrayInputRef = useRef<HTMLInputElement>(null);

  // ── Submission ──────────────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);
  const [submitStage, setSubmitStage] = useState<'idle' | 'creating' | 'uploading-xrays' | 'finalising'>('idle');
  const [formError, setFormError] = useState('');

  // ── Duplicate check effect ──────────────────────────────────────────────────
  useEffect(() => {
    if (!firstName.trim() || !lastName.trim() || phone.length < 5) {
      setDuplicates([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await api.checkDuplicatePatient(firstName, lastName, phone, dateOfBirth);
        setDuplicates(res.duplicates || []);
      } catch { /* non-critical */ }
    }, 250);
    return () => clearTimeout(timer);
  }, [firstName, lastName, phone, dateOfBirth]);

  // ── X-ray queue helpers ─────────────────────────────────────────────────────
  const addXRayFiles = useCallback((incoming: FileList | File[]) => {
    const files = Array.from(incoming);
    const remaining = MAX_XRAY_FILES - xrayQueue.length;
    const toAdd = files.slice(0, remaining);
    const entries: QueuedXRay[] = toAdd.map(file => {
      const error = validateXRayFile(file) ?? undefined;
      const previewUrl = !error && file.type.startsWith('image/') && file.type !== 'image/tiff'
        ? URL.createObjectURL(file)
        : null;
      return { file, previewUrl, error };
    });
    setXrayQueue(prev => [...prev, ...entries]);
  }, [xrayQueue.length]);

  const removeXRay = (idx: number) => {
    setXrayQueue(prev => {
      const entry = prev[idx];
      if (entry?.previewUrl) URL.revokeObjectURL(entry.previewUrl);
      return prev.filter((_, i) => i !== idx);
    });
  };

  // ── Reset on close ──────────────────────────────────────────────────────────
  const resetAndClose = () => {
    xrayQueue.forEach(e => { if (e.previewUrl) URL.revokeObjectURL(e.previewUrl); });
    setXrayQueue([]);
    setXrayNotes('');
    setXrayTakenAt('');
    setFormError('');
    setSubmitStage('idle');
    onClose();
  };

  if (!isOpen) return null;

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!firstName || !lastName || !phone) {
      setFormError('First Name, Last Name, and Phone number are required.');
      return;
    }

    try {
      setSubmitting(true);
      setSubmitStage('creating');

      // 1. Create the patient record
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
        generalMedicalNotes: medicalNotes || undefined,
      });

      // 2. Structured medical history from notes
      if (medicalNotes) {
        await api.addMedicalHistory(patient.id, {
          condition: 'Initial Intake Notes',
          notes: medicalNotes,
          diagnosedAt: new Date().toISOString().split('T')[0],
        });
      }

      // 3. Structured allergy record
      if (allergies) {
        await api.addAllergy(patient.id, {
          allergen: allergies,
          severity: 'HIGH',
          reaction: 'Reported during registration',
        });
      }

      // 4. X-ray uploads (only valid files)
      const validXRays = xrayQueue.filter(e => !e.error);
      if (validXRays.length > 0) {
        setSubmitStage('uploading-xrays');
        await api.uploadXRays(
          patient.id,
          validXRays.map(e => e.file),
          xrayNotes.trim() || undefined,
          xrayTakenAt || undefined,
        );
      }

      setSubmitStage('finalising');
      onSuccess(patient);
      resetAndClose();
    } catch (err: any) {
      setFormError(err.message || 'Failed to register patient. Please try again.');
      setSubmitStage('idle');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Button label ─────────────────────────────────────────────────────────────
  const validXRayCount = xrayQueue.filter(e => !e.error).length;
  let btnLabel = 'Register Patient';
  if (submitStage === 'creating')        btnLabel = 'Creating Record…';
  else if (submitStage === 'uploading-xrays') btnLabel = `Uploading ${validXRayCount} X-ray${validXRayCount !== 1 ? 's' : ''}…`;
  else if (submitStage === 'finalising') btnLabel = 'Finalising…';
  else if (validXRayCount > 0)           btnLabel = `Register & Upload ${validXRayCount} X-ray${validXRayCount !== 1 ? 's' : ''}`;

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-blue-800" />
            <div>
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                Register New Patient
              </h2>
              <p className="text-[11px] text-slate-500">Auto-assigns unique PT-ID and creates clinical record</p>
            </div>
          </div>
          <button onClick={resetAndClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Duplicate warning */}
        {duplicates.length > 0 && (
          <div className="bg-amber-50 p-3.5 border-b border-amber-200 text-amber-900 space-y-2 shrink-0">
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
                      onClick={() => { onSelectExistingPatient(d.id); resetAndClose(); }}
                      className="text-xs font-semibold text-blue-800 hover:underline flex items-center gap-1"
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs flex-1">

          {/* ── Section 1: Demographics ──────────────────────────── */}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              1. Basic Demographics &amp; Contact
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">First Name *</label>
                <input type="text" required placeholder="e.g. John" value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white focus:ring-1 focus:ring-blue-800 focus:outline-none" />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Last Name *</label>
                <input type="text" required placeholder="e.g. Smith" value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white focus:ring-1 focus:ring-blue-800 focus:outline-none" />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Phone Number *</label>
                <input type="tel" required placeholder="e.g. +1 555-0199" value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white focus:ring-1 focus:ring-blue-800 focus:outline-none" />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Email Address</label>
                <input type="email" placeholder="e.g. john.smith@example.com" value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-blue-800 focus:outline-none" />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Date of Birth *</label>
                <input type="date" required value={dateOfBirth}
                  onChange={e => setDateOfBirth(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-blue-800 focus:outline-none" />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Gender *</label>
                <select value={gender} onChange={e => setGender(e.target.value as Gender)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-blue-800 focus:outline-none">
                  {GENDER_OPTIONS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                </select>
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Blood Group</label>
                <select value={bloodGroup} onChange={e => setBloodGroup(e.target.value as BloodGroup)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-blue-800 focus:outline-none">
                  {BLOOD_GROUPS.map(bg => <option key={bg} value={bg}>{bg}</option>)}
                </select>
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Occupation</label>
                <input type="text" placeholder="e.g. Software Engineer" value={occupation}
                  onChange={e => setOccupation(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-blue-800 focus:outline-none" />
              </div>
            </div>
            <div className="mt-3">
              <label className="font-semibold text-slate-700 block mb-1">Residential Address</label>
              <input type="text" placeholder="e.g. 742 Evergreen Terrace, Springfield" value={address}
                onChange={e => setAddress(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-blue-800 focus:outline-none" />
            </div>
          </div>

          {/* ── Section 2: Emergency Contact ─────────────────────── */}
          <div className="pt-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              2. Emergency Contact
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Emergency Contact Name</label>
                <input type="text" placeholder="e.g. Jane Smith (Spouse)" value={emergencyContactName}
                  onChange={e => setEmergencyContactName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-blue-800 focus:outline-none" />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Emergency Phone Number</label>
                <input type="tel" placeholder="e.g. +1 555-0198" value={emergencyContactPhone}
                  onChange={e => setEmergencyContactPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-blue-800 focus:outline-none" />
              </div>
            </div>
          </div>

          {/* ── Section 3: Medical & Allergy Alerts ──────────────── */}
          <div className="pt-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              3. Critical Medical &amp; Allergy Alerts
            </div>
            <div className="space-y-3">
              <div className="p-3 bg-rose-50/50 border border-rose-200 rounded-lg">
                <label className="font-bold text-rose-900 block mb-1 flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                  <span>Known Drug Allergies / Contraindications</span>
                </label>
                <input type="text"
                  placeholder="e.g. Penicillin, Latex, NSAIDs, Local Anesthetic (Leave blank if none)"
                  value={allergies} onChange={e => setAllergies(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-rose-300 rounded-lg text-xs focus:ring-1 focus:ring-rose-500 focus:outline-none text-rose-900" />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Systemic Medical History / Notes</label>
                <textarea rows={2}
                  placeholder="e.g. Hypertension (controlled), Type 2 Diabetes, on Aspirin, Pacemaker"
                  value={medicalNotes} onChange={e => setMedicalNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-blue-800 focus:outline-none" />
              </div>
            </div>
          </div>

          {/* ── Section 4: Initial X-Rays ─────────────────────────── */}
          <div className="pt-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              4. Initial X-Rays <span className="normal-case font-normal text-slate-400">(optional)</span>
            </div>
            <p className="text-[11px] text-slate-500 mb-2">
              Upload existing radiographs during registration. JPEG · PNG · WEBP · GIF · BMP · TIFF · DICOM — max 20 MB each.
            </p>

            {/* Drop zone */}
            <div
              role="button"
              tabIndex={0}
              aria-label="Drop X-ray files here or click to browse"
              onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={e => { e.preventDefault(); setIsDragOver(false); if (e.dataTransfer.files.length > 0) addXRayFiles(e.dataTransfer.files); }}
              onClick={() => xrayInputRef.current?.click()}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') xrayInputRef.current?.click(); }}
              className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors select-none
                ${isDragOver
                  ? 'border-blue-800 bg-blue-50'
                  : 'border-slate-300 bg-slate-50 hover:border-blue-800 hover:bg-blue-50/30'
                }`}
            >
              <Upload className={`w-6 h-6 mx-auto mb-1.5 ${isDragOver ? 'text-blue-800' : 'text-slate-400'}`} />
              <p className="font-semibold text-slate-700 text-xs">
                Drag & drop X-rays here, or <span className="text-blue-800 underline">browse</span>
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">Up to {MAX_XRAY_FILES} files</p>
              <input
                ref={xrayInputRef}
                type="file"
                multiple
                accept={ACCEPT_XRAY}
                className="sr-only"
                aria-hidden="true"
                onChange={e => { if (e.target.files) { addXRayFiles(e.target.files); e.target.value = ''; } }}
              />
            </div>

            {/* Queued files */}
            {xrayQueue.length > 0 && (
              <div className="mt-3 space-y-2">
                <div className="max-h-40 overflow-y-auto space-y-1.5 pr-0.5">
                  {xrayQueue.map((entry, idx) => (
                    <div key={idx}
                      className={`flex items-center gap-2.5 p-2 rounded-lg border text-xs
                        ${entry.error ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-200'}`}
                    >
                      {/* Mini thumbnail or file icon */}
                      <div className="w-9 h-9 rounded-md overflow-hidden bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center">
                        {entry.previewUrl
                          ? <img src={entry.previewUrl} alt="" className="w-full h-full object-cover" />
                          : <FileX className="w-4 h-4 text-slate-400" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-800 truncate">{entry.file.name}</p>
                        <p className="text-[10px] text-slate-500">{formatBytes(entry.file.size)}</p>
                        {entry.error && (
                          <p className="text-[10px] text-rose-700 font-medium flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 shrink-0" />{entry.error}
                          </p>
                        )}
                      </div>
                      <button type="button" onClick={() => removeXRay(idx)}
                        className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100 shrink-0"
                        aria-label={`Remove ${entry.file.name}`}>
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Optional metadata */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      Label / Notes <span className="text-slate-400 font-normal">(optional)</span>
                    </label>
                    <input type="text" value={xrayNotes} onChange={e => setXrayNotes(e.target.value)}
                      maxLength={500} placeholder='e.g. "Initial panoramic", "PA pre-treatment"'
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-blue-800 focus:outline-none" />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      Date Taken <span className="text-slate-400 font-normal">(optional)</span>
                    </label>
                    <input type="date" value={xrayTakenAt} onChange={e => setXrayTakenAt(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-blue-800 focus:outline-none" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Footer ───────────────────────────────────────────── */}
          <div className="pt-4 border-t border-slate-200 space-y-2.5">
            {formError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-300 text-rose-900 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}
            <div className="flex items-center justify-end gap-2.5">
              <button type="button" onClick={resetAndClose}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium">
                Cancel
              </button>
              <button type="submit" disabled={submitting}
                className="px-5 py-2 bg-blue-800 hover:bg-blue-900 disabled:opacity-50 text-white rounded-lg text-xs font-medium shadow-xs flex items-center gap-1.5">
                {submitting && (
                  <svg className="w-3.5 h-3.5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                  </svg>
                )}
                <span>{btnLabel}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
