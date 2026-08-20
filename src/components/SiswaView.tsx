import React, { useState, useMemo } from 'react';
import { AbsensiRecord, ConfirmModalState, JenisKelas, PengaturanBimbel, StatusSiswa, Student, TingkatSekolah } from '../types';
import { 
  DAFTAR_TINGKAT_SEKOLAH, 
  cleanAndSyncTutorData, 
  cleanPhoneNumber, 
  exportToCSV, 
  formatRupiah, 
  getDefaultTarifByTingkat, 
  getKodePrefixByTingkat, 
  getTingkatBadgeClass, 
  getTodayDateString 
} from '../utils/helpers';
import { ConfirmModal } from './ConfirmModal';

interface SiswaViewProps {
  students: Student[];
  onSaveStudents: (students: Student[]) => void;
  pengaturan: PengaturanBimbel;
  absensi?: AbsensiRecord[];
  onSaveAbsensi?: (absensi: AbsensiRecord[]) => void;
  onSavePengaturan?: (newPengaturan: PengaturanBimbel) => void;
  onShowToast: (text: string, type?: 'success' | 'info' | 'error' | 'warning') => void;
}

export const SiswaView: React.FC<SiswaViewProps> = ({
  students,
  onSaveStudents,
  pengaturan,
  absensi,
  onSaveAbsensi,
  onSavePengaturan,
  onShowToast,
}) => {
  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTingkat, setFilterTingkat] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterJenis, setFilterJenis] = useState<string>('ALL');
  const [filterTutor, setFilterTutor] = useState<string>('ALL');

  // Modal State (Create / Edit)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [isAddingNewTutorInline, setIsAddingNewTutorInline] = useState(false);
  const [inlineNewTutorName, setInlineNewTutorName] = useState('');

  // Warning Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Official tutors list strictly from Master Bimbel Settings (Pengaturan)
  const availableTutors = useMemo(() => {
    const list = (pengaturan.daftarTutor || []).filter((t) => t && t.trim().length > 0);
    return Array.from(new Set(list));
  }, [pengaturan.daftarTutor]);

  // Count students with tutor references not registered in official Bimbel tutor list
  const unregisteredStudentsCount = useMemo(() => {
    return students.filter((s) => {
      const tutor = (s.tutorPembina || '').trim();
      return tutor && !availableTutors.includes(tutor);
    }).length;
  }, [students, availableTutors]);

  // Handler to repair and synchronize all student tutor allocations to official Bimbel tutors
  const handleAutoCleanAndSyncTutors = () => {
    if (availableTutors.length === 0) {
      onShowToast('Daftar tutor di Pusat Kontrol kosong. Tambahkan minimal 1 tutor resmi.', 'warning');
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Sinkronisasi Tutor Pembina Siswa',
      message: `TINDAKAN PERBAIKAN:\nSistem akan memverifikasi seluruh siswa (${students.length} siswa) dan menyesuaikan alokasi Tutor Pembina agar 100% selaras dengan daftar tutor resmi bimbel (${availableTutors.length} tutor terdaftar).\n\nNama tutor yang tidak terdaftar akan otomatis diselaraskan.\n\nLanjutkan proses sinkronisasi?`,
      confirmLabel: 'Ya, Sinkronkan Sekarang',
      isDanger: false,
      onConfirm: () => {
        const { cleanedStudents, cleanedAbsensi, cleanedStudentsCount, cleanedAbsensiCount } = cleanAndSyncTutorData(
          students,
          absensi || [],
          availableTutors
        );

        onSaveStudents(cleanedStudents);
        if (absensi && onSaveAbsensi) {
          onSaveAbsensi(cleanedAbsensi);
        }

        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        onShowToast(
          `Sinkronisasi berhasil! ${cleanedStudentsCount} siswa diselaraskan dengan tutor resmi bimbel.`,
          'success'
        );
      },
    });
  };

  // Form State
  const [formData, setFormData] = useState<{
    kodeSiswa: string;
    nama: string;
    tingkat: TingkatSekolah;
    jenisKelas: JenisKelas;
    tarifPerSesi: number;
    kontak: string;
    tutorPembina: string;
    status: StatusSiswa;
  }>({
    kodeSiswa: '',
    nama: '',
    tingkat: 'SD',
    jenisKelas: 'Grup',
    tarifPerSesi: 50000,
    kontak: '',
    tutorPembina: availableTutors[0] || 'Tutor Sigma',
    status: 'Aktif',
  });

  // Open Modal Create
  const handleOpenCreate = () => {
    setEditingStudent(null);
    setIsAddingNewTutorInline(false);
    setInlineNewTutorName('');
    const nextNumber = students.length + 1;
    setFormData({
      kodeSiswa: `SGM-SD-${String(nextNumber).padStart(3, '0')}`,
      nama: '',
      tingkat: 'SD',
      jenisKelas: 'Grup',
      tarifPerSesi: 50000,
      kontak: '',
      tutorPembina: pengaturan.daftarTutor[0] || '',
      status: 'Aktif',
    });
    setIsModalOpen(true);
  };

  // Open Modal Edit
  const handleOpenEdit = (student: Student) => {
    setEditingStudent(student);
    setIsAddingNewTutorInline(false);
    setInlineNewTutorName('');
    setFormData({
      kodeSiswa: student.kodeSiswa,
      nama: student.nama,
      tingkat: student.tingkat,
      jenisKelas: student.jenisKelas,
      tarifPerSesi: student.tarifPerSesi,
      kontak: student.kontak,
      tutorPembina: student.tutorPembina || '',
      status: student.status,
    });
    setIsModalOpen(true);
  };

  // Quick Change Tutor Pembina directly from table
  const handleQuickChangeTutor = (studentId: string, newTutor: string) => {
    const targetStudent = students.find((s) => s.id === studentId);
    if (!targetStudent) return;

    const updated = students.map((s) =>
      s.id === studentId ? { ...s, tutorPembina: newTutor } : s
    );
    onSaveStudents(updated);
    onShowToast(
      newTutor
        ? `Tutor Pembina untuk "${targetStudent.nama}" berhasil diubah ke: ${newTutor}`
        : `Tutor Pembina untuk "${targetStudent.nama}" telah dikosongkan.`,
      'success'
    );
  };

  // Handle add tutor dynamically into Database Tutor
  const handleSaveInlineTutor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inlineNewTutorName.trim()) return;
    const cleanName = inlineNewTutorName.trim();

    if (onSavePengaturan) {
      const currentList = pengaturan.daftarTutor || [];
      if (!currentList.includes(cleanName)) {
        const updatedList = [...currentList, cleanName];
        onSavePengaturan({
          ...pengaturan,
          daftarTutor: updatedList,
        });
      }
    }

    setFormData((prev) => ({ ...prev, tutorPembina: cleanName }));
    setIsAddingNewTutorInline(false);
    setInlineNewTutorName('');
    onShowToast(`Tutor baru "${cleanName}" berhasil ditambahkan ke database tutor!`, 'success');
  };

  // Auto-generate code prefix on Tingkat change if creating
  const handleTingkatChange = (newTingkat: TingkatSekolah) => {
    const defaultTarif = getDefaultTarifByTingkat(newTingkat, formData.jenisKelas);
    const prefix = getKodePrefixByTingkat(newTingkat);

    if (!editingStudent) {
      const countTingkat = students.filter((s) => s.tingkat === newTingkat).length + 1;
      setFormData((prev) => ({
        ...prev,
        tingkat: newTingkat,
        kodeSiswa: `SGM-${prefix}-${String(countTingkat).padStart(3, '0')}`,
        tarifPerSesi: defaultTarif,
      }));
    } else {
      setFormData((prev) => ({ ...prev, tingkat: newTingkat }));
    }
  };

  // Handle Save Student (Create or Update)
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nama.trim()) {
      onShowToast('Nama siswa wajib diisi!', 'warning');
      return;
    }

    if (editingStudent) {
      // Update existing
      const updated = students.map((s) =>
        s.id === editingStudent.id
          ? {
              ...s,
              ...formData,
            }
          : s
      );
      onSaveStudents(updated);
      onShowToast(`Data siswa "${formData.nama}" berhasil diperbarui!`, 'success');
    } else {
      // Create new
      const newStudent: Student = {
        id: `std-${Date.now()}`,
        ...formData,
        tanggalDaftar: getTodayDateString(),
      };
      onSaveStudents([newStudent, ...students]);
      onShowToast(`Siswa baru "${formData.nama}" berhasil didaftarkan!`, 'success');
    }

    setIsModalOpen(false);
  };

  // Delete Student with Warning Modal
  const handleRequestDelete = (student: Student) => {
    setConfirmModal({
      isOpen: true,
      title: 'Konfirmasi Hapus Data Siswa',
      message: `PERINGATAN:\nApakah Anda yakin ingin menghapus data siswa:\n\n• Nama: "${student.nama}"\n• Kode: ${student.kodeSiswa}\n• Jenjang: ${student.tingkat} (${student.jenisKelas})\n\nTindakan ini bersifat permanen dan tidak dapat dikembalikan.`,
      confirmLabel: 'Ya, Hapus Data Siswa',
      isDanger: true,
      onConfirm: () => {
        const updated = students.filter((s) => s.id !== student.id);
        onSaveStudents(updated);
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        onShowToast(`Data siswa "${student.nama}" berhasil dihapus.`, 'info');
      },
    });
  };

  // Export to CSV Functionality
  const handleDownloadCSV = () => {
    const headers = [
      'No',
      'Kode Siswa',
      'Nama Lengkap',
      'Tingkat',
      'Jenis Kelas',
      'Tarif Per Sesi (Rp)',
      'Kontak WA',
      'Tutor Pembina',
      'Status',
      'Tanggal Terdaftar',
    ];

    const rows = filteredStudents.map((s, idx) => [
      idx + 1,
      s.kodeSiswa,
      s.nama,
      s.tingkat,
      s.jenisKelas,
      s.tarifPerSesi,
      s.kontak,
      s.tutorPembina,
      s.status,
      s.tanggalDaftar,
    ]);

    exportToCSV([headers, ...rows], `Data_Siswa_Bimbel_Sigma_${getTodayDateString()}.csv`);
    onShowToast('File Data Siswa (.csv) berhasil diunduh!', 'success');
  };

  // Filter Data
  const filteredStudents = students.filter((s) => {
    const matchSearch =
      s.nama.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.kodeSiswa.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.tutorPembina.toLowerCase().includes(searchTerm.toLowerCase());

    const matchTingkat = filterTingkat === 'ALL' || s.tingkat === filterTingkat;
    const matchStatus = filterStatus === 'ALL' || s.status === filterStatus;
    const matchJenis = filterJenis === 'ALL' || s.jenisKelas === filterJenis;
    const matchTutor = filterTutor === 'ALL' || s.tutorPembina === filterTutor;

    return matchSearch && matchTingkat && matchStatus && matchJenis && matchTutor;
  });

  return (
    <div className="space-y-6">
      {/* Top Header Card with Actions */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-md shadow-indigo-600/20">
              <i className="fa-solid fa-users text-base"></i>
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Database Siswa Bimbel Sigma</h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Kelola data murid, jenjang sekolah, paket tarif les per sesi, dan alokasi Tutor Pembina (Wali Siswa)
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {/* Sync Tutor Action Button */}
          <button
            id="btn-sync-tutor-siswa"
            type="button"
            onClick={handleAutoCleanAndSyncTutors}
            className="px-3.5 py-2.5 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center gap-2 transition-all shadow-xs cursor-pointer"
            title="Sinkronkan seluruh Tutor Pembina dengan Database Resmi Bimbel"
          >
            <i className="fa-solid fa-arrows-rotate text-indigo-600"></i>
            <span>Sinkronkan Tutor</span>
          </button>

          {/* Download CSV Button */}
          <button
            id="btn-download-siswa-csv"
            onClick={handleDownloadCSV}
            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-2 transition-all shadow-xs cursor-pointer"
            title="Download Data Siswa format .CSV"
          >
            <i className="fa-solid fa-file-csv text-emerald-600 text-sm"></i>
            <span>Download CSV</span>
          </button>

          {/* Add Student Button */}
          <button
            id="btn-tambah-siswa"
            onClick={handleOpenCreate}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-2 transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
          >
            <i className="fa-solid fa-user-plus text-sm"></i>
            <span>Tambah Siswa Baru</span>
          </button>
        </div>
      </div>

      {/* Unregistered Tutor Alert Banner */}
      {unregisteredStudentsCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900 shadow-xs">
          <div className="flex items-center gap-3 text-xs">
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold shrink-0">
              <i className="fa-solid fa-triangle-exclamation text-sm"></i>
            </div>
            <div>
              <div className="font-extrabold text-amber-950">Tutor Pembina Perlu Disinkronkan</div>
              <p className="text-amber-800 text-[11px] mt-0.5">
                Ditemukan <b>{unregisteredStudentsCount} siswa</b> dengan nama Tutor Pembina yang tidak terdaftar di Database Resmi Bimbel ({availableTutors.length} tutor aktif).
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleAutoCleanAndSyncTutors}
            className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shrink-0 flex items-center gap-1.5 shadow-xs cursor-pointer transition-all"
          >
            <i className="fa-solid fa-wand-magic-sparkles"></i>
            <span>Perbaiki & Sinkronkan Sekarang</span>
          </button>
        </div>
      )}

      {/* Info Callout: Clarification on Tutor Pembina vs Attendance Payroll */}
      <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200/80 flex items-start gap-3 text-xs text-indigo-950">
        <div className="w-7 h-7 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 mt-0.5 font-bold">
          <i className="fa-solid fa-circle-info"></i>
        </div>
        <div className="space-y-1">
          <div className="font-extrabold text-indigo-950 flex items-center gap-2">
            <span>Peran Tutor Pembina pada Database Siswa</span>
            <span className="px-2 py-0.5 rounded-md bg-indigo-200/70 text-indigo-900 text-[10px] font-bold">
              Penanggung Jawab / Wali
            </span>
          </div>
          <p className="text-slate-600 leading-relaxed text-[11px]">
            Tutor Pembina dapat diubah sewaktu-waktu sesuai ketersediaan tutor di database. Bidang ini berfungsi murni sebagai <b>penanggung jawab administratif / wali akademik siswa</b>. 
            <span className="font-semibold text-indigo-950"> Honor dan gaji mengajar tutor dihitung mandiri berdasarkan kehadiran di menu Absensi dan siapa tutor yang aktual mengajar sesi tersebut.</span>
          </p>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-4 sm:p-5 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search Box */}
          <div className="lg:col-span-2 relative">
            <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
            <input
              type="text"
              placeholder="Cari nama siswa, kode, atau tutor pembina..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden bg-slate-50/60 font-medium"
            />
          </div>

          {/* Filter Tingkat */}
          <div>
            <select
              value={filterTingkat}
              onChange={(e) => setFilterTingkat(e.target.value)}
              className="w-full py-2 px-3 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden bg-white text-slate-700 font-bold cursor-pointer"
            >
              <option value="ALL">Semua Jenjang ({DAFTAR_TINGKAT_SEKOLAH.length} Jenjang)</option>
              {DAFTAR_TINGKAT_SEKOLAH.map((t) => (
                <option key={t.value} value={t.value}>
                  Jenjang {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Jenis Kelas */}
          <div>
            <select
              value={filterJenis}
              onChange={(e) => setFilterJenis(e.target.value)}
              className="w-full py-2 px-3 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden bg-white text-slate-700 font-bold cursor-pointer"
            >
              <option value="ALL">Semua Jenis Kelas</option>
              <option value="Privat">Kelas Privat (1 on 1)</option>
              <option value="Grup">Kelas Grup / Reguler</option>
            </select>
          </div>

          {/* Filter Tutor Pembina */}
          <div>
            <select
              value={filterTutor}
              onChange={(e) => setFilterTutor(e.target.value)}
              className="w-full py-2 px-3 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden bg-white text-slate-700 font-bold cursor-pointer"
            >
              <option value="ALL">Semua Tutor Pembina ({availableTutors.length})</option>
              {availableTutors.map((t, idx) => (
                <option key={idx} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
          <span>Menampilkan <b>{filteredStudents.length}</b> dari {students.length} total siswa terdaftar</span>
          {(searchTerm || filterTingkat !== 'ALL' || filterStatus !== 'ALL' || filterJenis !== 'ALL' || filterTutor !== 'ALL') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterTingkat('ALL');
                setFilterStatus('ALL');
                setFilterJenis('ALL');
                setFilterTutor('ALL');
              }}
              className="text-indigo-600 font-bold hover:underline cursor-pointer"
            >
              Reset Filter
            </button>
          )}
        </div>
      </div>

      {/* Student Data Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold">
                <th className="py-3.5 px-4 w-12 text-center">No</th>
                <th className="py-3.5 px-4">Kode & Nama Siswa</th>
                <th className="py-3.5 px-4">Jenjang & Kelas</th>
                <th className="py-3.5 px-4">Tarif / Sesi</th>
                <th className="py-3.5 px-4">
                  <div className="flex items-center gap-1.5">
                    <span>Tutor Pembina (Penanggung Jawab)</span>
                    <span className="text-[10px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded font-normal">Dapat diubah</span>
                  </div>
                </th>
                <th className="py-3.5 px-4">Kontak (WA)</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <i className="fa-solid fa-user-slash text-3xl mb-2 text-slate-300"></i>
                    <p className="font-semibold text-slate-600">Tidak ada data siswa yang cocok dengan filter pencarian</p>
                  </td>
                </tr>
              ) : (
                filteredStudents.map((s, idx) => (
                  <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 text-center text-slate-400 font-mono">{idx + 1}</td>
                    
                    {/* Kode & Nama */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{s.nama}</div>
                      <div className="text-[10px] font-mono text-indigo-600 font-semibold">{s.kodeSiswa}</div>
                    </td>

                    {/* Tingkat & Kelas */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${getTingkatBadgeClass(s.tingkat)}`}>
                          {s.tingkat}
                        </span>
                        <span className="text-slate-600 font-medium">({s.jenisKelas})</span>
                      </div>
                    </td>

                    {/* Tarif Per Sesi */}
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                      {formatRupiah(s.tarifPerSesi)}
                      <span className="text-[10px] font-normal text-slate-400 block">/ sesi hadir</span>
                    </td>

                    {/* Tutor Pembina - Inline Quick Dropdown */}
                    <td className="py-3.5 px-4 text-slate-700">
                      <div className="relative group min-w-[200px] max-w-[270px]">
                        <select
                          value={s.tutorPembina || ''}
                          onChange={(e) => handleQuickChangeTutor(s.id, e.target.value)}
                          className={`w-full text-xs font-semibold py-1.5 px-2.5 rounded-xl border cursor-pointer truncate transition-all shadow-2xs ${
                            s.tutorPembina && !availableTutors.includes(s.tutorPembina)
                              ? 'bg-amber-50/80 border-amber-300 text-amber-900 focus:ring-amber-500'
                              : 'bg-slate-50 border-slate-200 hover:bg-white focus:bg-white text-slate-800 focus:ring-indigo-500'
                          } focus:ring-2 focus:border-indigo-500 outline-hidden`}
                          title="Klik untuk mengubah Tutor Pembina (Penanggung Jawab Siswa)"
                        >
                          <option value="">-- Belum Ditentukan --</option>
                          {availableTutors.map((t, tidx) => (
                            <option key={tidx} value={t}>{t}</option>
                          ))}
                          {s.tutorPembina && !availableTutors.includes(s.tutorPembina) && (
                            <option value={s.tutorPembina} className="text-amber-800 bg-amber-100 font-bold">
                              ⚠️ {s.tutorPembina} (Tidak Terdaftar di Bimbel)
                            </option>
                          )}
                        </select>
                      </div>
                    </td>

                    {/* Kontak WA */}
                    <td className="py-3.5 px-4 font-mono text-slate-600">
                      {s.kontak ? (
                        <a
                          href={`https://wa.me/${cleanPhoneNumber(s.kontak)}?text=Halo%20Bapak%2FIbu%20Wali%20dari%20${encodeURIComponent(s.nama)}%2C%20kami%20dari%20${encodeURIComponent(pengaturan.namaLembaga)}...`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 hover:underline font-semibold bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200"
                        >
                          <i className="fa-brands fa-whatsapp text-emerald-600"></i>
                          {s.kontak}
                        </a>
                      ) : (
                        <span className="text-slate-400 italic">-</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4 text-center">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        s.status === 'Aktif'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}>
                        {s.status}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(s)}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 transition-all cursor-pointer"
                          title="Edit Lengkap Data Siswa"
                        >
                          <i className="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button
                          onClick={() => handleRequestDelete(s)}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-rose-600 hover:border-rose-300 hover:bg-rose-50 transition-all cursor-pointer"
                          title="Hapus Siswa (Warning)"
                        >
                          <i className="fa-solid fa-trash-can"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Form Tambah / Edit Siswa */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 animate-scale-up space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm">
                  <i className={`fa-solid ${editingStudent ? 'fa-pen-to-square' : 'fa-user-plus'}`}></i>
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900">
                    {editingStudent ? 'Edit Data Siswa' : 'Tambah Siswa Baru'}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    {editingStudent ? `Ubah informasi ${editingStudent.nama}` : 'Daftarkan siswa baru ke sistem Bimbel Sigma'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-base"></i>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              
              <div className="grid grid-cols-2 gap-3">
                {/* Kode Siswa */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Kode Siswa *</label>
                  <input
                    type="text"
                    required
                    value={formData.kodeSiswa}
                    onChange={(e) => setFormData({ ...formData, kodeSiswa: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-indigo-500 outline-hidden font-bold bg-slate-50"
                    placeholder="SGM-SD-001"
                  />
                </div>

                {/* Status */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Status Keaktifan *</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as StatusSiswa })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden font-bold bg-white cursor-pointer"
                  >
                    <option value="Aktif">Aktif</option>
                    <option value="Non-Aktif">Non-Aktif</option>
                  </select>
                </div>
              </div>

              {/* Nama Siswa */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nama Lengkap Siswa *</label>
                <input
                  type="text"
                  required
                  value={formData.nama}
                  onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden font-semibold"
                  placeholder="Contoh: Ahmad Faiz Pratama"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Tingkat */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Jenjang Tingkat *</label>
                  <select
                    value={formData.tingkat}
                    onChange={(e) => handleTingkatChange(e.target.value as TingkatSekolah)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden font-bold cursor-pointer"
                  >
                    {DAFTAR_TINGKAT_SEKOLAH.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.fullLabel}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Jenis Kelas */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Jenis Kelas *</label>
                  <select
                    value={formData.jenisKelas}
                    onChange={(e) => setFormData({ ...formData, jenisKelas: e.target.value as JenisKelas })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden font-bold cursor-pointer"
                  >
                    <option value="Grup">Grup / Reguler</option>
                    <option value="Privat">Privat (1 on 1)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Tarif Les Per Sesi */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Tarif Les Per Sesi (Rp) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="5000"
                    value={formData.tarifPerSesi}
                    onChange={(e) => setFormData({ ...formData, tarifPerSesi: Number(e.target.value) })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-indigo-500 outline-hidden font-bold text-indigo-700"
                    placeholder="50000"
                  />
                  <span className="text-[10px] text-slate-400 block mt-0.5">Digunakan otomatis di kartu tagihan</span>
                </div>

                {/* Kontak WA */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nomor WhatsApp Siswa / Ortu</label>
                  <input
                    type="text"
                    value={formData.kontak}
                    onChange={(e) => setFormData({ ...formData, kontak: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-indigo-500 outline-hidden"
                    placeholder="08123456789"
                  />
                </div>
              </div>

              {/* Tutor Pembina Selection & Management */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-slate-800">
                    Tutor Pembina (Penanggung Jawab Siswa)
                  </label>
                  {!isAddingNewTutorInline && (
                    <button
                      type="button"
                      onClick={() => setIsAddingNewTutorInline(true)}
                      className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <i className="fa-solid fa-plus text-[10px]"></i>
                      <span>Tambah Tutor Baru</span>
                    </button>
                  )}
                </div>

                {/* Inline New Tutor Input if requested */}
                {isAddingNewTutorInline ? (
                  <div className="p-2.5 rounded-xl bg-indigo-50/80 border border-indigo-200 space-y-2">
                    <div className="text-[11px] font-bold text-indigo-900">
                      Daftarkan Tutor Baru ke Database:
                    </div>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={inlineNewTutorName}
                        onChange={(e) => setInlineNewTutorName(e.target.value)}
                        placeholder="Contoh: Kak Rizky Pratama, S.Si (Biologi)"
                        className="flex-1 px-3 py-1.5 bg-white border border-indigo-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-indigo-500 outline-hidden"
                      />
                      <button
                        type="button"
                        onClick={handleSaveInlineTutor}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs cursor-pointer shadow-xs"
                      >
                        Simpan
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsAddingNewTutorInline(false)}
                        className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg text-xs cursor-pointer"
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                ) : (
                  <select
                    id="modal-tutor-pembina-select"
                    value={formData.tutorPembina}
                    onChange={(e) => setFormData({ ...formData, tutorPembina: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden font-bold bg-white text-slate-800 cursor-pointer text-xs"
                  >
                    <option value="">-- Pilih Tutor Pembina dari Database Bimbel --</option>
                    {availableTutors.map((t, idx) => (
                      <option key={idx} value={t}>{t}</option>
                    ))}
                    {editingStudent?.tutorPembina && !availableTutors.includes(editingStudent.tutorPembina) && (
                      <option value={editingStudent.tutorPembina} className="text-amber-800 bg-amber-100 font-bold">
                        ⚠️ {editingStudent.tutorPembina} (Tutor Sebelumnya / Tidak Terdaftar)
                      </option>
                    )}
                    {formData.tutorPembina &&
                      formData.tutorPembina !== editingStudent?.tutorPembina &&
                      !availableTutors.includes(formData.tutorPembina) && (
                        <option value={formData.tutorPembina} className="text-amber-800 bg-amber-100 font-bold">
                          ⚠️ {formData.tutorPembina} (Kustom / Tidak Terdaftar)
                        </option>
                    )}
                  </select>
                )}

                {/* Explanatory note */}
                <div className="text-[10px] text-slate-500 leading-normal flex items-start gap-1.5 pt-1">
                  <i className="fa-solid fa-circle-info text-indigo-500 mt-0.5"></i>
                  <span>
                    Tutor Pembina hanya bertindak sebagai penanggung jawab administratif siswa. Honor tutor mengajar dihitung sesuai catatan sesi dan siapa pengajar pada menu <b>Absensi</b>.
                  </span>
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-100 font-bold transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
                >
                  <i className="fa-solid fa-floppy-disk mr-1.5"></i>
                  {editingStudent ? 'Simpan Perubahan' : 'Simpan Siswa'}
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

