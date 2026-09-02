import React, { useState } from 'react';
import { User } from '../../types/index.js';

interface LoginScreenProps {
  availableUsers: User[];
  onLogin: (userId: string) => Promise<void>;
}

const roleColors: Record<string, string> = {
  RECEPTIONIST: 'bg-teal-50 text-teal-800 border-teal-300',
  DOCTOR:       'bg-sky-50  text-sky-800  border-sky-300',
  ADMIN:        'bg-violet-50 text-violet-800 border-violet-300',
};

const roleLabels: Record<string, string> = {
  RECEPTIONIST: 'Receptionist',
  DOCTOR:       'Doctor',
  ADMIN:        'Admin',
};

export const LoginScreen: React.FC<LoginScreenProps> = ({ availableUsers, onLogin }) => {
  const [loggingInId, setLoggingInId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handleSelect = async (userId: string) => {
    setLoggingInId(userId);
    setError('');
    try {
      await onLogin(userId);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoggingInId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Clinic Header */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-teal-600 rounded-2xl shadow-lg mb-3">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1M3 12h1m16 0h1M5.636 5.636l.707.707M17.657 17.657l.707.707M5.636 18.364l.707-.707M17.657 6.343l.707-.707M9 12a3 3 0 106 0 3 3 0 00-6 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Apex Dental Care</h1>
          <p className="text-xs text-slate-500 font-medium">Clinic Management System</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="p-5 border-b border-slate-100 bg-slate-50">
            <h2 className="text-sm font-bold text-slate-700 text-center">Select your account to continue</h2>
          </div>

          <div className="p-4 space-y-2">
            {availableUsers.filter(u => u.isActive).map(user => (
              <button
                key={user.id}
                onClick={() => handleSelect(user.id)}
                disabled={loggingInId !== null}
                className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 hover:border-teal-400 hover:bg-teal-50/30 transition-all text-left group disabled:opacity-60"
              >
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0 text-teal-700 font-bold text-sm border border-teal-200">
                  {user.name.charAt(0)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-800 text-sm truncate">{user.name}</div>
                  <div className="text-[11px] text-slate-500 truncate">{user.email}</div>
                </div>

                <div className={`px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wide flex-shrink-0 ${roleColors[user.role] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                  {roleLabels[user.role] || user.role}
                </div>

                {loggingInId === user.id ? (
                  <div className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                ) : (
                  <svg className="w-4 h-4 text-slate-300 group-hover:text-teal-500 transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </button>
            ))}

            {availableUsers.length === 0 && (
              <div className="py-8 text-center text-xs text-slate-400">
                No staff accounts found. Run the database seed first.
              </div>
            )}
          </div>

          {error && (
            <div className="mx-4 mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
              {error}
            </div>
          )}
        </div>

        <p className="text-center text-[11px] text-slate-400">
          Apex Dental Care & Implant Center · Secure Internal System
        </p>
      </div>
    </div>
  );
};
