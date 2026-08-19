import React, { useState, useEffect } from 'react';
import { CloudSyncStatus, PengaturanBimbel } from '../types';
import { getSupabaseClient } from '../utils/supabaseClient';

interface LoginPortalProps {
  pengaturan: PengaturanBimbel;
  cloudStatus: CloudSyncStatus;
  onLoginSuccess: (sessionData: { username: string; role: 'Admin' | 'Pengelola' | 'Tutor' }) => void;
  onShowToast: (text: string, type?: 'success' | 'info' | 'error' | 'warning') => void;
}

export const LoginPortal: React.FC<LoginPortalProps> = ({
  pengaturan,
  cloudStatus,
  onLoginSuccess,
  onShowToast,
}) => {
  const [loginMode, setLoginMode] = useState<'pin' | 'supabase'>('pin');
  
  // PIN / Master Password State
  const [pinInput, setPinInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  
  // Supabase Auth State
  const [emailInput, setEmailInput] = useState('');
  const [supabasePassword, setSupabasePassword] = useState('');
  
  // State UI
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutTime, setLockoutTime] = useState(0);

  const correctPin = (pengaturan.adminPin || 'admin123').trim();

  // Handle countdown if locked out
  useEffect(() => {
    if (lockoutTime > 0) {
      const timer = setTimeout(() => setLockoutTime((prev) => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [lockoutTime]);

  // Handle Master PIN / Password Submit
  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutTime > 0) return;

    setErrorMessage('');
    const inputClean = pinInput.trim();

    if (!inputClean) {
      setErrorMessage('Harap masukkan PIN Akses Pengelola');
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      // Validate strictly against the PIN configured in Pengaturan (default: admin123)
      if (inputClean === correctPin) {
        setIsLoading(false);
        setFailedAttempts(0);
        onShowToast(`Selamat datang di ${pengaturan.namaLembaga}!`, 'success');
        onLoginSuccess({
          username: pengaturan.pimpinan || 'Pengelola Bimbel',
          role: 'Admin',
        });
      } else {
        setIsLoading(false);
        const newAttempts = failedAttempts + 1;
        setFailedAttempts(newAttempts);

        if (newAttempts >= 5) {
          setLockoutTime(30);
          setErrorMessage('Terlalu banyak percobaan gagal. Silakan tunggu 30 detik.');
        } else {
          setErrorMessage(`PIN tidak sesuai! Sisa percobaan: ${5 - newAttempts}`);
        }
      }
    }, 400);
  };

  // Handle Email & Password Submit
  const handleEmailAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutTime > 0) return;

    setErrorMessage('');
    const email = emailInput.trim().toLowerCase();
    const password = supabasePassword.trim();

    if (!email || !password) {
      setErrorMessage('Email dan kata sandi wajib diisi');
      return;
    }

    setIsLoading(true);

    // Direct Administrator Email Credential Check
    if (email === 'dickyrians22@gmail.com' && password === 'Danscox.29') {
      setTimeout(() => {
        setIsLoading(false);
        setFailedAttempts(0);
        onShowToast(`Selamat datang ${email}! Akses Pengelola Aktif.`, 'success');
        onLoginSuccess({
          username: 'Dicky Riansyah (Admin)',
          role: 'Admin',
        });
      }, 400);
      return;
    }

    // Try Supabase Auth if client is configured
    const client = getSupabaseClient();
    if (client) {
      try {
        const { data, error } = await client.auth.signInWithPassword({
          email,
          password,
        });

        if (!error && data?.user) {
          setIsLoading(false);
          setFailedAttempts(0);
          onShowToast(`Login berhasil: ${data.user.email}!`, 'success');
          onLoginSuccess({
            username: data.user.email || email,
            role: 'Admin',
          });
          return;
        }
      } catch {
        // Fall through to invalid credentials
      }
    }

    // Invalid credentials
    setTimeout(() => {
      setIsLoading(false);
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);

      if (newAttempts >= 5) {
        setLockoutTime(30);
        setErrorMessage('Terlalu banyak percobaan gagal. Silakan tunggu 30 detik.');
      } else {
        setErrorMessage(`Email atau kata sandi tidak valid. Sisa percobaan: ${5 - newAttempts}`);
      }
    }, 400);
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 flex items-center justify-center p-4 sm:p-6 relative overflow-hidden font-sans select-none">
      
      {/* Dynamic Background Glows */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-900/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Authentication Card */}
      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 backdrop-blur-xl rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10 text-slate-200 animate-in fade-in zoom-in-95 duration-300">
        
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600 flex items-center justify-center text-white font-black text-3xl shadow-xl shadow-indigo-500/25 border border-indigo-400/30">
            Σ
          </div>
          
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-[11px] font-bold tracking-wider uppercase mb-1.5">
              <i className="fa-solid fa-shield-halved text-amber-400"></i> Portal Akses Keamanan
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              {pengaturan.namaLembaga}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5 line-clamp-1 italic">
              "{pengaturan.tagline}"
            </p>
          </div>
        </div>

        {/* Cloud Connection Badge */}
        <div className="mt-5 p-2.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${
              cloudStatus === 'connected' ? 'bg-emerald-400 ring-4 ring-emerald-400/20' :
              cloudStatus === 'syncing' ? 'bg-indigo-400 ring-4 ring-indigo-400/20 animate-pulse' :
              cloudStatus === 'connecting' ? 'bg-amber-400 ring-4 ring-amber-400/20 animate-pulse' :
              'bg-slate-500'
            }`} />
            <span className="text-slate-400 text-[11px] font-medium">Status Database:</span>
          </div>
          <span className={`text-[11px] font-bold font-mono ${
            cloudStatus === 'connected' ? 'text-emerald-400' :
            cloudStatus === 'syncing' ? 'text-indigo-400' :
            cloudStatus === 'connecting' ? 'text-amber-400' :
            'text-slate-400'
          }`}>
            {cloudStatus === 'connected' ? 'Supabase Cloud Terkoneksi' :
             cloudStatus === 'syncing' ? 'Sinkronisasi Data...' :
             cloudStatus === 'connecting' ? 'Menghubungkan...' :
             'Mode Offline / Mandiri'}
          </span>
        </div>

        {/* Mode Selector Tabs */}
        <div className="mt-5 grid grid-cols-2 gap-1.5 p-1 bg-slate-950/80 rounded-2xl border border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => {
              setLoginMode('pin');
              setErrorMessage('');
            }}
            className={`py-2 px-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
              loginMode === 'pin'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <i className="fa-solid fa-key text-[11px]"></i>
            <span>PIN Akses</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setLoginMode('supabase');
              setErrorMessage('');
            }}
            className={`py-2 px-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
              loginMode === 'supabase'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <i className="fa-solid fa-envelope text-[11px]"></i>
            <span>Email Admin</span>
          </button>
        </div>

        {/* Error Message Box */}
        {errorMessage && (
          <div className="mt-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5 animate-in shake duration-200">
            <i className="fa-solid fa-triangle-exclamation text-rose-400 shrink-0"></i>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* FORM MODE 1: PIN Akses */}
        {loginMode === 'pin' && (
          <form onSubmit={handlePinSubmit} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center justify-between">
                <span>PIN Akses Pengelola:</span>
                <span className="text-[10px] text-slate-400 font-normal">Dapat diubah di Pengaturan</span>
              </label>
              
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                  <i className="fa-solid fa-lock text-sm"></i>
                </div>

                <input
                  type={showPassword ? 'text' : 'password'}
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="Masukkan PIN Akses..."
                  disabled={isLoading || lockoutTime > 0}
                  autoFocus
                  className="w-full pl-10 pr-10 py-3 bg-slate-950/80 border border-slate-700/80 rounded-2xl text-white placeholder-slate-500 text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all font-mono"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1 text-xs"
                >
                  <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 bg-slate-950 border-slate-700 focus:ring-0"
                />
                <span className="text-[11px]">Ingat sesi login</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading || lockoutTime > 0}
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-extrabold text-sm shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLoading ? (
                <>
                  <i className="fa-solid fa-circle-notch fa-spin"></i>
                  <span>Memverifikasi PIN...</span>
                </>
              ) : lockoutTime > 0 ? (
                <>
                  <i className="fa-solid fa-hourglass-half"></i>
                  <span>Tunggu {lockoutTime} detik</span>
                </>
              ) : (
                <>
                  <span>Buka Dashboard Bimbel</span>
                  <i className="fa-solid fa-arrow-right text-xs"></i>
                </>
              )}
            </button>
          </form>
        )}

        {/* FORM MODE 2: Email & Kata Sandi */}
        {loginMode === 'supabase' && (
          <form onSubmit={handleEmailAuthSubmit} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Email Pengelola:
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                  <i className="fa-solid fa-envelope text-sm"></i>
                </div>
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="nama@email.com"
                  disabled={isLoading || lockoutTime > 0}
                  autoFocus
                  className="w-full pl-10 pr-4 py-3 bg-slate-950/80 border border-slate-700/80 rounded-2xl text-white placeholder-slate-500 text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Kata Sandi:
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                  <i className="fa-solid fa-lock text-sm"></i>
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={supabasePassword}
                  onChange={(e) => setSupabasePassword(e.target.value)}
                  placeholder="••••••••••••"
                  disabled={isLoading || lockoutTime > 0}
                  className="w-full pl-10 pr-10 py-3 bg-slate-950/80 border border-slate-700/80 rounded-2xl text-white placeholder-slate-500 text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1 text-xs"
                >
                  <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || lockoutTime > 0}
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-extrabold text-sm shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLoading ? (
                <>
                  <i className="fa-solid fa-circle-notch fa-spin"></i>
                  <span>Memverifikasi Akun...</span>
                </>
              ) : lockoutTime > 0 ? (
                <>
                  <i className="fa-solid fa-hourglass-half"></i>
                  <span>Tunggu {lockoutTime} detik</span>
                </>
              ) : (
                <>
                  <span>Masuk dengan Email</span>
                  <i className="fa-solid fa-arrow-right text-xs"></i>
                </>
              )}
            </button>
          </form>
        )}

        {/* Footer Info */}
        <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
          <span className="flex items-center gap-1">
            <i className="fa-solid fa-lock text-[10px] text-emerald-400"></i>
            <span>Enkripsi Sesi Aktif</span>
          </span>
          <span>Bimbel Sigma v2.0 Cloud</span>
        </div>

      </div>

    </div>
  );
};
