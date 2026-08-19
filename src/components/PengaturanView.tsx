import React, { useState, useEffect } from 'react';
import { ConfirmModalState, PengaturanBimbel, CloudSyncStatus, Student, AbsensiRecord, TransaksiKas } from '../types';
import { ConfirmModal } from './ConfirmModal';
import {
  getSupabaseConfig,
  saveSupabaseConfig,
  testSupabaseConnection,
  SupabaseConfig,
  SUPABASE_SQL_SETUP_SCRIPT,
} from '../utils/supabaseClient';

interface PengaturanViewProps {
  pengaturan: PengaturanBimbel;
  students: Student[];
  absensi: AbsensiRecord[];
  kas: TransaksiKas[];
  onSavePengaturan: (pengaturan: PengaturanBimbel) => void;
  onResetAllData: () => void;
  onShowToast: (text: string, type?: 'success' | 'info' | 'error' | 'warning') => void;
  cloudStatus?: CloudSyncStatus;
  onRefreshCloudData?: () => Promise<void>;
  onUploadAllToCloud?: () => Promise<void>;
  onSeedInitialData?: () => Promise<void>;
  onSupabaseConfigChange?: () => void;
}

export const PengaturanView: React.FC<PengaturanViewProps> = ({
  pengaturan,
  students,
  absensi,
  kas,
  onSavePengaturan,
  onResetAllData,
  onShowToast,
  cloudStatus = 'offline',
  onRefreshCloudData,
  onUploadAllToCloud,
  onSeedInitialData,
  onSupabaseConfigChange,
}) => {
  const [formData, setFormData] = useState<PengaturanBimbel>({ ...pengaturan });

  // Supabase Configuration State (URL & Anon Key disimpan di LocalStorage)
  const [supabaseConfig, setSupabaseConfig] = useState<SupabaseConfig>(getSupabaseConfig());
  const [showAnonKey, setShowAnonKey] = useState<boolean>(false);
  const [isTestingConn, setIsTestingConn] = useState<boolean>(false);
  const [isSyncingCloud, setIsSyncingCloud] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showSqlGuide, setShowSqlGuide] = useState<boolean>(false);

  // Warning Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Add Item State
  const [newTutor, setNewTutor] = useState('');
  const [newKatMasuk, setNewKatMasuk] = useState('');
  const [newKatKeluar, setNewKatKeluar] = useState('');

  // Keep local form in sync if parent pengaturan changes via realtime
  useEffect(() => {
    setFormData({ ...pengaturan });
  }, [pengaturan]);

  // Handle Profile Change
  const handleChange = (field: keyof PengaturanBimbel, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Submit Profile Form
  const handleSubmitProfile = (e: React.FormEvent) => {
    e.preventDefault();
    onSavePengaturan(formData);
    onShowToast('Profil Lembaga Bimbel Sigma berhasil disimpan ke Supabase Cloud!', 'success');
  };

  // Handle Supabase Config Save
  const handleSaveSupabaseSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (supabaseConfig.isEnabled && (!supabaseConfig.url || !supabaseConfig.anonKey)) {
      onShowToast('Supabase URL dan Anon Key wajib diisi jika sinkronisasi cloud diaktifkan!', 'warning');
      return;
    }

    saveSupabaseConfig(supabaseConfig);
    onShowToast('Konfigurasi database cloud Supabase berhasil disimpan!', 'success');
    if (onSupabaseConfigChange) {
      onSupabaseConfigChange();
    }
  };

  // Test Supabase Connection
  const handleTestConnection = async () => {
    if (!supabaseConfig.url || !supabaseConfig.anonKey) {
      onShowToast('Harap isi Supabase URL dan Anon Key terlebih dahulu.', 'warning');
      return;
    }

    setIsTestingConn(true);
    setTestResult(null);

    const result = await testSupabaseConnection(supabaseConfig.url, supabaseConfig.anonKey);
    setIsTestingConn(false);
    setTestResult(result);

    if (result.success) {
      onShowToast(result.message, 'success');
    } else {
      onShowToast(result.message, 'error');
    }
  };

  // Upload Current State Data to Cloud
  const handleUploadToCloud = async () => {
    if (!onUploadAllToCloud) return;
    setIsSyncingCloud(true);
    await onUploadAllToCloud();
    setIsSyncingCloud(false);
  };

  // Pull Data from Cloud (SELECT *)
  const handlePullFromCloud = async () => {
    if (!onRefreshCloudData) return;
    setIsSyncingCloud(true);
    await onRefreshCloudData();
    setIsSyncingCloud(false);
  };

  // Seed Initial Demo Template to Cloud
  const handleSeedCloud = async () => {
    if (!onSeedInitialData) return;
    setIsSyncingCloud(true);
    await onSeedInitialData();
    setIsSyncingCloud(false);
  };

  // Copy SQL Setup Code to Clipboard
  const handleCopySqlScript = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SETUP_SCRIPT);
    onShowToast('Skrip SQL Database Supabase berhasil disalin ke clipboard!', 'success');
  };

  // Tutor Management with Warning Confirmation
  const handleAddTutor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTutor.trim()) return;
    const updated = [...formData.daftarTutor, newTutor.trim()];
    const newPengaturan = { ...formData, daftarTutor: updated };
    setFormData(newPengaturan);
    onSavePengaturan(newPengaturan);
    setNewTutor('');
    onShowToast(`Tutor "${newTutor}" berhasil ditambahkan!`, 'success');
  };

  const handleRequestRemoveTutor = (index: number) => {
    const target = formData.daftarTutor[index];
    setConfirmModal({
      isOpen: true,
      title: 'Konfirmasi Hapus Tutor Pembina',
      message: `PERINGATAN:\nApakah Anda yakin ingin menghapus "${target}" dari daftar tutor pembina Bimbel Sigma?`,
      confirmLabel: 'Ya, Hapus Tutor',
      isDanger: true,
      onConfirm: () => {
        const updated = formData.daftarTutor.filter((_, i) => i !== index);
        const newPengaturan = { ...formData, daftarTutor: updated };
        setFormData(newPengaturan);
        onSavePengaturan(newPengaturan);
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        onShowToast(`Tutor "${target}" dihapus.`, 'info');
      },
    });
  };

  // Kategori Masuk Management with Warning Confirmation
  const handleAddKatMasuk = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKatMasuk.trim()) return;
    const updated = [...formData.kategoriMasuk, newKatMasuk.trim()];
    const newPengaturan = { ...formData, kategoriMasuk: updated };
    setFormData(newPengaturan);
    onSavePengaturan(newPengaturan);
    setNewKatMasuk('');
    onShowToast(`Kategori kas masuk "${newKatMasuk}" ditambahkan!`, 'success');
  };

  const handleRequestRemoveKatMasuk = (index: number) => {
    const target = formData.kategoriMasuk[index];
    setConfirmModal({
      isOpen: true,
      title: 'Konfirmasi Hapus Kategori Kas Masuk',
      message: `PERINGATAN:\nApakah Anda yakin ingin menghapus kategori "${target}"?`,
      confirmLabel: 'Ya, Hapus Kategori',
      isDanger: true,
      onConfirm: () => {
        const updated = formData.kategoriMasuk.filter((_, i) => i !== index);
        const newPengaturan = { ...formData, kategoriMasuk: updated };
        setFormData(newPengaturan);
        onSavePengaturan(newPengaturan);
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        onShowToast(`Kategori "${target}" dihapus.`, 'info');
      },
    });
  };

  // Kategori Keluar Management with Warning Confirmation
  const handleAddKatKeluar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKatKeluar.trim()) return;
    const updated = [...formData.kategoriKeluar, newKatKeluar.trim()];
    const newPengaturan = { ...formData, kategoriKeluar: updated };
    setFormData(newPengaturan);
    onSavePengaturan(newPengaturan);
    setNewKatKeluar('');
    onShowToast(`Kategori kas keluar "${newKatKeluar}" ditambahkan!`, 'success');
  };

  const handleRequestRemoveKatKeluar = (index: number) => {
    const target = formData.kategoriKeluar[index];
    setConfirmModal({
      isOpen: true,
      title: 'Konfirmasi Hapus Kategori Kas Keluar',
      message: `PERINGATAN:\nApakah Anda yakin ingin menghapus kategori "${target}"?`,
      confirmLabel: 'Ya, Hapus Kategori',
      isDanger: true,
      onConfirm: () => {
        const updated = formData.kategoriKeluar.filter((_, i) => i !== index);
        const newPengaturan = { ...formData, kategoriKeluar: updated };
        setFormData(newPengaturan);
        onSavePengaturan(newPengaturan);
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        onShowToast(`Kategori "${target}" dihapus.`, 'info');
      },
    });
  };

  // Export JSON Database Backup from Live Cloud/State Data
  const handleExportBackup = () => {
    const backupData = {
      siswa: students,
      absensi: absensi,
      kas: kas,
      pengaturan: formData,
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Backup_Database_Bimbel_Sigma_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onShowToast('File cadangan database JSON berhasil diunduh!', 'success');
  };

  // Reset to Factory Defaults with Warning Modal
  const handleRequestResetData = () => {
    setConfirmModal({
      isOpen: true,
      title: 'PERINGATAN KERAS: Reset Database ke Demo',
      message: 'PERINGATAN:\nApakah Anda yakin ingin mengembalikan seluruh database ke data demo awal BIMBEL SIGMA di Supabase Cloud?\n\nSemua perubahan data siswa, absensi, pembayaran tagihan, dan kas yang Anda buat akan ditimpa dengan data bawaan pabrik.',
      confirmLabel: 'Ya, Reset Seluruh Data Sekarang',
      isDanger: true,
      onConfirm: async () => {
        onResetAllData();
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        onShowToast('Data sistem telah direset ke setelan awal.', 'info');
      },
    });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
            <i className="fa-solid fa-sliders"></i>
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Pusat Kontrol & Pengaturan Bimbel Sigma</h2>
            <p className="text-xs text-slate-500">
              Integrasi Cloud Database Supabase Realtime, profil lembaga, tutor pembina, kategori kas, dan cadangan data
            </p>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CLOUD DATABASE SUPABASE INTEGRATION CARD */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border-2 border-emerald-500/40 p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-base">
              <i className="fa-solid fa-cloud-bolt"></i>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">Database Cloud Supabase (Penyimpanan Utama)</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Cloud-First Realtime
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Penyimpanan cloud tersentralisasi dengan sinkronisasi instan multi-perangkat (Laptop, Tablet, HP) tanpa refresh.
              </p>
            </div>
          </div>

          {/* Status Badge */}
          <div className="flex items-center gap-2">
            {cloudStatus === 'connected' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                <i className="fa-solid fa-cloud-check text-xs text-emerald-600"></i>
                Terhubung ke Cloud (Hardcoded)
              </span>
            )}
            {cloudStatus === 'syncing' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                <i className="fa-solid fa-rotate fa-spin text-xs"></i>
                Sinkronisasi Realtime...
              </span>
            )}
            {cloudStatus === 'connecting' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                <i className="fa-solid fa-circle-notch fa-spin text-xs"></i>
                Menghubungkan ke Cloud...
              </span>
            )}
            {cloudStatus === 'offline' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                <i className="fa-solid fa-plug-circle-xmark text-xs"></i>
                Offline
              </span>
            )}
            {cloudStatus === 'error' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                <i className="fa-solid fa-triangle-exclamation text-xs"></i>
                Koneksi Cloud Terputus
              </span>
            )}
          </div>
        </div>

        {/* Configuration Form */}
        <form onSubmit={handleSaveSupabaseSettings} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Supabase URL */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                <span>Supabase Project URL <span className="text-rose-500">*</span></span>
                <a
                  href="https://supabase.com/dashboard"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                >
                  Buka Supabase <i className="fa-solid fa-arrow-up-right-from-square text-[9px]"></i>
                </a>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <i className="fa-solid fa-link text-xs"></i>
                </div>
                <input
                  type="url"
                  placeholder="https://xyzabcdefghijklmnop.supabase.co"
                  value={supabaseConfig.url}
                  onChange={(e) => setSupabaseConfig({ ...supabaseConfig, url: e.target.value })}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono text-slate-800"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Ditemukan di Supabase: <strong>Project Settings → API → Project URL</strong>
              </p>
            </div>

            {/* Supabase Anon Public Key */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                <span>Supabase Anon Key (Public API Key) <span className="text-rose-500">*</span></span>
                <span className="text-[10px] text-slate-400 font-normal">Aman digunakan di browser</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <i className="fa-solid fa-key text-xs"></i>
                </div>
                <input
                  type={showAnonKey ? 'text' : 'password'}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  value={supabaseConfig.anonKey}
                  onChange={(e) => setSupabaseConfig({ ...supabaseConfig, anonKey: e.target.value })}
                  className="w-full pl-9 pr-10 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono text-slate-800"
                />
                <button
                  type="button"
                  onClick={() => setShowAnonKey(!showAnonKey)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                >
                  <i className={`fa-solid ${showAnonKey ? 'fa-eye-slash' : 'fa-eye'} text-xs`}></i>
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Ditemukan di Supabase: <strong>Project Settings → API → anon public key</strong>
              </p>
            </div>

          </div>

          {/* Toggle Enable Cloud Sync */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/60 border border-emerald-100">
            <div className="flex items-center gap-2.5">
              <input
                type="checkbox"
                id="enableCloudSync"
                checked={supabaseConfig.isEnabled}
                onChange={(e) => setSupabaseConfig({ ...supabaseConfig, isEnabled: e.target.checked })}
                className="w-4 h-4 text-emerald-600 rounded-md border-slate-300 focus:ring-emerald-500"
              />
              <label htmlFor="enableCloudSync" className="text-xs font-bold text-slate-800 cursor-pointer">
                Aktifkan Sinkronisasi Database Cloud Supabase Realtime
              </label>
            </div>
            <span className="text-[11px] font-medium text-emerald-800 hidden sm:inline">
              Otomatis sync perubahan data antar browser & HP
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-all flex items-center gap-2 cursor-pointer"
              >
                <i className="fa-solid fa-floppy-disk"></i>
                <span>Simpan Pengaturan Cloud</span>
              </button>

              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTestingConn}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-200 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <i className={`fa-solid ${isTestingConn ? 'fa-circle-notch fa-spin' : 'fa-network-wired'}`}></i>
                <span>{isTestingConn ? 'Menguji...' : 'Uji Koneksi (Test)'}</span>
              </button>
            </div>

            {/* Cloud Sync Manual Controls */}
            {supabaseConfig.isEnabled && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePullFromCloud}
                  disabled={isSyncingCloud}
                  title="Tarik seluruh data terbaru dari Supabase (SELECT *)"
                  className="px-3 py-2 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 font-bold text-xs border border-sky-200 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <i className={`fa-solid ${isSyncingCloud ? 'fa-circle-notch fa-spin' : 'fa-arrows-rotate'}`}></i>
                  <span>Tarik Data Cloud</span>
                </button>

                <button
                  type="button"
                  onClick={handleUploadToCloud}
                  disabled={isSyncingCloud}
                  title="Unggah seluruh data ke Cloud Supabase"
                  className="px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs border border-indigo-200 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <i className="fa-solid fa-cloud-arrow-up"></i>
                  <span>Upload ke Cloud</span>
                </button>

                <button
                  type="button"
                  onClick={handleSeedCloud}
                  disabled={isSyncingCloud}
                  title="Inisialisasi Data Demo ke Cloud Supabase"
                  className="px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs border border-amber-200 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <i className="fa-solid fa-wand-magic-sparkles"></i>
                  <span>Isi Data Demo</span>
                </button>
              </div>
            )}
          </div>
        </form>

        {/* Test Result Box */}
        {testResult && (
          <div
            className={`p-3 rounded-xl text-xs flex items-start gap-2.5 ${
              testResult.success
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            <i className={`fa-solid ${testResult.success ? 'fa-circle-check text-emerald-600' : 'fa-circle-xmark text-rose-600'} text-base mt-0.5`}></i>
            <div className="flex-1">
              <p className="font-bold">{testResult.success ? 'Koneksi Berhasil!' : 'Koneksi Gagal!'}</p>
              <p className="text-[11px] mt-0.5">{testResult.message}</p>
            </div>
          </div>
        )}

        {/* SQL Script Accordion Guide */}
        <div className="pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setShowSqlGuide(!showSqlGuide)}
            className="w-full flex items-center justify-between text-xs font-bold text-slate-700 hover:text-indigo-600 py-1"
          >
            <span className="flex items-center gap-2">
              <i className="fa-solid fa-terminal text-slate-400"></i>
              <span>Panduan Skrip SQL Database Supabase (Jalankan 1x di SQL Editor)</span>
            </span>
            <i className={`fa-solid ${showSqlGuide ? 'fa-chevron-up' : 'fa-chevron-down'} text-slate-400`}></i>
          </button>

          {showSqlGuide && (
            <div className="mt-3 p-4 rounded-xl bg-slate-900 text-slate-100 text-xs space-y-3 font-mono">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400 text-[11px]">Skrip SQL Pembuatan Tabel & Realtime</span>
                <button
                  type="button"
                  onClick={handleCopySqlScript}
                  className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-sans font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <i className="fa-solid fa-copy"></i>
                  <span>Salin Skrip SQL</span>
                </button>
              </div>

              <div className="max-h-60 overflow-y-auto pr-2 text-[11px] text-emerald-400 space-y-1 select-all whitespace-pre-wrap leading-relaxed">
                {SUPABASE_SQL_SETUP_SCRIPT}
              </div>

              <div className="bg-slate-800 p-2.5 rounded-lg text-[11px] text-slate-300 font-sans space-y-1">
                <p className="font-bold text-amber-400 flex items-center gap-1.5">
                  <i className="fa-solid fa-circle-info"></i>
                  Langkah-Langkah di Supabase:
                </p>
                <ol className="list-decimal list-inside space-y-0.5 text-slate-300">
                  <li>Buka proyek di <strong>supabase.com/dashboard</strong>.</li>
                  <li>Buka menu <strong>SQL Editor</strong> di sidebar kiri.</li>
                  <li>Klik <strong>New query</strong>, lalu paste skrip di atas dan klik tombol <strong>Run</strong>.</li>
                  <li>Selesai! Database siap menyimpan data dan sinkron secara realtime.</li>
                </ol>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* ========================================================================= */}
      {/* PROFIL LEMBAGA BIMBEL SIGMA FORM */}
      {/* ========================================================================= */}
      <form onSubmit={handleSubmitProfile} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
        <div className="border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <i className="fa-solid fa-building-columns text-indigo-600"></i>
            <span>Identitas & Profil Lembaga Bimbel</span>
          </h3>
          <p className="text-xs text-slate-500">
            Informasi ini digunakan pada kop surat, kartu presensi cetak 1/4 A4, kuitansi kas, dan laporan P&L tahunan.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Nama Lembaga / Bimbel <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.namaLembaga}
              onChange={(e) => handleChange('namaLembaga', e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Slogan / Tagline
            </label>
            <input
              type="text"
              value={formData.tagline}
              onChange={(e) => handleChange('tagline', e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Nama Pimpinan / Direktur Bimbel <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.pimpinan}
              onChange={(e) => handleChange('pimpinan', e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Nomor Induk Kependudukan (NIK) Pimpinan
            </label>
            <input
              type="text"
              value={formData.nik}
              onChange={(e) => handleChange('nik', e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Kota Domisili Bimbel <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.kota}
              onChange={(e) => handleChange('kota', e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Kontak WhatsApp / Telepon Resmi
            </label>
            <input
              type="text"
              value={formData.kontak}
              onChange={(e) => handleChange('kontak', e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Email Resmi Lembaga
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Keamanan & Sandi Akses Portal */}
          <div className="md:col-span-2 p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-indigo-900 font-bold text-xs">
                <i className="fa-solid fa-shield-halved text-indigo-600 text-sm"></i>
                <span>Keamanan & PIN Akses Portal Pengelola</span>
              </div>
              <span className="text-[10px] bg-indigo-200/60 text-indigo-800 font-bold px-2 py-0.5 rounded-md">
                Proteksi Dashboard
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  PIN Akses Pengelola <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.adminPin || 'admin123'}
                  onChange={(e) => handleChange('adminPin', e.target.value)}
                  placeholder="Masukkan PIN baru..."
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 font-bold text-indigo-950"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Ubah PIN di sini lalu klik tombol Simpan di bawah untuk memperbarui sandi masuk.
                </p>
              </div>

              <div className="p-3 bg-white/80 rounded-xl border border-indigo-100 text-xs flex flex-col justify-center space-y-1">
                <span className="font-bold text-slate-800 flex items-center gap-1.5 text-[11px]">
                  <i className="fa-solid fa-envelope text-indigo-600"></i>
                  <span>Akses Login Email Cadangan:</span>
                </span>
                <p className="text-[11px] font-mono text-indigo-900 font-bold">
                  dickyrians22@gmail.com
                </p>
                <p className="text-[10px] text-slate-500">
                  Dapat digunakan untuk masuk langsung via tab "Email Admin" di halaman portal.
                </p>
              </div>
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Alamat Lengkap Kantor Bimbel
            </label>
            <textarea
              rows={2}
              value={formData.alamat}
              onChange={(e) => handleChange('alamat', e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="flex justify-end pt-3 border-t border-slate-100">
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition-all flex items-center gap-2 cursor-pointer"
          >
            <i className="fa-solid fa-floppy-disk"></i>
            <span>Simpan Profil Lembaga</span>
          </button>
        </div>
      </form>

      {/* ========================================================================= */}
      {/* DAFTAR TUTOR & KATEGORI KAS */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Tutor Pembina */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-bold text-slate-900 mb-1 flex items-center gap-2">
              <i className="fa-solid fa-chalkboard-user text-indigo-600"></i>
              <span>Daftar Tutor Pembina ({formData.daftarTutor.length})</span>
            </h4>
            <p className="text-[11px] text-slate-500 mb-3">Pilihan tutor saat input data siswa dan presensi.</p>

            <ul className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {formData.daftarTutor.map((t, idx) => (
                <li key={idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 text-xs text-slate-700 border border-slate-100">
                  <span className="truncate pr-2">{t}</span>
                  <button
                    type="button"
                    onClick={() => handleRequestRemoveTutor(idx)}
                    className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                    title="Hapus Tutor"
                  >
                    <i className="fa-solid fa-trash text-xs"></i>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <form onSubmit={handleAddTutor} className="mt-4 pt-3 border-t border-slate-100 flex gap-2">
            <input
              type="text"
              placeholder="Nama tutor baru..."
              value={newTutor}
              onChange={(e) => setNewTutor(e.target.value)}
              className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs"
            >
              + Tambah
            </button>
          </form>
        </div>

        {/* Kategori Kas Masuk */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-bold text-emerald-800 mb-1 flex items-center gap-2">
              <i className="fa-solid fa-arrow-down-left-and-arrow-up-right-to-center text-emerald-600"></i>
              <span>Kategori Kas Masuk ({formData.kategoriMasuk.length})</span>
            </h4>
            <p className="text-[11px] text-slate-500 mb-3">Kategori penerimaan dana di pembukuan kas.</p>

            <ul className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {formData.kategoriMasuk.map((k, idx) => (
                <li key={idx} className="flex items-center justify-between p-2 rounded-lg bg-emerald-50/50 text-xs text-slate-700 border border-emerald-100">
                  <span className="truncate pr-2">{k}</span>
                  {k !== 'SPP Les Bulanan' && (
                    <button
                      type="button"
                      onClick={() => handleRequestRemoveKatMasuk(idx)}
                      className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                      title="Hapus Kategori"
                    >
                      <i className="fa-solid fa-trash text-xs"></i>
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <form onSubmit={handleAddKatMasuk} className="mt-4 pt-3 border-t border-slate-100 flex gap-2">
            <input
              type="text"
              placeholder="Kategori masuk baru..."
              value={newKatMasuk}
              onChange={(e) => setNewKatMasuk(e.target.value)}
              className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500"
            />
            <button
              type="submit"
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
            >
              + Tambah
            </button>
          </form>
        </div>

        {/* Kategori Kas Keluar */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-bold text-rose-800 mb-1 flex items-center gap-2">
              <i className="fa-solid fa-arrow-trend-down text-rose-600"></i>
              <span>Kategori Kas Keluar ({formData.kategoriKeluar.length})</span>
            </h4>
            <p className="text-[11px] text-slate-500 mb-3">Kategori beban biaya operasional bimbel.</p>

            <ul className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {formData.kategoriKeluar.map((k, idx) => (
                <li key={idx} className="flex items-center justify-between p-2 rounded-lg bg-rose-50/50 text-xs text-slate-700 border border-rose-100">
                  <span className="truncate pr-2">{k}</span>
                  <button
                    type="button"
                    onClick={() => handleRequestRemoveKatKeluar(idx)}
                    className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                    title="Hapus Kategori"
                  >
                    <i className="fa-solid fa-trash text-xs"></i>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <form onSubmit={handleAddKatKeluar} className="mt-4 pt-3 border-t border-slate-100 flex gap-2">
            <input
              type="text"
              placeholder="Kategori keluar baru..."
              value={newKatKeluar}
              onChange={(e) => setNewKatKeluar(e.target.value)}
              className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-rose-500"
            />
            <button
              type="submit"
              className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs"
            >
              + Tambah
            </button>
          </form>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* CADANGAN & PEMELIHARAAN DATA (BACKUP / FACTORY RESET) */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <i className="fa-solid fa-database text-indigo-600"></i>
            <span>Cadangan & Pemeliharaan Database</span>
          </h3>
          <p className="text-xs text-slate-500">
            Ekspor data cadangan JSON lokal atau kembalikan setelan data demo awal BIMBEL SIGMA.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleExportBackup}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs border border-slate-200 transition-all flex items-center gap-2 cursor-pointer"
            >
              <i className="fa-solid fa-download text-indigo-600"></i>
              <span>Unduh Cadangan JSON</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleRequestResetData}
            className="px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 transition-all flex items-center gap-2 cursor-pointer"
          >
            <i className="fa-solid fa-rotate-left"></i>
            <span>Kembalikan ke Data Demo Awal</span>
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmLabel={confirmModal.confirmLabel}
        isDanger={confirmModal.isDanger}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />

    </div>
  );
};
