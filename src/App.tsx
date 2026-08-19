/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  AbsensiRecord, 
  PengaturanBimbel, 
  Student, 
  ToastMessage, 
  TransaksiKas,
  CloudSyncStatus
} from './types';
import { 
  DEFAULT_PENGATURAN, 
  MOCK_STUDENTS, 
  generateMockAbsensi, 
  generateMockKas 
} from './utils/storage';
import { 
  getSupabaseConfig, 
  fetchAllCloudData, 
  uploadAllLocalDataToCloud, 
  subscribeToSupabaseRealtime, 
  upsertCloudStudent, 
  deleteCloudStudent, 
  upsertCloudAbsensi, 
  deleteCloudAbsensi, 
  upsertCloudKas, 
  deleteCloudKas, 
  saveCloudPengaturan,
  seedInitialCloudData,
  getSupabaseClient,
  broadcastToCloud
} from './utils/supabaseClient';
import { formatIndonesianDate, getTodayDateString } from './utils/helpers';
import { ActiveModule, Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { SiswaView } from './components/SiswaView';
import { AbsensiView } from './components/AbsensiView';
import { KartuPresensiView } from './components/KartuPresensiView';
import { BiayaAbsensiView } from './components/BiayaAbsensiView';
import { KasView } from './components/KasView';
import { ProfitLossView } from './components/ProfitLossView';
import { PengaturanView } from './components/PengaturanView';
import { LoginPortal } from './components/LoginPortal';
import { Toast } from './components/Toast';

export default function App() {
  // Authentication & Session State - Always start at Portal as requested
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  const [currentAdminUser, setCurrentAdminUser] = useState<string>(() => {
    try {
      return localStorage.getItem('sigma_auth_user') || sessionStorage.getItem('sigma_auth_user') || 'Pengelola Bimbel';
    } catch {
      return 'Pengelola Bimbel';
    }
  });

  // Navigation State
  const [activeModule, setActiveModule] = useState<ActiveModule>('dashboard');
  const [isOpenMobile, setIsOpenMobile] = useState<boolean>(false);

  // Core Data States (Pure In-Memory & Cloud-Synced, ZERO localStorage dependency for data)
  const [students, setStudents] = useState<Student[]>(MOCK_STUDENTS);
  const [absensi, setAbsensi] = useState<AbsensiRecord[]>(generateMockAbsensi());
  const [kas, setKas] = useState<TransaksiKas[]>(generateMockKas());
  const [pengaturan, setPengaturan] = useState<PengaturanBimbel>(DEFAULT_PENGATURAN);

  // Cloud Sync & Realtime State
  const [cloudStatus, setCloudStatus] = useState<CloudSyncStatus>('offline');
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const realtimeChannelRef = useRef<any>(null);
  const localBusRef = useRef<BroadcastChannel | null>(null);

  // Toast Notification System - Strict Max 1 Toast & 3s Auto-Dismiss
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const toastTimeoutRef = useRef<any>(null);

  const showToast = useCallback((text: string, type: 'success' | 'info' | 'error' | 'warning' = 'success') => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    const id = `toast-${Date.now()}`;
    // Strictly limit to maximum 1 toast displayed at any time
    setToasts([{ id, text, type }]);

    // Auto-dismiss after 3 seconds
    toastTimeoutRef.current = setTimeout(() => {
      setToasts([]);
    }, 3000);
  }, []);

  const dismissToast = useCallback((id?: string) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToasts([]);
  }, []);

  /**
   * 1. UTAMAKAN SUPABASE:
   * Saat pertama kali dimuat, aplikasi melakukan 'SELECT *' ke Supabase secara senyap (Silent Load).
   */
  const initCloudFirstData = useCallback(async (isSilent = true) => {
    const config = getSupabaseConfig();

    if (!config.isEnabled || !config.url || !config.anonKey) {
      setCloudStatus('offline');
      setIsInitialLoading(false);
      return;
    }

    if (!isSilent) {
      setCloudStatus('connecting');
    }

    try {
      // Direct SELECT * query ke Supabase
      const cloudData = await fetchAllCloudData();

      if (cloudData) {
        if (cloudData.isTableEmpty) {
          // Jika tabel Supabase masih kosong, lakukan auto-seeding data awal secara senyap
          await seedInitialCloudData();
          setStudents(MOCK_STUDENTS);
          setAbsensi(generateMockAbsensi());
          setKas(generateMockKas());
          setPengaturan(DEFAULT_PENGATURAN);
        } else {
          // Isi array data utama langsung dari Supabase
          setStudents(cloudData.students || []);
          setAbsensi(cloudData.absensi || []);
          setKas(cloudData.kas || []);
          setPengaturan(cloudData.pengaturan || DEFAULT_PENGATURAN);
        }
        setCloudStatus('connected');
      } else {
        setCloudStatus('error');
      }

      /**
       * 2. SINKRONISASI REALTIME BIDIRECTIONAL (SILENT SYNC):
       * Mengaktifkan Supabase Realtime Subscription untuk semua tabel.
       * Perubahan data disinkronkan secara senyap ke dalam state tanpa memunculkan toast bulk/spam.
       */
      if (!realtimeChannelRef.current) {
        const channel = subscribeToSupabaseRealtime({
          onAllStudentsSync: (allStudents) => {
            setStudents(allStudents);
          },
          onStudentUpsert: (student) => {
            setStudents((prev) => {
              const index = prev.findIndex((s) => s.id === student.id);
              if (index >= 0) {
                const updated = [...prev];
                updated[index] = student;
                return updated;
              }
              return [student, ...prev];
            });
          },
          onStudentDelete: (id) => {
            setStudents((prev) => prev.filter((s) => s.id !== id));
          },
          onAllAbsensiSync: (allAbsensi) => {
            setAbsensi(allAbsensi);
          },
          onAbsensiUpsert: (record) => {
            setAbsensi((prev) => {
              const index = prev.findIndex((a) => a.id === record.id);
              if (index >= 0) {
                const updated = [...prev];
                updated[index] = record;
                return updated;
              }
              return [record, ...prev];
            });
          },
          onAbsensiDelete: (id) => {
            setAbsensi((prev) => prev.filter((a) => a.id !== id));
          },
          onAllKasSync: (allKas) => {
            setKas(allKas);
          },
          onKasUpsert: (item) => {
            setKas((prev) => {
              const index = prev.findIndex((k) => k.id === item.id);
              if (index >= 0) {
                const updated = [...prev];
                updated[index] = item;
                return updated;
              }
              return [item, ...prev];
            });
          },
          onKasDelete: (id) => {
            setKas((prev) => prev.filter((k) => k.id !== id));
          },
          onPengaturanUpdate: (newPengaturan) => {
            setPengaturan(newPengaturan);
          },
          onStatusChange: (status) => {
            if (status === 'SUBSCRIBED') {
              setCloudStatus('connected');
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              setCloudStatus('error');
            }
          },
        });

        realtimeChannelRef.current = channel;
      }
    } catch (err) {
      console.error('Error saat inisialisasi Cloud Supabase:', err);
      setCloudStatus('error');
    } finally {
      setIsInitialLoading(false);
    }
  }, []);

  // Inisialisasi Local BroadcastChannel untuk sinkronisasi antar-tab instan
  useEffect(() => {
    if (typeof BroadcastChannel !== 'undefined') {
      const bus = new BroadcastChannel('sigma_bimbel_local_bus');
      bus.onmessage = (event) => {
        const { type, data } = event.data || {};
        if (type === 'SYNC_STUDENTS') {
          setStudents(data);
        } else if (type === 'SYNC_ABSENSI') {
          setAbsensi(data);
        } else if (type === 'SYNC_KAS') {
          setKas(data);
        } else if (type === 'SYNC_PENGATURAN') {
          setPengaturan(data);
        }
      };
      localBusRef.current = bus;
      return () => {
        bus.close();
      };
    }
  }, []);

  // Run initial Cloud-First Data Load on mount & on window focus (for mobile sleep/wake)
  useEffect(() => {
    initCloudFirstData();

    // Auto-refresh when tab becomes active / device unlocked
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        initCloudFirstData(true);
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
      if (realtimeChannelRef.current) {
        try {
          const client = getSupabaseClient();
          if (client) client.removeChannel(realtimeChannelRef.current);
        } catch (e) {
          console.error('Cleanup realtime error:', e);
        }
        realtimeChannelRef.current = null;
      }
    };
  }, [initCloudFirstData]);

  /**
   * 3. CRUD OPERATION VIA SUPABASE:
   * Semua fungsi Tambah, Edit, dan Hapus (Siswa, Presensi, Kas, Pengaturan)
   * langsung mengirim instruksi INSERT, UPDATE, atau DELETE ke Supabase dan
   * membroadcast pembaruan seketika ke seluruh perangkat & browser yang sedang aktif.
   */
  const handleSaveStudents = async (newStudents: Student[]) => {
    const prevStudents = students;
    setStudents(newStudents);

    // 1. Broadcast ke tab lain di browser yang sama
    localBusRef.current?.postMessage({ type: 'SYNC_STUDENTS', data: newStudents });

    // 2. Broadcast instan via Supabase Realtime ke browser/HP lain
    await broadcastToCloud('SYNC_STUDENTS', newStudents);

    const config = getSupabaseConfig();
    if (config.isEnabled && config.url && config.anonKey) {
      // Find deleted students to trigger DELETE on Supabase
      const currentIds = new Set(newStudents.map((s) => s.id));
      const deleted = prevStudents.filter((s) => !currentIds.has(s.id));
      for (const d of deleted) {
        await deleteCloudStudent(d.id);
        await broadcastToCloud('SYNC_STUDENT_DELETE', { id: d.id });
      }

      // Upsert modified / newly added students
      for (const s of newStudents) {
        await upsertCloudStudent(s);
        await broadcastToCloud('SYNC_STUDENT_UPSERT', s);
      }
    }
  };

  const handleSaveAbsensi = async (newRecords: AbsensiRecord[]) => {
    const prevAbsensi = absensi;
    setAbsensi(newRecords);

    // 1. Broadcast ke tab lain di browser yang sama
    localBusRef.current?.postMessage({ type: 'SYNC_ABSENSI', data: newRecords });

    // 2. Broadcast instan via Supabase Realtime ke browser/HP lain
    await broadcastToCloud('SYNC_ABSENSI', newRecords);

    const config = getSupabaseConfig();
    if (config.isEnabled && config.url && config.anonKey) {
      const currentIds = new Set(newRecords.map((a) => a.id));
      const deleted = prevAbsensi.filter((a) => !currentIds.has(a.id));
      for (const d of deleted) {
        await deleteCloudAbsensi(d.id);
        await broadcastToCloud('SYNC_ABSENSI_DELETE', { id: d.id });
      }

      for (const a of newRecords) {
        await upsertCloudAbsensi(a);
        await broadcastToCloud('SYNC_ABSENSI_UPSERT', a);
      }
    }
  };

  const handleSaveKas = async (newKas: TransaksiKas[]) => {
    const prevKas = kas;
    setKas(newKas);

    // 1. Broadcast ke tab lain di browser yang sama
    localBusRef.current?.postMessage({ type: 'SYNC_KAS', data: newKas });

    // 2. Broadcast instan via Supabase Realtime ke browser/HP lain
    await broadcastToCloud('SYNC_KAS', newKas);

    const config = getSupabaseConfig();
    if (config.isEnabled && config.url && config.anonKey) {
      const currentIds = new Set(newKas.map((k) => k.id));
      const deleted = prevKas.filter((k) => !currentIds.has(k.id));
      for (const d of deleted) {
        await deleteCloudKas(d.id);
        await broadcastToCloud('SYNC_KAS_DELETE', { id: d.id });
      }

      for (const k of newKas) {
        await upsertCloudKas(k);
        await broadcastToCloud('SYNC_KAS_UPSERT', k);
      }
    }
  };

  const handleSavePengaturan = async (newPengaturan: PengaturanBimbel) => {
    setPengaturan(newPengaturan);

    localBusRef.current?.postMessage({ type: 'SYNC_PENGATURAN', data: newPengaturan });
    await broadcastToCloud('SYNC_PENGATURAN', newPengaturan);

    const config = getSupabaseConfig();
    if (config.isEnabled && config.url && config.anonKey) {
      await saveCloudPengaturan(newPengaturan);
    }
  };

  // Manual Pull from Cloud (SELECT *)
  const handleRefreshCloudData = async () => {
    setCloudStatus('syncing');
    const cloudData = await fetchAllCloudData();
    if (cloudData) {
      setStudents(cloudData.students || []);
      setAbsensi(cloudData.absensi || []);
      setKas(cloudData.kas || []);
      setPengaturan(cloudData.pengaturan || DEFAULT_PENGATURAN);
      setCloudStatus('connected');
      showToast('Data berhasil dimuat ulang (SELECT *) langsung dari Supabase!', 'success');
    } else {
      setCloudStatus('error');
      showToast('Gagal menarik data dari Supabase. Periksa koneksi dan tabel.', 'error');
    }
  };

  // Manual Upload all state to Cloud
  const handleUploadAllToCloud = async () => {
    const result = await uploadAllLocalDataToCloud(students, absensi, kas, pengaturan);
    if (result.success) {
      showToast(result.message, 'success');
      setCloudStatus('connected');
    } else {
      showToast(result.message, 'error');
    }
  };

  // Seed Initial Demo Template to Cloud
  const handleSeedInitialData = async () => {
    const result = await seedInitialCloudData();
    if (result.success) {
      setStudents(MOCK_STUDENTS);
      setAbsensi(generateMockAbsensi());
      setKas(generateMockKas());
      setPengaturan(DEFAULT_PENGATURAN);
      showToast('Data demo berhasil di-seed ke Supabase Cloud!', 'success');
    } else {
      showToast(result.message, 'error');
    }
  };

  const handleResetAllData = async () => {
    await handleSeedInitialData();
  };

  // Auth Session Handlers
  const handleLoginSuccess = (sessionData: { username: string; role: 'Admin' | 'Pengelola' | 'Tutor' }) => {
    setIsAuthenticated(true);
    setCurrentAdminUser(sessionData.username);
    try {
      localStorage.setItem('sigma_auth_session_v1', 'true');
      localStorage.setItem('sigma_auth_user', sessionData.username);
      sessionStorage.setItem('sigma_auth_session_v1', 'true');
      sessionStorage.setItem('sigma_auth_user', sessionData.username);
    } catch (e) {
      console.warn('Session write warning:', e);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    try {
      localStorage.removeItem('sigma_auth_session_v1');
      localStorage.removeItem('sigma_auth_user');
      sessionStorage.removeItem('sigma_auth_session_v1');
      sessionStorage.removeItem('sigma_auth_user');
    } catch (e) {
      console.warn('Session clear warning:', e);
    }
    showToast('Sesi telah ditutup. Portal akses terkunci dengan aman.', 'info');
  };

  // Gatekeeper: Render Login Portal strictly first before accessing dashboard
  if (!isAuthenticated) {
    return (
      <>
        <LoginPortal
          pengaturan={pengaturan}
          cloudStatus={cloudStatus}
          onLoginSuccess={handleLoginSuccess}
          onShowToast={showToast}
        />
        <Toast toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col selection:bg-indigo-600 selection:text-white">
      
      {/* Sidebar Component */}
      <Sidebar
        activeModule={activeModule}
        setActiveModule={setActiveModule}
        pengaturan={pengaturan}
        isOpenMobile={isOpenMobile}
        setIsOpenMobile={setIsOpenMobile}
        onLogout={handleLogout}
      />

      {/* Main Content Area (offset by sidebar width on desktop) */}
      <div className="flex-1 flex flex-col lg:pl-72">
        
        {/* Top Header Bar */}
        <header className="no-print sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsOpenMobile(true)}
              className="lg:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 focus:ring-2 focus:ring-indigo-500"
              title="Buka Navigasi"
            >
              <i className="fa-solid fa-bars text-lg"></i>
            </button>

            <div>
              <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>{pengaturan.namaLembaga}</span>
                <span className="text-slate-300 font-normal">|</span>
                <span className="text-xs font-semibold text-slate-500 hidden sm:inline">
                  {activeModule === 'dashboard' && 'Dashboard & KPI Operasional'}
                  {activeModule === 'siswa' && 'Manajemen Database Siswa'}
                  {activeModule === 'absensi' && 'Presensi & Kehadiran Digital'}
                  {activeModule === 'pembayaran' && 'Daftar Murid & Biaya Absensi Berjalan'}
                  {activeModule === 'kartu' && 'Rekap Presensi & Kartu Tagihan (1/4 A4)'}
                  {activeModule === 'kas' && 'Pembukuan Kas Keluar Masuk'}
                  {activeModule === 'pl' && 'Laporan Laba Rugi Tahunan (P&L)'}
                  {activeModule === 'pengaturan' && 'Pusat Kontrol & Profil'}
                </span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 text-xs">
            
            {/* Supabase Cloud Realtime Badge */}
            <button
              onClick={() => setActiveModule('pengaturan')}
              title="Status Database Cloud Supabase (Klik untuk Pengaturan)"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer text-[11px] font-bold"
            >
              {cloudStatus === 'connected' && (
                <div className="flex items-center gap-1.5 text-emerald-800 bg-emerald-50 border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                  <i className="fa-solid fa-cloud-check text-emerald-600"></i>
                  <span className="hidden md:inline">Cloud Terhubung (Hardcoded)</span>
                  <span className="md:hidden">Cloud ON</span>
                </div>
              )}
              {(cloudStatus === 'connecting' || cloudStatus === 'syncing') && (
                <div className="flex items-center gap-1.5 text-amber-800 bg-amber-50 border-amber-200">
                  <i className="fa-solid fa-circle-notch fa-spin text-amber-600"></i>
                  <span className="hidden md:inline">Sinkronisasi Cloud...</span>
                  <span className="md:hidden">Sync...</span>
                </div>
              )}
              {cloudStatus === 'offline' && (
                <div className="flex items-center gap-1.5 text-slate-600 bg-slate-100 border-slate-200">
                  <i className="fa-solid fa-plug-circle-xmark text-slate-400"></i>
                  <span className="hidden md:inline">Cloud Belum Terhubung</span>
                  <span className="md:hidden">Setup Cloud</span>
                </div>
              )}
              {cloudStatus === 'error' && (
                <div className="flex items-center gap-1.5 text-rose-800 bg-rose-50 border-rose-200">
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                  <i className="fa-solid fa-triangle-exclamation text-rose-600"></i>
                  <span className="hidden md:inline">Cloud Error</span>
                  <span className="md:hidden">Error</span>
                </div>
              )}
            </button>

            <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 font-medium">
              <i className="fa-solid fa-calendar-day text-indigo-600"></i>
              <span>{formatIndonesianDate(getTodayDateString())}</span>
            </div>

            <div className="px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold flex items-center gap-1.5">
              <i className="fa-solid fa-user-check text-xs"></i>
              <span>{students.filter((s) => s.status === 'Aktif').length} Siswa</span>
            </div>

            {/* User Session & Logout Button */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-slate-700 hover:text-rose-700 font-bold transition-all cursor-pointer text-xs"
              title="Kunci / Keluar dari Dashboard"
            >
              <i className="fa-solid fa-lock text-slate-400 group-hover:text-rose-500"></i>
              <span className="hidden sm:inline">Kunci Portal</span>
            </button>
          </div>
        </header>

        {/* Global Banner if Cloud is not configured */}
        {cloudStatus === 'offline' && activeModule !== 'pengaturan' && (
          <div className="no-print bg-amber-500 text-white px-4 py-2.5 text-xs font-semibold flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <i className="fa-solid fa-triangle-exclamation text-amber-200 text-sm"></i>
              <span>
                <strong>Mode Cloud Belum Aktif:</strong> Masukkan <strong>Supabase URL</strong> dan <strong>Anon Key</strong> di Menu Pengaturan agar seluruh data tersimpan di Cloud & tersinkronisasi realtime multi-perangkat.
              </span>
            </div>
            <button
              onClick={() => setActiveModule('pengaturan')}
              className="px-3 py-1 bg-white text-amber-900 rounded-lg font-bold hover:bg-amber-50 transition-colors cursor-pointer text-[11px]"
            >
              Atur Sekarang →
            </button>
          </div>
        )}

        {/* View Router */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {activeModule === 'dashboard' && (
            <DashboardView
              students={students}
              absensi={absensi}
              kas={kas}
              pengaturan={pengaturan}
              onNavigate={setActiveModule}
            />
          )}

          {activeModule === 'siswa' && (
            <SiswaView
              students={students}
              onSaveStudents={handleSaveStudents}
              pengaturan={pengaturan}
              onShowToast={showToast}
            />
          )}

          {activeModule === 'absensi' && (
            <AbsensiView
              students={students}
              absensi={absensi}
              onSaveAbsensi={handleSaveAbsensi}
              pengaturan={pengaturan}
              onShowToast={showToast}
            />
          )}

          {activeModule === 'pembayaran' && (
            <BiayaAbsensiView
              students={students}
              absensi={absensi}
              kas={kas}
              onSaveKas={handleSaveKas}
              pengaturan={pengaturan}
              onShowToast={showToast}
            />
          )}

          {activeModule === 'kartu' && (
            <KartuPresensiView
              students={students}
              absensi={absensi}
              kas={kas}
              pengaturan={pengaturan}
              onShowToast={showToast}
            />
          )}

          {activeModule === 'kas' && (
            <KasView
              kas={kas}
              onSaveKas={handleSaveKas}
              students={students}
              pengaturan={pengaturan}
              onShowToast={showToast}
            />
          )}

          {activeModule === 'pl' && (
            <ProfitLossView
              kas={kas}
              pengaturan={pengaturan}
              onShowToast={showToast}
            />
          )}

          {activeModule === 'pengaturan' && (
            <PengaturanView
              pengaturan={pengaturan}
              students={students}
              absensi={absensi}
              kas={kas}
              onSavePengaturan={handleSavePengaturan}
              onResetAllData={handleResetAllData}
              onShowToast={showToast}
              cloudStatus={cloudStatus}
              onRefreshCloudData={handleRefreshCloudData}
              onUploadAllToCloud={handleUploadAllToCloud}
              onSeedInitialData={handleSeedInitialData}
              onSupabaseConfigChange={() => initCloudFirstData(false)}
            />
          )}
        </main>

        {/* Footer */}
        <footer className="no-print bg-white border-t border-slate-200 py-4 px-6 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© {new Date().getFullYear()} {pengaturan.namaLembaga}. {pengaturan.tagline}.</p>
          <div className="flex items-center gap-3 text-[11px] text-slate-400">
            <span>Pimpinan: {pengaturan.pimpinan}</span>
            <span>•</span>
            <span>Supabase Cloud-First Realtime Storage</span>
          </div>
        </footer>

      </div>

      {/* Floating Toast Notification System */}
      <Toast toasts={toasts} onDismiss={dismissToast} />

    </div>
  );
}
