import { format, parseISO, isValid } from 'date-fns';

export function formatDate(dateString?: string, formatStr = 'MMM dd, yyyy'): string {
  if (!dateString) return '—';
  try {
    const d = typeof dateString === 'string' ? parseISO(dateString) : dateString;
    return isValid(d) ? format(d, formatStr) : dateString;
  } catch {
    return dateString;
  }
}

export function formatTime(timeStr?: string): string {
  if (!timeStr) return '—';
  try {
    const [h, m] = timeStr.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return timeStr;
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
  } catch {
    return timeStr;
  }
}

export function calculateAge(dateOfBirth?: string): string {
  if (!dateOfBirth) return '—';
  try {
    const dob = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return `${age} yrs`;
  } catch {
    return '—';
  }
}

export function getStatusBadgeClasses(status: string): string {
  switch (status) {
    case 'ARRIVED':
      return 'bg-amber-50 text-amber-800 border-amber-300 ring-1 ring-amber-300/50';
    case 'IN_PROGRESS':
      return 'bg-blue-50 text-blue-800 border-blue-300 ring-1 ring-blue-300/50 animate-pulse';
    case 'COMPLETED':
      return 'bg-emerald-50 text-emerald-800 border-emerald-300';
    case 'CONFIRMED':
      return 'bg-teal-50 text-teal-800 border-teal-300';
    case 'SCHEDULED':
      return 'bg-slate-100 text-slate-700 border-slate-300';
    case 'CANCELLED':
      return 'bg-rose-50 text-rose-800 border-rose-300';
    case 'NO_SHOW':
      return 'bg-red-50 text-red-700 border-red-200';
    case 'RESCHEDULED':
      return 'bg-purple-50 text-purple-800 border-purple-300';
    case 'PLANNED':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    case 'ACTIVE':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'INACTIVE':
      return 'bg-slate-100 text-slate-600 border-slate-200';
    default:
      return 'bg-slate-50 text-slate-700 border-slate-200';
  }
}
