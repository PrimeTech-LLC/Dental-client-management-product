import React, { useState, useEffect } from 'react';
import { X, Printer, FileText, Check, Calendar, Stethoscope, User, MapPin, Phone, Mail } from 'lucide-react';
import { Patient, Doctor, Appointment, Prescription, ClinicSetting } from '../../types/index.js';
import { api } from '../../lib/api.js';
import { formatDate, formatTime, calculateAge } from '../../lib/utils.js';

export type PrintDocType = 
  | 'DailySchedule'
  | 'PatientHistory'
  | 'AppointmentCard'
  | 'Prescription'
  | 'BlankPrescription'
  | 'BlankDentalChart'
  | 'TreatmentPlan';

interface PrintCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultDocType?: PrintDocType;
  selectedAppointment?: Appointment;
  selectedPatientId?: string;
  selectedPrescription?: Prescription;
}

export const PrintCenterModal: React.FC<PrintCenterModalProps> = ({
  isOpen,
  onClose,
  defaultDocType = 'DailySchedule',
  selectedAppointment,
  selectedPatientId,
  selectedPrescription
}) => {
  const [docType, setDocType] = useState<PrintDocType>(defaultDocType);
  const [clinicSettings, setClinicSettings] = useState<ClinicSetting | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('ALL');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  // Loaded dynamic data
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patient, setPatient] = useState<any>(null);
  const [prescription, setPrescription] = useState<any>(selectedPrescription || null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (defaultDocType) setDocType(defaultDocType);
  }, [defaultDocType]);

  useEffect(() => {
    if (!isOpen) return;
    async function loadBase() {
      const [sets, docs] = await Promise.all([
        api.getSettings(),
        api.getDoctors(false)
      ]);
      setClinicSettings(sets);
      setDoctors(docs);
    }
    loadBase();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    async function fetchDocData() {
      setLoading(true);
      try {
        if (docType === 'DailySchedule') {
          const appts = await api.getAppointments({
            date: selectedDate,
            doctorId: selectedDoctorId !== 'ALL' ? selectedDoctorId : undefined
          });
          setAppointments(appts);
        } else if (docType === 'PatientHistory' || docType === 'TreatmentPlan') {
          const ptId = selectedPatientId || selectedAppointment?.patientId;
          if (ptId) {
            const pt = await api.getPatientById(ptId);
            setPatient(pt);
          }
        } else if (docType === 'Prescription') {
          if (selectedPrescription) {
            setPrescription(selectedPrescription);
          } else if (selectedPatientId) {
            const rxs = await api.getPrescriptions({ patientId: selectedPatientId });
            if (rxs.length > 0) setPrescription(rxs[0]);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchDocData();
  }, [isOpen, docType, selectedDate, selectedDoctorId, selectedPatientId, selectedAppointment, selectedPrescription]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden">
        {/* Modal Top Control Bar (Hidden during window.print via CSS) */}
        <div className="p-4 bg-slate-100 border-b border-slate-200 flex items-center justify-between no-print">
          <div className="flex items-center gap-3">
            <Printer className="w-5 h-5 text-teal-700" />
            <div>
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                Clinical Print Stationery & Forms
              </h2>
              <p className="text-[11px] text-slate-500">Official formatted print documents ready for physical output or PDF export</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Document Selector */}
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value as PrintDocType)}
              className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-semibold"
            >
              <option value="DailySchedule">Daily Appointment Schedule</option>
              <option value="AppointmentCard">Patient Appointment Slip / Token</option>
              <option value="Prescription">Prescription Sheet (Rx)</option>
              <option value="BlankPrescription">Blank Doctor Rx Pad</option>
              <option value="PatientHistory">Patient Medical History Card</option>
              <option value="BlankDentalChart">Blank 32-Tooth Chart Template</option>
              <option value="TreatmentPlan">Treatment Plan & Estimate</option>
            </select>

            {docType === 'DailySchedule' && (
              <>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs"
                />
                <select
                  value={selectedDoctorId}
                  onChange={(e) => setSelectedDoctorId(e.target.value)}
                  className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs"
                >
                  <option value="ALL">All Doctors</option>
                  {doctors.map(d => (
                    <option key={d.id} value={d.id}>{d.fullName}</option>
                  ))}
                </select>
              </>
            )}

            <button
              onClick={handlePrint}
              className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 ml-2"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Document</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Canvas Viewport */}
        <div className="p-8 overflow-y-auto bg-slate-200/50 flex justify-center flex-1">
          <div className="bg-white text-slate-900 w-full max-w-[800px] p-8 shadow-md border border-slate-300 min-h-[850px] flex flex-col justify-between print-clean-area font-sans text-xs">
            {/* Top Official Clinic Letterhead */}
            <div>
              <div className="border-b-2 border-slate-800 pb-4 flex items-start justify-between">
                <div>
                  <h1 className="text-xl font-black uppercase tracking-tight text-slate-900">
                    {clinicSettings?.clinicName || 'Apex Dental Care'}
                  </h1>
                  <p className="text-[11px] font-semibold text-slate-600 mt-0.5">
                    Advanced Restorative & Comprehensive Family Dentistry
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1">
                    {clinicSettings?.addressLine1} {clinicSettings?.addressLine2 ? `, ${clinicSettings.addressLine2}` : ''}, {clinicSettings?.city}, {clinicSettings?.state} {clinicSettings?.zipCode}
                  </p>
                </div>
                <div className="text-right text-[10px] text-slate-600 space-y-0.5">
                  <div><strong>Tel:</strong> {clinicSettings?.phone}</div>
                  {clinicSettings?.emergencyPhone && (
                    <div><strong>Emergency:</strong> {clinicSettings.emergencyPhone}</div>
                  )}
                  <div><strong>Email:</strong> {clinicSettings?.email}</div>
                  <div className="text-slate-400 font-mono text-[9px] mt-1">Printed: {new Date().toLocaleString()}</div>
                </div>
              </div>

              {/* BODY: VARY BY DOCTYPE */}

              {/* 1. DAILY APPOINTMENT SCHEDULE */}
              {docType === 'DailySchedule' && (
                <div className="py-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                      Daily Operatory Schedule — {formatDate(selectedDate)}
                    </h2>
                    <span className="text-[11px] font-semibold text-slate-600">
                      {selectedDoctorId !== 'ALL' ? doctors.find(d => d.id === selectedDoctorId)?.fullName : 'All Providers'}
                    </span>
                  </div>

                  <table className="w-full text-left text-[11px] border border-slate-300">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-300 font-bold uppercase text-slate-700">
                        <th className="p-2 border-r border-slate-300">Time</th>
                        <th className="p-2 border-r border-slate-300">PT ID</th>
                        <th className="p-2 border-r border-slate-300">Patient Name & Phone</th>
                        <th className="p-2 border-r border-slate-300">Doctor</th>
                        <th className="p-2 border-r border-slate-300">Procedure</th>
                        <th className="p-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {appointments.length > 0 ? (
                        appointments.map(appt => (
                          <tr key={appt.id}>
                            <td className="p-2 font-mono border-r border-slate-200 whitespace-nowrap font-bold">
                              {formatTime(appt.startTime)}
                            </td>
                            <td className="p-2 font-mono border-r border-slate-200 font-semibold">
                              {appt.patient?.patientNumber}
                            </td>
                            <td className="p-2 border-r border-slate-200">
                              <span className="font-bold">{appt.patient?.firstName} {appt.patient?.lastName}</span>
                              <span className="text-[10px] text-slate-500 block font-mono">{appt.patient?.phone}</span>
                            </td>
                            <td className="p-2 border-r border-slate-200">{appt.doctor?.fullName}</td>
                            <td className="p-2 border-r border-slate-200">{appt.appointmentType}</td>
                            <td className="p-2 font-semibold">{appt.status}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="p-6 text-center text-slate-400">
                            No appointments scheduled for this date.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 2. PATIENT APPOINTMENT SLIP / TOKEN */}
              {docType === 'AppointmentCard' && (
                <div className="py-8 space-y-6 max-w-md mx-auto border-2 border-dashed border-slate-400 p-6 rounded-lg my-4">
                  <div className="text-center space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block">
                      APPOINTMENT CONFIRMATION SLIP
                    </span>
                    <h2 className="text-base font-black text-slate-900">
                      {selectedAppointment?.patient?.firstName || patient?.firstName || 'Patient Name'} {selectedAppointment?.patient?.lastName || patient?.lastName || ''}
                    </h2>
                    <span className="font-mono text-xs text-slate-600 block">
                      Patient ID: {selectedAppointment?.patient?.patientNumber || patient?.patientNumber || 'PT-000001'}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-4 rounded border border-slate-200 space-y-2 text-xs">
                    <div className="flex justify-between border-b border-slate-200 pb-1">
                      <span className="text-slate-500">Date:</span>
                      <span className="font-bold">{formatDate(selectedAppointment?.appointmentDate || new Date().toISOString())}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-200 pb-1">
                      <span className="text-slate-500">Time:</span>
                      <span className="font-bold font-mono">{formatTime(selectedAppointment?.startTime || '09:00')}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-200 pb-1">
                      <span className="text-slate-500">Attending Doctor:</span>
                      <span className="font-bold">{selectedAppointment?.doctor?.fullName || 'Dr. Sarah Mitchell'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Procedure:</span>
                      <span className="font-bold">{selectedAppointment?.appointmentType || 'Routine Dental Checkup'}</span>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-500 text-center leading-relaxed">
                    Please arrive 10 minutes prior to your scheduled time. If you need to reschedule, kindly notify reception 24 hours in advance at <strong>{clinicSettings?.phone}</strong>.
                  </p>
                </div>
              )}

              {/* 3. PRESCRIPTION SHEET (Rx) */}
              {(docType === 'Prescription' || docType === 'BlankPrescription') && (
                <div className="py-5 space-y-6">
                  {/* Doctor Info */}
                  <div className="flex justify-between border-b border-slate-200 pb-3">
                    <div>
                      <h3 className="font-bold text-sm text-slate-900">
                        {prescription?.doctor?.fullName || 'Dr. Sarah Mitchell, DDS'}
                      </h3>
                      <p className="text-[11px] text-slate-600">
                        {prescription?.doctor?.specialization || 'Cosmetic & Restorative Dentistry'}
                      </p>
                      <p className="text-[10px] text-slate-400 font-mono">
                        License: {prescription?.doctor?.licenseNumber || 'DENT-88491'}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 uppercase block font-bold">Rx Date</span>
                      <span className="font-mono font-semibold">{formatDate(prescription?.prescriptionDate || new Date().toISOString())}</span>
                    </div>
                  </div>

                  {/* Patient Details Header */}
                  <div className="bg-slate-50 p-3 border border-slate-200 rounded grid grid-cols-3 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase font-bold">Patient Name</span>
                      <span className="font-bold text-slate-900">
                        {prescription?.patient?.firstName || patient?.firstName || '____________________'} {prescription?.patient?.lastName || patient?.lastName || ''}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase font-bold">Age / Gender</span>
                      <span className="font-semibold">
                        {prescription?.patient ? `${calculateAge(prescription.patient.dateOfBirth)} / ${prescription.patient.gender}` : '___ / ___'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase font-bold">Patient ID / Allergies</span>
                      <span className="font-bold text-rose-700">
                        {prescription?.patient?.allergies ? `⚠️ Allergy: ${prescription.patient.allergies}` : 'No known allergies'}
                      </span>
                    </div>
                  </div>

                  {/* Rx Symbol & Medication Table */}
                  <div className="space-y-3">
                    <div className="text-2xl font-serif font-black text-slate-800">℞</div>

                    {docType === 'Prescription' && prescription?.items ? (
                      <table className="w-full text-left text-xs border border-slate-300">
                        <thead>
                          <tr className="bg-slate-100 border-b border-slate-300 font-bold uppercase text-[10px] text-slate-700">
                            <th className="p-2 border-r border-slate-300">#</th>
                            <th className="p-2 border-r border-slate-300">Medicine & Strength</th>
                            <th className="p-2 border-r border-slate-300">Dosage & Frequency</th>
                            <th className="p-2 border-r border-slate-300">Duration</th>
                            <th className="p-2">Instructions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {prescription.items.map((it: any, idx: number) => (
                            <tr key={it.id || idx}>
                              <td className="p-2 font-mono text-slate-400 border-r border-slate-200">{idx + 1}</td>
                              <td className="p-2 font-bold text-slate-900 border-r border-slate-200">{it.medicineName} {it.strength}</td>
                              <td className="p-2 font-mono border-r border-slate-200">{it.dosage} ({it.frequency})</td>
                              <td className="p-2 border-r border-slate-200">{it.duration}</td>
                              <td className="p-2 text-slate-700">{it.instructions}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="h-64 border border-dashed border-slate-300 rounded p-4 text-slate-400">
                        <div className="space-y-8 pt-4">
                          <div className="border-b border-slate-200"></div>
                          <div className="border-b border-slate-200"></div>
                          <div className="border-b border-slate-200"></div>
                          <div className="border-b border-slate-200"></div>
                        </div>
                      </div>
                    )}

                    {prescription?.generalAdvice && (
                      <div className="pt-2 text-[11px] text-slate-700">
                        <strong>Advice: </strong> {prescription.generalAdvice}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 4. BLANK 32-TOOTH DENTAL CHART TEMPLATE */}
              {docType === 'BlankDentalChart' && (
                <div className="py-4 space-y-6">
                  <div className="text-center font-bold text-xs uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-2">
                    Physical Dental Odontogram & Clinical Examination Worksheet
                  </div>

                  {/* 32 Teeth Grid for pen notations */}
                  <div className="space-y-4">
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Maxillary (Upper) Arch</span>
                      <div className="grid grid-cols-16 gap-1 border border-slate-300 p-2 bg-slate-50 text-center font-mono text-[10px]">
                        {Array.from({ length: 16 }, (_, i) => i + 1).map(n => (
                          <div key={n} className="border border-slate-300 h-12 flex flex-col justify-between p-1 bg-white">
                            <span className="font-bold text-slate-700">#{n}</span>
                            <div className="w-4 h-4 rounded-full border border-slate-300 mx-auto"></div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Mandibular (Lower) Arch</span>
                      <div className="grid grid-cols-16 gap-1 border border-slate-300 p-2 bg-slate-50 text-center font-mono text-[10px]">
                        {Array.from({ length: 16 }, (_, i) => 32 - i).map(n => (
                          <div key={n} className="border border-slate-300 h-12 flex flex-col justify-between p-1 bg-white">
                            <div className="w-4 h-4 rounded-full border border-slate-300 mx-auto"></div>
                            <span className="font-bold text-slate-700">#{n}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Physical Clinical Notes Lines */}
                  <div className="space-y-4 pt-4">
                    <span className="text-[10px] font-bold uppercase text-slate-600 block">Doctor Clinical Observations & Treatment Plan:</span>
                    <div className="border-b border-slate-300 h-6"></div>
                    <div className="border-b border-slate-300 h-6"></div>
                    <div className="border-b border-slate-300 h-6"></div>
                    <div className="border-b border-slate-300 h-6"></div>
                  </div>
                </div>
              )}

              {/* 5. PATIENT MEDICAL HISTORY CARD */}
              {docType === 'PatientHistory' && patient && (
                <div className="py-4 space-y-4">
                  <div className="border-b border-slate-200 pb-2">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                      Patient Clinical History & Record Card
                    </h2>
                  </div>

                  <div className="bg-slate-50 p-4 rounded border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase font-bold">Patient Name</span>
                      <span className="font-bold text-slate-900">{patient.firstName} {patient.lastName}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase font-bold">Patient ID</span>
                      <span className="font-mono font-bold text-teal-800">{patient.patientNumber}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase font-bold">Age / Gender / DOB</span>
                      <span>{calculateAge(patient.dateOfBirth)} · {patient.gender} ({formatDate(patient.dateOfBirth)})</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase font-bold">Blood Group</span>
                      <span className="font-bold text-rose-700">{patient.bloodGroup}</span>
                    </div>
                  </div>

                  {/* Allergies Highlight */}
                  <div className="p-3 bg-rose-50 border border-rose-300 rounded text-rose-900 text-xs">
                    <strong>Medical Allergies & Adverse Warnings: </strong>
                    <span>{patient.allergies || 'No known drug or material allergies recorded.'}</span>
                  </div>

                  {/* Medical Conditions */}
                  <div className="space-y-2">
                    <h3 className="font-bold text-xs uppercase text-slate-700">Systemic Medical History:</h3>
                    {patient.medicalHistory && patient.medicalHistory.length > 0 ? (
                      <ul className="list-disc list-inside text-xs space-y-1">
                        {patient.medicalHistory.map((m: any) => (
                          <li key={m.id}>
                            <strong>{m.conditionName}</strong> {m.notes ? `— ${m.notes}` : ''}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-slate-400">No chronic systemic conditions documented.</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Signature Line */}
            <div className="pt-12 mt-8 border-t border-slate-200 flex items-end justify-between text-[11px] text-slate-500">
              <div>
                <p>This is an official clinical document generated by {clinicSettings?.clinicName}.</p>
                <p className="text-[9px] text-slate-400">Confidential Medical Record — Unauthorized reproduction prohibited.</p>
              </div>

              <div className="text-center min-w-[200px]">
                <div className="border-b border-slate-400 h-8 mb-1"></div>
                <span className="font-semibold text-slate-700 text-xs">Doctor / Authorized Signature</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
