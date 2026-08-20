import React, { useState, useMemo } from 'react';
import { AbsensiRecord, ConfirmModalState, PengaturanBimbel, Student, TransaksiKas, MetodeBayar } from '../types';
import { formatRupiah, getTodayDateString } from '../utils/helpers';
import { ConfirmModal } from './ConfirmModal';

interface GajiTutorViewProps {
  students: Student[];
  absensi: AbsensiRecord[];
  kas: TransaksiKas[];
  pengaturan: PengaturanBimbel;
  onSaveKas: (newKas: TransaksiKas[]) => void;
  onSavePengaturan: (newPengaturan: PengaturanBimbel) => void;
  onShowToast: (text: string, type?: 'success' | 'info' | 'error' | 'warning') => void;
}

export const GajiTutorView: React.FC<GajiTutorViewProps> = ({
  students,
  absensi,
  kas,
  pengaturan,
  onSaveKas,
  onSavePengaturan,
  onShowToast,
}) => {
  // Filters State
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = String(currentDate.getMonth() + 1).padStart(2, '0');

  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth);
  const [selectedTutorFilter, setSelectedTutorFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PAID' | 'UNPAID'>('ALL');

  // Modal / Drawer State
  const [detailTutor, setDetailTutor] = useState<string | null>(null);
  const [payoutModalTutor, setPayoutModalTutor] = useState<any | null>(null);
  const [printSlipTutor, setPrintSlipTutor] = useState<any | null>(null);
  const [isConfigOpen, setIsConfigOpen] = useState<boolean>(false);

  // Warning Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Quick Rate Settings Form
  const [rateGrup, setRateGrup] = useState<number>(pengaturan.persentaseGajiGrup ?? 60);
  const [ratePrivat, setRatePrivat] = useState<number>(pengaturan.persentaseGajiPrivat ?? 75);
  const [durasiMenit, setDurasiMenit] = useState<number>(pengaturan.durasiMenitPerSesi ?? 90);

  // Payout Form State
  const [payoutTanggal, setPayoutTanggal] = useState<string>(getTodayDateString());
  const [payoutMetode, setPayoutMetode] = useState<MetodeBayar>('Transfer Bank');
  const [payoutNominal, setPayoutNominal] = useState<number>(0);
  const [payoutBonus, setPayoutBonus] = useState<number>(0);
  const [payoutPotongan, setPayoutPotongan] = useState<number>(0);
  const [payoutKeterangan, setPayoutKeterangan] = useState<string>('');

  const activePeriodKey = `${selectedYear}-${selectedMonth}`;
  const periodLabel = new Date(selectedYear, Number(selectedMonth) - 1, 1).toLocaleDateString('id-ID', {
    month: 'long',
    year: 'numeric',
  });

  const durasiJamPerSesi = (durasiMenit || 90) / 60;

  // Map student dictionary for fast lookups
  const studentMap = useMemo(() => {
    const map = new Map<string, Student>();
    students.forEach((s) => map.set(s.id, s));
    return map;
  }, [students]);

  // List of all registered tutors - strictly from master database tutor
  const allTutorList = useMemo(() => {
    const list = (pengaturan.daftarTutor || []).filter((t) => t && t.trim().length > 0);
    return Array.from(new Set(list));
  }, [pengaturan.daftarTutor]);

  // Calculate teaching sessions and payroll by tutor for the selected period
  const tutorPayrollData = useMemo(() => {
    // 1. Filter absensi for the selected month and year
    const periodAbsensi = absensi.filter((a) => {
      if (!a.tanggal.startsWith(activePeriodKey)) return false;
      // Only count 'Hadir' sessions
      return a.status === 'Hadir';
    });

    // 2. Aggregate per tutor
    const payrollMap = new Map<string, {
      tutorNama: string;
      totalSesi: number;
      sesiGrup: number;
      sesiPrivat: number;
      totalJamMengajar: number;
      jamGrup: number;
      jamPrivat: number;
      nominalTarifSiswaGrup: number;
      nominalTarifSiswaPrivat: number;
      honorGrup: number;
      honorPrivat: number;
      totalHonor: number;
      sessions: Array<{
        absensi: AbsensiRecord;
        student?: Student;
        isPrivat: boolean;
        tarifSesiSiswa: number;
        persentase: number;
        honorSesi: number;
        durasiJam: number;
      }>;
    }>();

    // Initialize map for all known tutors
    allTutorList.forEach((tutorName) => {
      payrollMap.set(tutorName, {
        tutorNama: tutorName,
        totalSesi: 0,
        sesiGrup: 0,
        sesiPrivat: 0,
        totalJamMengajar: 0,
        jamGrup: 0,
        jamPrivat: 0,
        nominalTarifSiswaGrup: 0,
        nominalTarifSiswaPrivat: 0,
        honorGrup: 0,
        honorPrivat: 0,
        totalHonor: 0,
        sessions: [],
      });
    });

    // Process attendance records mapped strictly to registered tutors
    periodAbsensi.forEach((record) => {
      let tutorName = (record.tutor || '').trim();

      // Find registered tutor (exact, case-insensitive, or partial match)
      const matched = allTutorList.find((t) => t.toLowerCase() === tutorName.toLowerCase())
        || allTutorList.find((t) => t.toLowerCase().includes(tutorName.toLowerCase()) || (tutorName.length > 2 && tutorName.toLowerCase().includes(t.toLowerCase().split(' ')[0])));

      const targetTutor = matched || allTutorList[0] || 'Tutor Sigma';
      if (!payrollMap.has(targetTutor)) {
        payrollMap.set(targetTutor, {
          tutorNama: targetTutor,
          totalSesi: 0,
          sesiGrup: 0,
          sesiPrivat: 0,
          totalJamMengajar: 0,
          jamGrup: 0,
          jamPrivat: 0,
          nominalTarifSiswaGrup: 0,
          nominalTarifSiswaPrivat: 0,
          honorGrup: 0,
          honorPrivat: 0,
          totalHonor: 0,
          sessions: [],
        });
      }

      const entry = payrollMap.get(targetTutor)!;
      const student = studentMap.get(record.siswaId);
      const isPrivat = (student?.jenisKelas || 'Grup') === 'Privat';
      const tarifSesiSiswa = student?.tarifPerSesi || (isPrivat ? 85000 : 50000);
      const persentase = isPrivat ? (ratePrivat / 100) : (rateGrup / 100);
      const honorSesi = Math.round(tarifSesiSiswa * persentase);

      entry.totalSesi += 1;
      entry.totalJamMengajar += durasiJamPerSesi;

      if (isPrivat) {
        entry.sesiPrivat += 1;
        entry.jamPrivat += durasiJamPerSesi;
        entry.nominalTarifSiswaPrivat += tarifSesiSiswa;
        entry.honorPrivat += honorSesi;
      } else {
        entry.sesiGrup += 1;
        entry.jamGrup += durasiJamPerSesi;
        entry.nominalTarifSiswaGrup += tarifSesiSiswa;
        entry.honorGrup += honorSesi;
      }

      entry.totalHonor += honorSesi;
      entry.sessions.push({
        absensi: record,
        student,
        isPrivat,
        tarifSesiSiswa,
        persentase: isPrivat ? ratePrivat : rateGrup,
        honorSesi,
        durasiJam: durasiJamPerSesi,
      });
    });

    // 3. Match against TransaksiKas to see if already paid / posted to Kas Keluar
    return Array.from(payrollMap.values()).map((p) => {
      // Find matching kas keluar transaction for this tutor & period
      const matchingKas = kas.find((k) => {
        if (k.jenis !== 'Keluar') return false;
        if (k.kategori !== 'Gaji / Honor Tutor') return false;
        if (k.siswaId === p.tutorNama && (k.bulanTagihan === activePeriodKey || k.tanggal.startsWith(activePeriodKey))) {
          return true;
        }
        const note = (k.keterangan || '').toLowerCase();
        const tutorKey = p.tutorNama.toLowerCase().split(' ')[0]; // Match first word or full name
        const matchTutor = note.includes(p.tutorNama.toLowerCase()) || (tutorKey.length > 2 && note.includes(tutorKey));
        const matchPeriod = (k.bulanTagihan === activePeriodKey) || note.includes(activePeriodKey) || note.includes(periodLabel.toLowerCase()) || k.tanggal.startsWith(activePeriodKey);
        return matchTutor && matchPeriod;
      });

      return {
        ...p,
        sudahMasukKas: Boolean(matchingKas),
        matchingKas,
      };
    });
  }, [absensi, activePeriodKey, studentMap, allTutorList, rateGrup, ratePrivat, durasiJamPerSesi, kas, periodLabel]);

  // Filtered List based on UI selectors
  const filteredTutorData = useMemo(() => {
    return tutorPayrollData.filter((item) => {
      if (selectedTutorFilter !== 'ALL' && item.tutorNama !== selectedTutorFilter) {
        return false;
      }
      if (statusFilter === 'PAID' && !item.sudahMasukKas) {
        return false;
      }
      if (statusFilter === 'UNPAID' && item.sudahMasukKas) {
        return false;
      }
      // Show tutors with active sessions, or all tutors if specific filter is set
      return item.totalSesi > 0 || selectedTutorFilter === item.tutorNama;
    });
  }, [tutorPayrollData, selectedTutorFilter, statusFilter]);

  // Summary Totals
  const summaryStats = useMemo(() => {
    let totalSesi = 0;
    let totalJam = 0;
    let totalHonor = 0;
    let totalHonorGrup = 0;
    let totalHonorPrivat = 0;
    let totalSudahDicairkan = 0;
    let totalBelumDicairkan = 0;

    tutorPayrollData.forEach((t) => {
      totalSesi += t.totalSesi;
      totalJam += t.totalJamMengajar;
      totalHonor += t.totalHonor;
      totalHonorGrup += t.honorGrup;
      totalHonorPrivat += t.honorPrivat;
      if (t.sudahMasukKas) {
        totalSudahDicairkan += t.matchingKas?.nominal || t.totalHonor;
      } else {
        totalBelumDicairkan += t.totalHonor;
      }
    });

    return {
      totalSesi,
      totalJam,
      totalHonor,
      totalHonorGrup,
      totalHonorPrivat,
      totalSudahDicairkan,
      totalBelumDicairkan,
    };
  }, [tutorPayrollData]);

  // Handle Save Quick Settings
  const handleSaveRates = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: PengaturanBimbel = {
      ...pengaturan,
      persentaseGajiGrup: rateGrup,
      persentaseGajiPrivat: ratePrivat,
      durasiMenitPerSesi: durasiMenit,
    };
    onSavePengaturan(updated);
    setIsConfigOpen(false);
    onShowToast('Skema persentase & tarif honor tutor berhasil diperbarui!', 'success');
  };

  // Open Payout Modal for Tutor
  const handleOpenPayout = (tutorItem: any) => {
    setPayoutModalTutor(tutorItem);
    setPayoutTanggal(getTodayDateString());
    setPayoutMetode('Transfer Bank');
    setPayoutNominal(tutorItem.totalHonor);
    setPayoutBonus(0);
    setPayoutPotongan(0);
    setPayoutKeterangan(`Honor Mengajar ${tutorItem.tutorNama} Periode ${periodLabel} (${tutorItem.totalJamMengajar.toFixed(1)} Jam, ${tutorItem.totalSesi} Sesi)`);
  };

  // Submit Payout to Kas Keluar
  const handleConfirmPayout = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payoutModalTutor) return;

    const finalNominal = Math.max(0, payoutNominal + payoutBonus - payoutPotongan);
    if (finalNominal <= 0) {
      onShowToast('Nominal pembayaran honor harus lebih dari Rp 0', 'warning');
      return;
    }

    const newKasTransaction: TransaksiKas = {
      id: `kas-tutor-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      tanggal: payoutTanggal,
      jenis: 'Keluar',
      kategori: 'Gaji / Honor Tutor',
      keterangan: payoutKeterangan.trim(),
      nominal: finalNominal,
      siswaId: payoutModalTutor.tutorNama,
      bulanTagihan: activePeriodKey,
      metodeBayar: payoutMetode,
    };

    const updatedKas = [newKasTransaction, ...kas];
    onSaveKas(updatedKas);
    setPayoutModalTutor(null);
    onShowToast(`Honor ${payoutModalTutor.tutorNama} sebesar ${formatRupiah(finalNominal)} berhasil dicairkan & masuk ke Kas Keluar!`, 'success');
  };

  // Delete matching Kas Transaction (Un-pay / Rollback) with in-app Confirmation
  const handleRequestCancelPayout = (tutorItem: any) => {
    if (!tutorItem.matchingKas) {
      onShowToast('Transaksi pencairan kas tidak ditemukan.', 'warning');
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Hapus Pencairan dari Kas Keluar',
      message: `PERINGATAN:\nApakah Anda yakin ingin menghapus pencairan kas honor untuk "${tutorItem.tutorNama}" sebesar ${formatRupiah(tutorItem.matchingKas.nominal)} periode ${periodLabel} dari Kas Keluar?\n\nTransaksi kas ini akan dihapus permanen dan status honor tutor akan dikembalikan menjadi 'Belum Dicairkan'.`,
      confirmLabel: 'Ya, Hapus Pencairan',
      isDanger: true,
      onConfirm: () => {
        const targetId = tutorItem.matchingKas.id;
        const updatedKas = kas.filter((k) => k.id !== targetId);
        onSaveKas(updatedKas);
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        onShowToast(`Pencairan kas honor "${tutorItem.tutorNama}" berhasil dihapus dari Kas Keluar. Status kembali 'Belum Dicairkan'.`, 'success');
      },
      onCancel: () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  // Export CSV / Excel
  const handleExportCSV = () => {
    const headers = [
      'Nama Tutor',
      'Periode',
      'Total Sesi',
      'Sesi Grup',
      'Sesi Privat',
      'Total Jam Mengajar',
      'Honor Kelas Grup (Rp)',
      'Honor Kelas Privat (Rp)',
      'Total Honor (Rp)',
      'Status Kas',
      'Metode Bayar',
      'Tanggal Cair'
    ];

    const rows = tutorPayrollData.map((t) => [
      `"${t.tutorNama}"`,
      `"${periodLabel}"`,
      t.totalSesi,
      t.sesiGrup,
      t.sesiPrivat,
      t.totalJamMengajar.toFixed(1),
      t.honorGrup,
      t.honorPrivat,
      t.totalHonor,
      t.sudahMasukKas ? 'Sudah Masuk Kas Keluar' : 'Belum Masuk Kas',
      t.matchingKas?.metodeBayar || '-',
      t.matchingKas?.tanggal || '-'
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Rekap_Honor_Tutor_${activePeriodKey}_Bimbel_Sigma.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onShowToast('File Rekapitulasi Honor Tutor berhasil diunduh!', 'success');
  };

  // Generate & Download Standalone Printable HTML Slip Gaji
  const handleDownloadSlipHTML = (tutorItem: any) => {
    const filename = `Slip_Gaji_${tutorItem.tutorNama.replace(/[^a-zA-Z0-9]/g, '_')}_${activePeriodKey}.html`;
    const htmlContent = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Slip Gaji & Honor Tutor - ${tutorItem.tutorNama} (${periodLabel})</title>
  <style>
    @page { size: A4 portrait; margin: 15mm; }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 24px;
      font-size: 13px;
      line-height: 1.5;
    }
    .slip-container {
      max-width: 800px;
      margin: 0 auto;
      border: 2px solid #0f172a;
      border-radius: 12px;
      padding: 28px;
      background: #ffffff;
    }
    .header {
      border-bottom: 2px solid #0f172a;
      padding-bottom: 14px;
      margin-bottom: 20px;
      text-align: center;
    }
    .inst-name {
      font-size: 20px;
      font-weight: 900;
      letter-spacing: -0.5px;
      margin: 0;
      color: #0f172a;
      text-transform: uppercase;
    }
    .inst-tagline {
      font-size: 12px;
      font-style: italic;
      color: #475569;
      margin: 3px 0 0 0;
    }
    .inst-meta {
      font-size: 11px;
      color: #64748b;
      margin-top: 5px;
    }
    .title-banner {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 10px 14px;
      margin-bottom: 18px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .title-text {
      font-size: 14px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #0f172a;
      margin: 0;
    }
    .period-badge {
      font-size: 11px;
      font-weight: 700;
      color: #312e81;
      background: #e0e7ff;
      padding: 3px 8px;
      border-radius: 6px;
      border: 1px solid #c7d2fe;
    }
    .info-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
      margin-bottom: 20px;
      background: #f8fafc;
      padding: 14px;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
    }
    .info-item { display: flex; flex-direction: column; }
    .info-label { font-size: 11px; font-weight: 600; color: #64748b; }
    .info-val { font-size: 13px; font-weight: 800; color: #0f172a; margin-top: 2px; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      font-size: 12px;
    }
    th {
      background: #0f172a;
      color: #ffffff;
      font-weight: 700;
      padding: 8px 10px;
      text-align: left;
      border: 1px solid #0f172a;
    }
    td {
      padding: 8px 10px;
      border: 1px solid #cbd5e1;
      color: #334155;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    .total-row td {
      background: #f1f5f9;
      font-weight: 800;
      color: #0f172a;
      font-size: 13px;
      border-top: 2px solid #0f172a;
    }
    .signature-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 24px;
      margin-top: 30px;
      text-align: center;
      font-size: 11px;
    }
    .sig-space { height: 50px; }
    .sig-name { font-weight: 800; text-decoration: underline; }
    .sig-role { color: #64748b; font-size: 11px; margin-top: 2px; }
    .no-print-bar { margin-bottom: 14px; text-align: right; }
    .btn-action {
      background: #4f46e5;
      color: white;
      border: none;
      padding: 8px 14px;
      border-radius: 6px;
      font-weight: bold;
      cursor: pointer;
      font-size: 12px;
    }
    @media print {
      .no-print-bar { display: none !important; }
      body { padding: 0; background: transparent; }
      .slip-container { border: 1px solid #0f172a; }
    }
  </style>
</head>
<body>
  <div class="no-print-bar">
    <button class="btn-action" onclick="window.print()">🖨️ Cetak / Simpan PDF</button>
  </div>
  <div class="slip-container">
    <div class="header">
      <h1 class="inst-name">${pengaturan.namaLembaga}</h1>
      <p class="inst-tagline">"${pengaturan.tagline}"</p>
      <div class="inst-meta">
        ${pengaturan.alamat} • Kontak: ${pengaturan.kontak} • Email: ${pengaturan.email}
      </div>
    </div>

    <div class="title-banner">
      <h2 class="title-text">SLIP PEMBAYARAN HONOR TUTOR</h2>
      <span class="period-badge">Periode: ${periodLabel}</span>
    </div>

    <div class="info-grid">
      <div class="info-item">
        <span class="info-label">Nama Tutor Pengajar</span>
        <span class="info-val">${tutorItem.tutorNama}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Status Pencairan Kas</span>
        <span class="info-val" style="color: ${tutorItem.sudahMasukKas ? '#047857' : '#b45309'};">
          ${tutorItem.sudahMasukKas ? '✓ LUNAS (TERCATAT DI KAS KELUAR)' : '⏳ BELUM DICAIRKAN'}
        </span>
      </div>
      <div class="info-item">
        <span class="info-label">Total Jam & Sesi Mengajar</span>
        <span class="info-val">${tutorItem.totalJamMengajar.toFixed(1)} Jam (${tutorItem.totalSesi} Sesi)</span>
      </div>
      <div class="info-item">
        <span class="info-label">Metode Pembayaran</span>
        <span class="info-val">${tutorItem.matchingKas?.metodeBayar || 'Transfer Bank'}</span>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Komponen Honor Mengajar</th>
          <th class="text-center">Jumlah Sesi</th>
          <th class="text-center">Total Jam</th>
          <th class="text-center">Skema Bagi Hasil</th>
          <th class="text-right">Subtotal Honor</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Mengajar Sesi Kelas Grup</strong></td>
          <td class="text-center">${tutorItem.sesiGrup} Sesi</td>
          <td class="text-center">${tutorItem.jamGrup.toFixed(1)} Jam</td>
          <td class="text-center">${rateGrup}% dari Tarif Siswa</td>
          <td class="text-right font-mono"><strong>${formatRupiah(tutorItem.honorGrup)}</strong></td>
        </tr>
        <tr>
          <td><strong>Mengajar Sesi Kelas Privat (1-on-1)</strong></td>
          <td class="text-center">${tutorItem.sesiPrivat} Sesi</td>
          <td class="text-center">${tutorItem.jamPrivat.toFixed(1)} Jam</td>
          <td class="text-center">${ratePrivat}% dari Tarif Siswa</td>
          <td class="text-right font-mono"><strong>${formatRupiah(tutorItem.honorPrivat)}</strong></td>
        </tr>
        <tr class="total-row">
          <td colspan="4" class="text-right">TOTAL HONOR BERSIH DITERIMA:</td>
          <td class="text-right font-mono" style="font-size: 14px; color: #1e1b4b;"><strong>${formatRupiah(tutorItem.totalHonor)}</strong></td>
        </tr>
      </tbody>
    </table>

    <div class="signature-grid">
      <div>
        <p>Penerima (Tutor Pengajar),</p>
        <div class="sig-space"></div>
        <p class="sig-name">${tutorItem.tutorNama}</p>
        <p class="sig-role">Tutor Akademik Bimbel Sigma</p>
      </div>

      <div>
        <p>${pengaturan.kota || 'Jakarta'}, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        <p>Pimpinan Lembaga,</p>
        <div class="sig-space"></div>
        <p class="sig-name">${pengaturan.pimpinan}</p>
        <p class="sig-role">Direktur Utama ${pengaturan.namaLembaga}</p>
      </div>
    </div>
  </div>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    onShowToast(`Slip gaji ${tutorItem.tutorNama} berhasil diunduh (${filename})!`, 'success');
  };

  // Open Print Slip View
  const handlePrintSlip = (tutorItem: any) => {
    setPrintSlipTutor(tutorItem);
    setTimeout(() => {
      window.print();
    }, 300);
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Action Controls */}
      <div className="no-print bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/20">
              <i className="fa-solid fa-chalkboard-user text-base"></i>
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
                Rekapan Gaji & Honor Tutor
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Kalkulasi otomatis honor mengajar berbasis jam & persentase sesi (Grup & Privat) terintegrasi ke Kas Keluar
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <button
            type="button"
            onClick={() => setIsConfigOpen(true)}
            className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-2xs"
            title="Ubah persentase honor Grup & Privat"
          >
            <i className="fa-solid fa-sliders text-indigo-600"></i>
            <span>Skema Tarif ({rateGrup}% / {ratePrivat}%)</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3.5 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-2xs"
          >
            <i className="fa-solid fa-file-excel text-emerald-600"></i>
            <span>Ekspor CSV</span>
          </button>
        </div>
      </div>

      {/* KPI & Summary Cards */}
      <div className="no-print grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Honor Periode Ini */}
        <div className="bg-gradient-to-br from-indigo-900 via-indigo-800 to-indigo-950 p-5 rounded-3xl text-white shadow-lg shadow-indigo-950/20 border border-indigo-700/50 relative overflow-hidden">
          <div className="absolute right-3 top-3 opacity-10 text-6xl text-white">
            <i className="fa-solid fa-hand-holding-dollar"></i>
          </div>
          <p className="text-[11px] font-bold text-indigo-200 uppercase tracking-wider">
            Total Honor Periode {selectedMonth}/{selectedYear}
          </p>
          <h2 className="text-2xl font-black mt-1 font-mono tracking-tight text-white">
            {formatRupiah(summaryStats.totalHonor)}
          </h2>
          <div className="mt-3 flex items-center justify-between text-[11px] text-indigo-200/90 pt-2.5 border-t border-indigo-700/60">
            <span>{summaryStats.totalSesi} Total Sesi Mengajar</span>
            <span className="font-bold">{summaryStats.totalJam.toFixed(1)} Jam</span>
          </div>
        </div>

        {/* Breakdown Honor Grup vs Privat */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Honor Grup ({rateGrup}%) vs Privat ({ratePrivat}%)
              </span>
              <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
            </div>
            <div className="mt-2 space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-600 font-medium flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  Sesi Grup:
                </span>
                <span className="font-bold font-mono text-slate-900">{formatRupiah(summaryStats.totalHonorGrup)}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-600 font-medium flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                  Sesi Privat:
                </span>
                <span className="font-bold font-mono text-slate-900">{formatRupiah(summaryStats.totalHonorPrivat)}</span>
              </div>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-2">
            Standar durasi: {durasiMenit} menit/sesi ({durasiJamPerSesi} jam)
          </p>
        </div>

        {/* Sudah Masuk Kas Keluar */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
                Sudah Masuk Kas Keluar
              </span>
              <div className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600 text-xs">
                <i className="fa-solid fa-check"></i>
              </div>
            </div>
            <h3 className="text-xl font-extrabold text-emerald-700 font-mono mt-1">
              {formatRupiah(summaryStats.totalSudahDicairkan)}
            </h3>
          </div>
          <p className="text-[10px] text-slate-500 mt-2 flex items-center gap-1">
            <i className="fa-solid fa-circle-check text-emerald-500 text-[10px]"></i>
            <span>Tercatat otomatis di Laporan Kas & P&L</span>
          </p>
        </div>

        {/* Belum Dicairkan */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">
                Belum Dicairkan
              </span>
              <div className="w-6 h-6 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600 text-xs">
                <i className="fa-solid fa-clock"></i>
              </div>
            </div>
            <h3 className="text-xl font-extrabold text-amber-700 font-mono mt-1">
              {formatRupiah(summaryStats.totalBelumDicairkan)}
            </h3>
          </div>
          <p className="text-[10px] text-slate-500 mt-2 flex items-center gap-1">
            <i className="fa-solid fa-arrow-right-to-bracket text-amber-500 text-[10px]"></i>
            <span>Siap di-posting 1-klik ke Kas Keluar</span>
          </p>
        </div>
      </div>

      {/* Filter & Selection Toolbar */}
      <div className="no-print bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Month Selector */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-2xl border border-slate-200">
            <i className="fa-solid fa-calendar-days text-slate-400 text-xs"></i>
            <span className="text-xs font-bold text-slate-700">Bulan:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-xs font-bold text-indigo-700 focus:outline-hidden cursor-pointer"
            >
              <option value="01">Januari</option>
              <option value="02">Februari</option>
              <option value="03">Maret</option>
              <option value="04">April</option>
              <option value="05">Mei</option>
              <option value="06">Juni</option>
              <option value="07">Juli</option>
              <option value="08">Agustus</option>
              <option value="09">September</option>
              <option value="10">Oktober</option>
              <option value="11">November</option>
              <option value="12">Desember</option>
            </select>
          </div>

          {/* Year Selector */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-2xl border border-slate-200">
            <span className="text-xs font-bold text-slate-700">Tahun:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-transparent text-xs font-bold text-indigo-700 focus:outline-hidden cursor-pointer"
            >
              {[2024, 2025, 2026, 2027, 2028].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Tutor Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-2xl border border-slate-200">
            <i className="fa-solid fa-user-tie text-slate-400 text-xs"></i>
            <select
              value={selectedTutorFilter}
              onChange={(e) => setSelectedTutorFilter(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-hidden cursor-pointer max-w-[180px] truncate"
            >
              <option value="ALL">Semua Tutor ({allTutorList.length})</option>
              {allTutorList.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center p-1 bg-slate-100 rounded-2xl border border-slate-200/80 text-xs font-bold">
          <button
            type="button"
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              statusFilter === 'ALL' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Semua
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('UNPAID')}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              statusFilter === 'UNPAID' ? 'bg-white text-amber-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Belum Cair
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('PAID')}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              statusFilter === 'PAID' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Sudah Masuk Kas
          </button>
        </div>
      </div>

      {/* Main Table: Rekapan Gaji & Honor Tutor */}
      <div className="no-print bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-extrabold text-sm text-slate-900">
              Daftar Honor Mengajar Tutor - Periode {periodLabel}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Tarif dihitung dari persentase biaya per sesi siswa: Grup ({rateGrup}%) & Privat ({ratePrivat}%)
            </p>
          </div>
          <span className="text-xs font-bold bg-indigo-50 text-indigo-700 px-3 py-1 rounded-xl border border-indigo-100">
            {filteredTutorData.length} Tutor Ditampilkan
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 text-slate-600 font-bold border-b border-slate-200">
                <th className="py-3.5 px-4">Nama Tutor</th>
                <th className="py-3.5 px-3 text-center">Kelas Grup</th>
                <th className="py-3.5 px-3 text-center">Kelas Privat</th>
                <th className="py-3.5 px-3 text-center">Total Jam Mengajar</th>
                <th className="py-3.5 px-4 text-right">Subtotal Grup</th>
                <th className="py-3.5 px-4 text-right">Subtotal Privat</th>
                <th className="py-3.5 px-4 text-right font-extrabold text-slate-900">Total Honor</th>
                <th className="py-3.5 px-4 text-center">Status Kas</th>
                <th className="py-3.5 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTutorData.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <i className="fa-solid fa-clipboard-question text-3xl mb-2 text-slate-300"></i>
                    <p className="font-semibold text-slate-600">Tidak ada sesi mengajar ditemukan untuk periode {periodLabel}</p>
                    <p className="text-[11px] text-slate-400 mt-1">Pastikan absensi kehadiran siswa (status 'Hadir') telah dicatat pada menu Absensi.</p>
                  </td>
                </tr>
              ) : (
                filteredTutorData.map((item) => (
                  <tr key={item.tutorNama} className="hover:bg-indigo-50/30 transition-colors">
                    <td className="py-4 px-4 font-bold text-slate-900">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 font-extrabold flex items-center justify-center text-xs shrink-0">
                          {item.tutorNama.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">{item.tutorNama}</div>
                          <div className="text-[10px] text-slate-400 font-normal">
                            {item.totalSesi} Sesi ({item.totalJamMengajar.toFixed(1)} Jam)
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Sesi Grup */}
                    <td className="py-4 px-3 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-100">
                        {item.sesiGrup} sesi ({item.jamGrup.toFixed(1)} jam)
                      </span>
                    </td>

                    {/* Sesi Privat */}
                    <td className="py-4 px-3 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-100">
                        {item.sesiPrivat} sesi ({item.jamPrivat.toFixed(1)} jam)
                      </span>
                    </td>

                    {/* Total Jam */}
                    <td className="py-4 px-3 text-center font-bold text-slate-800 font-mono">
                      {item.totalJamMengajar.toFixed(1)} Jam
                    </td>

                    {/* Subtotal Grup */}
                    <td className="py-4 px-4 text-right font-mono text-slate-700">
                      {formatRupiah(item.honorGrup)}
                    </td>

                    {/* Subtotal Privat */}
                    <td className="py-4 px-4 text-right font-mono text-slate-700">
                      {formatRupiah(item.honorPrivat)}
                    </td>

                    {/* Total Honor */}
                    <td className="py-4 px-4 text-right font-black font-mono text-indigo-950 text-sm">
                      {formatRupiah(item.totalHonor)}
                    </td>

                    {/* Status Kas Keluar */}
                    <td className="py-4 px-4 text-center">
                      {item.sudahMasukKas ? (
                        <div className="inline-flex flex-col items-center">
                          <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center gap-1 border border-emerald-200">
                            <i className="fa-solid fa-check-circle"></i>
                            <span>Masuk Kas Keluar</span>
                          </span>
                          <span className="text-[9px] text-slate-400 font-mono mt-0.5">
                            {item.matchingKas?.tanggal} ({item.matchingKas?.metodeBayar || 'Kas'})
                          </span>
                        </div>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold flex items-center justify-center gap-1 border border-amber-200">
                          <i className="fa-solid fa-clock"></i>
                          <span>Belum Dicairkan</span>
                        </span>
                      )}
                    </td>

                    {/* Action Buttons */}
                    <td className="py-4 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* Detail Sessions Button */}
                        <button
                          type="button"
                          onClick={() => setDetailTutor(item.tutorNama)}
                          className="p-1.5 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs transition-all cursor-pointer flex items-center gap-1"
                          title="Lihat rincian sesi mengajar"
                        >
                          <i className="fa-solid fa-list-ul"></i>
                          <span className="text-[10px] hidden md:inline">Detail</span>
                        </button>

                        {/* Download Slip Button */}
                        <button
                          type="button"
                          onClick={() => handleDownloadSlipHTML(item)}
                          className="p-1.5 px-2.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                          title="Unduh Berkas Slip Gaji Tutor (HTML / PDF)"
                        >
                          <i className="fa-solid fa-download text-emerald-600"></i>
                          <span className="text-[11px]">Download</span>
                        </button>

                        {/* Post to Kas Out or Revoke */}
                        {!item.sudahMasukKas ? (
                          <button
                            type="button"
                            onClick={() => handleOpenPayout(item)}
                            disabled={item.totalHonor <= 0}
                            className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] transition-all flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
                            title="Cairkan honor & masukkan ke Kas Keluar"
                          >
                            <i className="fa-solid fa-money-bill-transfer text-amber-300"></i>
                            <span>Cairkan ke Kas</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleRequestCancelPayout(item)}
                            className="p-1.5 px-2.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                            title="Hapus pencairan dari Kas Keluar"
                          >
                            <i className="fa-solid fa-trash-can text-rose-500"></i>
                            <span className="text-[11px]">Hapus Pencairan</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {filteredTutorData.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100 font-extrabold text-slate-900 border-t-2 border-slate-300">
                  <td className="py-3.5 px-4">TOTAL REKAPITULASI</td>
                  <td className="py-3.5 px-3 text-center">{summaryStats.totalSesi} Sesi</td>
                  <td className="py-3.5 px-3 text-center">-</td>
                  <td className="py-3.5 px-3 text-center font-mono">{summaryStats.totalJam.toFixed(1)} Jam</td>
                  <td className="py-3.5 px-4 text-right font-mono">{formatRupiah(summaryStats.totalHonorGrup)}</td>
                  <td className="py-3.5 px-4 text-right font-mono">{formatRupiah(summaryStats.totalHonorPrivat)}</td>
                  <td className="py-3.5 px-4 text-right font-mono text-indigo-900 text-sm font-black">{formatRupiah(summaryStats.totalHonor)}</td>
                  <td colSpan={2} className="py-3.5 px-4 text-center text-xs text-slate-500 font-medium">
                    {summaryStats.totalBelumDicairkan > 0 ? `Sisa belum cair: ${formatRupiah(summaryStats.totalBelumDicairkan)}` : 'Semua honor sudah masuk kas'}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Modal / Dialog: Quick Rate Configuration */}
      {isConfigOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2 text-indigo-900 font-extrabold text-base">
                <i className="fa-solid fa-sliders text-indigo-600"></i>
                <span>Pengaturan Skema Honor Tutor</span>
              </div>
              <button
                type="button"
                onClick={() => setIsConfigOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            <form onSubmit={handleSaveRates} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Persentase Honor Kelas Grup (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={rateGrup}
                    onChange={(e) => setRateGrup(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 text-xs font-bold font-mono rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">Bagi hasil sesi siswa kelas grup (bawaan: 60%)</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Persentase Honor Kelas Privat (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={ratePrivat}
                    onChange={(e) => setRatePrivat(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 text-xs font-bold font-mono rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">Bagi hasil sesi siswa kelas privat 1-on-1 (bawaan: 75%)</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Durasi Standar per Sesi Mengajar
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="30"
                    step="15"
                    value={durasiMenit}
                    onChange={(e) => setDurasiMenit(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 text-xs font-bold font-mono rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">Menit</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">90 menit = 1.5 jam per sesi mengajar</p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsConfigOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
                >
                  Simpan Skema
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal / Dialog: Cairkan Honor ke Kas Keluar */}
      {payoutModalTutor && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2 text-indigo-900 font-extrabold text-base">
                <i className="fa-solid fa-money-bill-transfer text-indigo-600"></i>
                <span>Cairkan Honor ke Kas Keluar</span>
              </div>
              <button
                type="button"
                onClick={() => setPayoutModalTutor(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            <form onSubmit={handleConfirmPayout} className="mt-4 space-y-4">
              {/* Tutor Summary Pill */}
              <div className="p-3.5 bg-indigo-50/80 rounded-2xl border border-indigo-100 space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-indigo-950">{payoutModalTutor.tutorNama}</span>
                  <span className="font-bold font-mono text-indigo-700">{periodLabel}</span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-600 pt-1">
                  <span>Total Sesi: {payoutModalTutor.totalSesi} sesi ({payoutModalTutor.totalJamMengajar.toFixed(1)} Jam)</span>
                  <span>Honor Terhitung: <b>{formatRupiah(payoutModalTutor.totalHonor)}</b></span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tanggal Pencairan Kas <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={payoutTanggal}
                    onChange={(e) => setPayoutTanggal(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Metode Pembayaran <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={payoutMetode}
                    onChange={(e) => setPayoutMetode(e.target.value as MetodeBayar)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 font-medium cursor-pointer"
                  >
                    <option value="Transfer Bank">Transfer Bank</option>
                    <option value="Tunai / Cash">Tunai / Cash</option>
                    <option value="QRIS">QRIS</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Honor Pokok
                  </label>
                  <input
                    type="number"
                    value={payoutNominal}
                    onChange={(e) => setPayoutNominal(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Bonus / Tunjangan (+)
                  </label>
                  <input
                    type="number"
                    value={payoutBonus}
                    onChange={(e) => setPayoutBonus(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 text-emerald-700 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Potongan (-)
                  </label>
                  <input
                    type="number"
                    value={payoutPotongan}
                    onChange={(e) => setPayoutPotongan(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 text-rose-700 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Keterangan Kas Keluar
                </label>
                <textarea
                  rows={2}
                  value={payoutKeterangan}
                  onChange={(e) => setPayoutKeterangan(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Total Final Payout */}
              <div className="p-3 bg-slate-900 rounded-2xl text-white flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300">Total Masuk Kas Keluar:</span>
                <span className="text-lg font-black font-mono text-emerald-400">
                  {formatRupiah(Math.max(0, payoutNominal + payoutBonus - payoutPotongan))}
                </span>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPayoutModalTutor(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-md shadow-indigo-600/30 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <i className="fa-solid fa-floppy-disk"></i>
                  <span>Posting ke Kas Keluar Sekarang</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Drawer: Detail Rincian Sesi Mengajar Tutor */}
      {detailTutor && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl p-6 shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="font-extrabold text-base text-slate-900">
                  Rincian Sesi Mengajar: {detailTutor}
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Periode {periodLabel}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailTutor(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              {(() => {
                const target = tutorPayrollData.find((t) => t.tutorNama === detailTutor);
                if (!target || target.sessions.length === 0) {
                  return (
                    <div className="py-8 text-center text-slate-400 text-xs font-medium">
                      Tidak ada catatan sesi mengajar untuk tutor ini di periode {periodLabel}.
                    </div>
                  );
                }

                return (
                  <div className="space-y-2">
                    {target.sessions.map((sess, idx) => (
                      <div key={idx} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3 text-xs">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">{sess.absensi.siswaNama}</span>
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              sess.isPrivat ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                            }`}>
                              Kelas {sess.isPrivat ? 'Privat' : 'Grup'}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500">
                            📅 {sess.absensi.tanggal} {sess.absensi.jam && `• ⏰ ${sess.absensi.jam}`} • Materi: {sess.absensi.materi || 'Sesi Reguler'}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="font-black font-mono text-indigo-950 text-xs">
                            {formatRupiah(sess.honorSesi)}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {formatRupiah(sess.tarifSesiSiswa)} × {sess.persentase}% ({sess.durasiJam} Jam)
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Standar perhitungan: Siswa Hadir × Tarif Sesi × Persentase Honor
              </span>
              <button
                type="button"
                onClick={() => setDetailTutor(null)}
                className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs cursor-pointer"
              >
                Tutup Rincian
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRINT-ONLY VIEW: SLIP GAJI & HONOR TUTOR */}
      {printSlipTutor && (
        <div className="hidden print:block p-8 bg-white text-slate-900 max-w-4xl mx-auto">
          {/* Header Kop Lembaga */}
          <div className="border-b-2 border-slate-900 pb-4 text-center">
            <h1 className="text-2xl font-black tracking-tight">{pengaturan.namaLembaga}</h1>
            <p className="text-xs italic text-slate-600 mt-0.5">"{pengaturan.tagline}"</p>
            <p className="text-[11px] text-slate-600 mt-1">
              {pengaturan.alamat} • Kontak: {pengaturan.kontak} • Email: {pengaturan.email}
            </p>
          </div>

          {/* Slip Title */}
          <div className="text-center my-6">
            <h2 className="text-lg font-black tracking-wider uppercase underline">
              SLIP PEMBAYARAN HONOR TUTOR
            </h2>
            <p className="text-xs font-mono font-bold mt-1 text-slate-600">
              Periode: {periodLabel}
            </p>
          </div>

          {/* Tutor Info Box */}
          <div className="grid grid-cols-2 gap-4 text-xs p-4 bg-slate-50 rounded-xl border border-slate-300 mb-6">
            <div>
              <span className="text-slate-500 font-medium">Nama Tutor:</span>
              <p className="font-extrabold text-sm text-slate-900">{printSlipTutor.tutorNama}</p>
            </div>
            <div className="text-right">
              <span className="text-slate-500 font-medium">Status Pembayaran:</span>
              <p className="font-extrabold text-xs text-emerald-800">
                {printSlipTutor.sudahMasukKas ? 'LUNAS (TERCATAT DI KAS)' : 'BELUM DICAIRKAN'}
              </p>
            </div>
          </div>

          {/* Details Table */}
          <table className="w-full text-xs border-collapse border border-slate-300 mb-6">
            <thead>
              <tr className="bg-slate-100 font-bold border-b border-slate-300">
                <th className="border border-slate-300 p-2 text-left">Komponen Honor Mengajar</th>
                <th className="border border-slate-300 p-2 text-center">Jumlah Sesi</th>
                <th className="border border-slate-300 p-2 text-center">Total Jam</th>
                <th className="border border-slate-300 p-2 text-center">Skema Bagi Hasil</th>
                <th className="border border-slate-300 p-2 text-right">Subtotal Honor</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-slate-300 p-2 font-semibold">Mengajar Kelas Grup</td>
                <td className="border border-slate-300 p-2 text-center">{printSlipTutor.sesiGrup} Sesi</td>
                <td className="border border-slate-300 p-2 text-center">{printSlipTutor.jamGrup.toFixed(1)} Jam</td>
                <td className="border border-slate-300 p-2 text-center">{rateGrup}% dari Tarif Siswa</td>
                <td className="border border-slate-300 p-2 text-right font-mono font-bold">{formatRupiah(printSlipTutor.honorGrup)}</td>
              </tr>
              <tr>
                <td className="border border-slate-300 p-2 font-semibold">Mengajar Kelas Privat (1-on-1)</td>
                <td className="border border-slate-300 p-2 text-center">{printSlipTutor.sesiPrivat} Sesi</td>
                <td className="border border-slate-300 p-2 text-center">{printSlipTutor.jamPrivat.toFixed(1)} Jam</td>
                <td className="border border-slate-300 p-2 text-center">{ratePrivat}% dari Tarif Siswa</td>
                <td className="border border-slate-300 p-2 text-right font-mono font-bold">{formatRupiah(printSlipTutor.honorPrivat)}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-black border-t-2 border-slate-900">
                <td colSpan={4} className="border border-slate-300 p-2 text-right">TOTAL HONOR BERSIH DITERIMA:</td>
                <td className="border border-slate-300 p-2 text-right font-mono text-sm">{formatRupiah(printSlipTutor.totalHonor)}</td>
              </tr>
            </tfoot>
          </table>

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-12 mt-12 text-xs">
            <div className="text-center">
              <p className="text-slate-600">Penerima (Tutor),</p>
              <div className="h-16"></div>
              <p className="font-extrabold underline">{printSlipTutor.tutorNama}</p>
            </div>

            <div className="text-center">
              <p className="text-slate-600">
                {pengaturan.kota || 'Jakarta'}, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
              <p className="text-slate-600">Pimpinan Lembaga,</p>
              <div className="h-16"></div>
              <p className="font-extrabold underline">{pengaturan.pimpinan}</p>
            </div>
          </div>
        </div>
      )}

      {/* In-App Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmLabel={confirmModal.confirmLabel || 'Hapus Sekarang'}
        cancelLabel={confirmModal.cancelLabel || 'Batal'}
        isDanger={confirmModal.isDanger !== false}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
