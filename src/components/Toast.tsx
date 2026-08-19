import React from 'react';
import { ToastMessage } from '../types';

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  if (!toasts || toasts.length === 0) return null;

  // Strictly take at most 1 toast (single active notification)
  const currentToast = toasts[0];

  let bg = 'bg-slate-900/95 text-white border-slate-700 shadow-slate-950/40';
  let icon = 'fa-circle-info text-sky-400';

  if (currentToast.type === 'success') {
    bg = 'bg-emerald-950/95 text-emerald-100 border-emerald-700/80 shadow-emerald-950/40';
    icon = 'fa-circle-check text-emerald-400';
  } else if (currentToast.type === 'error') {
    bg = 'bg-rose-950/95 text-rose-100 border-rose-700/80 shadow-rose-950/40';
    icon = 'fa-circle-exclamation text-rose-400';
  } else if (currentToast.type === 'warning') {
    bg = 'bg-amber-950/95 text-amber-100 border-amber-700/80 shadow-amber-950/40';
    icon = 'fa-triangle-exclamation text-amber-400';
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-sm w-full no-print pointer-events-none">
      <div
        key={currentToast.id}
        className={`pointer-events-auto p-3.5 rounded-2xl border backdrop-blur-md shadow-2xl flex items-start justify-between gap-3 text-xs font-semibold animate-in slide-in-from-bottom-2 fade-in duration-200 ${bg}`}
      >
        <div className="flex items-center gap-2.5 flex-1 pr-1">
          <i className={`fa-solid ${icon} text-sm shrink-0`}></i>
          <span className="leading-snug text-slate-100">{currentToast.text}</span>
        </div>
        <button
          type="button"
          onClick={() => onDismiss(currentToast.id)}
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
          title="Tutup notifikasi"
        >
          <i className="fa-solid fa-xmark text-xs"></i>
        </button>
      </div>
    </div>
  );
};
