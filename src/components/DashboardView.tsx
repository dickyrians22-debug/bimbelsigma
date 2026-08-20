import React from 'react';
import { AbsensiRecord, PengaturanBimbel, Student, TransaksiKas } from '../types';
import { 
  DAFTAR_TINGKAT_SEKOLAH, 
  formatIndonesianDate, 
  formatMonthYear, 
  formatRupiah, 
  getTingkatBadgeClass, 
  getTodayDateString 
} from '../utils/helpers';
import { ActiveModule } from './Sidebar';

interface DashboardViewProps {
  students: Student[];
  absensi: AbsensiRecord[];
  kas: TransaksiKas[];
  pengaturan: PengaturanBimbel;
  onNavigate: (module: ActiveModule) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  students,
  absensi,
  kas,
  pengaturan,
  onNavigate,
}) => {
  const today = getTodayDateString();
  const currentYear = new Date().getFullYear();
  const currentMonthIdx = new Date().getMonth();
  const currentMonthPrefix = `${currentYear}-${String(currentMonthIdx + 1).padStart(2, '0')}`;

  // 1. KPI Siswa Aktif
  const totalSiswaAktif = students.filter((s) => s.status === 'Aktif').length;
  const totalSiswaNonAktif = students.filter((s) => s.status === 'Non-Aktif').length;

  // 2. KPI Keuangan Bulan Ini
  const kasBulanIni = kas.filter((k) => k.tanggal.startsWith(currentMonthPrefix));
  const totalPemasukanBulanIni = kasBulanIni
    .filter((k) => k.jenis === 'Masuk')
    .reduce((sum, item) => sum + (item.nominal || 0), 0);

  const totalPengeluaranBulanIni = kasBulanIni
    .filter((k) => k.jenis === 'Keluar')
    .reduce((sum, item) => sum + (item.nominal || 0), 0);

  const netProfitBulanIni = totalPemasukanBulanIni - totalPengeluaranBulanIni;

  // Absensi Hari Ini
  const absensiHariIni = absensi.filter((a) => a.tanggal === today);
  const hadirHariIni = absensiHariIni.filter((a) => a.status === 'Hadir').length;

  // Recent 5 Kas
  const recentKas = [...kas].sort((a, b) => b.tanggal.localeCompare(a.tanggal)).slice(0, 5);

  // Recent 5 Absensi
  const recentAbsensi = [...absensi].sort((a, b) => b.tanggal.localeCompare(a.tanggal)).slice(0, 5);

  // Breakdown Tingkat
  const distributionTingkat = DAFTAR_TINGKAT_SEKOLAH.map((item) => ({
    ...item,
    count: students.filter((s) => s.tingkat === item.value && s.status === 'Aktif').length,
  }));

  const countPrivat = students.filter((s) => s.jenisKelas === 'Privat' && s.status === 'Aktif').length;
  const countGrup = students.filter((s) => s.jenisKelas === 'Grup' && s.status === 'Aktif').length;

  return (
    <div className="space-y-6">
      
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-bold uppercase tracking-wider">
            <i className="fa-solid fa-sparkles text-amber-400"></i> Panel Utama Pengelola
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Selamat Datang di {pengaturan.namaLembaga}
          </h2>
          <p className="text-indigo-200 text-sm font-medium italic">
            "{pengaturan.tagline}"
          </p>
          <div className="pt-2 text-xs text-indigo-300/80 flex flex-wrap items-center gap-4">
            <span><i className="fa-solid fa-calendar-day mr-1.5 text-indigo-400"></i> {formatIndonesianDate(today)}</span>
            <span>•</span>
            <span><i className="fa-solid fa-location-dot mr-1.5 text-indigo-400"></i> {pengaturan.alamat}</span>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1: Siswa Aktif */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between space-y-3 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Siswa Aktif
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm">
              <i className="fa-solid fa-users"></i>
            </div>
          </div>
          <div>
            <div className="text-3xl font-black text-slate-900 tracking-tight">
              {totalSiswaAktif} <span className="text-sm font-semibold text-slate-400">Siswa</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
              <span>Non-Aktif: {totalSiswaNonAktif}</span>
              <button
                onClick={() => onNavigate('siswa')}
                className="text-blue-600 font-bold hover:underline"
              >
                Lihat Siswa →
              </button>
            </div>
          </div>
        </div>

        {/* KPI 2: Pemasukan Bulan Ini */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between space-y-3 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Pemasukan ({formatMonthYear(currentYear, currentMonthIdx).split(' ')[0]})
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm">
              <i className="fa-solid fa-arrow-down-left"></i>
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-700 tracking-tight">
              {formatRupiah(totalPemasukanBulanIni)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
              <span>{kasBulanIni.filter(k => k.jenis === 'Masuk').length} Transaksi</span>
              <button
                onClick={() => onNavigate('kas')}
                className="text-emerald-600 font-bold hover:underline"
              >
                Detail Kas →
              </button>
            </div>
          </div>
        </div>

        {/* KPI 3: Pengeluaran Bulan Ini */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between space-y-3 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Pengeluaran ({formatMonthYear(currentYear, currentMonthIdx).split(' ')[0]})
            </span>
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-sm">
              <i className="fa-solid fa-arrow-up-right"></i>
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-rose-700 tracking-tight">
              {formatRupiah(totalPengeluaranBulanIni)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
              <span>{kasBulanIni.filter(k => k.jenis === 'Keluar').length} Transaksi</span>
              <button
                onClick={() => onNavigate('kas')}
                className="text-rose-600 font-bold hover:underline"
              >
                Detail Kas →
              </button>
            </div>
          </div>
        </div>

        {/* KPI 4: Net Profit / Laba Bersih */}
        <div className={`rounded-2xl border p-5 shadow-xs flex flex-col justify-between space-y-3 hover:shadow-md transition-shadow ${
          netProfitBulanIni >= 0 ? 'bg-indigo-900 text-white border-indigo-800' : 'bg-rose-900 text-white border-rose-800'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-200 uppercase tracking-wider">
              Laba Bersih (Net Profit)
            </span>
            <div className="w-9 h-9 rounded-xl bg-white/10 text-indigo-200 flex items-center justify-center font-bold text-sm">
              <i className="fa-solid fa-chart-line"></i>
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black tracking-tight">
              {formatRupiah(netProfitBulanIni)}
            </div>
            <div className="text-[11px] text-indigo-200/80 mt-1 flex items-center justify-between">
              <span>{netProfitBulanIni >= 0 ? '✓ Surplus / Laba' : '⚠️ Defisit / Rugi'}</span>
              <button
                onClick={() => onNavigate('pl')}
                className="text-amber-300 font-bold hover:underline"
              >
                Laporan P&L →
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Action Buttons */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
          Akses Cepat Operasional
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <button
            onClick={() => onNavigate('absensi')}
            className="p-3.5 rounded-xl border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/50 flex items-center gap-3 text-left transition-all group cursor-pointer"
          >
            <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm group-hover:scale-110 transition-transform">
              <i className="fa-solid fa-clipboard-user"></i>
            </div>
            <div>
              <div className="text-xs font-bold text-slate-800">Presensi Siswa</div>
              <div className="text-[10px] text-slate-500">Input kehadiran</div>
            </div>
          </button>

          <button
            onClick={() => onNavigate('pembayaran')}
            className="p-3.5 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 flex items-center gap-3 text-left transition-all group cursor-pointer"
          >
            <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm group-hover:scale-110 transition-transform">
              <i className="fa-solid fa-file-invoice-dollar"></i>
            </div>
            <div>
              <div className="text-xs font-bold text-slate-800">Biaya Absensi</div>
              <div className="text-[10px] text-slate-500">Status Lunas Siswa</div>
            </div>
          </button>

          <button
            onClick={() => onNavigate('gaji-tutor')}
            className="p-3.5 rounded-xl border border-slate-200 hover:border-amber-500 hover:bg-amber-50/50 flex items-center gap-3 text-left transition-all group cursor-pointer"
          >
            <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-sm group-hover:scale-110 transition-transform">
              <i className="fa-solid fa-chalkboard-user"></i>
            </div>
            <div>
              <div className="text-xs font-bold text-slate-800">Gaji Tutor</div>
              <div className="text-[10px] text-slate-500">Grup & Privat → Kas</div>
            </div>
          </button>

          <button
            onClick={() => onNavigate('kartu')}
            className="p-3.5 rounded-xl border border-slate-200 hover:border-purple-500 hover:bg-purple-50/50 flex items-center gap-3 text-left transition-all group cursor-pointer"
          >
            <div className="w-9 h-9 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-sm group-hover:scale-110 transition-transform">
              <i className="fa-solid fa-print"></i>
            </div>
            <div>
              <div className="text-xs font-bold text-slate-800">Cetak Rekap</div>
              <div className="text-[10px] text-slate-500">Lembar & Kartu</div>
            </div>
          </button>

          <button
            onClick={() => onNavigate('kas')}
            className="p-3.5 rounded-xl border border-slate-200 hover:border-rose-500 hover:bg-rose-50/50 flex items-center gap-3 text-left transition-all group cursor-pointer"
          >
            <div className="w-9 h-9 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-sm group-hover:scale-110 transition-transform">
              <i className="fa-solid fa-wallet"></i>
            </div>
            <div>
              <div className="text-xs font-bold text-slate-800">Buku Kas</div>
              <div className="text-[10px] text-slate-500">Masuk & Keluar</div>
            </div>
          </button>

          <button
            onClick={() => onNavigate('siswa')}
            className="p-3.5 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 flex items-center gap-3 text-left transition-all group cursor-pointer"
          >
            <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm group-hover:scale-110 transition-transform">
              <i className="fa-solid fa-users"></i>
            </div>
            <div>
              <div className="text-xs font-bold text-slate-800">Daftar Siswa</div>
              <div className="text-[10px] text-slate-500">Data & Wali Murid</div>
            </div>
          </button>
        </div>
      </div>

      {/* 2-Column Section: Student Demographics & Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: Demografi Siswa & Ringkasan Kelas */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <i className="fa-solid fa-graduation-cap text-indigo-600"></i>
              Distribusi Siswa Aktif
            </h3>
            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
              {totalSiswaAktif} Total
            </span>
          </div>

          <div className="space-y-3.5 text-xs">
            <div>
              <div className="flex items-center justify-between text-slate-500 font-bold text-[11px] mb-1.5">
                <span>Distribusi per Jenjang ({distributionTingkat.length} Kategori)</span>
                <span className="text-indigo-600">{totalSiswaAktif} Aktif</span>
              </div>
              
              {/* Stacked Progress Bar */}
              <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden flex shadow-inner">
                {distributionTingkat.map((item) => {
                  const pct = totalSiswaAktif ? (item.count / totalSiswaAktif) * 100 : 0;
                  if (pct <= 0) return null;
                  
                  let barColor = 'bg-slate-400';
                  if (item.value === 'PAUD') barColor = 'bg-pink-500';
                  if (item.value === 'TK') barColor = 'bg-amber-400';
                  if (item.value === 'SD') barColor = 'bg-emerald-500';
                  if (item.value === 'SMP') barColor = 'bg-blue-500';
                  if (item.value === 'SMA') barColor = 'bg-indigo-600';
                  if (item.value === 'Mahasiswa') barColor = 'bg-purple-600';
                  if (item.value === 'Umum') barColor = 'bg-teal-600';

                  return (
                    <div
                      key={item.value}
                      style={{ width: `${pct}%` }}
                      className={`${barColor} h-full transition-all`}
                      title={`${item.label}: ${item.count} siswa (${Math.round(pct)}%)`}
                    />
                  );
                })}
              </div>

              {/* Grid Jenjang Chips */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 pt-3">
                {distributionTingkat.map((item) => (
                  <div 
                    key={item.value} 
                    className="p-2 rounded-xl bg-slate-50/80 border border-slate-200/70 flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${getTingkatBadgeClass(item.value)}`}>
                        {item.label}
                      </span>
                    </div>
                    <div className="mt-1 flex items-baseline justify-between">
                      <span className="font-extrabold text-sm text-slate-800 font-mono">{item.count}</span>
                      <span className="text-[10px] text-slate-400 font-medium">siswa</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Kelas Privat (1 on 1):</span>
                <span className="text-lg font-black text-slate-800">{countPrivat} Siswa</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Kelas Grup / Reguler:</span>
                <span className="text-lg font-black text-slate-800">{countGrup} Siswa</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Aktivitas Kas Terbaru */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <i className="fa-solid fa-receipt text-indigo-600"></i>
              Transaksi Kas Terbaru
            </h3>
            <button
              onClick={() => onNavigate('kas')}
              className="text-xs text-indigo-600 font-bold hover:underline"
            >
              Lihat Semua →
            </button>
          </div>

          {recentKas.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              Belum ada transaksi kas dicatat.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 text-xs">
              {recentKas.map((k) => (
                <div key={k.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                      k.jenis === 'Masuk' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                    }`}>
                      <i className={`fa-solid ${k.jenis === 'Masuk' ? 'fa-arrow-down' : 'fa-arrow-up'}`}></i>
                    </div>
                    <div>
                      <div className="font-bold text-slate-800">{k.kategori}</div>
                      <div className="text-[11px] text-slate-500">{k.keterangan}</div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className={`font-extrabold ${k.jenis === 'Masuk' ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {k.jenis === 'Masuk' ? '+' : '-'} {formatRupiah(k.nominal)}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {formatIndonesianDate(k.tanggal, false)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
};
