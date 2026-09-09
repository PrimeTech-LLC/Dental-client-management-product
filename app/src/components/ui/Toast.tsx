/**
 * Lightweight Toast / Notification system.
 *
 * Usage:
 *   const { toasts, showToast } = useToast();
 *   showToast('Saved successfully', 'success');
 *   <ToastContainer toasts={toasts} onDismiss={dismissToast} />
 */
import React, { useState, useCallback, useEffect } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev, { id, message, type }]);
    // Auto-dismiss after 4 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return { toasts, showToast, dismissToast };
}

// ─── Container Component ─────────────────────────────────────────────────────

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

const iconMap: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />,
  error:   <XCircle      className="w-4 h-4 shrink-0 text-rose-500" />,
  warning: <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />,
  info:    <Info          className="w-4 h-4 shrink-0 text-blue-500" />,
};

const bgMap: Record<ToastType, string> = {
  success: 'bg-emerald-50 border-emerald-300 text-emerald-900',
  error:   'bg-rose-50 border-rose-300 text-rose-900',
  warning: 'bg-amber-50 border-amber-300 text-amber-900',
  info:    'bg-blue-50 border-blue-300 text-blue-900',
};

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`flex items-start gap-3 p-3.5 rounded-xl border shadow-lg text-xs font-medium pointer-events-auto animate-in slide-in-from-right-2 ${bgMap[toast.type]}`}
        >
          {iconMap[toast.type]}
          <span className="flex-1 leading-relaxed">{toast.message}</span>
          <button
            onClick={() => onDismiss(toast.id)}
            className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
            aria-label="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};

// ─── Confirm Dialog ──────────────────────────────────────────────────────────
// Drop-in replacement for window.confirm()

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  const confirmBg =
    variant === 'danger'  ? 'bg-rose-600 hover:bg-rose-700' :
    variant === 'warning' ? 'bg-amber-600 hover:bg-amber-700' :
                            'bg-teal-600 hover:bg-teal-700';

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[9999] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-sm p-6 space-y-4 text-xs">
        <div>
          <h3 className="font-bold text-sm text-slate-900">{title}</h3>
          <p className="text-slate-500 mt-1.5 leading-relaxed">{message}</p>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 font-medium"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-white rounded-lg font-semibold shadow-xs ${confirmBg}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
