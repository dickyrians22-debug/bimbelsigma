import React from 'react';
import { ToastMessage } from '../types';

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full no-print">
      {toasts.map((toast) => {
        let bg = 'bg-slate-900 text-white border-slate-700';
        let icon = 'fa-circle-info text-blue-400';

        if (toast.type === 'success') {
          bg = 'bg-emerald-900 text-emerald-100 border-emerald-700';
          icon = 'fa-circle-check text-emerald-400';
        } else if (toast.type === 'error') {
          bg = 'bg-rose-900 text-rose-100 border-rose-700';
          icon = 'fa-circle-exclamation text-rose-400';
        } else if (toast.type === 'warning') {
          bg = 'bg-amber-900 text-amber-100 border-amber-700';
          icon = 'fa-triangle-exclamation text-amber-400';
        }

        return (
          <div
            key={toast.id}
            className={`p-3.5 rounded-xl border shadow-xl flex items-start justify-between gap-3 text-xs font-semibold animate-slide-up ${bg}`}
          >
            <div className="flex items-center gap-2.5">
              <i className={`fa-solid ${icon} text-sm shrink-0`}></i>
              <span className="leading-snug">{toast.text}</span>
            </div>
            <button
              onClick={() => onDismiss(toast.id)}
              className="text-slate-400 hover:text-white p-0.5 transition-colors"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        );
      })}
    </div>
  );
};
