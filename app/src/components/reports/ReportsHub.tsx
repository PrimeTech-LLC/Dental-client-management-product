import React, { useState, useEffect } from 'react';
import { BarChart3, Calendar, Download, Printer, Stethoscope, CheckCircle2, XCircle, DollarSign, Activity } from 'lucide-react';
import { api } from '../../lib/api.js';
import { format, subDays, startOfMonth } from 'date-fns';

export const ReportsHub: React.FC = () => {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(todayStr);
  const [reports, setReports] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadReports = async () => {
    try {
      setLoading(true);
      const data = await api.getReports(startDate, endDate);
      setReports(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [startDate, endDate]);

  const handleSetPreset = (preset: 'today' | 'week' | 'month') => {
    if (preset === 'today') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'week') {
      setStartDate(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
      setEndDate(todayStr);
    } else if (preset === 'month') {
      setStartDate(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
      setEndDate(todayStr);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-teal-600" />
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">
              Clinic Reports & Operatory Analytics
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Performance metrics, doctor productivity, appointment completion ratios, and estimated revenue.
          </p>
        </div>

        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium border border-slate-200"
        >
          <Printer className="w-3.5 h-3.5 text-slate-600" />
          <span>Print Summary Report</span>
        </button>
      </div>

      {/* Date Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-slate-600">Preset Range:</span>
          <button
            onClick={() => handleSetPreset('today')}
            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 font-medium"
          >
            Today
          </button>
          <button
            onClick={() => handleSetPreset('week')}
            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 font-medium"
          >
            Last 7 Days
          </button>
          <button
            onClick={() => handleSetPreset('month')}
            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 font-medium"
          >
            This Month
          </button>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-slate-500">From:</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="p-1.5 bg-slate-50 border border-slate-300 rounded text-xs"
          />
          <label className="text-slate-500">To:</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="p-1.5 bg-slate-50 border border-slate-300 rounded text-xs"
          />
        </div>
      </div>

      {/* Reports Metrics Summary */}
      {reports && (
        <div className="space-y-6">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Total Appointments</span>
              <div className="text-2xl font-bold text-slate-800 mt-1">{reports.totalAppointments}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">In selected date range</div>
            </div>

            <div className="bg-emerald-50/70 p-4 rounded-xl border border-emerald-200 shadow-2xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 block">Completed Sessions</span>
              <div className="text-2xl font-bold text-emerald-900 mt-1">{reports.completedAppointments}</div>
              <div className="text-[11px] text-emerald-700 mt-0.5">
                {reports.totalAppointments > 0 ? `${Math.round((reports.completedAppointments / reports.totalAppointments) * 100)}% completion rate` : '0%'}
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Cancelled / No Show</span>
              <div className="text-2xl font-bold text-slate-700 mt-1">{reports.cancelledAppointments}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Patient drop-offs</div>
            </div>

            <div className="bg-teal-50/70 p-4 rounded-xl border border-teal-200 shadow-2xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-teal-800 block">Estimated Revenue</span>
              <div className="text-2xl font-bold text-teal-900 mt-1">${reports.estimatedRevenue?.toLocaleString() || 0}</div>
              <div className="text-[11px] text-teal-700 mt-0.5">From treatments delivered</div>
            </div>
          </div>

          {/* Breakdown Charts Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* By Procedure Type */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Appointments by Procedure Type
              </h3>
              <div className="space-y-3">
                {Object.entries(reports.byType || {}).map(([type, count]: [string, any]) => {
                  const percent = reports.totalAppointments > 0 ? Math.round((count / reports.totalAppointments) * 100) : 0;

                  return (
                    <div key={type} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-800">{type}</span>
                        <span className="text-slate-500 font-mono">{count} ({percent}%)</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-teal-600 rounded-full"
                          style={{ width: `${percent}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* By Doctor */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Doctor Caseload & Operatory Volume
              </h3>
              <div className="space-y-3">
                {Object.entries(reports.byDoctor || {}).map(([docName, count]: [string, any]) => {
                  const percent = reports.totalAppointments > 0 ? Math.round((count / reports.totalAppointments) * 100) : 0;

                  return (
                    <div key={docName} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-800">{docName}</span>
                        <span className="text-slate-500 font-mono">{count} appointments</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-600 rounded-full"
                          style={{ width: `${percent}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
