import React, { useState, useEffect } from 'react';
import { PengaturanBimbel, TransaksiKas } from '../types';
import { formatIndonesianDate, formatRupiah, getTodayDateString, NAMA_BULAN } from '../utils/helpers';

interface ProfitLossViewProps {
  kas: TransaksiKas[];
  pengaturan: PengaturanBimbel;
  onShowToast: (text: string, type?: 'success' | 'info' | 'error' | 'warning') => void;
}

export const ProfitLossView: React.FC<ProfitLossViewProps> = ({
  kas,
  pengaturan,
  onShowToast,
}) => {
  const currentYear = new Date().getFullYear();
  const today = getTodayDateString();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);

  // Signature Customization States
  const [tempatTtd, setTempatTtd] = useState<string>(pengaturan.kota || 'Jakarta');
  const [tanggalTtd, setTanggalTtd] = useState<string>(today);
  const [jabatanTtd, setJabatanTtd] = useState<string>(`Pimpinan & Pengelola ${pengaturan.namaLembaga}`);
  const [namaTtd, setNamaTtd] = useState<string>(pengaturan.pimpinan);
  const [nikTtd, setNikTtd] = useState<string>(pengaturan.nik);
  const [showConfigPanel, setShowConfigPanel] = useState<boolean>(true);

  // Sync defaults when pengaturan changes if user hasn't heavily modified
  useEffect(() => {
    if (pengaturan.kota && (!tempatTtd || tempatTtd === 'Jakarta')) {
      setTempatTtd(pengaturan.kota);
    }
    if (pengaturan.pimpinan && !namaTtd) {
      setNamaTtd(pengaturan.pimpinan);
    }
    if (pengaturan.nik && !nikTtd) {
      setNikTtd(pengaturan.nik);
    }
  }, [pengaturan]);

  // Compute 12-month P&L data for selected year
  const monthlyData = NAMA_BULAN.map((monthName, index) => {
    const monthPrefix = `${selectedYear}-${String(index + 1).padStart(2, '0')}`;
    const monthKas = kas.filter((k) => k.tanggal.startsWith(monthPrefix));

    const pemasukan = monthKas
      .filter((k) => k.jenis === 'Masuk')
      .reduce((sum, item) => sum + (item.nominal || 0), 0);

    const pengeluaran = monthKas
      .filter((k) => k.jenis === 'Keluar')
      .reduce((sum, item) => sum + (item.nominal || 0), 0);

    const netProfit = pemasukan - pengeluaran;
    const margin = pemasukan > 0 ? ((netProfit / pemasukan) * 100).toFixed(1) : '0.0';

    return {
      monthNumber: index + 1,
      monthName,
      pemasukan,
      pengeluaran,
      netProfit,
      margin,
      transactionCount: monthKas.length,
    };
  });

  // Annual Totals
  const totalPemasukanTahunan = monthlyData.reduce((sum, m) => sum + m.pemasukan, 0);
  const totalPengeluaranTahunan = monthlyData.reduce((sum, m) => sum + m.pengeluaran, 0);
  const totalNetProfitTahunan = totalPemasukanTahunan - totalPengeluaranTahunan;
  const marginTahunan = totalPemasukanTahunan > 0
    ? ((totalNetProfitTahunan / totalPemasukanTahunan) * 100).toFixed(1)
    : '0.0';

  const handlePrint = () => {
    window.print();
  };

  // Download P&L Summary as CSV / Excel-compatible file
  const handleDownloadCSV = () => {
    const headers = [
      'No',
      'Bulan Operasional',
      'Pemasukan (Rp)',
      'Pengeluaran (Rp)',
      'Laba / Rugi Bersih (Rp)',
      'Margin Keuntungan (%)',
      'Status',
      'Jumlah Transaksi'
    ];

    const rows = monthlyData.map((m) => [
      m.monthNumber,
      `"${m.monthName} ${selectedYear}"`,
      m.pemasukan,
      m.pengeluaran,
      m.netProfit,
      `"${m.margin}%"`,
      m.pemasukan === 0 && m.pengeluaran === 0 ? 'Nihil' : m.netProfit >= 0 ? 'SURPLUS' : 'DEFISIT',
      m.transactionCount
    ]);

    const totalRow = [
      'TOTAL',
      `"TOTAL TAHUNAN ${selectedYear}"`,
      totalPemasukanTahunan,
      totalPengeluaranTahunan,
      totalNetProfitTahunan,
      `"${marginTahunan}%"`,
      totalNetProfitTahunan >= 0 ? 'SURPLUS' : 'DEFISIT',
      kas.filter((k) => k.tanggal.startsWith(String(selectedYear))).length
    ];

    const metadataRows = [
      [`"LAPORAN LABA RUGI (PROFIT & LOSS REPORT)"`],
      [`"Nama Lembaga: ${pengaturan.namaLembaga}"`],
      [`"Tahun Buku: ${selectedYear}"`],
      [`"Tanggal Unduh: ${formatIndonesianDate(getTodayDateString())}"`],
      [`"Tempat / Tanggal TTD: ${tempatTtd}, ${formatIndonesianDate(tanggalTtd, false)}"`],
      [`"Penandatangan: ${namaTtd} (${jabatanTtd})"`],
      []
    ];

    const csvContent = '\uFEFF' + [
      ...metadataRows.map(r => r.join(',')),
      headers.join(','),
      ...rows.map(r => r.join(',')),
      totalRow.join(',')
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Laporan_PnL_${selectedYear}_${(pengaturan.namaLembaga || 'Bimbel').replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    onShowToast(`Laporan Laba Rugi (P&L) Tahun ${selectedYear} berhasil diunduh (CSV / Excel)!`, 'success');
  };

  // Download Detailed Transaction Ledger for the selected year
  const handleDownloadDetailTransactionsCSV = () => {
    const yearKas = kas.filter((k) => k.tanggal.startsWith(String(selectedYear)));
    if (yearKas.length === 0) {
      onShowToast(`Tidak ada transaksi kas tercatat pada tahun ${selectedYear}`, 'warning');
      return;
    }

    const headers = [
      'ID Transaksi',
      'Tanggal',
      'Jenis (Masuk/Keluar)',
      'Kategori',
      'Keterangan',
      'Nominal (Rp)',
      'Bulan Tagihan SPP',
      'Metode Pembayaran'
    ];

    const rows = yearKas.map((k) => [
      `"${k.id}"`,
      `"${k.tanggal}"`,
      `"${k.jenis}"`,
      `"${k.kategori}"`,
      `"${(k.keterangan || '').replace(/"/g, '""')}"`,
      k.nominal,
      `"${k.bulanTagihan || '-'}"`,
      `"${k.metodeBayar || '-'}"`
    ]);

    const csvContent = '\uFEFF' + [
      [`"BUKU BESAR MUTASI KAS PENDUKUNG P&L TAHUN ${selectedYear}"`],
      [`"Lembaga: ${pengaturan.namaLembaga}"`],
      [`"Total Mutasi: ${yearKas.length} Transaksi"`],
      [],
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Buku_Besar_Kas_${selectedYear}_${(pengaturan.namaLembaga || 'Bimbel').replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    onShowToast(`Buku besar ${yearKas.length} transaksi kas tahun ${selectedYear} berhasil diunduh!`, 'success');
  };

  return (
    <div className="space-y-6">
      
      {/* Screen Toolbar Card (Hidden in print) */}
      <div className="no-print bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm">
              <i className="fa-solid fa-chart-line"></i>
            </div>
            <h2 className="text-lg font-extrabold text-slate-900">Laporan Laba Rugi Tahunan (P&L Report)</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Rekapitulasi komparasi pendapatan dan pengeluaran 12 bulan (Januari s/d Desember) untuk tahun {selectedYear}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Year Selector */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="font-bold text-slate-600">Tahun:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="py-2 px-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden bg-white text-slate-700 font-bold"
            >
              {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Toggle Signature Setting Panel */}
          <button
            onClick={() => setShowConfigPanel(!showConfigPanel)}
            className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
              showConfigPanel
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
            title="Buka/Tutup Pengaturan Tanda Tangan"
          >
            <i className="fa-solid fa-pen-fancy text-xs"></i>
            <span>Atur TTD</span>
            <i className={`fa-solid ${showConfigPanel ? 'fa-chevron-up' : 'fa-chevron-down'} text-[10px]`}></i>
          </button>

          {/* Download P&L CSV / Excel */}
          <button
            id="btn-download-pnl-csv"
            onClick={handleDownloadCSV}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
            title="Unduh Rekap Laporan P&L Tahunan dalam format CSV / Excel"
          >
            <i className="fa-solid fa-file-excel text-sm"></i>
            <span>Download P&L (CSV)</span>
          </button>

          {/* Download Detail Transactions */}
          <button
            id="btn-download-pnl-detail"
            onClick={handleDownloadDetailTransactionsCSV}
            className="px-3.5 py-2 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            title="Unduh Rincian Buku Besar Mutasi Kas Transaksi Pendukung"
          >
            <i className="fa-solid fa-table-list text-xs"></i>
            <span>Download Rincian Mutasi</span>
          </button>

          {/* Print / Save PDF Button */}
          <button
            id="btn-cetak-pl"
            onClick={handlePrint}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs flex items-center gap-2 transition-all shadow-md shadow-indigo-200 cursor-pointer"
            title="Cetak atau Simpan Laporan P&L Resmi format PDF A4"
          >
            <i className="fa-solid fa-print text-sm"></i>
            <span>Cetak / PDF P&L</span>
          </button>
        </div>
      </div>

      {/* Signature Customization Panel (No-print) */}
      {showConfigPanel && (
        <div className="no-print bg-slate-900 text-white rounded-2xl p-5 shadow-lg border border-slate-800 animate-scale-up space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-bold text-xs">
                <i className="fa-solid fa-pen-nib"></i>
              </div>
              <h3 className="font-bold text-sm text-slate-100">
                Pengaturan Tempat, Tanggal, & Penandatangan Dokumen P&L
              </h3>
            </div>
            <span className="text-[11px] text-slate-400">
              Perubahan langsung tampil pada lembar laporan di bawah sebelum dicetak
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
            {/* Tempat / Kota */}
            <div>
              <label className="block font-bold text-slate-300 mb-1">
                Kota / Tempat TTD:
              </label>
              <input
                type="text"
                value={tempatTtd}
                onChange={(e) => setTempatTtd(e.target.value)}
                placeholder="Contoh: Jakarta / Surabaya"
                className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white font-semibold focus:ring-2 focus:ring-indigo-400 outline-hidden"
              />
            </div>

            {/* Tanggal TTD */}
            <div>
              <label className="block font-bold text-slate-300 mb-1">
                Tanggal TTD Dokumen:
              </label>
              <input
                type="date"
                value={tanggalTtd}
                onChange={(e) => setTanggalTtd(e.target.value)}
                className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono focus:ring-2 focus:ring-indigo-400 outline-hidden font-bold"
              />
            </div>

            {/* Jabatan Penandatangan */}
            <div>
              <label className="block font-bold text-slate-300 mb-1">
                Jabatan Penandatangan:
              </label>
              <input
                type="text"
                value={jabatanTtd}
                onChange={(e) => setJabatanTtd(e.target.value)}
                placeholder="Pimpinan & Pengelola"
                className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-indigo-400 outline-hidden"
              />
            </div>

            {/* Nama Penandatangan */}
            <div>
              <label className="block font-bold text-slate-300 mb-1">
                Nama Lengkap & Gelar:
              </label>
              <input
                type="text"
                value={namaTtd}
                onChange={(e) => setNamaTtd(e.target.value)}
                placeholder="Nama Pimpinan"
                className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold focus:ring-2 focus:ring-indigo-400 outline-hidden"
              />
            </div>

            {/* NIK / NIP */}
            <div>
              <label className="block font-bold text-slate-300 mb-1">
                NIK / NIP (Opsional):
              </label>
              <input
                type="text"
                value={nikTtd}
                onChange={(e) => setNikTtd(e.target.value)}
                placeholder="317508..."
                className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono focus:ring-2 focus:ring-indigo-400 outline-hidden"
              />
            </div>
          </div>

          {/* Quick Date Presets */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span>Preset Tanggal Cepat:</span>
              <button
                type="button"
                onClick={() => setTanggalTtd(today)}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 font-semibold transition-colors"
              >
                Hari Ini ({today})
              </button>
              <button
                type="button"
                onClick={() => setTanggalTtd(`${selectedYear}-12-31`)}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 font-semibold transition-colors"
              >
                Akhir Tahun (31 Des {selectedYear})
              </button>
              <button
                type="button"
                onClick={() => setTanggalTtd(`${selectedYear}-06-30`)}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 font-semibold transition-colors"
              >
                Semester 1 (30 Jun {selectedYear})
              </button>
            </div>

            <div className="text-emerald-400 font-mono text-[11px]">
              Teks Terpasang: <b className="text-white">{tempatTtd || 'Jakarta'}, {formatIndonesianDate(tanggalTtd, false)}</b>
            </div>
          </div>
        </div>
      )}

      {/* Screen Annual Summary Strip (Hidden in print) */}
      <div className="no-print grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Pendapatan ({selectedYear})</span>
          <div className="text-2xl font-black text-emerald-700 font-mono">
            {formatRupiah(totalPemasukanTahunan)}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Pengeluaran ({selectedYear})</span>
          <div className="text-2xl font-black text-rose-700 font-mono">
            {formatRupiah(totalPengeluaranTahunan)}
          </div>
        </div>

        <div className={`p-5 rounded-2xl border shadow-xs space-y-1 ${
          totalNetProfitTahunan >= 0 ? 'bg-indigo-900 text-white border-indigo-800' : 'bg-rose-900 text-white border-rose-800'
        }`}>
          <span className="text-xs font-bold text-indigo-200 uppercase tracking-wider">Laba Bersih Tahunan (P&L)</span>
          <div className="text-2xl font-black font-mono">
            {formatRupiah(totalNetProfitTahunan)}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Margin Keuntungan Bersih</span>
          <div className="text-2xl font-black text-indigo-700 font-mono">
            {marginTahunan}%
          </div>
        </div>
      </div>

      {/* PRINT-READY CONTAINER FOR ANNUAL P&L */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 sm:p-8 print-container space-y-6 text-slate-900">
        
        {/* Official Kop Lembaga BIMBEL SIGMA */}
        <div className="border-b-2 border-slate-800 pb-4 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-2xl shrink-0">
              Σ
            </div>
            <div>
              <h1 className="font-black text-xl text-slate-900 uppercase tracking-tight leading-tight">
                {pengaturan.namaLembaga}
              </h1>
              <p className="text-xs font-semibold text-indigo-700 italic">
                "{pengaturan.tagline}"
              </p>
              <p className="text-[11px] text-slate-600 mt-0.5">
                {pengaturan.alamat} • Telp: {pengaturan.kontak} • Email: {pengaturan.email}
              </p>
            </div>
          </div>

          <div className="text-right shrink-0">
            <div className="text-xs font-black uppercase bg-slate-900 text-white px-3 py-1 rounded inline-block">
              LAPORAN LABA RUGI (PROFIT & LOSS)
            </div>
            <div className="text-xs font-extrabold text-slate-800 font-mono mt-1">
              TAHUN BUKU {selectedYear}
            </div>
          </div>
        </div>

        {/* 12 Months Profit & Loss Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 border-y-2 border-slate-800 text-slate-900 font-black uppercase text-[11px]">
                <th className="py-3 px-3 w-12 text-center">No</th>
                <th className="py-3 px-4">Bulan Operasional</th>
                <th className="py-3 px-4 text-right">Pemasukan (Rp)</th>
                <th className="py-3 px-4 text-right">Pengeluaran (Rp)</th>
                <th className="py-3 px-4 text-right">Laba / Rugi Bersih (Rp)</th>
                <th className="py-3 px-4 text-right">Margin (%)</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {monthlyData.map((m) => (
                <tr key={m.monthNumber} className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 text-center text-slate-400 font-mono">{m.monthNumber}</td>
                  <td className="py-2.5 px-4 font-bold text-slate-900">
                    {m.monthName} {selectedYear}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-800">
                    {m.pemasukan > 0 ? formatRupiah(m.pemasukan) : '-'}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono font-bold text-rose-800">
                    {m.pengeluaran > 0 ? formatRupiah(m.pengeluaran) : '-'}
                  </td>
                  <td className={`py-2.5 px-4 text-right font-mono font-black ${
                    m.netProfit >= 0 ? 'text-slate-900' : 'text-rose-700'
                  }`}>
                    {m.pemasukan === 0 && m.pengeluaran === 0 ? '-' : formatRupiah(m.netProfit)}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono text-slate-600">
                    {m.pemasukan > 0 ? `${m.margin}%` : '-'}
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    {m.pemasukan === 0 && m.pengeluaran === 0 ? (
                      <span className="text-slate-400 text-[10px] italic">Nihil</span>
                    ) : m.netProfit >= 0 ? (
                      <span className="inline-block px-2 py-0.5 rounded text-[9px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        SURPLUS
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 rounded text-[9px] font-extrabold bg-rose-100 text-rose-800 border border-rose-300">
                        DEFISIT
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-900 text-white font-black text-xs border-t-2 border-slate-950">
                <td colSpan={2} className="py-3 px-4 uppercase tracking-wider">
                  TOTAL TAHUNAN ({selectedYear})
                </td>
                <td className="py-3 px-4 text-right font-mono text-emerald-300">
                  {formatRupiah(totalPemasukanTahunan)}
                </td>
                <td className="py-3 px-4 text-right font-mono text-rose-300">
                  {formatRupiah(totalPengeluaranTahunan)}
                </td>
                <td className="py-3 px-4 text-right font-mono text-amber-300 text-sm">
                  {formatRupiah(totalNetProfitTahunan)}
                </td>
                <td className="py-3 px-4 text-right font-mono text-indigo-200">
                  {marginTahunan}%
                </td>
                <td className="py-3 px-4 text-center">
                  <span className="text-[10px] font-black uppercase text-amber-300">
                    {totalNetProfitTahunan >= 0 ? 'SURPLUS' : 'DEFISIT'}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Official Signatures and Notes */}
        <div className="pt-8 border-t border-slate-200 grid grid-cols-2 gap-8 text-xs text-slate-700">
          <div>
            <h4 className="font-bold text-slate-900 mb-1">Catatan Akuntansi & Rekonsiliasi:</h4>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Laporan keuangan ini disusun secara objektif berdasarkan mutasi kas masuk dan kas keluar harian yang terdata dalam sistem pembukuan {pengaturan.namaLembaga}. Telah diperiksa dan disetujui untuk arsip pembukuan resmi tahunan.
            </p>
            <p className="text-[10px] text-slate-400 mt-2 font-mono">
              Dicetak pada: {formatIndonesianDate(getTodayDateString())}
            </p>
          </div>

          <div className="text-right flex flex-col items-end justify-between">
            <div>
              <p className="text-slate-700 font-medium">
                {tempatTtd || pengaturan.kota || 'Jakarta'}, {formatIndonesianDate(tanggalTtd, false)}
              </p>
              <p className="font-bold text-slate-900 mt-0.5">{jabatanTtd}</p>
            </div>

            <div className="pt-16">
              <p className="font-black text-slate-900 underline text-sm">{namaTtd}</p>
              {nikTtd && (
                <p className="text-xs text-slate-600 font-mono mt-0.5">NIK: {nikTtd}</p>
              )}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};
