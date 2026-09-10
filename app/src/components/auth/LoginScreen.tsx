import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api.js';

interface LoginScreenProps {
  onLogin: (username: string, password: string) => Promise<void>;
}

// ── Change Password Screen (CONFIG-02) ───────────────────────────────────────
// Shown after login when mustChangePassword is true.
// Uses its own API call; does not require the parent to wire anything extra.
const ChangePasswordScreen: React.FC<{ username: string; onDone: () => void }> = ({ username, onDone }) => {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (next.length < 8) { setError('New password must be at least 8 characters.'); return; }
    if (next !== confirm) { setError('Passwords do not match.'); return; }
    try {
      setLoading(true);
      await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      }).then(async r => {
        const body = await r.json();
        if (!body.success) throw new Error(body.error?.message || 'Failed to change password.');
      });
      onDone();
    } catch (err: any) {
      setError(err.message || 'Failed to change password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-amber-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-amber-500 rounded-2xl shadow-lg mb-1">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">Change Your Password</h1>
          <p className="text-xs text-slate-500">
            Your account (<strong>{username}</strong>) requires a password change before you can continue.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 bg-amber-50 border-b border-amber-100">
            <p className="text-xs text-amber-800 font-medium text-center">
              Default credentials detected — please set a secure password.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide">Current Password</label>
              <input type="password" required value={current} onChange={e => setCurrent(e.target.value)} disabled={loading}
                placeholder="Enter current (default) password"
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:bg-white transition-colors disabled:opacity-60" />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide">New Password</label>
              <input type="password" required minLength={8} value={next} onChange={e => setNext(e.target.value)} disabled={loading}
                placeholder="Min. 8 characters"
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:bg-white transition-colors disabled:opacity-60" />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide">Confirm New Password</label>
              <input type="password" required minLength={8} value={confirm} onChange={e => setConfirm(e.target.value)} disabled={loading}
                placeholder="Repeat new password"
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:bg-white transition-colors disabled:opacity-60" />
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">{error}</div>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 mt-2">
              {loading
                ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /><span>Saving…</span></>
                : <span>Set New Password & Continue</span>
              }
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

// ── Main Login Screen ────────────────────────────────────────────────────────

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [clinicName, setClinicName] = useState('');
  const [clinicTagline, setClinicTagline] = useState('');
  // CONFIG-02: track whether the newly-logged-in user must change their password
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [loggedInUsername, setLoggedInUsername] = useState('');

  useEffect(() => {
    api.getPublicClinic()
      .then(s => {
        setClinicName(s.clinicName || '');
        setClinicTagline(s.tagline || '');
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setLoading(true);
    setError('');
    try {
      // Call the parent handler — it sets currentUser in App state
      await onLogin(username.trim(), password);
      // After successful login, check if the server requires a password change.
      // We do a fresh /api/auth/me call to read the mustChangePassword flag.
      try {
        const meRes = await fetch('/api/auth/me', { credentials: 'include' });
        const meBody = await meRes.json();
        if (meBody?.data?.user?.mustChangePassword) {
          setLoggedInUsername(username.trim());
          setMustChangePassword(true);
        }
      } catch { /* non-critical */ }
    } catch (err: any) {
      setError(err.message || 'Invalid username or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // CONFIG-02: show the forced password change screen
  if (mustChangePassword) {
    return (
      <ChangePasswordScreen
        username={loggedInUsername}
        onDone={() => setMustChangePassword(false)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-teal-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-7">

        {/* Clinic Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-teal-600 rounded-2xl shadow-lg mb-1">
            <svg className="w-9 h-9 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2C9.5 2 7 3.5 6 6c-.8 2-.6 4.5-.3 6.5.3 2 .8 4 1.8 5.5.5.8 1.1 1 1.5 1s.7-.3 1-.8c.3-.5.5-1.2.7-2 .2-.8.3-1.7.3-2.2s.2-.5.5-.5.5.2.5.5c0 .5.1 1.4.3 2.2.2.8.4 1.5.7 2 .3.5.6.8 1 .8s1-.2 1.5-1c1-1.5 1.5-3.5 1.8-5.5.3-2 .5-4.5-.3-6.5C17 3.5 14.5 2 12 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            {clinicName || 'Dental Clinic'}
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            {clinicTagline || 'Receptionist Management System'}
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-700 text-center tracking-wide uppercase">
              Sign In to Your Account
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Username */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide">Username</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </span>
                <input type="text" autoComplete="username" autoFocus required
                  placeholder="Enter your name or email"
                  value={username} onChange={e => setUsername(e.target.value)} disabled={loading}
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:bg-white transition-colors disabled:opacity-60" />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide">Password</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </span>
                <input type={showPassword ? 'text' : 'password'} autoComplete="current-password" required
                  placeholder="Enter your password"
                  value={password} onChange={e => setPassword(e.target.value)} disabled={loading}
                  className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:bg-white transition-colors disabled:opacity-60" />
                <button type="button" onClick={() => setShowPassword(v => !v)} tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
                <svg className="w-4 h-4 text-rose-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <button type="submit" disabled={loading || !username.trim() || !password}
              className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 mt-2">
              {loading ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /><span>Signing in…</span></>
              ) : (
                <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" /></svg><span>Sign In</span></>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] text-slate-400">
          {clinicName || 'Dental Clinic'} · Secure Internal System
        </p>
      </div>
    </div>
  );
};
