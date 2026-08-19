import React, { useState } from 'react';
import { AbsensiRecord, ConfirmModalState, PengaturanBimbel, StatusKehadiran, Student } from '../types';
import { 
  cleanPhoneNumber, 
  exportToCSV, 
  formatIndonesianDate, 
  getCurrentTimeString, 
  getTodayDateString 
} from '../utils/helpers';
import { ConfirmModal } from './ConfirmModal';

interface AbsensiViewProps {
  students: Student[];
  absensi: AbsensiRecord[];
  onSaveAbsensi: (records: AbsensiRecord[]) => void;
  pengaturan: PengaturanBimbel;
  onShowToast: (text: string, type?: 'success' | 'info' | 'error' | 'warning') => void;
}

export const AbsensiView: React.FC<AbsensiViewProps> = ({
  students,
  absensi,
  onSaveAbsensi,
  pengaturan,
  onShowToast,
}) => {
  const today = getTodayDateString();

  // Filters
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterSiswa, setFilterSiswa] = useState<string>('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AbsensiRecord | null>(null);

  // Warning Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Form State
  const [formData, setFormData] = useState<{
    siswaId: string;
    tanggal: string;
    jam: string;
    status: StatusKehadiran;
    materi: string;
    catatan: string;
    tutor: string;
  }>({
    siswaId: '',
    tanggal: today,
    jam: getCurrentTimeString(),
    status: 'Hadir',
    materi: '',
    catatan: '',
    tutor: pengaturan.daftarTutor[0] || '',
  });

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingRecord(null);
    const firstActiveStudent = students.find((s) => s.status === 'Aktif') || students[0];
    setFormData({
      siswaId: firstActiveStudent ? firstActiveStudent.id : '',
      tanggal: selectedDate || today,
      jam: getCurrentTimeString(),
      status: 'Hadir',
      materi: '',
      catatan: '',
      tutor: firstActiveStudent ? firstActiveStudent.tutorPembina : (pengaturan.daftarTutor[0] || ''),
    });
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (record: AbsensiRecord) => {
    setEditingRecord(record);
    setFormData({
      siswaId: record.siswaId,
      tanggal: record.tanggal,
      jam: record.jam,
      status: record.status,
      materi: record.materi,
      catatan: record.catatan || '',
      tutor: record.tutor,
    });
    setIsModalOpen(true);
  };

  // Student selection change in modal
  const handleStudentSelect = (sId: string) => {
    const std = students.find((s) => s.id === sId);
    setFormData((prev) => ({
      ...prev,
      siswaId: sId,
      tutor: std?.tutorPembina || prev.tutor,
    }));
  };

  // Submit Absensi Form (Create or Edit)
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.siswaId) {
      onShowToast('Pilih siswa terlebih dahulu!', 'warning');
      return;
    }

    const std = students.find((s) => s.id === formData.siswaId);
    const nama = std ? std.nama : 'Siswa';
    const kode = std ? std.kodeSiswa : '-';

    if (editingRecord) {
      // Edit
      const updated = absensi.map((r) =>
        r.id === editingRecord.id
          ? {
              ...r,
              ...formData,
              siswaNama: nama,
              kodeSiswa: kode,
            }
          : r
      );
      onSaveAbsensi(updated);
      onShowToast(`Presensi "${nama}" berhasil diperbarui!`, 'success');
    } else {
      // Create
      const newRec: AbsensiRecord = {
        id: `abs-${Date.now()}`,
        ...formData,
        siswaNama: nama,
        kodeSiswa: kode,
      };
      onSaveAbsensi([newRec, ...absensi]);
      onShowToast(`Presensi "${nama}" (${formData.status}) berhasil dicatat!`, 'success');
    }

    setIsModalOpen(false);
  };

  // Delete Record with Warning Confirmation
  const handleRequestDelete = (record: AbsensiRecord) => {
    setConfirmModal({
      isOpen: true,
      title: 'Konfirmasi Hapus Catatan Presensi',
      message: `PERINGATAN:\nApakah Anda yakin ingin menghapus data presensi:\n\n• Siswa: "${record.siswaNama}" (${record.kodeSiswa})\n• Tanggal: ${record.tanggal} (Jam: ${record.jam})\n• Status: ${record.status}\n• Materi: "${record.materi}"\n\nTindakan ini akan mempengaruhi rekapan total sesi hadir dan tagihan les siswa ini.`,
      confirmLabel: 'Ya, Hapus Presensi',
      isDanger: true,
      onConfirm: () => {
        const updated = absensi.filter((r) => r.id !== record.id);
        onSaveAbsensi(updated);
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        onShowToast(`Data presensi ${record.siswaNama} telah dihapus.`, 'info');
      },
    });
  };

  // Quick mark "Hadir Semua Siswa Aktif Hari Ini" with Confirmation
  const handleQuickMarkAllPresent = () => {
    const activeStudents = students.filter((s) => s.status === 'Aktif');
    if (activeStudents.length === 0) {
      onShowToast('Tidak ada siswa aktif.', 'warning');
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Presensi Otomatis Hadir Semua Siswa',
      message: `Konfirmasi Presensi Massal:\nCatat kehadiran (Status: Hadir) untuk ${activeStudents.length} siswa aktif pada tanggal ${selectedDate || today} sekaligus?`,
      confirmLabel: 'Ya, Catat Kehadiran Semua',
      isDanger: false,
      onConfirm: () => {
        const dateTarget = selectedDate || today;
        const existingTodayStudentIds = new Set(
          absensi.filter((a) => a.tanggal === dateTarget).map((a) => a.siswaId)
        );

        const newRecords: AbsensiRecord[] = [];
        activeStudents.forEach((s) => {
          if (!existingTodayStudentIds.has(s.id)) {
            newRecords.push({
              id: `abs-${Date.now()}-${s.id}`,
              siswaId: s.id,
              siswaNama: s.nama,
              kodeSiswa: s.kodeSiswa,
              tanggal: dateTarget,
              jam: getCurrentTimeString(),
              status: 'Hadir',
              materi: `Sesi Belajar ${s.tingkat} - ${s.jenisKelas}`,
              catatan: 'Kehadiran sesi terjadwal',
              tutor: s.tutorPembina || pengaturan.daftarTutor[0] || 'Tutor Sigma',
            });
          }
        });

        setConfirmModal((prev) => ({ ...prev, isOpen: false }));

        if (newRecords.length === 0) {
          onShowToast('Semua siswa aktif sudah memiliki presensi pada tanggal ini.', 'info');
          return;
        }

        onSaveAbsensi([...newRecords, ...absensi]);
        onShowToast(`Berhasil mencatat presensi hadir untuk ${newRecords.length} siswa!`, 'success');
      },
    });
  };

  // Export to CSV Functionality
  const handleDownloadCSV = () => {
    const headers = [
      'No',
      'Tanggal',
      'Jam',
      'Kode Siswa',
      'Nama Siswa',
      'Jenjang',
      'Status Kehadiran',
      'Materi Pelajaran',
      'Catatan',
      'Tutor Pengajar'
    ];

    const rows = filteredAbsensi.map((r, idx) => {
      const std = students.find((s) => s.id === r.siswaId);
      return [
        idx + 1,
        r.tanggal,
        r.jam,
        r.kodeSiswa,
        r.siswaNama,
        std?.tingkat || '-',
        r.status,
        r.materi,
        r.catatan || '-',
        r.tutor
      ];
    });

    exportToCSV([headers, ...rows], `Rekap_Absensi_Bimbel_Sigma_${selectedDate || 'Semua'}.csv`);
    onShowToast('File Rekap Absensi (.csv) berhasil diunduh!', 'success');
  };

  // Filtered List
  const filteredAbsensi = absensi.filter((r) => {
    const matchDate = !selectedDate || r.tanggal === selectedDate;
    const matchStatus = filterStatus === 'ALL' || r.status === filterStatus;
    const matchSiswa = filterSiswa === 'ALL' || r.siswaId === filterSiswa;
    return matchDate && matchStatus && matchSiswa;
  });

  // Calculate stats for current selected date
  const totalRecordsDate = absensi.filter((r) => !selectedDate || r.tanggal === selectedDate);
  const countHadir = totalRecordsDate.filter((r) => r.status === 'Hadir').length;
  const countIzin = totalRecordsDate.filter((r) => r.status === 'Izin').length;
  const countSakit = totalRecordsDate.filter((r) => r.status === 'Sakit').length;
  const countAlpha = totalRecordsDate.filter((r) => r.status === 'Alpha').length;

  return (
    <div className="space-y-6">
      
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm">
              <i className="fa-solid fa-clipboard-check"></i>
            </div>
            <h2 className="text-lg font-extrabold text-slate-900">Absensi & Presensi Digital</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Pencatatan sesi kehadiran siswa, materi pembelajaran, status kehadiran, dan catatan evaluasi
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {/* Download CSV Button */}
          <button
            id="btn-download-absensi-csv"
            onClick={handleDownloadCSV}
            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-2 transition-all shadow-xs"
            title="Download Rekap Absensi format .CSV"
          >
            <i className="fa-solid fa-file-csv text-emerald-600 text-sm"></i>
            <span>Download Rekap Absensi (.csv)</span>
          </button>

          {/* Quick Mark All Present */}
          <button
            onClick={handleQuickMarkAllPresent}
            className="px-3.5 py-2.5 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center gap-2 transition-all"
            title="Hadirkan semua siswa aktif pada tanggal terpilih"
          >
            <i className="fa-solid fa-users-viewfinder text-sm"></i>
            <span>+ Hadirkan Semua</span>
          </button>

          {/* Add Attendance Button */}
          <button
            id="btn-tambah-absensi"
            onClick={handleOpenCreate}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-2 transition-all shadow-md shadow-indigo-200"
          >
            <i className="fa-solid fa-plus text-sm"></i>
            <span>Input Presensi</span>
          </button>
        </div>
      </div>

      {/* Date Summary Metric Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Input</span>
            <span className="text-xl font-black text-slate-900">{totalRecordsDate.length} Sesi</span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs">
            <i className="fa-solid fa-list-check"></i>
          </div>
        </div>

        <div className="bg-emerald-50 p-3.5 rounded-xl border border-emerald-100 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-emerald-700 block">Hadir</span>
            <span className="text-xl font-black text-emerald-800">{countHadir} Siswa</span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-emerald-200/60 text-emerald-800 flex items-center justify-center font-bold text-xs">
            H
          </div>
        </div>

        <div className="bg-blue-50 p-3.5 rounded-xl border border-blue-100 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-blue-700 block">Izin</span>
            <span className="text-xl font-black text-blue-800">{countIzin} Siswa</span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-blue-200/60 text-blue-800 flex items-center justify-center font-bold text-xs">
            I
          </div>
        </div>

        <div className="bg-purple-50 p-3.5 rounded-xl border border-purple-100 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-purple-700 block">Sakit</span>
            <span className="text-xl font-black text-purple-800">{countSakit} Siswa</span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-purple-200/60 text-purple-800 flex items-center justify-center font-bold text-xs">
            S
          </div>
        </div>

        <div className="bg-rose-50 p-3.5 rounded-xl border border-rose-100 shadow-xs flex items-center justify-between col-span-2 sm:col-span-1">
          <div>
            <span className="text-[10px] uppercase font-bold text-rose-700 block">Alpha / Alpa</span>
            <span className="text-xl font-black text-rose-800">{countAlpha} Siswa</span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-rose-200/60 text-rose-800 flex items-center justify-center font-bold text-xs">
            A
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          
          {/* Pilih Tanggal */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
              Filter Tanggal:
            </label>
            <div className="flex gap-1.5">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full py-2 px-3 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden bg-slate-50 font-mono"
              />
              <button
                type="button"
                onClick={() => setSelectedDate(today)}
                className="px-2.5 py-2 rounded-xl border border-slate-200 text-xs font-bold hover:bg-slate-100 text-slate-700"
                title="Set Hari Ini"
              >
                Hari Ini
              </button>
              <button
                type="button"
                onClick={() => setSelectedDate('')}
                className="px-2.5 py-2 rounded-xl border border-slate-200 text-xs font-bold hover:bg-slate-100 text-slate-500"
                title="Tampilkan Semua Tanggal"
              >
                Semua
              </button>
            </div>
          </div>

          {/* Filter Siswa */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
              Filter Siswa:
            </label>
            <select
              value={filterSiswa}
              onChange={(e) => setFilterSiswa(e.target.value)}
              className="w-full py-2 px-3 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden bg-white text-slate-700"
            >
              <option value="ALL">Semua Siswa ({students.length})</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.kodeSiswa} - {s.nama} ({s.tingkat})
                </option>
              ))}
            </select>
          </div>

          {/* Filter Status */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
              Filter Status:
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full py-2 px-3 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden bg-white text-slate-700"
            >
              <option value="ALL">Semua Status (H / I / S / A)</option>
              <option value="Hadir">Hadir</option>
              <option value="Izin">Izin</option>
              <option value="Sakit">Sakit</option>
              <option value="Alpha">Alpha</option>
            </select>
          </div>

          {/* Quick Date Display */}
          <div className="flex flex-col justify-end">
            <div className="p-2 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-600 font-semibold flex items-center justify-between">
              <span>{selectedDate ? formatIndonesianDate(selectedDate) : 'Semua Tanggal'}</span>
              <span className="text-indigo-600 font-bold">{filteredAbsensi.length} Data</span>
            </div>
          </div>

        </div>
      </div>

      {/* Attendance Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold">
                <th className="py-3 px-4 w-12 text-center">No</th>
                <th className="py-3 px-4">Waktu & Tanggal</th>
                <th className="py-3 px-4">Siswa</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4">Materi Pelajaran</th>
                <th className="py-3 px-4">Catatan Evaluasi</th>
                <th className="py-3 px-4">Tutor Pengajar</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAbsensi.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <i className="fa-solid fa-clipboard-list text-2xl mb-2 block"></i>
                    Belum ada data presensi untuk filter yang dipilih.
                  </td>
                </tr>
              ) : (
                filteredAbsensi.map((r, idx) => {
                  const std = students.find((s) => s.id === r.siswaId);
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 text-center text-slate-400 font-mono">{idx + 1}</td>
                      
                      {/* Tanggal & Jam */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 font-mono">{r.tanggal}</div>
                        <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                          <i className="fa-solid fa-clock text-slate-400"></i> {r.jam || '-'}
                        </div>
                      </td>

                      {/* Nama & Kode */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{r.siswaNama}</div>
                        <div className="text-[10px] font-mono text-indigo-600 font-semibold flex items-center gap-1.5">
                          <span>{r.kodeSiswa}</span>
                          {std && (
                            <span className="text-slate-400 font-sans">({std.tingkat} - {std.jenisKelas})</span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                          r.status === 'Hadir' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                          r.status === 'Izin' ? 'bg-blue-100 text-blue-800 border border-blue-300' :
                          r.status === 'Sakit' ? 'bg-purple-100 text-purple-800 border border-purple-300' :
                          'bg-rose-100 text-rose-800 border border-rose-300'
                        }`}>
                          {r.status}
                        </span>
                      </td>

                      {/* Materi */}
                      <td className="py-3 px-4 text-slate-800">
                        <div className="font-semibold">{r.materi || '-'}</div>
                      </td>

                      {/* Catatan */}
                      <td className="py-3 px-4 text-slate-500">
                        <div className="italic text-[11px] line-clamp-2">{r.catatan || '-'}</div>
                      </td>

                      {/* Tutor */}
                      <td className="py-3 px-4 text-slate-700">
                        <div className="font-medium">{r.tutor || '-'}</div>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {std?.kontak && (
                            <a
                              href={`https://wa.me/${cleanPhoneNumber(std.kontak)}?text=Halo%20Bapak%2FIbu%20Wali%20dari%20${encodeURIComponent(std.nama)}%2C%20menginfokan%20kehadiran%20Bimbel%20Sigma%20pada%20tanggal%20${encodeURIComponent(r.tanggal)}%3A%20Status%20*${encodeURIComponent(r.status)}*%20dengan%20materi%20*${encodeURIComponent(r.materi)}*.%20Terima%20kasih.`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-lg border border-emerald-200 text-emerald-600 hover:bg-emerald-50 transition-all"
                              title="Kirim Info via WhatsApp"
                            >
                              <i className="fa-brands fa-whatsapp"></i>
                            </a>
                          )}
                          <button
                            onClick={() => handleOpenEdit(r)}
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 transition-all"
                            title="Edit Absensi"
                          >
                            <i className="fa-solid fa-pen-to-square"></i>
                          </button>
                          <button
                            onClick={() => handleRequestDelete(r)}
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-rose-600 hover:border-rose-300 hover:bg-rose-50 transition-all"
                            title="Hapus Absensi"
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
          </table>
        </div>
      </div>

      {/* Modal Input / Edit Presensi */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 animate-scale-up space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm">
                  <i className={`fa-solid ${editingRecord ? 'fa-pen-to-square' : 'fa-clipboard-user'}`}></i>
                </div>
                <h3 className="font-extrabold text-base text-slate-900">
                  {editingRecord ? 'Edit Presensi Siswa' : 'Input Presensi Baru'}
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
              
              {/* Pilih Siswa */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Pilih Siswa Bimbel *</label>
                <select
                  required
                  value={formData.siswaId}
                  onChange={(e) => handleStudentSelect(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-hidden font-bold"
                >
                  <option value="">-- Pilih Siswa --</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.kodeSiswa} - {s.nama} ({s.tingkat} - {s.jenisKelas} | {s.status})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Tanggal */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tanggal *</label>
                  <input
                    type="date"
                    required
                    value={formData.tanggal}
                    onChange={(e) => setFormData({ ...formData, tanggal: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-indigo-500 outline-hidden font-bold"
                  />
                </div>

                {/* Jam */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Jam Masuk / Sesi *</label>
                  <input
                    type="time"
                    required
                    value={formData.jam}
                    onChange={(e) => setFormData({ ...formData, jam: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-indigo-500 outline-hidden font-bold"
                  />
                </div>
              </div>

              {/* Status Kehadiran Radio Pills */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Status Kehadiran *</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['Hadir', 'Izin', 'Sakit', 'Alpha'] as StatusKehadiran[]).map((st) => (
                    <button
                      type="button"
                      key={st}
                      onClick={() => setFormData({ ...formData, status: st })}
                      className={`py-2 rounded-xl font-bold border transition-all text-center ${
                        formData.status === st
                          ? st === 'Hadir'
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                            : st === 'Izin'
                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                            : st === 'Sakit'
                            ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                            : 'bg-rose-600 text-white border-rose-600 shadow-sm'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Materi Pelajaran */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Materi / Topik Pelajaran *</label>
                <input
                  type="text"
                  required
                  value={formData.materi}
                  onChange={(e) => setFormData({ ...formData, materi: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-hidden font-semibold"
                  placeholder="Contoh: Matematika - Persamaan Kuadrat & Soal Latihan"
                />
              </div>

              {/* Catatan Evaluasi */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Catatan Evaluasi / Keterangan</label>
                <textarea
                  rows={2}
                  value={formData.catatan}
                  onChange={(e) => setFormData({ ...formData, catatan: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-hidden"
                  placeholder="Contoh: Sangat aktif bertanya, tugas selesai 100%"
                />
              </div>

              {/* Tutor Pengajar */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Tutor Pengajar</label>
                <select
                  value={formData.tutor}
                  onChange={(e) => setFormData({ ...formData, tutor: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-hidden"
                >
                  {pengaturan.daftarTutor.map((t, idx) => (
                    <option key={idx} value={t}>{t}</option>
                  ))}
                </select>
              </div>

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
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md shadow-indigo-200"
                >
                  <i className="fa-solid fa-floppy-disk mr-1.5"></i>
                  {editingRecord ? 'Simpan Perubahan' : 'Simpan Presensi'}
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
