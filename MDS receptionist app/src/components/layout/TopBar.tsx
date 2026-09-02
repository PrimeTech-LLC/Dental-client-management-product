import React, { useState } from 'react';
import {
  Search,
  UserPlus,
  CalendarPlus,
  Printer
} from 'lucide-react';
import { User, ClinicSettings } from '../../types/index.js';
import { format } from 'date-fns';

interface TopBarProps {
  currentUser?: User;
  availableUsers?: User[];
  onSwitchUser?: (userId: string) => void;
  onOpenNewAppointment: () => void;
  onOpenNewPatient: () => void;
  onOpenGlobalSearch?: () => void;
  onOpenSearch?: () => void;
  onOpenPrintCenter: (docType?: any) => void;
  settings?: ClinicSettings;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentUser,
  availableUsers = [],
  onSwitchUser,
  onOpenNewAppointment,
  onOpenNewPatient,
  onOpenGlobalSearch,
  onOpenSearch,
  onOpenPrintCenter,
  settings
}) => {
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const todayFormatted = format(new Date(), 'EEEE, dd MMMM yyyy');
  const triggerSearch = onOpenGlobalSearch || onOpenSearch || (() => {});

  const clinicName = settings?.clinicName || 'Lakeside Dental Clinic';

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0 z-20">
      {/* Search Input */}
      <div className="flex items-center gap-4 flex-1 max-w-xl">
        <div className="relative w-full max-w-md">
          <button
            type="button"
            onClick={triggerSearch}
            className="w-full flex items-center text-left pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-md text-slate-500 hover:text-slate-800 hover:border-slate-300 transition-colors focus:outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer"
          >
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <span className="truncate">Search patient by name or phone (⌘K)...</span>
            <kbd className="ml-auto hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-slate-500 bg-white border border-slate-200 rounded">
              ⌘K
            </kbd>
          </button>
        </div>
      </div>

      {/* Right Header Section */}
      <div className="flex items-center gap-5">
        {/* Clinic & Date Info */}
        <div className="text-right hidden sm:block">
          <p className="text-sm font-semibold text-slate-900 leading-tight">{clinicName}</p>
          <p className="text-[11px] text-slate-500">{todayFormatted}</p>
        </div>

        {/* Print Center Quick Button */}
        <button
          onClick={() => onOpenPrintCenter('DailySchedule')}
          className="hidden md:flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200/80 text-slate-700 rounded-md text-xs font-medium border border-slate-200 transition-colors cursor-pointer"
          title="Print Daily Schedule, Rx, and Cards"
        >
          <Printer className="w-3.5 h-3.5 text-slate-500" />
          <span>Print Center</span>
        </button>

        {/* New Patient Button */}
        <button
          onClick={onOpenNewPatient}
          className="hidden lg:flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-md text-xs font-medium shadow-xs transition-colors cursor-pointer"
        >
          <UserPlus className="w-3.5 h-3.5 text-slate-500" />
          <span>New Patient</span>
        </button>

        {/* New Appointment Primary Button */}
        <button
          onClick={onOpenNewAppointment}
          className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium px-4 py-2 rounded-md shadow-sm transition-colors cursor-pointer"
        >
          <CalendarPlus className="w-4 h-4" />
          <span>+ New Appointment</span>
        </button>

        {/* User Switcher (if available) */}
        {currentUser && (
          <div className="relative border-l border-slate-200 pl-4">
            <button
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-slate-100 transition-colors text-left cursor-pointer"
            >
              <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs">
                {currentUser.name.charAt(0)}
              </div>
              <div className="hidden xl:block text-left">
                <div className="text-xs font-semibold text-slate-800 leading-tight">
                  {currentUser.name}
                </div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider">
                  {currentUser.role}
                </div>
              </div>
            </button>

            {userDropdownOpen && (
              <div className="absolute right-0 mt-2 w-60 bg-white rounded-lg shadow-lg border border-slate-200 py-1.5 z-50 text-xs">
                <div className="px-3 py-1.5 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Switch Active Role
                </div>
                {availableUsers.map(u => (
                  <button
                    key={u.id}
                    onClick={() => {
                      onSwitchUser?.(u.id);
                      setUserDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-slate-50 ${u.id === currentUser.id ? 'bg-teal-50 text-teal-900 font-semibold' : 'text-slate-700'}`}
                  >
                    <span>{u.name}</span>
                    <span className="text-[10px] text-slate-400 uppercase">{u.role}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};

