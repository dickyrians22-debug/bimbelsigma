import React from 'react';
import { PengaturanBimbel } from '../types';

export type ActiveModule = 'dashboard' | 'siswa' | 'absensi' | 'kartu' | 'pembayaran' | 'kas' | 'pl' | 'pengaturan';

interface SidebarProps {
  activeModule: ActiveModule;
  setActiveModule: (module: ActiveModule) => void;
  pengaturan: PengaturanBimbel;
  isOpenMobile: boolean;
  setIsOpenMobile: (open: boolean) => void;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeModule,
  setActiveModule,
  pengaturan,
  isOpenMobile,
  setIsOpenMobile,
  onLogout,
}) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard & KPI', icon: 'fa-chart-pie', badge: 'Live' },
    { id: 'siswa', label: 'Database Siswa', icon: 'fa-users', badge: null },
    { id: 'absensi', label: 'Absensi & Presensi', icon: 'fa-clipboard-check', badge: null },
    { id: 'pembayaran', label: 'Biaya Absensi & Tagihan', icon: 'fa-file-invoice-dollar', badge: 'Otomatis' },
    { id: 'kartu', label: 'Rekap Presensi & Kartu', icon: 'fa-id-card-clip', badge: 'Cetak' },
    { id: 'kas', label: 'Kas Keluar Masuk', icon: 'fa-wallet', badge: null },
    { id: 'pl', label: 'Laporan P&L Tahunan', icon: 'fa-chart-line', badge: 'PDF' },
    { id: 'pengaturan', label: 'Pusat Kontrol & Profil', icon: 'fa-sliders', badge: null },
  ] as const;

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs lg:hidden no-print"
          onClick={() => setIsOpenMobile(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 bg-slate-900 text-slate-200 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        } no-print border-r border-slate-800 shadow-2xl`}
      >
        {/* Top Logo & Title */}
        <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-indigo-500/20">
              Σ
            </div>
            <div>
              <h1 className="font-extrabold text-base text-white tracking-tight leading-none">
                {pengaturan.namaLembaga}
              </h1>
              <p className="text-[10px] font-medium text-indigo-400 mt-1 line-clamp-1 italic">
                "{pengaturan.tagline}"
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsOpenMobile(false)}
            className="lg:hidden text-slate-400 hover:text-white p-1"
          >
            <i className="fa-solid fa-xmark text-lg"></i>
          </button>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800">
          <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Menu Operasional Utama
          </div>

          {menuItems.map((item) => {
            const isActive = activeModule === item.id;
            return (
              <button
                key={item.id}
                id={`btn-menu-${item.id}`}
                onClick={() => {
                  setActiveModule(item.id as ActiveModule);
                  setIsOpenMobile(false);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all group ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-bold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-6 text-center ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-indigo-400'}`}>
                    <i className={`fa-solid ${item.icon} text-sm`}></i>
                  </div>
                  <span className="truncate">{item.label}</span>
                </div>

                {item.badge && (
                  <span
                    className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md shrink-0 ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-800 text-indigo-400 border border-indigo-500/20'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom Profile Info & Status */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/40 text-xs">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-indigo-400 text-xs font-bold border border-slate-700 shrink-0">
                <i className="fa-solid fa-user-tie"></i>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-bold text-white truncate">{pengaturan.pimpinan}</div>
                <div className="text-[10px] text-slate-400 truncate">Pimpinan / Admin</div>
              </div>
            </div>

            {onLogout && (
              <button
                onClick={onLogout}
                className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all border border-slate-800 hover:border-rose-500/30"
                title="Keluar / Kunci Akses Portal"
              >
                <i className="fa-solid fa-arrow-right-from-bracket text-xs"></i>
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};
