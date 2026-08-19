import React, { useState } from 'react';
import { AbsensiRecord, PengaturanBimbel, Student, TransaksiKas } from '../types';
import { 
  exportToCSV, 
  formatIndonesianDate, 
  formatMonthYear, 
  formatRupiah, 
  getTodayDateString, 
  NAMA_BULAN 
} from '../utils/helpers';

interface KartuPresensiViewProps {
  students: Student[];
  absensi: AbsensiRecord[];
  kas: TransaksiKas[];
  pengaturan: PengaturanBimbel;
  onShowToast: (text: string, type?: 'success' | 'info' | 'error' | 'warning') => void;
}

export const KartuPresensiView: React.FC<KartuPresensiViewProps> = ({
  students,
  absensi,
  kas,
  pengaturan,
  onShowToast,
}) => {
  const currentYear = new Date().getFullYear();
  const currentMonthIdx = new Date().getMonth();
  const today = getTodayDateString();

  // Filters
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonthIdx);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('ALL');

  // Layout Mode: 'lembaran' (Full A4 Page Sheet per student) or 'kartu-quarter' (1/4 A4 Grid 2x2)
  const [layoutMode, setLayoutMode] = useState<'lembaran' | 'kartu-quarter'>('lembaran');

  const monthPrefix = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;

  // Filter students
  const activeStudents = students.filter((s) => s.status === 'Aktif');
  const targetStudents = selectedStudentId === 'ALL'
    ? activeStudents
    : students.filter((s) => s.id === selectedStudentId);

  // Compute student attendance & billing data for selected month
  const studentBillingData = targetStudents.map((student) => {
    // All attendance records for this student in the month
    const studentAbsensi = absensi
      .filter((a) => (a.siswaId === student.id || (a.kodeSiswa && a.kodeSiswa === student.kodeSiswa)) && a.tanggal.startsWith(monthPrefix))
      .sort((a, b) => a.tanggal.localeCompare(b.tanggal));

    const hadirRecords = studentAbsensi.filter((a) => a.status === 'Hadir');
    const izinCount = studentAbsensi.filter((a) => a.status === 'Izin').length;
    const sakitCount = studentAbsensi.filter((a) => a.status === 'Sakit').length;
    const alphaCount = studentAbsensi.filter((a) => a.status === 'Alpha').length;

    const totalSesiHadir = hadirRecords.length;
    const totalTagihan = totalSesiHadir * (student.tarifPerSesi || 0);

    // Payments linked via TransaksiKas (Kas Masuk with SPP category, siswaId and matching bulanTagihan/tanggal prefix)
    const matchingKas = kas.filter((k) => 
      k.jenis === 'Masuk' &&
      (k.kategori.toLowerCase().includes('spp') || k.kategori === 'SPP Les Bulanan') &&
      (k.siswaId === student.id || k.siswaId === student.kodeSiswa) &&
      (k.bulanTagihan === monthPrefix || (!k.bulanTagihan && k.tanggal.startsWith(monthPrefix)))
    );

    const totalTerbayar = matchingKas.reduce((sum, k) => sum + (k.nominal || 0), 0);
    const isLunas = totalTagihan > 0 ? totalTerbayar >= totalTagihan : totalTerbayar > 0;

    return {
      student,
      studentAbsensi,
      hadirRecords,
      totalSesiHadir,
      izinCount,
      sakitCount,
      alphaCount,
      totalTagihan,
      totalTerbayar,
      isLunas,
      matchingKas,
    };
  });

  // Handle Print via Window
  const handlePrint = () => {
    window.print();
  };

  // Handle Download Standalone Printable HTML
  const handleDownloadHTML = () => {
    const htmlContent = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Rekap Presensi & Kartu Tagihan - ${pengaturan.namaLembaga}</title>
  <style>
    body { font-family: 'Segoe UI', Roboto, sans-serif; color: #0f172a; margin: 20px; line-height: 1.4; }
    .sheet { border: 2px solid #1e293b; padding: 24px; border-radius: 8px; margin-bottom: 24px; page-break-inside: avoid; }
    .header { border-bottom: 2px solid #1e293b; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; }
    .title { font-size: 18px; font-weight: 900; text-transform: uppercase; margin: 0; }
    .tagline { font-size: 11px; font-style: italic; color: #475569; margin: 2px 0 0 0; }
    .meta-box { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; margin-bottom: 16px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 11px; }
    th { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; font-weight: bold; }
    td { border: 1px solid #e2e8f0; padding: 6px 8px; vertical-align: top; }
    .total-box { background: #0f172a; color: #ffffff; padding: 10px 14px; border-radius: 6px; display: flex; justify-content: space-between; font-weight: bold; margin-top: 12px; }
    .sig-grid { display: flex; justify-content: space-between; margin-top: 24px; font-size: 11px; }
    @media print { .sheet { page-break-after: always; } }
  </style>
</head>
<body>
  ${studentBillingData.map(({ student, studentAbsensi, totalSesiHadir, totalTagihan, totalTerbayar, isLunas }) => `
    <div class="sheet">
      <div class="header">
        <div>
          <h2 class="title">${pengaturan.namaLembaga}</h2>
          <p class="tagline">"${pengaturan.tagline}"</p>
          <p style="font-size: 10px; color: #64748b; margin: 2px 0 0 0;">${pengaturan.alamat} • ${pengaturan.kontak}</p>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 11px; font-weight: bold; background: #0f172a; color: white; padding: 3px 8px; border-radius: 4px; display: inline-block;">LEMBAR REKAP PRESENSI & TAGIHAN</div>
          <div style="font-size: 11px; font-weight: bold; margin-top: 4px;">Periode: ${formatMonthYear(selectedYear, selectedMonth)}</div>
        </div>
      </div>

      <div class="meta-box">
        <div><strong>Nama Siswa:</strong> ${student.nama}</div>
        <div><strong>Kode Siswa:</strong> ${student.kodeSiswa}</div>
        <div><strong>Jenjang / Kelas:</strong> ${student.tingkat} (${student.jenisKelas})</div>
        <div><strong>Tutor Pembina:</strong> ${student.tutorPembina || '-'}</div>
      </div>

      <div style="font-size: 12px; font-weight: bold; margin-bottom: 6px;">Riwayat Kehadiran & Materi Pembelajaran Lengkap:</div>
      <table>
        <thead>
          <tr>
            <th style="width: 30px; text-align: center;">No</th>
            <th style="width: 80px;">Tanggal</th>
            <th style="width: 50px;">Jam</th>
            <th style="width: 65px;">Status</th>
            <th>Materi Pembelajaran Lengkap</th>
            <th>Catatan Evaluasi / Kemajuan</th>
            <th style="width: 80px; text-align: right;">Paraf</th>
          </tr>
        </thead>
        <tbody>
          ${studentAbsensi.length === 0 ? `<tr><td colspan="7" style="text-align: center; color: #94a3b8; padding: 16px;">Belum ada catatan presensi pada bulan ini.</td></tr>` : ''}
          ${studentAbsensi.map((a, idx) => `
            <tr>
              <td style="text-align: center;">${idx + 1}</td>
              <td><strong>${a.tanggal}</strong></td>
              <td>${a.jam}</td>
              <td><strong>${a.status}</strong></td>
              <td>${a.materi || '-'}</td>
              <td>${a.catatan || '-'}</td>
              <td style="text-align: right; color: #047857; font-weight: bold;">${a.status === 'Hadir' ? '✓ Hadir' : a.status}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div style="margin-top: 12px; font-size: 12px; display: flex; justify-content: space-between;">
        <span>Kalkulasi: <strong>${totalSesiHadir} Sesi Hadir</strong> × ${formatRupiah(student.tarifPerSesi)}</span>
        <span>Status Pembayaran: <strong>${isLunas ? 'LUNAS' : totalTerbayar > 0 ? `SEBAGIAN (${formatRupiah(totalTerbayar)})` : 'BELUM LUNAS'}</strong></span>
      </div>

      <div class="total-box">
        <span>TOTAL BIAYA LES:</span>
        <span>${formatRupiah(totalTagihan)}</span>
      </div>

      <div class="sig-grid">
        <div>
          <p>Wali Murid / Siswa,</p>
          <div style="height: 45px;"></div>
          <p><strong>( ${student.nama} )</strong></p>
        </div>
        <div style="text-align: right;">
          <p>Jakarta, ${formatIndonesianDate(today, false)}<br>Pengelola ${pengaturan.namaLembaga},</p>
          <div style="height: 35px;"></div>
          <p><strong><u>${pengaturan.pimpinan}</u></strong><br><span style="font-size: 9px; color: #64748b;">NIK: ${pengaturan.nik}</span></p>
        </div>
      </div>
    </div>
  `).join('')}
</body>
</html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Lembar_Rekap_Presensi_Bimbel_Sigma_${monthPrefix}.html`;
    a.click();
    URL.revokeObjectURL(url);
    onShowToast('File Lembaran Rekap (.html) berhasil diunduh!', 'success');
  };

  // Handle Download CSV
  const handleDownloadCSV = () => {
    const headers = [
      'No',
      'Kode Siswa',
      'Nama Siswa',
      'Jenjang',
      'Kelas',
      'Periode',
      'Total Sesi Hadir',
      'Izin',
      'Sakit',
      'Alpha',
      'Tarif/Sesi (Rp)',
      'Total Tagihan (Rp)',
      'Total Terbayar (Rp)',
      'Status Bayar'
    ];

    const rows = studentBillingData.map(({ student, totalSesiHadir, izinCount, sakitCount, alphaCount, totalTagihan, totalTerbayar, isLunas }, idx) => [
      idx + 1,
      student.kodeSiswa,
      student.nama,
      student.tingkat,
      student.jenisKelas,
      formatMonthYear(selectedYear, selectedMonth),
      totalSesiHadir,
      izinCount,
      sakitCount,
      alphaCount,
      student.tarifPerSesi,
      totalTagihan,
      totalTerbayar,
      isLunas ? 'Lunas' : totalTerbayar > 0 ? 'Sebagian' : 'Belum Lunas'
    ]);

    exportToCSV([headers, ...rows], `Rekap_Presensi_Tagihan_Bimbel_Sigma_${monthPrefix}.csv`);
    onShowToast('File Rekap CSV berhasil diunduh!', 'success');
  };

  return (
    <div className="space-y-6">
      
      {/* Screen Toolbar Card (Hidden in print) */}
      <div className="no-print bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm">
              <i className="fa-solid fa-id-card-clip"></i>
            </div>
            <h2 className="text-lg font-extrabold text-slate-900">Rekap Presensi & Cetak Kartu / Lembaran</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Riwayat absensi dan <b>materi pembelajaran lengkap (lembaran tanpa scroll)</b> dengan kalkulasi tarif per sesi hadir
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          
          {/* Download HTML */}
          <button
            id="btn-download-lembar-html"
            onClick={handleDownloadHTML}
            className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs"
            title="Download Lembaran Rekap format Dokumen HTML"
          >
            <i className="fa-solid fa-file-code text-indigo-600 text-sm"></i>
            <span>Download Lembar (.html)</span>
          </button>

          {/* Download CSV */}
          <button
            id="btn-download-kartu-csv"
            onClick={handleDownloadCSV}
            className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs"
            title="Download Rekap CSV"
          >
            <i className="fa-solid fa-file-csv text-emerald-600 text-sm"></i>
            <span>Download (.csv)</span>
          </button>

          {/* Cetak / Print PDF */}
          <button
            id="btn-cetak-kartu"
            onClick={handlePrint}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs flex items-center gap-2 transition-all shadow-md shadow-indigo-200"
          >
            <i className="fa-solid fa-print text-sm"></i>
            <span>Cetak / Simpan PDF</span>
          </button>
        </div>
      </div>

      {/* Filter & Layout Mode Bar (Hidden in print) */}
      <div className="no-print bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          
          {/* Pilih Bulan */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
              Periode Bulan:
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="w-full py-2 px-3 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden bg-white text-slate-700 font-bold"
            >
              {NAMA_BULAN.map((m, idx) => (
                <option key={idx} value={idx}>{m}</option>
              ))}
            </select>
          </div>

          {/* Pilih Tahun */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
              Tahun:
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="w-full py-2 px-3 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden bg-white text-slate-700 font-bold"
            >
              {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Filter Siswa */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
              Pilih Siswa yang Dicetak:
            </label>
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="w-full py-2 px-3 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden bg-white text-slate-700 font-bold"
            >
              <option value="ALL">Semua Siswa Aktif ({activeStudents.length} Siswa)</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.kodeSiswa} - {s.nama} ({s.tingkat})
                </option>
              ))}
            </select>
          </div>

          {/* Layout Mode Selector */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
              Format Tampilan & Cetak:
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setLayoutMode('lembaran')}
                className={`py-2 px-2 rounded-xl text-xs font-extrabold border flex items-center justify-center gap-1.5 transition-all ${
                  layoutMode === 'lembaran'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <i className="fa-solid fa-file-lines"></i>
                <span>Lembar Penuh</span>
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode('kartu-quarter')}
                className={`py-2 px-2 rounded-xl text-xs font-extrabold border flex items-center justify-center gap-1.5 transition-all ${
                  layoutMode === 'kartu-quarter'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <i className="fa-solid fa-grip"></i>
                <span>Kartu 1/4 A4</span>
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* PRINT CONTAINER / SCREEN PREVIEW */}
      <div className="print-container">
        
        {studentBillingData.length === 0 ? (
          <div className="no-print bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-400 text-xs">
            Tidak ada siswa aktif untuk dicetak kartu / lembar presensinya.
          </div>
        ) : layoutMode === 'lembaran' ? (
          /* ========================================================= */
          /* MODE 1: LEMBARAN REKAP LENGKAP (FULL SHEET PER SISWA)    */
          /* ========================================================= */
          <div className="space-y-6">
            {studentBillingData.map(({ student, studentAbsensi, totalSesiHadir, izinCount, sakitCount, alphaCount, totalTagihan, totalTerbayar, isLunas }) => (
              <div
                key={student.id}
                className="bg-white border-2 border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xs space-y-4 print-sheet-full text-slate-900"
              >
                {/* Header Kop */}
                <div className="border-b-2 border-slate-800 pb-3 flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-xl shrink-0">
                      Σ
                    </div>
                    <div>
                      <h3 className="font-black text-base uppercase tracking-tight text-slate-900 leading-tight">
                        {pengaturan.namaLembaga}
                      </h3>
                      <p className="text-xs font-semibold text-indigo-700 italic leading-tight">
                        "{pengaturan.tagline}"
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {pengaturan.alamat} • Telp: {pengaturan.kontak} • {pengaturan.email}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-black uppercase bg-slate-900 text-white px-3 py-1 rounded inline-block">
                      LEMBAR REKAPITULASI PRESENSI & TAGIHAN
                    </div>
                    <div className="text-xs font-bold text-slate-800 font-mono mt-1">
                      PERIODE: {formatMonthYear(selectedYear, selectedMonth).toUpperCase()}
                    </div>
                  </div>
                </div>

                {/* Student Info Box */}
                <div className="bg-slate-50 border border-slate-300 rounded-xl p-3.5 text-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Nama Siswa:</span>
                    <span className="font-black text-sm text-slate-900">{student.nama}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Kode & Jenjang:</span>
                    <span className="font-bold text-slate-800 font-mono">{student.kodeSiswa} ({student.tingkat} - {student.jenisKelas})</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Tutor Pembina:</span>
                    <span className="font-medium text-slate-800">{student.tutorPembina || '-'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Tarif Les / Sesi:</span>
                    <span className="font-mono font-bold text-slate-900">{formatRupiah(student.tarifPerSesi)} / Sesi</span>
                  </div>
                </div>

                {/* Complete History Table - NO SCROLL, FULL EXPANDED */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span>Daftar Riwayat Kehadiran & Materi Pembelajaran Lengkap:</span>
                    <span className="font-mono text-slate-600">
                      Hadir: {totalSesiHadir} | Izin: {izinCount} | Sakit: {sakitCount} | Alpha: {alphaCount}
                    </span>
                  </div>

                  <div className="border border-slate-300 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-300 font-bold text-slate-700">
                          <th className="py-2 px-3 w-10 text-center">No</th>
                          <th className="py-2 px-3 w-28">Tanggal</th>
                          <th className="py-2 px-2 w-16">Jam</th>
                          <th className="py-2 px-3 w-20 text-center">Status</th>
                          <th className="py-2 px-3">Materi Pembelajaran Lengkap</th>
                          <th className="py-2 px-3">Catatan Evaluasi / Tutor</th>
                          <th className="py-2 px-3 text-right w-20">Paraf</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {studentAbsensi.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-6 text-center text-slate-400 italic text-xs">
                              Belum ada catatan presensi untuk siswa ini pada bulan terpilih.
                            </td>
                          </tr>
                        ) : (
                          studentAbsensi.map((a, idx) => (
                            <tr key={a.id} className="hover:bg-slate-50/70">
                              <td className="py-2 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                              <td className="py-2 px-3 font-mono font-bold text-slate-900">
                                {a.tanggal}
                              </td>
                              <td className="py-2 px-2 font-mono text-slate-600">{a.jam}</td>
                              <td className="py-2 px-3 text-center">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                    a.status === 'Hadir'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : a.status === 'Izin'
                                      ? 'bg-amber-100 text-amber-800'
                                      : a.status === 'Sakit'
                                      ? 'bg-blue-100 text-blue-800'
                                      : 'bg-rose-100 text-rose-800'
                                  }`}
                                >
                                  {a.status}
                                </span>
                              </td>
                              <td className="py-2 px-3 font-medium text-slate-900 leading-relaxed">
                                {a.materi || '-'}
                              </td>
                              <td className="py-2 px-3 text-slate-600 text-[11px] leading-relaxed">
                                {a.catatan || '-'}
                              </td>
                              <td className="py-2 px-3 text-right text-emerald-700 font-bold">
                                {a.status === 'Hadir' ? '✓ Hadir' : a.status}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Calculation Strip & Total */}
                <div className="bg-slate-50 border border-slate-300 rounded-xl p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center text-xs gap-2">
                    <span className="text-slate-700">
                      Rincian Perhitungan: <b>{totalSesiHadir} Sesi Hadir</b> × {formatRupiah(student.tarifPerSesi)} / Sesi
                    </span>
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-black uppercase ${
                      isLunas
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : totalTerbayar > 0
                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                        : 'bg-rose-100 text-rose-800 border border-rose-300'
                    }`}>
                      Status Kas: {isLunas ? '✓ LUNAS' : totalTerbayar > 0 ? `SEBAGIAN (${formatRupiah(totalTerbayar)})` : '⚠️ BELUM LUNAS'}
                    </span>
                  </div>

                  <div className="bg-slate-900 text-white rounded-xl p-3 flex items-center justify-between font-black">
                    <span className="text-xs uppercase tracking-wider">TOTAL BIAYA LES (TAGIHAN):</span>
                    <span className="font-mono text-amber-300 text-base">{formatRupiah(totalTagihan)}</span>
                  </div>
                </div>

                {/* Signatures */}
                <div className="pt-4 border-t border-slate-300 grid grid-cols-2 gap-8 text-xs text-slate-700">
                  <div>
                    <p>Wali Murid / Siswa,</p>
                    <div className="h-14"></div>
                    <p className="font-bold text-slate-900">( {student.nama} )</p>
                  </div>
                  <div className="text-right">
                    <p className="text-slate-600">Jakarta, {formatIndonesianDate(today, false)}</p>
                    <p className="font-bold text-slate-900 mt-0.5">Pimpinan & Pengelola {pengaturan.namaLembaga},</p>
                    <div className="h-14"></div>
                    <p className="font-bold underline text-slate-900">{pengaturan.pimpinan}</p>
                    <p className="text-[10px] text-slate-500 font-mono">NIK: {pengaturan.nik}</p>
                  </div>
                </div>

              </div>
            ))}
          </div>
        ) : (
          /* ========================================================= */
          /* MODE 2: KARTU PRESENSI 1/4 A4 (GRID 2X2)                  */
          /* ========================================================= */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print-grid-2x2">
            {studentBillingData.map(({ student, hadirRecords, totalSesiHadir, izinCount, sakitCount, alphaCount, totalTagihan, totalTerbayar, isLunas }) => (
              <div
                key={student.id}
                className="bg-white border-2 border-slate-800 rounded-xl p-4 shadow-xs flex flex-col justify-between space-y-2.5 print-card-quarter text-slate-900"
              >
                {/* Header Kop */}
                <div className="border-b-2 border-slate-800 pb-2 flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-black text-base shrink-0">
                      Σ
                    </div>
                    <div>
                      <h4 className="font-black text-xs uppercase tracking-tight text-slate-900 leading-tight">
                        {pengaturan.namaLembaga}
                      </h4>
                      <p className="text-[8px] text-slate-600 italic leading-none line-clamp-1">
                        "{pengaturan.tagline}"
                      </p>
                      <p className="text-[8px] text-slate-500 leading-tight mt-0.5">
                        {pengaturan.alamat}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[9px] font-black uppercase bg-slate-900 text-white px-2 py-0.5 rounded">
                      KARTU PRESENSI
                    </div>
                    <div className="text-[9px] font-bold text-slate-700 font-mono mt-0.5">
                      {formatMonthYear(selectedYear, selectedMonth)}
                    </div>
                  </div>
                </div>

                {/* Student Info Box */}
                <div className="bg-slate-50 border border-slate-300 rounded p-2 text-[10px] grid grid-cols-2 gap-x-2 gap-y-1">
                  <div>
                    <span className="text-slate-500">Nama Siswa:</span>
                    <div className="font-extrabold text-slate-900 truncate">{student.nama}</div>
                  </div>
                  <div>
                    <span className="text-slate-500">Kode Siswa:</span>
                    <div className="font-bold text-slate-800 font-mono">{student.kodeSiswa}</div>
                  </div>
                  <div>
                    <span className="text-slate-500">Jenjang:</span>
                    <div className="font-bold text-slate-800">{student.tingkat} ({student.jenisKelas})</div>
                  </div>
                  <div>
                    <span className="text-slate-500">Tutor Pembina:</span>
                    <div className="font-bold text-slate-800 truncate">{student.tutorPembina || '-'}</div>
                  </div>
                </div>

                {/* Attendance Summary */}
                <div className="flex-1 space-y-1">
                  <div className="text-[9px] font-bold uppercase text-slate-600 flex justify-between">
                    <span>Sesi Kehadiran & Materi:</span>
                    <span className="text-slate-500 font-mono">
                      H: {totalSesiHadir} | I: {izinCount} | S: {sakitCount} | A: {alphaCount}
                    </span>
                  </div>

                  {/* Sessions table without inner scrollbar */}
                  <div className="border border-slate-300 rounded overflow-hidden">
                    <table className="w-full text-left text-[9px] border-collapse">
                      <thead>
                        <tr className="bg-slate-200/80 border-b border-slate-300 font-bold text-slate-700">
                          <th className="py-0.5 px-1.5 w-6 text-center">No</th>
                          <th className="py-0.5 px-1.5 w-16">Tanggal</th>
                          <th className="py-0.5 px-1.5">Materi Pelajaran</th>
                          <th className="py-0.5 px-1.5 text-right w-12">Paraf</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 font-mono">
                        {hadirRecords.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-3 text-center text-slate-400 font-sans italic text-[8px]">
                              Belum ada sesi kehadiran tercatat di bulan ini.
                            </td>
                          </tr>
                        ) : (
                          hadirRecords.slice(0, 8).map((r, sIdx) => (
                            <tr key={r.id}>
                              <td className="py-0.5 px-1.5 text-center text-slate-500">{sIdx + 1}</td>
                              <td className="py-0.5 px-1.5 font-bold">{r.tanggal.split('-').slice(1).join('/')}</td>
                              <td className="py-0.5 px-1.5 truncate max-w-[120px] font-sans">{r.materi}</td>
                              <td className="py-0.5 px-1.5 text-right text-emerald-700 font-bold font-sans">✓ Hadir</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Calculation and Signatures */}
                <div className="border-t-2 border-dashed border-slate-400 pt-2 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-slate-600 font-medium">
                      Perhitungan: <b>{totalSesiHadir} Sesi Hadir</b> × {formatRupiah(student.tarifPerSesi)}
                    </span>
                    <span className="font-extrabold text-xs text-slate-900 font-mono">
                      {formatRupiah(totalTagihan)}
                    </span>
                  </div>

                  <div className="bg-slate-900 text-white rounded p-1.5 flex items-center justify-between text-xs font-black">
                    <span className="text-[9px] uppercase tracking-wider">TOTAL BIAYA LES:</span>
                    <span className="font-mono text-amber-300">{formatRupiah(totalTagihan)}</span>
                  </div>

                  <div className="pt-1 flex items-end justify-between text-[8px] text-slate-600">
                    <div>
                      <p>Wali Murid / Siswa,</p>
                      <div className="h-6"></div>
                      <p className="font-bold">( {student.nama} )</p>
                    </div>
                    <div className="text-right">
                      <p>Pengelola {pengaturan.namaLembaga},</p>
                      <div className="h-6"></div>
                      <p className="font-bold underline">{pengaturan.pimpinan}</p>
                    </div>
                  </div>
                </div>

              </div>
            ))}
          </div>
        )}

      </div>

    </div>
  );
};
