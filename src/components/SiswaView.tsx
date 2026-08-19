import React, { useState } from 'react';
import { ConfirmModalState, JenisKelas, PengaturanBimbel, StatusSiswa, Student, TingkatSekolah } from '../types';
import { cleanPhoneNumber, exportToCSV, formatRupiah, getTodayDateString } from '../utils/helpers';
import { ConfirmModal } from './ConfirmModal';

interface SiswaViewProps {
  students: Student[];
  onSaveStudents: (students: Student[]) => void;
  pengaturan: PengaturanBimbel;
  onShowToast: (text: string, type?: 'success' | 'info' | 'error' | 'warning') => void;
}

export const SiswaView: React.FC<SiswaViewProps> = ({
  students,
  onSaveStudents,
  pengaturan,
  onShowToast,
}) => {
  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTingkat, setFilterTingkat] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterJenis, setFilterJenis] = useState<string>('ALL');

  // Modal State (Create / Edit)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  // Warning Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

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
    tutorPembina: pengaturan.daftarTutor[0] || 'Tutor Sigma',
    status: 'Aktif',
  });

  // Open Modal Create
  const handleOpenCreate = () => {
    setEditingStudent(null);
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
    setFormData({
      kodeSiswa: student.kodeSiswa,
      nama: student.nama,
      tingkat: student.tingkat,
      jenisKelas: student.jenisKelas,
      tarifPerSesi: student.tarifPerSesi,
      kontak: student.kontak,
      tutorPembina: student.tutorPembina,
      status: student.status,
    });
    setIsModalOpen(true);
  };

  // Auto-generate code prefix on Tingkat change if creating
  const handleTingkatChange = (newTingkat: TingkatSekolah) => {
    let defaultTarif = 50000;
    if (newTingkat === 'SMP') defaultTarif = 65000;
    if (newTingkat === 'SMA') defaultTarif = 80000;
    if (formData.jenisKelas === 'Privat') defaultTarif += 35000;

    if (!editingStudent) {
      const countTingkat = students.filter(s => s.tingkat === newTingkat).length + 1;
      setFormData(prev => ({
        ...prev,
        tingkat: newTingkat,
        kodeSiswa: `SGM-${newTingkat}-${String(countTingkat).padStart(3, '0')}`,
        tarifPerSesi: defaultTarif,
      }));
    } else {
      setFormData(prev => ({ ...prev, tingkat: newTingkat }));
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
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
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
      'Tanggal Terdaftar'
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
      s.tanggalDaftar
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

    return matchSearch && matchTingkat && matchStatus && matchJenis;
  });

  return (
    <div className="space-y-6">
      
      {/* Top Header Card with Actions */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm">
              <i className="fa-solid fa-users"></i>
            </div>
            <h2 className="text-lg font-extrabold text-slate-900">Database Siswa Bimbel Sigma</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Kelola data murid, jenjang sekolah, paket tarif les per sesi, dan alokasi tutor pembina
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {/* Download CSV Button */}
          <button
            id="btn-download-siswa-csv"
            onClick={handleDownloadCSV}
            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-2 transition-all shadow-xs"
            title="Download Data Siswa format .CSV"
          >
            <i className="fa-solid fa-file-csv text-emerald-600 text-sm"></i>
            <span>Download Data Siswa (.csv)</span>
          </button>

          {/* Add Student Button */}
          <button
            id="btn-tambah-siswa"
            onClick={handleOpenCreate}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-2 transition-all shadow-md shadow-indigo-200"
          >
            <i className="fa-solid fa-user-plus text-sm"></i>
            <span>Tambah Siswa Baru</span>
          </button>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          
          {/* Search Box */}
          <div className="lg:col-span-2 relative">
            <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
            <input
              type="text"
              placeholder="Cari nama, kode siswa, atau tutor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden bg-slate-50/50"
            />
          </div>

          {/* Filter Tingkat */}
          <div>
            <select
              value={filterTingkat}
              onChange={(e) => setFilterTingkat(e.target.value)}
              className="w-full py-2 px-3 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden bg-white text-slate-700 font-bold"
            >
              <option value="ALL">Semua Jenjang (SD/SMP/SMA)</option>
              <option value="SD">Jenjang SD</option>
              <option value="SMP">Jenjang SMP</option>
              <option value="SMA">Jenjang SMA</option>
            </select>
          </div>

          {/* Filter Jenis Kelas */}
          <div>
            <select
              value={filterJenis}
              onChange={(e) => setFilterJenis(e.target.value)}
              className="w-full py-2 px-3 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden bg-white text-slate-700 font-bold"
            >
              <option value="ALL">Semua Jenis Kelas</option>
              <option value="Privat">Kelas Privat (1 on 1)</option>
              <option value="Grup">Kelas Grup / Reguler</option>
            </select>
          </div>

          {/* Filter Status */}
          <div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full py-2 px-3 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden bg-white text-slate-700 font-bold"
            >
              <option value="ALL">Semua Status</option>
              <option value="Aktif">Status Aktif</option>
              <option value="Non-Aktif">Status Non-Aktif</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
          <span>Menampilkan <b>{filteredStudents.length}</b> dari {students.length} total siswa</span>
          {(searchTerm || filterTingkat !== 'ALL' || filterStatus !== 'ALL' || filterJenis !== 'ALL') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterTingkat('ALL');
                setFilterStatus('ALL');
                setFilterJenis('ALL');
              }}
              className="text-indigo-600 font-bold hover:underline"
            >
              Reset Filter
            </button>
          )}
        </div>
      </div>

      {/* Student Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold">
                <th className="py-3 px-4 w-12 text-center">No</th>
                <th className="py-3 px-4">Kode & Nama Siswa</th>
                <th className="py-3 px-4">Jenjang & Kelas</th>
                <th className="py-3 px-4">Tarif / Sesi</th>
                <th className="py-3 px-4">Tutor Pembina</th>
                <th className="py-3 px-4">Kontak (WA)</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <i className="fa-solid fa-user-slash text-2xl mb-2 block"></i>
                    Tidak ada data siswa yang cocok dengan filter pencarian.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((s, idx) => (
                  <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 text-center text-slate-400 font-mono">{idx + 1}</td>
                    
                    {/* Kode & Nama */}
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{s.nama}</div>
                      <div className="text-[10px] font-mono text-indigo-600 font-semibold">{s.kodeSiswa}</div>
                    </td>

                    {/* Tingkat & Kelas */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          s.tingkat === 'SD' ? 'bg-amber-100 text-amber-800' :
                          s.tingkat === 'SMP' ? 'bg-blue-100 text-blue-800' : 'bg-indigo-100 text-indigo-800'
                        }`}>
                          {s.tingkat}
                        </span>
                        <span className="text-slate-600 font-medium">({s.jenisKelas})</span>
                      </div>
                    </td>

                    {/* Tarif Per Sesi */}
                    <td className="py-3 px-4 font-mono font-bold text-slate-800">
                      {formatRupiah(s.tarifPerSesi)}
                      <span className="text-[10px] font-normal text-slate-400 block">/ sesi hadir</span>
                    </td>

                    {/* Tutor Pembina */}
                    <td className="py-3 px-4 text-slate-700">
                      <div className="line-clamp-1" title={s.tutorPembina}>
                        <i className="fa-solid fa-chalkboard-user mr-1.5 text-indigo-400"></i>
                        {s.tutorPembina || '-'}
                      </div>
                    </td>

                    {/* Kontak WA */}
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {s.kontak ? (
                        <a
                          href={`https://wa.me/${cleanPhoneNumber(s.kontak)}?text=Halo%20Bapak%2FIbu%20Wali%20dari%20${encodeURIComponent(s.nama)}%2C%20kami%20dari%20${encodeURIComponent(pengaturan.namaLembaga)}...`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 hover:underline font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200"
                        >
                          <i className="fa-brands fa-whatsapp text-emerald-600"></i>
                          {s.kontak}
                        </a>
                      ) : (
                        <span className="text-slate-400 italic">-</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        s.status === 'Aktif'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}>
                        {s.status}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(s)}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 transition-all"
                          title="Edit Data Siswa"
                        >
                          <i className="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button
                          onClick={() => handleRequestDelete(s)}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-rose-600 hover:border-rose-300 hover:bg-rose-50 transition-all"
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
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 animate-scale-up space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm">
                  <i className={`fa-solid ${editingStudent ? 'fa-pen-to-square' : 'fa-user-plus'}`}></i>
                </div>
                <h3 className="font-extrabold text-base text-slate-900">
                  {editingStudent ? 'Edit Data Siswa' : 'Tambah Siswa Baru'}
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
              
              <div className="grid grid-cols-2 gap-3">
                {/* Kode Siswa */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Kode Siswa *</label>
                  <input
                    type="text"
                    required
                    value={formData.kodeSiswa}
                    onChange={(e) => setFormData({ ...formData, kodeSiswa: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-indigo-500 outline-hidden font-bold"
                    placeholder="SGM-SD-001"
                  />
                </div>

                {/* Status */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Status Keaktifan *</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as StatusSiswa })}
                    className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-hidden font-bold"
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
                  className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-hidden font-semibold"
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
                    className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-hidden font-bold"
                  >
                    <option value="SD">SD (Sekolah Dasar)</option>
                    <option value="SMP">SMP (Sekolah Menengah Pertama)</option>
                    <option value="SMA">SMA / UTBK SNBT</option>
                  </select>
                </div>

                {/* Jenis Kelas */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Jenis Kelas *</label>
                  <select
                    value={formData.jenisKelas}
                    onChange={(e) => setFormData({ ...formData, jenisKelas: e.target.value as JenisKelas })}
                    className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-hidden font-bold"
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
                    className="w-full p-2.5 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-indigo-500 outline-hidden font-bold text-indigo-700"
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
                    className="w-full p-2.5 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-indigo-500 outline-hidden"
                    placeholder="08123456789"
                  />
                </div>
              </div>

              {/* Tutor Pembina */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Tutor Pembina / Pengajar</label>
                <select
                  value={formData.tutorPembina}
                  onChange={(e) => setFormData({ ...formData, tutorPembina: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-hidden font-bold"
                >
                  <option value="">-- Pilih Tutor Pembina --</option>
                  {pengaturan.daftarTutor.map((t, idx) => (
                    <option key={idx} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              {/* Modal Buttons */}
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
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
      />

    </div>
  );
};
