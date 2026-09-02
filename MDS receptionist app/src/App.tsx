import React, { useState, useEffect, useCallback } from 'react';
import { AppSidebar, NavSection } from './components/layout/AppSidebar.js';
import { TopBar } from './components/layout/TopBar.js';
import { GlobalSearchModal } from './components/layout/GlobalSearchModal.js';

// Hubs & Views
import { ReceptionistDashboard } from './components/dashboard/ReceptionistDashboard.js';
import { AppointmentsHub } from './components/appointments/AppointmentsHub.js';
import { PatientsHub } from './components/patients/PatientsHub.js';
import { PatientProfileView } from './components/patients/PatientProfileView.js';
import { DoctorsHub } from './components/doctors/DoctorsHub.js';
import { PrescriptionsHub } from './components/prescriptions/PrescriptionsHub.js';
import { TreatmentsHub } from './components/treatments/TreatmentsHub.js';
import { RemindersHub } from './components/reminders/RemindersHub.js';
import { ReportsHub } from './components/reports/ReportsHub.js';
import { AuditLogsHub } from './components/audit/AuditLogsHub.js';
import { SettingsHub } from './components/settings/SettingsHub.js';

// Modals
import { NewAppointmentModal } from './components/appointments/NewAppointmentModal.js';
import { RescheduleModal } from './components/appointments/RescheduleModal.js';
import { AppointmentDetailModal } from './components/appointments/AppointmentDetailModal.js';
import { NewPatientModal } from './components/patients/NewPatientModal.js';
import { PrescriptionEditorModal } from './components/prescriptions/PrescriptionEditorModal.js';
import { PrintCenterModal, PrintDocType } from './components/print/PrintCenterModal.js';

// Auth / login screen
import { LoginScreen } from './components/auth/LoginScreen.js';

import { Appointment, Prescription, User } from './types/index.js';
import { api } from './lib/api.js';

