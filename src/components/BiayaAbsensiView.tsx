import React, { useState } from 'react';
import { 
  AbsensiRecord, 
  ConfirmModalState, 
  MetodeBayar, 
  PengaturanBimbel, 
  Student, 
  TransaksiKas 
} from '../types';
import { 
  cleanPhoneNumber, 
  exportToCSV, 
  formatIndonesianDate, 
  formatRupiah, 
  formatYearMonth, 
  getCurrentYearMonth, 
  getTodayDateString 
} from '../utils/helpers';
import { ConfirmModal } from './ConfirmModal';

interface BiayaAbsensiViewProps {
  students: Student[];
  absensi: AbsensiRecord[];
  kas: TransaksiKas[];
  onSaveKas: (kasList: TransaksiKas[]) => void;
  pengaturan: PengaturanBimbel;
  onShowToast: (text: string, type?: 'success' | 'info' | 'error' | 'warning') => void;
}

export const BiayaAbsensiView: React.FC<BiayaAbsensiViewProps> = ({
  students,
  absensi,
  kas,
  onSaveKas,
  pengaturan,
  onShowToast,
}) => {
  const today = getTodayDateString();
  const currentYM = getCurrentYearMonth();

  // Selected Month filter (YYYY-MM)
  const [selectedMonth, setSelectedMonth] = useState<string>(currentYM);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterTingkat, setFilterTingkat] = useState<string>('ALL');
  const [filterStatusBayar, setFilterStatusBayar] = useState<string>('ALL');

  // Modal State for Paying / Recording Kas Masuk
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [selectedStudentForPay, setSelectedStudentForPay] = useState<Student | null>(null);
  const [payFormData, setPayFormData] = useState<{
    tanggal: string;
    nominal: number;
    metodeBayar: MetodeBayar;
    keterangan: string;
    kategori: string;
  }>({
    tanggal: today,
    nominal: 0,
    metodeBayar: 'Transfer Bank',
    keterangan: '',
    kategori: 'SPP Les Bulanan',
  });

  // Modal State for Viewing Student Session Details
  const [detailStudent, setDetailStudent] = useState<Student | null>(null);

  // Modal State for Printable Statement & Invoice Sheet
  const [printInvoiceStudent, setPrintInvoiceStudent] = useState<Student | null>(null);

  // Warning Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Calculate fees & payments for each student dynamically
  const studentBillingList = students.map((student) => {
    // 1. Get attendance records for this student in selected month
    const studentAbsensiMonth = absensi.filter((a) => {
      const matchSiswa = a.siswaId === student.id;
      const matchMonth = !selectedMonth || a.tanggal.startsWith(selectedMonth);
      return matchSiswa && matchMonth;
    });

    const countHadir = studentAbsensiMonth.filter((a) => a.status === 'Hadir').length;
    const countIzin = studentAbsensiMonth.filter((a) => a.status === 'Izin').length;
    const countSakit = studentAbsensiMonth.filter((a) => a.status === 'Sakit').length;
    const countAlpha = studentAbsensiMonth.filter((a) => a.status === 'Alpha').length;
    const totalSesi = studentAbsensiMonth.length;

    // Total fee based strictly on attended sessions
    const totalBiaya = countHadir * student.tarifPerSesi;

    // 2. Get payment records from Kas Masuk (specifically SPP category) for this student in selected month
    const studentKasMasukMonth = kas.filter((k) => {
      const matchSiswa = k.siswaId === student.id;
      const matchJenis = k.jenis === 'Masuk';
      const matchKategori = k.kategori.toLowerCase().includes('spp') || k.kategori === 'SPP Les Bulanan';
      const matchMonth = !selectedMonth || k.bulanTagihan === selectedMonth || (k.tanggal.startsWith(selectedMonth) && !k.bulanTagihan);
      return matchSiswa && matchJenis && matchKategori && matchMonth;
    });

    const totalTerbayar = studentKasMasukMonth.reduce((sum, item) => sum + (item.nominal || 0), 0);
    const sisaTagihan = Math.max(0, totalBiaya - totalTerbayar);
    const kelebihanBayar = Math.max(0, totalTerbayar - totalBiaya);

    // Status
    let statusKeterangan: 'Lunas' | 'Belum Lunas' | 'Belum Ada Sesi' = 'Belum Lunas';
    if (totalBiaya === 0 && countHadir === 0) {
      statusKeterangan = 'Belum Ada Sesi';
    } else if (totalTerbayar >= totalBiaya) {
      statusKeterangan = 'Lunas';
    } else {
      statusKeterangan = 'Belum Lunas';
    }

    return {
      student,
      studentAbsensiMonth,
      countHadir,
      countIzin,
      countSakit,
      countAlpha,
      totalSesi,
      totalBiaya,
      studentKasMasukMonth,
      totalTerbayar,
      sisaTagihan,
      kelebihanBayar,
      statusKeterangan,
    };
  });

  // Filtered List
  const filteredBillingList = studentBillingList.filter((item) => {
    const s = item.student;
    const matchSearch =
      s.nama.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.kodeSiswa.toLowerCase().includes(searchTerm.toLowerCase());
    const matchTingkat = filterTingkat === 'ALL' || s.tingkat === filterTingkat;
    const matchStatus = filterStatusBayar === 'ALL' || item.statusKeterangan === filterStatusBayar;

    return matchSearch && matchTingkat && matchStatus;
  });

  // Summary Metrics
  const totalSiswaAktif = students.filter((s) => s.status === 'Aktif').length;
  const totalSemuaSesiHadir = studentBillingList.reduce((sum, i) => sum + i.countHadir, 0);
  const totalAkumulasiBiaya = studentBillingList.reduce((sum, i) => sum + i.totalBiaya, 0);
  const totalAkumulasiTerbayar = studentBillingList.reduce((sum, i) => sum + i.totalTerbayar, 0);
  const totalAkumulasiPiutang = studentBillingList.reduce((sum, i) => sum + i.sisaTagihan, 0);
  const countLunas = studentBillingList.filter((i) => i.statusKeterangan === 'Lunas').length;
  const countBelumLunas = studentBillingList.filter((i) => i.statusKeterangan === 'Belum Lunas').length;

  // Open Pay Modal prefilled
  const handleOpenPayModal = (item: typeof studentBillingList[0]) => {
    setSelectedStudentForPay(item.student);
    const amountToPay = item.sisaTagihan > 0 ? item.sisaTagihan : item.totalBiaya;
    setPayFormData({
      tanggal: today,
      nominal: amountToPay > 0 ? amountToPay : item.student.tarifPerSesi,
      metodeBayar: 'Transfer Bank',
      kategori: 'SPP Les Bulanan',
      keterangan: `Pembayaran SPP Les ${item.student.nama} (${formatYearMonth(selectedMonth)})`,
    });
    setIsPayModalOpen(true);
  };

  // Submit Payment -> Writes directly into Kas Keluar Masuk (Kas Masuk)
  const handleSubmitPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentForPay) return;
    if (payFormData.nominal <= 0) {
      onShowToast('Nominal pembayaran harus lebih dari Rp 0!', 'warning');
      return;
    }

    const newKasItem: TransaksiKas = {
      id: `kas-${Date.now()}`,
      tanggal: payFormData.tanggal,
      jenis: 'Masuk',
      kategori: payFormData.kategori || 'SPP Les Bulanan',
      keterangan: payFormData.keterangan || `Pembayaran SPP Les ${selectedStudentForPay.nama} (${formatYearMonth(selectedMonth)})`,
      nominal: payFormData.nominal,
      siswaId: selectedStudentForPay.id,
      bulanTagihan: selectedMonth || currentYM,
      metodeBayar: payFormData.metodeBayar,
    };

    onSaveKas([newKasItem, ...kas]);
    setIsPayModalOpen(false);
    onShowToast(
      `Pembayaran ${formatRupiah(payFormData.nominal)} untuk ${selectedStudentForPay.nama} berhasil dicatat di Kas Masuk!`,
      'success'
    );
  };

  // Delete a linked Kas payment with warning confirmation
  const handleRequestDeleteKasPayment = (kasItem: TransaksiKas, studentName: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Konfirmasi Hapus Catatan Pembayaran Kas',
      message: `PERINGATAN:\nApakah Anda yakin ingin menghapus data pembayaran kas:\n\n• Siswa: ${studentName}\n• Tanggal: ${kasItem.tanggal}\n• Nominal: ${formatRupiah(kasItem.nominal)}\n• Keterangan: "${kasItem.keterangan}"\n\nPenghapusan ini akan langsung mengubah status lunas siswa kembali menjadi Belum Lunas dan mengurangi saldo kas masuk bimbel.`,
      confirmLabel: 'Ya, Hapus Pembayaran Kas',
      isDanger: true,
      onConfirm: () => {
        const updated = kas.filter((k) => k.id !== kasItem.id);
        onSaveKas(updated);
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        onShowToast(`Catatan pembayaran ${formatRupiah(kasItem.nominal)} telah dihapus dari kas.`, 'info');
      },
    });
  };

  // Export to CSV
  const handleDownloadCSV = () => {
    const headers = [
      'No',
      'Kode Siswa',
      'Nama Siswa',
      'Jenjang & Kelas',
      'Tarif per Sesi (Rp)',
      `Sesi Hadir (${formatYearMonth(selectedMonth)})`,
      'Sesi Izin',
      'Sesi Sakit',
      'Sesi Alpha',
      'Total Biaya Absensi (Rp)',
      'Total Terbayar di Kas (Rp)',
      'Sisa Tagihan (Rp)',
      'Status Keterangan'
    ];

    const rows = filteredBillingList.map((item, idx) => [
      idx + 1,
      item.student.kodeSiswa,
      item.student.nama,
      `${item.student.tingkat} - ${item.student.jenisKelas}`,
      item.student.tarifPerSesi,
      item.countHadir,
      item.countIzin,
      item.countSakit,
      item.countAlpha,
      item.totalBiaya,
      item.totalTerbayar,
      item.sisaTagihan,
      item.statusKeterangan
    ]);

    // Summary row
    rows.push([
      '',
      'TOTAL REKAPITULASI',
      '',
      '',
      '',
      totalSemuaSesiHadir,
      '',
      '',
      '',
      totalAkumulasiBiaya,
      totalAkumulasiTerbayar,
      totalAkumulasiPiutang,
      `${countLunas} Lunas, ${countBelumLunas} Belum Lunas`
    ]);

    exportToCSV(
      [headers, ...rows],
      `Rekap_Biaya_Absensi_Siswa_Sigma_${selectedMonth || 'Semua'}.csv`
    );
    onShowToast('File Rekap Biaya Absensi (.csv) berhasil diunduh!', 'success');
  };

  return (
    <div className="space-y-6">
      
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm">
              <i className="fa-solid fa-file-invoice-dollar"></i>
            </div>
            <h2 className="text-lg font-extrabold text-slate-900">
              Daftar Murid & Biaya Absensi Berjalan
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Total biaya terhitung otomatis dari sesi absensi yang berjalan di bulan ini. Status pembayaran tersinkronisasi langsung dari Kas Masuk Bimbel.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {/* Download CSV */}
          <button
            id="btn-download-biaya-csv"
            onClick={handleDownloadCSV}
            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-2 transition-all shadow-xs"
            title="Download Rekap format .CSV"
          >
            <i className="fa-solid fa-file-csv text-emerald-600 text-sm"></i>
            <span>Download CSV Rekap Biaya</span>
          </button>

          {/* Cetak Rekap Bulanan */}
          <button
            onClick={() => window.print()}
            className="px-4 py-2.5 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center gap-2 transition-all shadow-xs"
            title="Cetak Rekapan Lembaran A4"
          >
            <i className="fa-solid fa-print text-sm"></i>
            <span>Cetak Lembaran Rekap</span>
          </button>
        </div>
      </div>

      {/* Month Selector & Quick Presets Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <i className="fa-solid fa-calendar-days text-indigo-600"></i>
            <span>Pilih Periode Bulan & Tahun:</span>
          </label>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="py-1.5 px-3 text-xs border border-slate-300 rounded-xl font-mono font-bold bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-hidden"
          />
          <button
            type="button"
            onClick={() => setSelectedMonth(currentYM)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              selectedMonth === currentYM
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            Bulan Ini
          </button>
          <button
            type="button"
            onClick={() => {
              const [y, m] = currentYM.split('-').map(Number);
              const prevDate = new Date(y, m - 2, 1);
              const prevYM = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
              setSelectedMonth(prevYM);
            }}
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
          >
            Bulan Lalu
          </button>
          <button
            type="button"
            onClick={() => setSelectedMonth('')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              !selectedMonth
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-500'
            }`}
          >
            Semua Periode
          </button>
        </div>

        <div className="text-xs font-semibold text-slate-600 bg-indigo-50/70 border border-indigo-100 px-3.5 py-1.5 rounded-xl flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>
          <span>Periode Terpilih: <b>{selectedMonth ? formatYearMonth(selectedMonth) : 'Semua Periode Waktu'}</b></span>
        </div>
      </div>

      {/* KPI Metric Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        
        {/* Total Sesi Hadir Berjalan */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Sesi Hadir</span>
            <span className="text-2xl font-black text-indigo-700 font-mono">{totalSemuaSesiHadir}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Sesi di {formatYearMonth(selectedMonth)}</span>
          </div>
          <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm">
            <i className="fa-solid fa-person-chalkboard"></i>
          </div>
        </div>

        {/* Total Biaya Berjalan */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Biaya Absensi</span>
            <span className="text-lg font-black text-slate-900 font-mono">{formatRupiah(totalAkumulasiBiaya)}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Sesi Hadir × Tarif</span>
          </div>
          <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-sm">
            <i className="fa-solid fa-calculator"></i>
          </div>
        </div>

        {/* Total Terbayar di Kas */}
        <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-emerald-700 block">Kas Masuk Terbayar</span>
            <span className="text-lg font-black text-emerald-800 font-mono">{formatRupiah(totalAkumulasiTerbayar)}</span>
            <span className="text-[10px] text-emerald-600 block mt-0.5">{countLunas} Siswa Lunas</span>
          </div>
          <div className="w-9 h-9 rounded-lg bg-emerald-200/60 text-emerald-800 flex items-center justify-center font-bold text-sm">
            <i className="fa-solid fa-circle-check"></i>
          </div>
        </div>

        {/* Sisa Piutang / Belum Lunas */}
        <div className="bg-rose-50 p-4 rounded-xl border border-rose-100 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-rose-700 block">Sisa Belum Bayar</span>
            <span className="text-lg font-black text-rose-800 font-mono">{formatRupiah(totalAkumulasiPiutang)}</span>
            <span className="text-[10px] text-rose-600 block mt-0.5">{countBelumLunas} Siswa Belum Lunas</span>
          </div>
          <div className="w-9 h-9 rounded-lg bg-rose-200/60 text-rose-800 flex items-center justify-center font-bold text-sm">
            <i className="fa-solid fa-clock-rotate-left"></i>
          </div>
        </div>

        {/* Status Siswa Aktif */}
        <div className="bg-indigo-900 text-white p-4 rounded-xl border border-indigo-800 shadow-xs flex items-center justify-between col-span-2 sm:col-span-1">
          <div>
            <span className="text-[10px] uppercase font-bold text-indigo-200 block">Siswa Aktif</span>
            <span className="text-2xl font-black font-mono">{totalSiswaAktif}</span>
            <span className="text-[10px] text-indigo-200 block mt-0.5">Dari {students.length} Total Siswa</span>
          </div>
          <div className="w-9 h-9 rounded-lg bg-white/10 text-white flex items-center justify-center font-bold text-sm">
            <i className="fa-solid fa-users"></i>
          </div>
        </div>

      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          
          {/* Search Nama / Kode */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
              Cari Siswa:
            </label>
            <div className="relative">
              <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
              <input
                type="text"
                placeholder="Ketik nama atau kode siswa..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden bg-slate-50"
              />
            </div>
          </div>

          {/* Filter Status Pembayaran */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
              Status Pembayaran:
            </label>
            <select
              value={filterStatusBayar}
              onChange={(e) => setFilterStatusBayar(e.target.value)}
              className="w-full py-2 px-3 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden bg-white text-slate-700 font-bold"
            >
              <option value="ALL">Semua Status (Lunas & Belum Lunas)</option>
              <option value="Lunas">✓ Lunas</option>
              <option value="Belum Lunas">⚠️ Belum Lunas / Kurang</option>
              <option value="Belum Ada Sesi">Belum Ada Sesi</option>
            </select>
          </div>

          {/* Filter Jenjang */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
              Jenjang Pendidikan:
            </label>
            <select
              value={filterTingkat}
              onChange={(e) => setFilterTingkat(e.target.value)}
              className="w-full py-2 px-3 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden bg-white text-slate-700"
            >
              <option value="ALL">Semua Jenjang (SD, SMP, SMA)</option>
              <option value="SD">SD</option>
              <option value="SMP">SMP</option>
              <option value="SMA">SMA</option>
            </select>
          </div>

        </div>
      </div>

      {/* Main Billing & Student Fee Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold">
                <th className="py-3.5 px-4 w-10 text-center">No</th>
                <th className="py-3.5 px-4">Nama Siswa & Paket</th>
                <th className="py-3.5 px-4 text-center">Tarif / Sesi</th>
                <th className="py-3.5 px-4 text-center">Kehadiran Berjalan</th>
                <th className="py-3.5 px-4 text-right">Total Biaya Absensi</th>
                <th className="py-3.5 px-4 text-right">Kas Terbayar</th>
                <th className="py-3.5 px-4 text-right">Sisa Tagihan</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredBillingList.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <i className="fa-solid fa-folder-open text-2xl mb-2 block"></i>
                    Tidak ada data siswa untuk filter yang dipilih.
                  </td>
                </tr>
              ) : (
                filteredBillingList.map((item, idx) => {
                  const s = item.student;
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                      
                      {/* No */}
                      <td className="py-3.5 px-4 text-center text-slate-400 font-mono">{idx + 1}</td>
                      
                      {/* Nama & Jenjang */}
                      <td className="py-3.5 px-4">
                        <div className="font-extrabold text-slate-900 flex items-center gap-1.5">
                          <span>{s.nama}</span>
                          {s.status === 'Non-Aktif' && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] bg-slate-100 text-slate-500 font-semibold">
                              Non-Aktif
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1.5 mt-0.5">
                          <span className="text-indigo-600 font-bold">{s.kodeSiswa}</span>
                          <span>•</span>
                          <span className="font-sans">{s.tingkat} ({s.jenisKelas})</span>
                        </div>
                      </td>

                      {/* Tarif per Sesi */}
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-700">
                        {formatRupiah(s.tarifPerSesi)}
                      </td>

                      {/* Kehadiran Berjalan */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex items-center gap-1.5">
                          <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-indigo-50 text-indigo-700 border border-indigo-100">
                            {item.countHadir} Sesi Hadir
                          </span>
                          <button
                            onClick={() => setDetailStudent(s)}
                            className="p-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-slate-100"
                            title="Lihat rincian tanggal & materi kehadiran siswa"
                          >
                            <i className="fa-solid fa-circle-info"></i>
                          </button>
                        </div>
                        {(item.countIzin > 0 || item.countSakit > 0 || item.countAlpha > 0) && (
                          <div className="text-[10px] text-slate-400 mt-1">
                            {item.countIzin > 0 && `Izin: ${item.countIzin} `}
                            {item.countSakit > 0 && `Sakit: ${item.countSakit} `}
                            {item.countAlpha > 0 && `Alpha: ${item.countAlpha}`}
                          </div>
                        )}
                      </td>

                      {/* Total Biaya Berjalan */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="font-mono font-black text-slate-900 text-sm">
                          {formatRupiah(item.totalBiaya)}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {item.countHadir} × {formatRupiah(s.tarifPerSesi)}
                        </div>
                      </td>

                      {/* Kas Terbayar */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="font-mono font-black text-emerald-700 text-sm">
                          {formatRupiah(item.totalTerbayar)}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {item.studentKasMasukMonth.length}x transaksi kas
                        </div>
                      </td>

                      {/* Sisa Tagihan */}
                      <td className="py-3.5 px-4 text-right">
                        <div className={`font-mono font-black text-sm ${
                          item.sisaTagihan > 0 ? 'text-rose-600' : 'text-slate-400'
                        }`}>
                          {item.sisaTagihan > 0 ? formatRupiah(item.sisaTagihan) : 'Rp 0'}
                        </div>
                        {item.kelebihanBayar > 0 && (
                          <div className="text-[10px] text-emerald-600 font-bold">
                            Lebih: +{formatRupiah(item.kelebihanBayar)}
                          </div>
                        )}
                      </td>

                      {/* Status Keterangan */}
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                          item.statusKeterangan === 'Lunas'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : item.statusKeterangan === 'Belum Lunas'
                            ? 'bg-rose-100 text-rose-800 border border-rose-300 animate-pulse'
                            : 'bg-slate-100 text-slate-600 border border-slate-300'
                        }`}>
                          {item.statusKeterangan === 'Lunas' && '✓ LUNAS'}
                          {item.statusKeterangan === 'Belum Lunas' && '⚠️ BELUM LUNAS'}
                          {item.statusKeterangan === 'Belum Ada Sesi' && 'BELUM ADA SESI'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          
                          {/* Bayar Kas Masuk */}
                          <button
                            id={`btn-bayar-${s.id}`}
                            onClick={() => handleOpenPayModal(item)}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1 shadow-xs transition-all"
                            title="Catat Pembayaran Masuk ke Kas Bimbel"
                          >
                            <i className="fa-solid fa-plus-circle text-xs"></i>
                            <span>+ Bayar</span>
                          </button>

                          {/* Cetak Rincian & Kwitansi */}
                          <button
                            onClick={() => setPrintInvoiceStudent(s)}
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 transition-all"
                            title="Cetak Lembaran Rincian & Kwitansi (A4)"
                          >
                            <i className="fa-solid fa-file-invoice"></i>
                          </button>

                          {/* Kirim WhatsApp */}
                          {s.kontak && (
                            <a
                              href={`https://wa.me/${cleanPhoneNumber(s.kontak)}?text=Halo%20Bapak%2FIbu%20Wali%20dari%20*${encodeURIComponent(s.nama)}*%2C%20berikut%20rekapan%20absensi%20%26%20biaya%20les%20Bimbel%20Sigma%20periode%20*${encodeURIComponent(formatYearMonth(selectedMonth))}*%3A%0A%0A%E2%80%A2%20Total%20Kehadiran%3A%20*${item.countHadir}%20Sesi*%0A%E2%80%A2%20Tarif%20per%20Sesi%3A%20*${encodeURIComponent(formatRupiah(s.tarifPerSesi))}*%0A%E2%80%A2%20Total%20Biaya%20Berjalan%3A%20*${encodeURIComponent(formatRupiah(item.totalBiaya))}*%0A%E2%80%A2%20Terbayar%20di%20Kas%3A%20*${encodeURIComponent(formatRupiah(item.totalTerbayar))}*%0A%E2%80%A2%20Sisa%20Tagihan%3A%20*${encodeURIComponent(formatRupiah(item.sisaTagihan))}*%0A%E2%80%A2%20Status%3A%20*${item.statusKeterangan.toUpperCase()}*%0A%0ATerima%20kasih%20atas%20kepercayaannya%20pada%20Bimbel%20Sigma.`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-lg border border-emerald-200 text-emerald-600 hover:bg-emerald-50 transition-all"
                              title="Kirim Rincian Tagihan ke WhatsApp Wali Murid"
                            >
                              <i className="fa-brands fa-whatsapp"></i>
                            </a>
                          )}

                        </div>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
            {filteredBillingList.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100/90 border-t-2 border-slate-300 font-bold text-slate-900 text-xs">
                  <td colSpan={3} className="py-3.5 px-4 text-right uppercase tracking-wider">
                    Total Keseluruhan ({formatYearMonth(selectedMonth)}):
                  </td>
                  <td className="py-3.5 px-4 text-center font-mono font-black text-indigo-700">
                    {totalSemuaSesiHadir} Sesi Hadir
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-black text-slate-900">
                    {formatRupiah(totalAkumulasiBiaya)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-black text-emerald-800">
                    {formatRupiah(totalAkumulasiTerbayar)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-black text-rose-800">
                    {formatRupiah(totalAkumulasiPiutang)}
                  </td>
                  <td colSpan={2} className="py-3.5 px-4 text-center text-slate-600">
                    {countLunas} Lunas / {countBelumLunas} Kurang
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Modal: Catat Pembayaran SPP Masuk ke Kas */}
      {isPayModalOpen && selectedStudentForPay && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 animate-scale-up space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm">
                  <i className="fa-solid fa-wallet"></i>
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900">
                    Catat Pembayaran SPP ke Kas Masuk
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Siswa: <b>{selectedStudentForPay.nama}</b> ({selectedStudentForPay.kodeSiswa})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsPayModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <i className="fa-solid fa-xmark text-base"></i>
              </button>
            </div>

            <form onSubmit={handleSubmitPayment} className="space-y-4 text-xs">
              
              {/* Periode Bulan & Siswa Info */}
              <div className="p-3 bg-indigo-50/70 rounded-xl border border-indigo-100 space-y-1 text-slate-700">
                <div className="flex justify-between">
                  <span className="font-semibold">Periode Bulan Tagihan:</span>
                  <span className="font-mono font-bold text-indigo-700">
                    {formatYearMonth(selectedMonth || currentYM)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">Jenjang / Kelas:</span>
                  <span>{selectedStudentForPay.tingkat} ({selectedStudentForPay.jenisKelas})</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">Tarif per Sesi:</span>
                  <span className="font-mono font-bold">{formatRupiah(selectedStudentForPay.tarifPerSesi)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Tanggal Pembayaran */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tanggal Bayar *</label>
                  <input
                    type="date"
                    required
                    value={payFormData.tanggal}
                    onChange={(e) => setPayFormData({ ...payFormData, tanggal: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-indigo-500 outline-hidden font-bold"
                  />
                </div>

                {/* Metode Bayar */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Metode Bayar *</label>
                  <select
                    value={payFormData.metodeBayar}
                    onChange={(e) => setPayFormData({ ...payFormData, metodeBayar: e.target.value as MetodeBayar })}
                    className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-hidden font-bold"
                  >
                    <option value="Transfer Bank">Transfer Bank</option>
                    <option value="Tunai / Cash">Tunai / Cash</option>
                    <option value="QRIS">QRIS</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>
              </div>

              {/* Nominal Pembayaran */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nominal Pembayaran Masuk (Rp) *
                </label>
                <input
                  type="number"
                  required
                  min="1000"
                  step="1000"
                  value={payFormData.nominal || ''}
                  onChange={(e) => setPayFormData({ ...payFormData, nominal: Number(e.target.value) })}
                  className="w-full p-2.5 border border-emerald-300 bg-emerald-50/40 rounded-lg font-mono text-base font-black text-emerald-800 focus:ring-2 focus:ring-emerald-500 outline-hidden"
                  placeholder="Contoh: 300000"
                />
                <span className="text-[10px] font-bold text-slate-500 block mt-1">
                  Terbilang: {formatRupiah(payFormData.nominal)}
                </span>
              </div>

              {/* Keterangan Transaksi Kas */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Keterangan Transaksi Kas Masuk</label>
                <input
                  type="text"
                  required
                  value={payFormData.keterangan}
                  onChange={(e) => setPayFormData({ ...payFormData, keterangan: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-hidden font-medium"
                />
              </div>

              {/* Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPayModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-100 font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md shadow-emerald-200 flex items-center gap-1.5"
                >
                  <i className="fa-solid fa-floppy-disk"></i>
                  <span>Simpan ke Kas Masuk</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Modal: Rincian Kehadiran & Riwayat Pembayaran Siswa */}
      {detailStudent && (() => {
        const item = studentBillingList.find((i) => i.student.id === detailStudent.id);
        if (!item) return null;

        return (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 animate-scale-up space-y-4 max-h-[90vh] overflow-y-auto">
              
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                    <i className="fa-solid fa-clipboard-user text-indigo-600"></i>
                    <span>Rincian Absensi & Kas Siswa: {detailStudent.nama}</span>
                  </h3>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    {detailStudent.kodeSiswa} • Periode: {formatYearMonth(selectedMonth || currentYM)}
                  </p>
                </div>
                <button
                  onClick={() => setDetailStudent(null)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <i className="fa-solid fa-xmark text-base"></i>
                </button>
              </div>

              {/* Sesi Kehadiran Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Sesi Kehadiran Siswa ({item.studentAbsensiMonth.length} Catatan):
                  </h4>
                  <span className="text-xs font-extrabold text-indigo-700 font-mono">
                    {item.countHadir} Hadir × {formatRupiah(detailStudent.tarifPerSesi)} = {formatRupiah(item.totalBiaya)}
                  </span>
                </div>

                {item.studentAbsensiMonth.length === 0 ? (
                  <div className="p-4 bg-slate-50 rounded-xl text-center text-xs text-slate-400 border border-slate-200">
                    Belum ada catatan presensi pada periode bulan ini.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-50 font-bold text-slate-600">
                        <tr>
                          <th className="p-2.5">Tanggal</th>
                          <th className="p-2.5 text-center">Status</th>
                          <th className="p-2.5">Materi Pelajaran</th>
                          <th className="p-2.5">Tutor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {item.studentAbsensiMonth.map((a) => (
                          <tr key={a.id} className="hover:bg-slate-50/50">
                            <td className="p-2.5 font-mono font-bold text-slate-800">
                              {a.tanggal} <span className="text-[10px] text-slate-400 font-normal">({a.jam})</span>
                            </td>
                            <td className="p-2.5 text-center">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                a.status === 'Hadir' ? 'bg-emerald-100 text-emerald-800' :
                                a.status === 'Izin' ? 'bg-blue-100 text-blue-800' :
                                a.status === 'Sakit' ? 'bg-purple-100 text-purple-800' : 'bg-rose-100 text-rose-800'
                              }`}>
                                {a.status}
                              </span>
                            </td>
                            <td className="p-2.5 font-medium text-slate-800">{a.materi}</td>
                            <td className="p-2.5 text-slate-600">{a.tutor}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Riwayat Kas Masuk Terkait */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                    Riwayat Pembayaran Kas Masuk ({item.studentKasMasukMonth.length} Transaksi):
                  </h4>
                  <span className="text-xs font-extrabold text-emerald-800 font-mono">
                    Total: {formatRupiah(item.totalTerbayar)}
                  </span>
                </div>

                {item.studentKasMasukMonth.length === 0 ? (
                  <div className="p-4 bg-rose-50 rounded-xl text-center text-xs text-rose-700 border border-rose-200">
                    Belum ada riwayat pembayaran kas masuk untuk siswa ini di bulan ini.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-50 font-bold text-slate-600">
                        <tr>
                          <th className="p-2.5">Tanggal</th>
                          <th className="p-2.5">Keterangan</th>
                          <th className="p-2.5">Metode</th>
                          <th className="p-2.5 text-right">Nominal</th>
                          <th className="p-2.5 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {item.studentKasMasukMonth.map((k) => (
                          <tr key={k.id} className="hover:bg-slate-50/50">
                            <td className="p-2.5 font-mono font-bold text-slate-800">{k.tanggal}</td>
                            <td className="p-2.5 text-slate-700">{k.keterangan}</td>
                            <td className="p-2.5 font-medium text-slate-600">{k.metodeBayar || 'Kas Masuk'}</td>
                            <td className="p-2.5 text-right font-mono font-bold text-emerald-700">
                              {formatRupiah(k.nominal)}
                            </td>
                            <td className="p-2.5 text-right">
                              <button
                                onClick={() => handleRequestDeleteKasPayment(k, detailStudent.nama)}
                                className="p-1 rounded text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                                title="Hapus transaksi pembayaran kas ini"
                              >
                                <i className="fa-solid fa-trash-can"></i>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setDetailStudent(null)}
                  className="px-4 py-2 bg-slate-800 text-white rounded-xl font-bold text-xs hover:bg-slate-900"
                >
                  Tutup
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      {/* Modal: Full Sheet Printable Statement & Kwitansi (Bebas Scroll, Lembaran Utuh) */}
      {printInvoiceStudent && (() => {
        const item = studentBillingList.find((i) => i.student.id === printInvoiceStudent.id);
        if (!item) return null;

        return (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-3xl w-full p-8 shadow-2xl border border-slate-200 animate-scale-up space-y-6 my-auto">
              
              {/* Action Toolbar on Top */}
              <div className="no-print flex items-center justify-between pb-4 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-print text-indigo-600"></i>
                  <span className="font-bold text-sm text-slate-800">Pratinjau Cetak Lembaran Rincian & Kwitansi</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => window.print()}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-200"
                  >
                    <i className="fa-solid fa-print"></i>
                    <span>Cetak / Simpan PDF</span>
                  </button>
                  <button
                    onClick={() => setPrintInvoiceStudent(null)}
                    className="px-3 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-100"
                  >
                    Tutup
                  </button>
                </div>
              </div>

              {/* The Printable Sheet Layout */}
              <div className="print-sheet-full bg-white p-6 border border-slate-200 rounded-xl space-y-5 text-slate-900">
                
                {/* Header KOP Lembaga */}
                <div className="flex items-center justify-between pb-4 border-b-2 border-slate-900">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-2xl">
                      Σ
                    </div>
                    <div>
                      <h2 className="text-lg font-black text-slate-900 leading-tight uppercase tracking-wide">
                        {pengaturan.namaLembaga}
                      </h2>
                      <p className="text-xs font-semibold text-indigo-800 italic">"{pengaturan.tagline}"</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{pengaturan.alamat} • Kontak: {pengaturan.kontak}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="inline-block px-3 py-1 bg-slate-900 text-white text-xs font-extrabold uppercase tracking-widest rounded-md">
                      RINCIAN BIAYA & KWITANSI
                    </span>
                    <div className="text-[11px] font-mono text-slate-600 mt-1 font-bold">
                      Periode: {formatYearMonth(selectedMonth || currentYM)}
                    </div>
                  </div>
                </div>

                {/* Identitas Siswa */}
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3.5 rounded-lg border border-slate-200 text-xs">
                  <div>
                    <div className="text-[10px] uppercase font-bold text-slate-500">Nama Siswa:</div>
                    <div className="text-sm font-extrabold text-slate-900">{printInvoiceStudent.nama}</div>
                    <div className="text-[11px] font-mono text-indigo-700 font-bold">{printInvoiceStudent.kodeSiswa}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-bold text-slate-500">Program / Jenjang:</div>
                    <div className="font-bold text-slate-900">{printInvoiceStudent.tingkat} ({printInvoiceStudent.jenisKelas})</div>
                    <div className="text-[11px] text-slate-600">Tutor: {printInvoiceStudent.tutorPembina}</div>
                  </div>
                </div>

                {/* Tabel Sesi Absensi */}
                <div>
                  <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider mb-2">
                    1. Rincian Sesi Kehadiran & Pembelajaran
                  </h4>
                  <table className="w-full text-left border border-slate-300 text-xs">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-300 font-bold text-slate-800">
                        <th className="p-2 w-8 text-center border-r border-slate-300">No</th>
                        <th className="p-2 w-28 border-r border-slate-300">Tanggal</th>
                        <th className="p-2 w-20 text-center border-r border-slate-300">Status</th>
                        <th className="p-2 border-r border-slate-300">Materi yang Dipelajari</th>
                        <th className="p-2 w-28 text-right">Tarif</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {item.studentAbsensiMonth.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-4 text-center text-slate-400 italic">
                            Belum ada sesi presensi pada periode ini.
                          </td>
                        </tr>
                      ) : (
                        item.studentAbsensiMonth.map((a, i) => (
                          <tr key={a.id}>
                            <td className="p-2 text-center font-mono border-r border-slate-200">{i + 1}</td>
                            <td className="p-2 font-mono border-r border-slate-200">{a.tanggal}</td>
                            <td className="p-2 text-center border-r border-slate-200 font-bold">
                              {a.status}
                            </td>
                            <td className="p-2 border-r border-slate-200">{a.materi}</td>
                            <td className="p-2 text-right font-mono font-bold">
                              {a.status === 'Hadir' ? formatRupiah(printInvoiceStudent.tarifPerSesi) : 'Rp 0'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50 border-t-2 border-slate-300 font-bold">
                        <td colSpan={3} className="p-2 text-right uppercase text-slate-600 border-r border-slate-300">
                          Total Sesi Hadir:
                        </td>
                        <td className="p-2 font-mono font-black text-indigo-900 border-r border-slate-300">
                          {item.countHadir} Sesi Hadir
                        </td>
                        <td className="p-2 text-right font-mono font-black text-slate-900">
                          {formatRupiah(item.totalBiaya)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Perhitungan Biaya & Kas Terbayar */}
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5 text-xs">
                    <div className="font-bold text-slate-800 uppercase text-[10px]">2. Riwayat Pembayaran di Kas Bimbel:</div>
                    {item.studentKasMasukMonth.length === 0 ? (
                      <div className="text-slate-400 italic text-[11px]">Belum ada pembayaran yang tercatat.</div>
                    ) : (
                      item.studentKasMasukMonth.map((k) => (
                        <div key={k.id} className="flex justify-between font-mono text-[11px]">
                          <span>• {k.tanggal} ({k.metodeBayar || 'Kas'}):</span>
                          <span className="font-bold text-emerald-700">{formatRupiah(k.nominal)}</span>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="p-3 bg-indigo-50/80 rounded-lg border border-indigo-200 space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-700">
                      <span>Total Biaya Absensi:</span>
                      <span className="font-mono font-bold">{formatRupiah(item.totalBiaya)}</span>
                    </div>
                    <div className="flex justify-between text-emerald-800 font-bold">
                      <span>Total Terbayar di Kas:</span>
                      <span className="font-mono">{formatRupiah(item.totalTerbayar)}</span>
                    </div>
                    <div className="flex justify-between border-t border-indigo-200 pt-1 text-sm font-extrabold">
                      <span className={item.sisaTagihan > 0 ? 'text-rose-700' : 'text-slate-800'}>
                        {item.sisaTagihan > 0 ? 'Sisa Tagihan / Kurang:' : 'Sisa Tagihan:'}
                      </span>
                      <span className={`font-mono ${item.sisaTagihan > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                        {formatRupiah(item.sisaTagihan)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-black uppercase ${
                        item.statusKeterangan === 'Lunas' ? 'bg-emerald-200 text-emerald-900' : 'bg-rose-200 text-rose-900'
                      }`}>
                        Status: {item.statusKeterangan}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Tanda Tangan */}
                <div className="pt-6 grid grid-cols-2 text-center text-xs">
                  <div>
                    <div className="text-slate-500 mb-12">Wali Murid / Siswa,</div>
                    <div className="font-bold border-b border-slate-400 inline-block px-8 pb-1">
                      ( {printInvoiceStudent.nama} )
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 mb-12">
                      Jakarta, {formatIndonesianDate(today, false)}<br />
                      Pimpinan / Pengelola {pengaturan.namaLembaga},
                    </div>
                    <div className="font-bold border-b border-slate-400 inline-block px-8 pb-1">
                      ( {pengaturan.pimpinan} )
                    </div>
                  </div>
                </div>

              </div>

            </div>
          </div>
        );
      })()}

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
