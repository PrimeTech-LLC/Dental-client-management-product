import React from 'react';
import {
  Search,
  UserPlus,
  CalendarPlus,
  Printer,
  LogOut,
  Menu,
} from 'lucide-react';
import { User, ClinicSettings } from '../../types/index.js';
import { format } from 'date-fns';

interface TopBarProps {
  currentUser?: User;
  onLogout?: () => void;
  onOpenNewAppointment: () => void;
  onOpenNewPatient: () => void;
  onOpenGlobalSearch?: () => void;
  onOpenSearch?: () => void;
  onOpenPrintCenter: (docType?: any) => void;
  settings?: ClinicSettings;
  // MOB-01: toggle the mobile sidebar drawer
  onToggleSidebar?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentUser,
  onLogout,
  onOpenNewAppointment,
  onOpenNewPatient,
  onOpenGlobalSearch,
  onOpenSearch,
  onOpenPrintCenter,
  settings,
  onToggleSidebar,
}) => {
  const todayFormatted = format(new Date(), 'EEEE, dd MMMM yyyy');
  const triggerSearch = onOpenGlobalSearch || onOpenSearch || (() => {});
  const clinicName = settings?.clinicName || '';

  return (
    <header className="h-16 bg-white border-b border-black/10 flex items-center justify-between px-4 md:px-8 shrink-0 z-20">
      {/* Left side: hamburger (mobile only) + search */}
      <div className="flex items-center gap-3 flex-1 max-w-xl">

        {/* MOB-01: hamburger button — only visible on mobile (< md) */}
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            aria-label="Open navigation menu"
            className="md:hidden p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
          >
            <Menu className="w-5 h-5" aria-hidden="true" />
          </button>
        )}

        {/* Search bar */}
        <div className="relative w-full max-w-md">
          <button
            type="button"
            onClick={triggerSearch}
            aria-label="Open global search"
            className="w-full flex items-center text-left pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-md text-slate-500 hover:text-slate-800 hover:border-slate-300 transition-colors focus:outline-none cursor-pointer"
            style={{ '--tw-ring-color': '#1e3a8a' } as any}
          >
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />
            <span className="truncate">Search patient by name or phone (⌘K)...</span>
            <kbd className="ml-auto hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-slate-500 bg-white border border-slate-200 rounded">
              ⌘K
            </kbd>
          </button>
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-2 md:gap-4">
        {/* Clinic & Date — hidden on mobile */}
        <div className="text-right hidden sm:block">
          <p className="text-sm font-semibold text-slate-900 leading-tight">{clinicName}</p>
          <p className="text-[11px] text-slate-500">{todayFormatted}</p>
        </div>

        {/* Print Center — hidden below md */}
        <button
          onClick={() => onOpenPrintCenter('DailySchedule')}
          aria-label="Open print center"
          className="hidden md:flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200/80 text-slate-700 rounded-md text-xs font-medium border border-slate-200 transition-colors cursor-pointer"
        >
          <Printer className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
          <span>Print Center</span>
        </button>

        {/* New Patient — hidden below lg */}
        <button
          onClick={onOpenNewPatient}
          aria-label="Register new patient"
          className="hidden lg:flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-md text-xs font-medium shadow-xs transition-colors cursor-pointer"
        >
          <UserPlus className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
          <span>New Patient</span>
        </button>

        {/* New Appointment — always visible */}
        <button
          onClick={onOpenNewAppointment}
          aria-label="Book new appointment"
          className="flex items-center gap-1.5 md:gap-2 text-white text-xs md:text-sm font-medium px-3 md:px-4 py-2 rounded-md shadow-sm transition-colors cursor-pointer"
          style={{ backgroundColor: '#1e3a8a' }}
          onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#1e40af'}
          onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#1e3a8a'}
        >
          <CalendarPlus className="w-4 h-4" aria-hidden="true" />
          <span className="hidden sm:inline">+ New Appointment</span>
          <span className="sm:hidden">+ Book</span>
        </button>

        {/* User display + logout */}
        {currentUser && (
          <div className="flex items-center gap-2 border-l border-slate-200 pl-3 md:pl-4">
            <div
              className="w-7 h-7 rounded-full text-white flex items-center justify-center font-bold text-xs"
              style={{ backgroundColor: '#1e3a8a' }}
              aria-hidden="true"
            >
              {currentUser.name.charAt(0).toUpperCase()}
            </div>
            <div className="hidden xl:block text-left">
              <div className="text-xs font-semibold text-slate-800 leading-tight">{currentUser.name}</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">{currentUser.role}</div>
            </div>
            {onLogout && (
              <button
                onClick={onLogout}
                aria-label="Sign out"
                className="ml-1 p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
