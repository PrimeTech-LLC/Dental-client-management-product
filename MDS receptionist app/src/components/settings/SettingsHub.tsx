import React, { useState, useEffect } from 'react';
import { Settings, Save, CheckCircle2, Building, Clock, Phone, Mail, Globe, MapPin } from 'lucide-react';
import { ClinicSetting } from '../../types/index.js';
import { api } from '../../lib/api.js';

export const SettingsHub: React.FC = () => {
  const [settings, setSettings] = useState<ClinicSetting | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Form states
  const [clinicName, setClinicName] = useState('');
  const [phone, setPhone] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [email, setEmail] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [operatingStart, setOperatingStart] = useState('08:00');
  const [operatingEnd, setOperatingEnd] = useState('18:00');
  const [slotDuration, setSlotDuration] = useState(30);
  const [currencySymbol, setCurrencySymbol] = useState('$');

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await api.getSettings();
      setSettings(data);
      setClinicName(data.clinicName);
      setPhone(data.phone);
      setEmergencyPhone(data.emergencyPhone || '');
      setEmail(data.email);
      setAddressLine1(data.addressLine1);
      setAddressLine2(data.addressLine2 || '');
      setCity(data.city);
      setState(data.state);
      setZipCode(data.zipCode);
      setOperatingStart(data.operatingHoursStart);
      setOperatingEnd(data.operatingHoursEnd);
      setSlotDuration(data.defaultSlotDurationMinutes);
      setCurrencySymbol(data.currencySymbol);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const updated = await api.updateSettings({
        clinicName,
        phone,
        emergencyPhone,
        email,
        addressLine1,
        addressLine2,
        city,
        state,
        zipCode,
        operatingHoursStart: operatingStart,
        operatingHoursEnd: operatingEnd,
        defaultSlotDurationMinutes: Number(slotDuration),
        currencySymbol
      });
      setSettings(updated);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      alert(`Failed to save settings: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-xs text-slate-400">Loading clinic configuration...</div>;
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-teal-600" />
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">
              Clinic Configuration & Practice Identity
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Global clinic header, print stationery details, and default operatory operating hours.
          </p>
        </div>

        {savedSuccess && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-semibold animate-pulse">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Settings saved successfully</span>
          </div>
        )}
      </div>

      {/* Settings Form */}
      <form onSubmit={handleSave} className="space-y-6 text-xs">
        {/* Section 1: Practice Profile */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 border-b border-slate-100 pb-2">
            Practice Details (Stationery & Header)
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Clinic Name *</label>
              <input
                type="text"
                required
                value={clinicName}
                onChange={(e) => setClinicName(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-lg text-xs font-medium"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Primary Phone *</label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-lg text-xs font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Emergency After-Hours Hotline</label>
              <input
                type="tel"
                value={emergencyPhone}
                onChange={(e) => setEmergencyPhone(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-lg text-xs font-mono"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Official Reception Email *</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-lg text-xs"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Address */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 border-b border-slate-100 pb-2">
            Facility Address
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Address Line 1 *</label>
              <input
                type="text"
                required
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-lg text-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Suite / Floor</label>
              <input
                type="text"
                value={addressLine2}
                onChange={(e) => setAddressLine2(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-lg text-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">City *</label>
              <input
                type="text"
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-lg text-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">State / Province *</label>
              <input
                type="text"
                required
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-lg text-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Postal / ZIP Code *</label>
              <input
                type="text"
                required
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-lg text-xs font-mono"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Operatory Scheduling defaults */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 border-b border-slate-100 pb-2">
            Default Operating Hours & Slot Intervals
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Clinic Opening Time</label>
              <input
                type="time"
                value={operatingStart}
                onChange={(e) => setOperatingStart(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-lg text-xs font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Clinic Closing Time</label>
              <input
                type="time"
                value={operatingEnd}
                onChange={(e) => setOperatingEnd(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-lg text-xs font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Default Slot Interval</label>
              <select
                value={slotDuration}
                onChange={(e) => setSlotDuration(Number(e.target.value))}
                className="w-full p-2.5 border border-slate-300 rounded-lg text-xs"
              >
                <option value={15}>15 Minutes</option>
                <option value={30}>30 Minutes (Standard)</option>
                <option value={45}>45 Minutes</option>
                <option value={60}>60 Minutes (Long)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Save button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold text-xs shadow-xs flex items-center gap-2 transition-colors"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving Changes...' : 'Save Configuration'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
