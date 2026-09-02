import React from 'react';
import {
  CalendarDays,
  Users,
  UserRoundCheck,
  Stethoscope,
  FileText,
  Bell,
  BarChart3,
  ShieldAlert,
  Settings,
  LayoutDashboard,
  Printer
} from 'lucide-react';

export type NavItemKey =
  | 'dashboard'
  | 'appointments'
  | 'patients'
  | 'doctors'
  | 'treatments'
  | 'prescriptions'
  | 'reminders'
  | 'reports'
  | 'audit'
  | 'settings';

export type NavSection = NavItemKey;

interface AppSidebarProps {
  currentTab?: NavItemKey;
  currentSection?: NavItemKey;
  onSelectTab?: (tab: NavItemKey) => void;
  onNavigate?: (tab: NavItemKey) => void;
  onOpenPrintCenter?: () => void;
  isCollapsed?: boolean;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  currentTab,
  currentSection,
  onSelectTab,
  onNavigate,
  onOpenPrintCenter
}) => {
  const activeKey = currentSection || currentTab || 'dashboard';
  const handleSelect = onNavigate || onSelectTab || (() => {});

  const navItems: { key: NavItemKey; label: string; icon: React.FC<{ className?: string }> }[] = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { key: 'patients', label: 'Patients', icon: Users },
    { key: 'appointments', label: 'Schedule', icon: CalendarDays },
    { key: 'doctors', label: 'Doctors', icon: Stethoscope },
    { key: 'prescriptions', label: 'Prescriptions', icon: FileText },
    { key: 'treatments', label: 'Treatments', icon: UserRoundCheck },
    { key: 'reminders', label: 'Reminders', icon: Bell },
    { key: 'reports', label: 'Reports', icon: BarChart3 },
    { key: 'audit', label: 'Audit Logs', icon: ShieldAlert },
    { key: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 border-r border-slate-800 select-none h-screen">
      {/* Brand Header */}
      <div className="p-6 flex items-center gap-3 border-b border-slate-800 shrink-0">
        <div className="w-8 h-8 bg-teal-500 rounded flex items-center justify-center text-white font-bold text-base shadow-sm">
          D
        </div>
        <span className="text-white font-semibold tracking-tight uppercase text-sm">
          DentalOS Pro
        </span>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-3 pb-1 pt-1">
          Navigation
        </div>
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeKey === item.key;
          return (
            <button
              key={item.key}
              onClick={() => handleSelect(item.key)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-md text-sm font-medium transition-colors text-left cursor-pointer ${
                isActive
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Quick Print Center Action */}
      {onOpenPrintCenter && (
        <div className="px-4 pb-2">
          <button
            onClick={onOpenPrintCenter}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700/90 text-slate-300 hover:text-white rounded-md text-xs font-medium transition-colors border border-slate-750 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-teal-400" />
            <span>Print Center & Stationery</span>
          </button>
        </div>
      )}

      {/* Receptionist Profile Footer */}
      <div className="p-4 border-t border-slate-800 shrink-0">
        <div className="flex items-center gap-3 p-2 bg-slate-800/50 rounded-lg border border-slate-800">
          <div className="w-8 h-8 rounded-full bg-slate-600 text-white font-semibold flex items-center justify-center text-xs">
            AR
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate">Alice Reed</p>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider">Receptionist</p>
          </div>
          <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]"></span>
        </div>
      </div>
    </aside>
  );
};