export default function App() {
  // ── Auth state ───────────────────────────────────────────────
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [authLoading, setAuthLoading] = useState(true);

  // ── Navigation state ─────────────────────────────────────────
  const [currentSection, setCurrentSection] = useState<NavSection>('dashboard');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  // ── Modal states ─────────────────────────────────────────────
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const [isNewAppointmentOpen, setIsNewAppointmentOpen] = useState(false);
  const [newApptInitialPatientId, setNewApptInitialPatientId] = useState<string | undefined>();
  const [newApptInitialDoctorId, setNewApptInitialDoctorId] = useState<string | undefined>();
  const [newApptInitialDate, setNewApptInitialDate] = useState<string | undefined>();

  const [isRescheduleOpen, setIsRescheduleOpen] = useState(false);
  const [rescheduleAppointment, setRescheduleAppointment] = useState<Appointment | null>(null);

  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailAppointment, setDetailAppointment] = useState<Appointment | null>(null);

  const [isNewPatientOpen, setIsNewPatientOpen] = useState(false);

  const [isNewPrescriptionOpen, setIsNewPrescriptionOpen] = useState(false);
  const [prescriptionInitialPatientId, setPrescriptionInitialPatientId] = useState<string | undefined>();

  const [isPrintCenterOpen, setIsPrintCenterOpen] = useState(false);
  const [printDocType, setPrintDocType] = useState<PrintDocType>('DailySchedule');
  const [printAppointment, setPrintAppointment] = useState<Appointment | undefined>();
  const [printPatientId, setPrintPatientId] = useState<string | undefined>();
  const [printPrescription, setPrintPrescription] = useState<Prescription | undefined>();

  // ── Bootstrap auth from cookie ───────────────────────────────
  useEffect(() => {
    api.getAuthMe().then(({ user, availableUsers }) => {
      setCurrentUser(user ?? null);
      setAvailableUsers(availableUsers ?? []);
    }).catch(() => {
      setCurrentUser(null);
    }).finally(() => setAuthLoading(false));
  }, []);

  // ── Keyboard shortcut: Ctrl+K / Cmd+K ───────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ── Handlers ─────────────────────────────────────────────────
  const handleLogin = useCallback(async (userId: string) => {
    const { user } = await api.switchRole(userId);
    setCurrentUser(user);
  }, []);

  const handleLogout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setCurrentUser(null);
  }, []);

  const handleOpenNewAppointment = useCallback((patientId?: string, doctorId?: string, date?: string) => {
    setNewApptInitialPatientId(patientId);
    setNewApptInitialDoctorId(doctorId);
    setNewApptInitialDate(date);
    setIsNewAppointmentOpen(true);
  }, []);

  const handleOpenReschedule = useCallback((appointment: Appointment) => {
    setRescheduleAppointment(appointment);
    setIsRescheduleOpen(true);
  }, []);

  // Unified handler — receives the full appointment object
  const handleOpenDetail = useCallback((appointment: Appointment) => {
    setDetailAppointment(appointment);
    setIsDetailOpen(true);
  }, []);

  const handleUpdateAppointmentStatus = useCallback(async (appointmentId: string, newStatus: string) => {
    try {
      const updated = await api.updateAppointmentStatus(appointmentId, newStatus);
      // Update the detail modal if it's showing the same appointment
      setDetailAppointment(prev => (prev?.id === appointmentId ? updated : prev));
    } catch (err: any) {
      alert(`Failed to update status: ${err.message}`);
    }
  }, []);

  const handleOpenNewPrescription = useCallback((patientId?: string) => {
    setPrescriptionInitialPatientId(patientId);
    setIsNewPrescriptionOpen(true);
  }, []);

  const handleOpenPrintCenter = useCallback((
    docType: PrintDocType | string,
    appointment?: Appointment,
    patientId?: string,
    prescription?: Prescription
  ) => {
    setPrintDocType(docType as PrintDocType);
    setPrintAppointment(appointment);
    setPrintPatientId(patientId);
    setPrintPrescription(prescription);
    setIsPrintCenterOpen(true);
  }, []);

  const handleSelectPatient = useCallback((patientId: string) => {
    setSelectedPatientId(patientId);
    setCurrentSection('patients');
  }, []);

  const handleNavigate = useCallback((section: NavSection) => {
    if (section !== 'patients') setSelectedPatientId(null);
    setCurrentSection(section);
  }, []);

  // ── Render: auth gate ────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Loading Apex Dental...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginScreen availableUsers={availableUsers} onLogin={handleLogin} />;
  }

  return (
    <div className="h-screen bg-slate-50 text-slate-800 flex overflow-hidden font-sans antialiased selection:bg-teal-100 selection:text-teal-900">
      {/* Left Navigation Sidebar */}
      <AppSidebar
        currentSection={currentSection}
        onNavigate={handleNavigate}
        onOpenPrintCenter={() => handleOpenPrintCenter('DailySchedule')}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top Header */}
        <TopBar
          currentUser={currentUser}
          onOpenSearch={() => setIsSearchOpen(true)}
          onOpenGlobalSearch={() => setIsSearchOpen(true)}
          onOpenNewAppointment={() => handleOpenNewAppointment()}
          onOpenNewPatient={() => setIsNewPatientOpen(true)}
          onOpenPrintCenter={(docType) => handleOpenPrintCenter(docType)}
          onLogout={handleLogout}
        />

        {/* Dynamic Center Work Area */}
        <main className="flex-1 overflow-y-auto bg-slate-50">
          {currentSection === 'dashboard' && (
            <ReceptionistDashboard
              onOpenNewAppointment={() => handleOpenNewAppointment()}
              onOpenNewPatient={() => setIsNewPatientOpen(true)}
              onSelectAppointment={handleOpenDetail}
              onSelectPatient={handleSelectPatient}
              onRescheduleAppointment={handleOpenReschedule}
              onOpenPrintCenter={(docType, appt, ptId) => handleOpenPrintCenter(docType, appt, ptId)}
            />
          )}

          {currentSection === 'appointments' && (
            <AppointmentsHub
              onOpenNewAppointment={handleOpenNewAppointment}
              onSelectAppointment={handleOpenDetail}
              onRescheduleAppointment={handleOpenReschedule}
              onOpenPrintCenter={(docType, appt) => handleOpenPrintCenter(docType, appt)}
              onSelectPatient={handleSelectPatient}
            />
          )}

          {currentSection === 'patients' && (
            selectedPatientId ? (
              <PatientProfileView
                patientId={selectedPatientId}
                onBack={() => setSelectedPatientId(null)}
                onOpenNewAppointment={(ptId) => handleOpenNewAppointment(ptId)}
                onOpenNewPrescription={(ptId) => handleOpenNewPrescription(ptId)}
                onOpenPrintCenter={(docType, appt, ptId, rx) => handleOpenPrintCenter(docType, appt, ptId, rx)}
                onRescheduleAppointment={handleOpenReschedule}
              />
            ) : (
              <PatientsHub
                onSelectPatient={handleSelectPatient}
                onOpenNewPatient={() => setIsNewPatientOpen(true)}
                onOpenNewAppointment={(ptId) => handleOpenNewAppointment(ptId)}
                onOpenPrintCenter={(docType, appt, ptId) => handleOpenPrintCenter(docType, appt, ptId)}
              />
            )
          )}

          {currentSection === 'doctors' && <DoctorsHub />}

          {currentSection === 'prescriptions' && (
            <PrescriptionsHub
              onOpenNewPrescription={handleOpenNewPrescription}
              onOpenPrintCenter={(docType, appt, ptId, rx) => handleOpenPrintCenter(docType, appt, ptId, rx)}
              onSelectPatient={handleSelectPatient}
            />
          )}

          {currentSection === 'treatments' && (
            <TreatmentsHub onSelectPatient={handleSelectPatient} />
          )}

          {currentSection === 'reminders' && <RemindersHub />}
          {currentSection === 'reports'   && <ReportsHub />}
          {currentSection === 'audit'     && <AuditLogsHub />}
          {currentSection === 'settings'  && <SettingsHub />}
        </main>
      </div>

      {/* ── Global Modals ──────────────────────────────────────── */}
      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectPatient={(ptId) => { setIsSearchOpen(false); handleSelectPatient(ptId); }}
        onSelectAppointment={(appt) => { setIsSearchOpen(false); handleOpenDetail(appt); }}
      />

      <NewAppointmentModal
        isOpen={isNewAppointmentOpen}
        onClose={() => setIsNewAppointmentOpen(false)}
        onSuccess={() => setIsNewAppointmentOpen(false)}
        initialPatientId={newApptInitialPatientId}
        initialDoctorId={newApptInitialDoctorId}
        initialDate={newApptInitialDate}
      />

      {rescheduleAppointment && (
        <RescheduleModal
          isOpen={isRescheduleOpen}
          onClose={() => { setIsRescheduleOpen(false); setRescheduleAppointment(null); }}
          appointment={rescheduleAppointment}
          onSuccess={() => { setIsRescheduleOpen(false); setRescheduleAppointment(null); }}
        />
      )}

      {detailAppointment && (
        <AppointmentDetailModal
          isOpen={isDetailOpen}
          appointment={detailAppointment}
          onClose={() => { setIsDetailOpen(false); setDetailAppointment(null); }}
          onSelectPatient={(ptId) => {
            setIsDetailOpen(false);
            setDetailAppointment(null);
            handleSelectPatient(ptId);
          }}
          onReschedule={(appt) => {
            setIsDetailOpen(false);
            setDetailAppointment(null);
            handleOpenReschedule(appt);
          }}
          onUpdateStatus={handleUpdateAppointmentStatus}
          onOpenPrintCenter={(docType, appt, ptId) => handleOpenPrintCenter(docType, appt, ptId)}
        />
      )}

      <NewPatientModal
        isOpen={isNewPatientOpen}
        onClose={() => setIsNewPatientOpen(false)}
        onSuccess={(newPatient) => {
          setIsNewPatientOpen(false);
          handleSelectPatient(newPatient.id);
        }}
        onSelectExistingPatient={(ptId) => {
          setIsNewPatientOpen(false);
          handleSelectPatient(ptId);
        }}
      />

      <PrescriptionEditorModal
        isOpen={isNewPrescriptionOpen}
        onClose={() => setIsNewPrescriptionOpen(false)}
        onSuccess={() => setIsNewPrescriptionOpen(false)}
        initialPatientId={prescriptionInitialPatientId}
        onOpenPrintCenter={(docType, appt, ptId, rx) => handleOpenPrintCenter(docType, appt, ptId, rx)}
      />

      <PrintCenterModal
        isOpen={isPrintCenterOpen}
        onClose={() => setIsPrintCenterOpen(false)}
        defaultDocType={printDocType}
        selectedAppointment={printAppointment}
        selectedPatientId={printPatientId}
        selectedPrescription={printPrescription}
      />
    </div>
  );
}
