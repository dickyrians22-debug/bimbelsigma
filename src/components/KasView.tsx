import React, { useState } from 'react';
import { ConfirmModalState, JenisKas, MetodeBayar, PengaturanBimbel, Student, TransaksiKas } from '../types';
import { 
  exportToCSV, 
  formatIndonesianDate, 
  formatRupiah, 
  formatYearMonth, 
  getCurrentYearMonth, 
  getTodayDateString 
} from '../utils/helpers';
import { ConfirmModal } from './ConfirmModal';

interface KasViewProps {
  kas: TransaksiKas[];
  onSaveKas: (kasList: TransaksiKas[]) => void;
  students: Student[];
  pengaturan: PengaturanBimbel;
  onShowToast: (text: string, type?: 'success' | 'info' | 'error' | 'warning') => void;
}

export const KasView: React.FC<KasViewProps> = ({
  kas,
  onSaveKas,
  students,
  pengaturan,
  onShowToast,
}) => {
  const today = getTodayDateString();
  const currentYM = getCurrentYearMonth();
  const currentYear = new Date().getFullYear();
  const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
  
  // Date Range Defaults (Start of month to Today)
  const defaultStartDate = `${currentYear}-${currentMonth}-01`;
  const [startDate, setStartDate] = useState<string>(defaultStartDate);
  const [endDate, setEndDate] = useState<string>(today);

  // Other filters
  const [filterJenis, setFilterJenis] = useState<string>('ALL');
  const [filterKategori, setFilterKategori] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingKas, setEditingKas] = useState<TransaksiKas | null>(null);

  // Warning Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Form State
  const [formData, setFormData] = useState<{
    tanggal: string;
    jenis: JenisKas;
    kategori: string;
    keterangan: string;
    nominal: number;
    siswaId?: string;
    bulanTagihan?: string;
    metodeBayar?: MetodeBayar;
  }>({
    tanggal: today,
    jenis: 'Masuk',
    kategori: pengaturan.kategoriMasuk[0] || 'SPP Les Bulanan',
    keterangan: '',
    nominal: 0,
    siswaId: '',
    bulanTagihan: currentYM,
    metodeBayar: 'Transfer Bank',
  });

  // Helper to check if category is SPP
  const isKategoriSPP = (jenis: JenisKas, kategori: string) => {
    return jenis === 'Masuk' && (kategori.toLowerCase().includes('spp') || kategori === 'SPP Les Bulanan');
  };

  // Open Create Modal
  const handleOpenCreate = (defaultJenis: JenisKas = 'Masuk') => {
    setEditingKas(null);
    const defaultKategori = defaultJenis === 'Masuk' 
      ? (pengaturan.kategoriMasuk[0] || 'SPP Les Bulanan') 
      : (pengaturan.kategoriKeluar[0] || '');
    
    const isSPP = isKategoriSPP(defaultJenis, defaultKategori);

    setFormData({
      tanggal: today,
      jenis: defaultJenis,
      kategori: defaultKategori,
      keterangan: '',
      nominal: 0,
      siswaId: isSPP ? '' : undefined,
      bulanTagihan: isSPP ? currentYM : undefined,
      metodeBayar: 'Transfer Bank',
    });
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (item: TransaksiKas) => {
    setEditingKas(item);
    const isSPP = isKategoriSPP(item.jenis, item.kategori);

    setFormData({
      tanggal: item.tanggal,
      jenis: item.jenis,
      kategori: item.kategori,
      keterangan: item.keterangan,
      nominal: item.nominal,
      siswaId: isSPP ? (item.siswaId || '') : undefined,
      bulanTagihan: isSPP ? (item.bulanTagihan || currentYM) : undefined,
      metodeBayar: item.metodeBayar || 'Transfer Bank',
    });
    setIsModalOpen(true);
  };

  // Switch Jenis in form
  const handleJenisChange = (newJenis: JenisKas) => {
    const defaultKategori = newJenis === 'Masuk' 
      ? (pengaturan.kategoriMasuk[0] || 'SPP Les Bulanan') 
      : (pengaturan.kategoriKeluar[0] || '');
    
    const isSPP = isKategoriSPP(newJenis, defaultKategori);

    setFormData((prev) => ({
      ...prev,
      jenis: newJenis,
      kategori: defaultKategori,
      siswaId: isSPP ? prev.siswaId || '' : undefined,
      bulanTagihan: isSPP ? prev.bulanTagihan || currentYM : undefined,
    }));
  };

  // Switch Kategori in form
  const handleKategoriChange = (newKategori: string) => {
    const isSPP = isKategoriSPP(formData.jenis, newKategori);
    setFormData((prev) => ({
      ...prev,
      kategori: newKategori,
      // If changing to non-SPP, wipe siswaId and bulanTagihan
      siswaId: isSPP ? prev.siswaId || '' : undefined,
      bulanTagihan: isSPP ? prev.bulanTagihan || currentYM : undefined,
    }));
  };

  // Submit Form
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.nominal <= 0) {
      onShowToast('Nominal transaksi harus lebih dari Rp 0!', 'warning');
      return;
    }
    if (!formData.keterangan.trim()) {
      onShowToast('Keterangan transaksi wajib diisi!', 'warning');
      return;
    }

    const isSPP = isKategoriSPP(formData.jenis, formData.kategori);

    // Clean payload so non-SPP transactions never carry student/month attributes
    const payload: TransaksiKas = {
      id: editingKas ? editingKas.id : `kas-${Date.now()}`,
      tanggal: formData.tanggal,
      jenis: formData.jenis,
      kategori: formData.kategori,
      keterangan: formData.keterangan,
      nominal: formData.nominal,
      metodeBayar: formData.metodeBayar || 'Transfer Bank',
      siswaId: isSPP && formData.siswaId ? formData.siswaId : undefined,
      bulanTagihan: isSPP && formData.bulanTagihan ? formData.bulanTagihan : undefined,
    };

    if (editingKas) {
      // Edit
      const updated = kas.map((k) => (k.id === editingKas.id ? payload : k));
      onSaveKas(updated);
      onShowToast(`Transaksi kas berhasil diperbarui!`, 'success');
    } else {
      // Create
      onSaveKas([payload, ...kas]);
      onShowToast(`Transaksi ${formData.jenis} sebesar ${formatRupiah(formData.nominal)} berhasil dicatat!`, 'success');
    }

    setIsModalOpen(false);
  };

  // Delete with Warning Modal
  const handleRequestDelete = (item: TransaksiKas) => {
    setConfirmModal({
      isOpen: true,
      title: 'Konfirmasi Hapus Transaksi Kas',
      message: `PERINGATAN:\nApakah Anda yakin ingin menghapus transaksi kas:\n\n• Jenis: Kas ${item.jenis} (${item.kategori})\n• Keterangan: "${item.keterangan}"\n• Nominal: ${formatRupiah(item.nominal)}\n• Tanggal: ${item.tanggal}\n\nTindakan ini akan mempengaruhi saldo pembukuan, status tagihan siswa, dan laporan P&L bimbel.`,
      confirmLabel: 'Ya, Hapus Transaksi Kas',
      isDanger: true,
      onConfirm: () => {
        const updated = kas.filter((k) => k.id !== item.id);
        onSaveKas(updated);
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        onShowToast(`Transaksi kas "${item.keterangan}" telah dihapus.`, 'info');
      },
    });
  };

  // Filtered Kas
  const filteredKas = kas.filter((item) => {
    const matchStart = !startDate || item.tanggal >= startDate;
    const matchEnd = !endDate || item.tanggal <= endDate;
    const matchJenis = filterJenis === 'ALL' || item.jenis === filterJenis;
    const matchKategori = filterKategori === 'ALL' || item.kategori === filterKategori;
    const matchSearch =
      item.keterangan.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.kategori.toLowerCase().includes(searchTerm.toLowerCase());

    return matchStart && matchEnd && matchJenis && matchKategori && matchSearch;
  });

  // Running Balance Calculation for Filtered Range
  const totalPemasukan = filteredKas
    .filter((k) => k.jenis === 'Masuk')
    .reduce((sum, item) => sum + (item.nominal || 0), 0);

  const totalPengeluaran = filteredKas
    .filter((k) => k.jenis === 'Keluar')
    .reduce((sum, item) => sum + (item.nominal || 0), 0);

  const saldoKasBersih = totalPemasukan - totalPengeluaran;

  // Export to CSV Functionality
  const handleDownloadCSV = () => {
    const headers = [
      'No',
      'Tanggal',
      'Jenis Kas',
      'Kategori',
      'Keterangan Transaksi',
      'Pemasukan (Rp)',
      'Pengeluaran (Rp)',
      'Metode Bayar',
      'Siswa Terkait (Khusus SPP)',
      'Bulan Tagihan (Khusus SPP)'
    ];

    const rows = filteredKas.map((k, idx) => {
      const isSPP = isKategoriSPP(k.jenis, k.kategori);
      const std = isSPP && k.siswaId ? students.find((s) => s.id === k.siswaId) : null;
      return [
        idx + 1,
        k.tanggal,
        k.jenis,
        k.kategori,
        k.keterangan,
        k.jenis === 'Masuk' ? k.nominal : 0,
        k.jenis === 'Keluar' ? k.nominal : 0,
        k.metodeBayar || '-',
        std ? `${std.kodeSiswa} - ${std.nama}` : '-',
        isSPP && k.bulanTagihan ? formatYearMonth(k.bulanTagihan) : '-'
      ];
    });

    // Add Summary Row
    rows.push([
      '',
      'TOTAL RENTANG INI',
      '',
      '',
      `Saldo Bersih: ${formatRupiah(saldoKasBersih)}`,
      totalPemasukan,
      totalPengeluaran,
      '',
      '',
      ''
    ]);

    const dateRangeLabel = `${startDate || 'Awal'}_sd_${endDate || 'Sekarang'}`;
    exportToCSV([headers, ...rows], `Laporan_Kas_Bimbel_Sigma_${dateRangeLabel}.csv`);
    onShowToast('File Laporan Kas (.csv) berhasil diunduh!', 'success');
  };

  const isCurrentFormSPP = isKategoriSPP(formData.jenis, formData.kategori);

  return (
    <div className="space-y-6">
      
      {/* Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm">
              <i className="fa-solid fa-wallet"></i>
            </div>
            <h2 className="text-lg font-extrabold text-slate-900">Kas Keluar Masuk & Pembukuan</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Pencatatan arus kas operasional umum dan SPP bulanan siswa yang tersinkronisasi otomatis dengan running balance real-time
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {/* Download CSV Button */}
          <button
            id="btn-download-kas-csv"
            onClick={handleDownloadCSV}
            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-2 transition-all shadow-xs"
            title="Download Laporan Kas format .CSV"
          >
            <i className="fa-solid fa-file-csv text-emerald-600 text-sm"></i>
            <span>Download Laporan Kas (.csv)</span>
          </button>

          {/* Catat Masuk */}
          <button
            id="btn-catat-masuk"
            onClick={() => handleOpenCreate('Masuk')}
            className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 transition-all shadow-md shadow-emerald-200"
          >
            <i className="fa-solid fa-arrow-down text-sm"></i>
            <span>+ Kas Masuk</span>
          </button>

          {/* Catat Keluar */}
          <button
            id="btn-catat-keluar"
            onClick={() => handleOpenCreate('Keluar')}
            className="px-3.5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-2 transition-all shadow-md shadow-rose-200"
          >
            <i className="fa-solid fa-arrow-up text-sm"></i>
            <span>- Kas Keluar</span>
          </button>
        </div>
      </div>

      {/* Running Balance Strip for Active Date Range */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        {/* Total Pemasukan */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Pemasukan (Filter Aktif)
            </span>
            <div className="text-2xl font-black text-emerald-700 font-mono">
              + {formatRupiah(totalPemasukan)}
            </div>
            <span className="text-[10px] text-slate-400">
              {filteredKas.filter((k) => k.jenis === 'Masuk').length} transaksi kas masuk
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-lg">
            <i className="fa-solid fa-arrow-down-long"></i>
          </div>
        </div>

        {/* Total Pengeluaran */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Pengeluaran (Filter Aktif)
            </span>
            <div className="text-2xl font-black text-rose-700 font-mono">
              - {formatRupiah(totalPengeluaran)}
            </div>
            <span className="text-[10px] text-slate-400">
              {filteredKas.filter((k) => k.jenis === 'Keluar').length} transaksi kas keluar
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-lg">
            <i className="fa-solid fa-arrow-up-long"></i>
          </div>
        </div>

        {/* Saldo Kas Bersih */}
        <div className={`rounded-2xl border p-5 shadow-xs flex items-center justify-between ${
          saldoKasBersih >= 0 ? 'bg-indigo-900 text-white border-indigo-800' : 'bg-rose-900 text-white border-rose-800'
        }`}>
          <div className="space-y-1">
            <span className="text-xs font-bold text-indigo-200 uppercase tracking-wider">
              Saldo Kas Bersih (Running Balance)
            </span>
            <div className="text-2xl font-black font-mono">
              {formatRupiah(saldoKasBersih)}
            </div>
            <span className="text-[10px] text-indigo-200/80">
              {saldoKasBersih >= 0 ? '✓ Arus Kas Positif' : '⚠️ Defisit Kas'}
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-white/10 text-white flex items-center justify-center font-bold text-lg">
            <i className="fa-solid fa-scale-balanced"></i>
          </div>
        </div>

      </div>

      {/* Filter Keuangan Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          
          {/* Rentang Tanggal Dari */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
              Dari Tanggal:
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full py-2 px-3 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden bg-slate-50 font-mono"
            />
          </div>

          {/* Rentang Tanggal Sampai */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
              Sampai Tanggal:
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full py-2 px-3 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden bg-slate-50 font-mono"
            />
          </div>

          {/* Filter Jenis */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
              Jenis Transaksi:
            </label>
            <select
              value={filterJenis}
              onChange={(e) => setFilterJenis(e.target.value)}
              className="w-full py-2 px-3 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden bg-white text-slate-700 font-bold"
            >
              <option value="ALL">Semua (Masuk & Keluar)</option>
              <option value="Masuk">Kas Masuk Saja</option>
              <option value="Keluar">Kas Keluar Saja</option>
            </select>
          </div>

          {/* Filter Kategori */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
              Kategori:
            </label>
            <select
              value={filterKategori}
              onChange={(e) => setFilterKategori(e.target.value)}
              className="w-full py-2 px-3 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden bg-white text-slate-700"
            >
              <option value="ALL">Semua Kategori</option>
              <optgroup label="Kas Masuk">
                {pengaturan.kategoriMasuk.map((km, idx) => (
                  <option key={`m-${idx}`} value={km}>{km}</option>
                ))}
              </optgroup>
              <optgroup label="Kas Keluar">
                {pengaturan.kategoriKeluar.map((kk, idx) => (
                  <option key={`k-${idx}`} value={kk}>{kk}</option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Search Box */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
              Cari Keterangan:
            </label>
            <div className="relative">
              <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
              <input
                type="text"
                placeholder="Cari transaksi..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden bg-slate-50"
              />
            </div>
          </div>

        </div>

        {/* Quick Date Presets */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-1.5 text-slate-500">
            <span className="text-[11px]">Preset:</span>
            <button
              onClick={() => {
                setStartDate(today);
                setEndDate(today);
              }}
              className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold"
            >
              Hari Ini
            </button>
            <button
              onClick={() => {
                setStartDate(`${currentYear}-${currentMonth}-01`);
                setEndDate(today);
              }}
              className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold"
            >
              Bulan Ini
            </button>
            <button
              onClick={() => {
                setStartDate(`${currentYear}-01-01`);
                setEndDate(`${currentYear}-12-31`);
              }}
              className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold"
            >
              Tahun Ini ({currentYear})
            </button>
            <button
              onClick={() => {
                setStartDate('');
                setEndDate('');
                setFilterJenis('ALL');
                setFilterKategori('ALL');
                setSearchTerm('');
              }}
              className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-500 text-[11px]"
            >
              Tampilkan Semua
            </button>
          </div>

          <div className="text-[11px] text-slate-500">
            Menampilkan <b>{filteredKas.length}</b> dari {kas.length} total transaksi
          </div>
        </div>
      </div>

      {/* Transaction Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold">
                <th className="py-3 px-4 w-12 text-center">No</th>
                <th className="py-3 px-4">Tanggal</th>
                <th className="py-3 px-4">Jenis & Kategori</th>
                <th className="py-3 px-4">Keterangan & Rincian</th>
                <th className="py-3 px-4 text-right">Pemasukan</th>
                <th className="py-3 px-4 text-right">Pengeluaran</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredKas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <i className="fa-solid fa-wallet text-2xl mb-2 block"></i>
                    Tidak ada catatan transaksi kas pada rentang filter ini.
                  </td>
                </tr>
              ) : (
                filteredKas.map((k, idx) => {
                  const isSPP = isKategoriSPP(k.jenis, k.kategori);
                  const std = isSPP && k.siswaId ? students.find((s) => s.id === k.siswaId) : null;
                  return (
                    <tr key={k.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 text-center text-slate-400 font-mono">{idx + 1}</td>
                      
                      {/* Tanggal */}
                      <td className="py-3 px-4 font-mono font-bold text-slate-800">
                        {k.tanggal}
                        <div className="text-[10px] text-slate-400 font-sans font-normal">
                          {formatIndonesianDate(k.tanggal, false)}
                        </div>
                      </td>

                      {/* Jenis & Kategori */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                            k.jenis === 'Masuk' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {k.jenis}
                          </span>
                          <span className="font-bold text-slate-800">{k.kategori}</span>
                        </div>
                      </td>

                      {/* Keterangan */}
                      <td className="py-3 px-4 text-slate-700">
                        <div className="font-medium">{k.keterangan}</div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                          {/* ONLY SHOW STUDENT BADGE IF THIS IS AN SPP PAYMENT */}
                          {isSPP && std && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-mono text-[10px] font-bold border border-indigo-100">
                              <i className="fa-solid fa-user-graduate text-[9px]"></i>
                              <span>Siswa: {std.nama}</span>
                            </span>
                          )}
                          {/* ONLY SHOW BILLING MONTH IF THIS IS AN SPP PAYMENT */}
                          {isSPP && k.bulanTagihan && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[10px] font-bold">
                              <i className="fa-solid fa-calendar-check text-[9px]"></i>
                              <span>Periode: {formatYearMonth(k.bulanTagihan)}</span>
                            </span>
                          )}
                          {k.metodeBayar && (
                            <span className="text-[10px] text-slate-400">
                              ({k.metodeBayar})
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Pemasukan */}
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                        {k.jenis === 'Masuk' ? formatRupiah(k.nominal) : '-'}
                      </td>

                      {/* Pengeluaran */}
                      <td className="py-3 px-4 text-right font-mono font-bold text-rose-700">
                        {k.jenis === 'Keluar' ? formatRupiah(k.nominal) : '-'}
                      </td>

                      {/* Aksi */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(k)}
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 transition-all"
                            title="Edit Transaksi"
                          >
                            <i className="fa-solid fa-pen-to-square"></i>
                          </button>
                          <button
                            onClick={() => handleRequestDelete(k)}
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-rose-600 hover:border-rose-300 hover:bg-rose-50 transition-all"
                            title="Hapus Transaksi (Warning)"
                          >
                            <i className="fa-solid fa-trash-can"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {filteredKas.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100/80 border-t-2 border-slate-300 font-bold text-slate-900 text-xs">
                  <td colSpan={4} className="py-3 px-4 text-right uppercase tracking-wider">
                    Total Arus Kas Rentang Ini:
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-black text-emerald-800">
                    {formatRupiah(totalPemasukan)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-black text-rose-800">
                    {formatRupiah(totalPengeluaran)}
                  </td>
                  <td className="py-3 px-4"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Modal Catat / Edit Kas */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 animate-scale-up space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                  formData.jenis === 'Masuk' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                }`}>
                  <i className={`fa-solid ${formData.jenis === 'Masuk' ? 'fa-arrow-down' : 'fa-arrow-up'}`}></i>
                </div>
                <h3 className="font-extrabold text-base text-slate-900">
                  {editingKas ? 'Edit Transaksi Kas' : `Catat Transaksi Kas ${formData.jenis}`}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <i className="fa-solid fa-xmark text-base"></i>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              
              {/* Jenis Kas Tabs */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Jenis Transaksi *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleJenisChange('Masuk')}
                    className={`py-2.5 rounded-xl font-extrabold border flex items-center justify-center gap-2 transition-all ${
                      formData.jenis === 'Masuk'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <i className="fa-solid fa-arrow-down"></i>
                    <span>KAS MASUK (+)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleJenisChange('Keluar')}
                    className={`py-2.5 rounded-xl font-extrabold border flex items-center justify-center gap-2 transition-all ${
                      formData.jenis === 'Keluar'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <i className="fa-solid fa-arrow-up"></i>
                    <span>KAS KELUAR (-)</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Tanggal */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tanggal Transaksi *</label>
                  <input
                    type="date"
                    required
                    value={formData.tanggal}
                    onChange={(e) => setFormData({ ...formData, tanggal: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-indigo-500 outline-hidden font-bold"
                  />
                </div>

                {/* Kategori */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Kategori Transaksi *</label>
                  <select
                    required
                    value={formData.kategori}
                    onChange={(e) => handleKategoriChange(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-hidden font-bold"
                  >
                    {(formData.jenis === 'Masuk' ? pengaturan.kategoriMasuk : pengaturan.kategoriKeluar).map((cat, idx) => (
                      <option key={idx} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Nominal (Rp) */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nominal Transaksi (Rp) *
                </label>
                <input
                  type="number"
                  required
                  min="1000"
                  step="1000"
                  value={formData.nominal || ''}
                  onChange={(e) => setFormData({ ...formData, nominal: Number(e.target.value) })}
                  className={`w-full p-2.5 border rounded-lg font-mono text-base font-black focus:ring-2 outline-hidden ${
                    formData.jenis === 'Masuk'
                      ? 'border-emerald-300 focus:ring-emerald-500 text-emerald-800 bg-emerald-50/30'
                      : 'border-rose-300 focus:ring-rose-500 text-rose-800 bg-rose-50/30'
                  }`}
                  placeholder="Contoh: 500000"
                />
                <span className="text-[10px] font-bold text-slate-500 block mt-1">
                  Terbilang: {formatRupiah(formData.nominal)}
                </span>
              </div>

              {/* Keterangan */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Keterangan / Rincian Transaksi *</label>
                <input
                  type="text"
                  required
                  value={formData.keterangan}
                  onChange={(e) => setFormData({ ...formData, keterangan: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-hidden"
                  placeholder={isCurrentFormSPP ? "Contoh: Pembayaran SPP Les Bulan Ini" : "Contoh: Pembelian spidol & modul / Operasional listrik"}
                />
              </div>

              {/* Metode Bayar */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Metode Pembayaran:</label>
                <select
                  value={formData.metodeBayar || 'Transfer Bank'}
                  onChange={(e) => setFormData({ ...formData, metodeBayar: e.target.value as MetodeBayar })}
                  className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-hidden bg-white"
                >
                  <option value="Transfer Bank">Transfer Bank</option>
                  <option value="Tunai / Cash">Tunai / Cash</option>
                  <option value="QRIS">QRIS</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>

              {/* Siswa & Periode Bulan Tagihan (HANYA MUNCUL KETIKA KATEGORI = SPP BULANAN) */}
              {isCurrentFormSPP ? (
                <div className="p-3.5 bg-indigo-50/70 rounded-xl border border-indigo-200 space-y-3">
                  <div className="font-bold text-indigo-900 text-xs flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <i className="fa-solid fa-link text-indigo-600"></i>
                      <span>Kaitkan dengan Pembayaran SPP Siswa:</span>
                    </div>
                    <span className="text-[10px] bg-indigo-200/80 text-indigo-900 font-bold px-2 py-0.5 rounded">
                      Khusus SPP
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Pilih Siswa */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Pilih Siswa Terkait:</label>
                      <select
                        value={formData.siswaId || ''}
                        onChange={(e) => {
                          const sid = e.target.value;
                          const found = students.find((s) => s.id === sid);
                          setFormData({
                            ...formData,
                            siswaId: sid,
                            keterangan: found && !formData.keterangan ? `Pembayaran SPP Les ${found.nama}` : formData.keterangan
                          });
                        }}
                        className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-hidden bg-white font-medium"
                      >
                        <option value="">-- Pilih Siswa --</option>
                        {students.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.kodeSiswa} - {s.nama} ({s.tingkat})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Bulan Tagihan */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Untuk Periode Tagihan Bulan:</label>
                      <input
                        type="month"
                        value={formData.bulanTagihan || currentYM}
                        onChange={(e) => setFormData({ ...formData, bulanTagihan: e.target.value })}
                        className="w-full p-2 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-indigo-500 outline-hidden bg-white font-bold"
                      />
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-100 font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2 rounded-xl text-white font-bold shadow-md ${
                    formData.jenis === 'Masuk'
                      ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'
                      : 'bg-rose-600 hover:bg-rose-700 shadow-rose-200'
                  }`}
                >
                  <i className="fa-solid fa-floppy-disk mr-1.5"></i>
                  {editingKas ? 'Simpan Perubahan' : 'Simpan Transaksi'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Confirmation Warning Modal */}
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
