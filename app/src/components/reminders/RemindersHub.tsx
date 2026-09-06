import React, { useState, useEffect } from 'react';
import { Bell, Send, CheckCircle2, Clock, Phone, Mail, MessageSquare, RefreshCw } from 'lucide-react';
import { AppointmentReminder } from '../../types/index.js';
import { api } from '../../lib/api.js';
import { formatDate } from '../../lib/utils.js';

export const RemindersHub: React.FC = () => {
  const [reminders, setReminders] = useState<AppointmentReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const loadReminders = async () => {
    try {
      setLoading(true);
      const data = await api.getReminders();
      setReminders(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReminders();
  }, []);

  const handleManualSend = async (id: string) => {
    try {
      setSendingId(id);
      const updated = await api.sendReminder(id);
      setReminders(prev => prev.map(r => r.id === id ? updated : r));
    } catch (err: any) {
      alert(`Failed to send reminder: ${err.message}`);
    } finally {
      setSendingId(null);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-teal-600" />
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">
              Automated Patient Reminders & Notifications
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Omni-channel notifications (SMS, Email, WhatsApp) for 24-hour appointment confirmations and follow-ups.
          </p>
        </div>

        <button
          onClick={loadReminders}
          className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium border border-slate-200"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Queue</span>
        </button>
      </div>

      {/* Reminders Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center text-xs text-slate-400">Loading reminder queue...</div>
          ) : reminders.length === 0 ? (
            <div className="p-12 text-center text-slate-400">No scheduled reminders in queue.</div>
          ) : (
            <table className="w-full text-left text-xs text-slate-700">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/70 text-[11px] uppercase font-semibold text-slate-600">
                  <th className="py-3 px-4">Channel</th>
                  <th className="py-3 px-4">Recipient</th>
                  <th className="py-3 px-4">Message Content</th>
                  <th className="py-3 px-4">Scheduled For</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reminders.map(rem => {
                  const isSent = rem.status === 'SENT';

                  return (
                    <tr key={rem.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold border ${
                          rem.channel === 'SMS' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                          rem.channel === 'WHATSAPP' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                          'bg-blue-50 text-blue-800 border-blue-200'
                        }`}>
                          {rem.channel === 'SMS' && <Phone className="w-3 h-3" />}
                          {rem.channel === 'WHATSAPP' && <MessageSquare className="w-3 h-3" />}
                          {rem.channel === 'EMAIL' && <Mail className="w-3 h-3" />}
                          <span>{rem.channel}</span>
                        </span>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-800">{rem.recipient}</div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="p-2 rounded bg-slate-50 border border-slate-200 text-slate-700 text-[11px] max-w-lg">
                          {rem.message}
                        </div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                        {formatDate(rem.scheduledAt)}
                        {rem.sentAt && (
                          <div className="text-[10px] text-emerald-700 font-sans">
                            Sent {formatDate(rem.sentAt)}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${
                          isSent ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}>
                          {rem.status}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => handleManualSend(rem.id)}
                          disabled={sendingId === rem.id}
                          className="px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-lg text-xs font-semibold flex items-center gap-1 ml-auto shadow-2xs"
                        >
                          <Send className="w-3 h-3" />
                          <span>{sendingId === rem.id ? 'Sending...' : isSent ? 'Resend' : 'Send Now'}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
