import { AbsensiRecord, PengaturanBimbel, Student, TransaksiKas } from '../types';
import { getCurrentYearMonth, getTodayDateString } from './helpers';

const STORAGE_STUDENTS_KEY = 'sigma_students_v1';
const STORAGE_ABSENSI_KEY = 'sigma_absensi_v1';
const STORAGE_KAS_KEY = 'sigma_kas_v1';
const STORAGE_PENGATURAN_KEY = 'sigma_pengaturan_v1';

export function getStoredStudentsCache(): Student[] {
  try {
    const raw = localStorage.getItem(STORAGE_STUDENTS_KEY);
    if (!raw) return MOCK_STUDENTS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : MOCK_STUDENTS;
  } catch {
    return MOCK_STUDENTS;
  }
}

export function saveStoredStudentsCache(students: Student[]): void {
  try {
    localStorage.setItem(STORAGE_STUDENTS_KEY, JSON.stringify(students));
  } catch (e) {
    console.warn('LocalStorage save students error:', e);
  }
}

export function getStoredAbsensiCache(): AbsensiRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_ABSENSI_KEY);
    if (!raw) return generateMockAbsensi();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : generateMockAbsensi();
  } catch {
    return generateMockAbsensi();
  }
}

export function saveStoredAbsensiCache(absensi: AbsensiRecord[]): void {
  try {
    localStorage.setItem(STORAGE_ABSENSI_KEY, JSON.stringify(absensi));
  } catch (e) {
    console.warn('LocalStorage save absensi error:', e);
  }
}

export function getStoredKasCache(): TransaksiKas[] {
  try {
    const raw = localStorage.getItem(STORAGE_KAS_KEY);
    if (!raw) return generateMockKas();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : generateMockKas();
  } catch {
    return generateMockKas();
  }
}

export function saveStoredKasCache(kas: TransaksiKas[]): void {
  try {
    localStorage.setItem(STORAGE_KAS_KEY, JSON.stringify(kas));
  } catch (e) {
    console.warn('LocalStorage save kas error:', e);
  }
}

export function getStoredPengaturanCache(): PengaturanBimbel {
  try {
    const raw = localStorage.getItem(STORAGE_PENGATURAN_KEY);
    if (!raw) return DEFAULT_PENGATURAN;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? { ...DEFAULT_PENGATURAN, ...parsed } : DEFAULT_PENGATURAN;
  } catch {
    return DEFAULT_PENGATURAN;
  }
}

export function saveStoredPengaturanCache(pengaturan: PengaturanBimbel): void {
  try {
    localStorage.setItem(STORAGE_PENGATURAN_KEY, JSON.stringify(pengaturan));
  } catch (e) {
    console.warn('LocalStorage save pengaturan error:', e);
  }
}

export const DEFAULT_PENGATURAN: PengaturanBimbel = {
  namaLembaga: 'BIMBEL SIGMA',
  tagline: 'Belajar Sampai Paham, Bukan Sekadar Hafal',
  pimpinan: 'Kak Dimas Setiawan, S.Pd., M.Si.',
  nik: '3175081204900002',
  kota: 'Jakarta',
  alamat: 'Jl. Sigma Prestasi No. 88, Kebayoran Baru, Jakarta Selatan',
  kontak: '0812-8899-7766',
  email: 'admin@bimbelsigma.id',
  daftarTutor: [
    'Kak Dimas Setiawan, M.Si (Matematika & Fisika)',
    'Kak Amanda Putri, S.Pd (Kimia & Biologi)',
    'Kak Fikri Ramadhan, M.Sc (TPS UTBK & Penalaran)',
    'Kak Fitri Nur Azizah, S.Pd (Bahasa Indonesia & SD)',
    'Kak Kevin Wijaya, B.Ed (English Mastery & TOEFL)'
  ],
  kategoriMasuk: [
    'SPP Les Bulanan',
    'Biaya Pendaftaran Siswa',
    'Buku & Modul Sigma',
    'Tryout & Ujian Simulasi',
    'Lain-lain (Kas Masuk)'
  ],
  kategoriKeluar: [
    'Gaji / Honor Tutor',
    'Sewa Tempat & Gedung',
    'Listrik & Internet/WiFi',
    'ATK, Modul & Cetak',
    'Konsumsi & Snack Siswa',
    'Operasional & Kebersihan',
    'Lain-lain (Kas Keluar)'
  ],
  adminPin: 'admin123',
  requireLogin: true,
  persentaseGajiGrup: 60,
  persentaseGajiPrivat: 75,
  durasiMenitPerSesi: 90,
};

export const MOCK_STUDENTS: Student[] = [
  {
    id: 'std-001',
    kodeSiswa: 'SGM-PAUD-001',
    nama: 'Adiba Shakila Atmarini',
    tingkat: 'PAUD',
    jenisKelas: 'Privat',
    tarifPerSesi: 75000,
    kontak: '081234567809',
    tutorPembina: 'Kak Fitri Nur Azizah, S.Pd (Bahasa Indonesia & SD)',
    status: 'Aktif',
    tanggalDaftar: '2026-01-05',
  },
  {
    id: 'std-002',
    kodeSiswa: 'SGM-TK-001',
    nama: 'Kenzo Alfarizi Pratama',
    tingkat: 'TK',
    jenisKelas: 'Grup',
    tarifPerSesi: 45000,
    kontak: '081234567810',
    tutorPembina: 'Kak Fitri Nur Azizah, S.Pd (Bahasa Indonesia & SD)',
    status: 'Aktif',
    tanggalDaftar: '2026-01-08',
  },
  {
    id: 'std-003',
    kodeSiswa: 'SGM-SD-001',
    nama: 'Ahmad Faiz Pratama',
    tingkat: 'SD',
    jenisKelas: 'Grup',
    tarifPerSesi: 50000,
    kontak: '081234567801',
    tutorPembina: 'Kak Fitri Nur Azizah, S.Pd (Bahasa Indonesia & SD)',
    status: 'Aktif',
    tanggalDaftar: '2026-01-10',
  },
  {
    id: 'std-004',
    kodeSiswa: 'SGM-SD-002',
    nama: 'Alya Putri Salsabila',
    tingkat: 'SD',
    jenisKelas: 'Privat',
    tarifPerSesi: 85000,
    kontak: '081234567802',
    tutorPembina: 'Kak Fitri Nur Azizah, S.Pd (Bahasa Indonesia & SD)',
    status: 'Aktif',
    tanggalDaftar: '2026-01-12',
  },
  {
    id: 'std-005',
    kodeSiswa: 'SGM-SMP-001',
    nama: 'Bagas Aditya Nugraha',
    tingkat: 'SMP',
    jenisKelas: 'Grup',
    tarifPerSesi: 65000,
    kontak: '081234567803',
    tutorPembina: 'Kak Dimas Setiawan, M.Si (Matematika & Fisika)',
    status: 'Aktif',
    tanggalDaftar: '2026-01-15',
  },
  {
    id: 'std-006',
    kodeSiswa: 'SGM-SMP-002',
    nama: 'Chelsea Olivia Clarissa',
    tingkat: 'SMP',
    jenisKelas: 'Privat',
    tarifPerSesi: 100000,
    kontak: '081234567804',
    tutorPembina: 'Kak Amanda Putri, S.Pd (Kimia & Biologi)',
    status: 'Aktif',
    tanggalDaftar: '2026-01-18',
  },
  {
    id: 'std-007',
    kodeSiswa: 'SGM-SMA-001',
    nama: 'Daffa Rizky Maulana',
    tingkat: 'SMA',
    jenisKelas: 'Grup',
    tarifPerSesi: 80000,
    kontak: '081234567805',
    tutorPembina: 'Kak Fikri Ramadhan, M.Sc (TPS UTBK & Penalaran)',
    status: 'Aktif',
    tanggalDaftar: '2026-01-20',
  },
  {
    id: 'std-008',
    kodeSiswa: 'SGM-SMA-002',
    nama: 'Elvira Nathania Zahra',
    tingkat: 'SMA',
    jenisKelas: 'Privat',
    tarifPerSesi: 115000,
    kontak: '081234567806',
    tutorPembina: 'Kak Dimas Setiawan, M.Si (Matematika & Fisika)',
    status: 'Aktif',
    tanggalDaftar: '2026-01-22',
  },
  {
    id: 'std-009',
    kodeSiswa: 'SGM-MHS-001',
    nama: 'Gilang Ramadhan Santoso',
    tingkat: 'Mahasiswa',
    jenisKelas: 'Privat',
    tarifPerSesi: 135000,
    kontak: '081234567811',
    tutorPembina: 'Kak Dimas Setiawan, M.Si (Matematika & Fisika)',
    status: 'Aktif',
    tanggalDaftar: '2026-02-01',
  },
  {
    id: 'std-010',
    kodeSiswa: 'SGM-UMUM-001',
    nama: 'Hendra Kusuma, S.T.',
    tingkat: 'Umum',
    jenisKelas: 'Privat',
    tarifPerSesi: 135000,
    kontak: '081234567812',
    tutorPembina: 'Kak Kevin Wijaya, B.Ed (English Mastery & TOEFL)',
    status: 'Aktif',
    tanggalDaftar: '2026-02-05',
  }
];

export function generateMockAbsensi(): AbsensiRecord[] {
  const currentYM = getCurrentYearMonth();
  const today = getTodayDateString();

  return [
    {
      id: 'abs-001',
      siswaId: 'std-001',
      siswaNama: 'Ahmad Faiz Pratama',
      kodeSiswa: 'SGM-SD-001',
      tanggal: `${currentYM}-02`,
      jam: '15:30',
      status: 'Hadir',
      materi: 'Operasi Pecahan Campuran & Soal Cerita',
      catatan: 'Sangat aktif bertanya, pemahaman konsep 85%',
      tutor: 'Kak Fitri Nur Azizah, S.Pd (Bahasa Indonesia & SD)'
    },
    {
      id: 'abs-002',
      siswaId: 'std-001',
      siswaNama: 'Ahmad Faiz Pratama',
      kodeSiswa: 'SGM-SD-001',
      tanggal: `${currentYM}-05`,
      jam: '15:30',
      status: 'Hadir',
      materi: 'Keliling & Luas Bangun Datar Segitiga',
      catatan: 'Tugas rumah dikerjakan lengkap',
      tutor: 'Kak Fitri Nur Azizah, S.Pd (Bahasa Indonesia & SD)'
    },
    {
      id: 'abs-003',
      siswaId: 'std-001',
      siswaNama: 'Ahmad Faiz Pratama',
      kodeSiswa: 'SGM-SD-001',
      tanggal: `${currentYM}-09`,
      jam: '15:30',
      status: 'Hadir',
      materi: 'Latihan Ulangan Harian Bab 3',
      catatan: 'Nilai latihan 90/100',
      tutor: 'Kak Fitri Nur Azizah, S.Pd (Bahasa Indonesia & SD)'
    },
    {
      id: 'abs-004',
      siswaId: 'std-001',
      siswaNama: 'Ahmad Faiz Pratama',
      kodeSiswa: 'SGM-SD-001',
      tanggal: `${currentYM}-12`,
      jam: '15:30',
      status: 'Hadir',
      materi: 'Sistem Pernapasan Manusia (IPA)',
      catatan: 'Hadir tepat waktu',
      tutor: 'Kak Fitri Nur Azizah, S.Pd (Bahasa Indonesia & SD)'
    },
    {
      id: 'abs-005',
      siswaId: 'std-002',
      siswaNama: 'Alya Putri Salsabila',
      kodeSiswa: 'SGM-SD-002',
      tanggal: `${currentYM}-03`,
      jam: '16:30',
      status: 'Hadir',
      materi: 'Reading Comprehension & Grammar Simple Past',
      catatan: 'Kosakata meningkat pesat',
      tutor: 'Kak Fitri Nur Azizah, S.Pd (Bahasa Indonesia & SD)'
    },
    {
      id: 'abs-006',
      siswaId: 'std-002',
      siswaNama: 'Alya Putri Salsabila',
      kodeSiswa: 'SGM-SD-002',
      tanggal: `${currentYM}-07`,
      jam: '16:30',
      status: 'Hadir',
      materi: 'Matematika: Debit dan Volume Air',
      catatan: 'Perlu latihan konversi satuan',
      tutor: 'Kak Fitri Nur Azizah, S.Pd (Bahasa Indonesia & SD)'
    },
    {
      id: 'abs-007',
      siswaId: 'std-002',
      siswaNama: 'Alya Putri Salsabila',
      kodeSiswa: 'SGM-SD-002',
      tanggal: `${currentYM}-10`,
      jam: '16:30',
      status: 'Sakit',
      materi: 'Review Materi Tengah Semester',
      catatan: 'Izin demam, orang tua konfirmasi via WA',
      tutor: 'Kak Fitri Nur Azizah, S.Pd (Bahasa Indonesia & SD)'
    },
    {
      id: 'abs-008',
      siswaId: 'std-003',
      siswaNama: 'Bagas Aditya Nugraha',
      kodeSiswa: 'SGM-SMP-001',
      tanggal: `${currentYM}-04`,
      jam: '18:30',
      status: 'Hadir',
      materi: 'Teorema Pythagoras & Segitiga Istimewa',
      catatan: 'Paham rumus dasar dengan baik',
      tutor: 'Kak Dimas Setiawan, M.Si (Matematika & Fisika)'
    },
    {
      id: 'abs-009',
      siswaId: 'std-003',
      siswaNama: 'Bagas Aditya Nugraha',
      kodeSiswa: 'SGM-SMP-001',
      tanggal: `${currentYM}-08`,
      jam: '18:30',
      status: 'Hadir',
      materi: 'Fisika: Tekanan Zat Padat & Zat Cair (Hidrostatis)',
      catatan: 'Percobaan simulasi lancar',
      tutor: 'Kak Dimas Setiawan, M.Si (Matematika & Fisika)'
    },
    {
      id: 'abs-010',
      siswaId: 'std-003',
      siswaNama: 'Bagas Aditya Nugraha',
      kodeSiswa: 'SGM-SMP-001',
      tanggal: `${currentYM}-11`,
      jam: '18:30',
      status: 'Hadir',
      materi: 'SPLDV Metode Eliminasi & Substitusi',
      catatan: 'Latihan 5 soal benar semua',
      tutor: 'Kak Dimas Setiawan, M.Si (Matematika & Fisika)'
    },
    {
      id: 'abs-011',
      siswaId: 'std-004',
      siswaNama: 'Chelsea Olivia Clarissa',
      kodeSiswa: 'SGM-SMP-002',
      tanggal: `${currentYM}-02`,
      jam: '17:00',
      status: 'Hadir',
      materi: 'Struktur Atom & Tabel Periodik Unsur',
      catatan: 'Memahami konfigurasi elektron',
      tutor: 'Kak Amanda Putri, S.Pd (Kimia & Biologi)'
    },
    {
      id: 'abs-012',
      siswaId: 'std-004',
      siswaNama: 'Chelsea Olivia Clarissa',
      kodeSiswa: 'SGM-SMP-002',
      tanggal: `${currentYM}-06`,
      jam: '17:00',
      status: 'Hadir',
      materi: 'Sistem Pencernaan & Enzim Pencernaan',
      catatan: 'Catatan rapi dan interaktif',
      tutor: 'Kak Amanda Putri, S.Pd (Kimia & Biologi)'
    },
    {
      id: 'abs-013',
      siswaId: 'std-005',
      siswaNama: 'Daffa Rizky Maulana',
      kodeSiswa: 'SGM-SMA-001',
      tanggal: `${currentYM}-03`,
      jam: '19:00',
      status: 'Hadir',
      materi: 'TPS Penalaran Matematika UTBK - Aljabar Lanjutan',
      catatan: 'Kecepatan pengerjaan 1.5 menit/soal',
      tutor: 'Kak Fikri Ramadhan, M.Sc (TPS UTBK & Penalaran)'
    },
    {
      id: 'abs-014',
      siswaId: 'std-005',
      siswaNama: 'Daffa Rizky Maulana',
      kodeSiswa: 'SGM-SMA-001',
      tanggal: `${currentYM}-07`,
      jam: '19:00',
      status: 'Hadir',
      materi: 'Kalkulus: Turunan Fungsi Trigonometri',
      catatan: 'Latihan soal tingkat HOTS',
      tutor: 'Kak Fikri Ramadhan, M.Sc (TPS UTBK & Penalaran)'
    },
    {
      id: 'abs-015',
      siswaId: 'std-005',
      siswaNama: 'Daffa Rizky Maulana',
      kodeSiswa: 'SGM-SMA-001',
      tanggal: `${currentYM}-10`,
      jam: '19:00',
      status: 'Hadir',
      materi: 'Fisika: Gelombang Elektromagnetik & Efek Doppler',
      catatan: 'Diskusi soal UTBK 2024',
      tutor: 'Kak Dimas Setiawan, M.Si (Matematika & Fisika)'
    },
    {
      id: 'abs-016',
      siswaId: 'std-005',
      siswaNama: 'Daffa Rizky Maulana',
      kodeSiswa: 'SGM-SMA-001',
      tanggal: `${currentYM}-14`,
      jam: '19:00',
      status: 'Hadir',
      materi: 'Simulasi Tryout Penalaran Umum',
      catatan: 'Skor TO: 720',
      tutor: 'Kak Fikri Ramadhan, M.Sc (TPS UTBK & Penalaran)'
    },
    {
      id: 'abs-017',
      siswaId: 'std-006',
      siswaNama: 'Elvira Nathania Zahra',
      kodeSiswa: 'SGM-SMA-002',
      tanggal: `${currentYM}-04`,
      jam: '16:00',
      status: 'Hadir',
      materi: 'Termokimia: Perubahan Entalpi & Hukum Hess',
      catatan: 'Pemahaman materi sangat tajam',
      tutor: 'Kak Amanda Putri, S.Pd (Kimia & Biologi)'
    },
    {
      id: 'abs-018',
      siswaId: 'std-006',
      siswaNama: 'Elvira Nathania Zahra',
      kodeSiswa: 'SGM-SMA-002',
      tanggal: `${currentYM}-08`,
      jam: '16:00',
      status: 'Hadir',
      materi: 'Matematika: Integral Substitusi & Parsial',
      catatan: 'Latihan soal SBMPTN',
      tutor: 'Kak Dimas Setiawan, M.Si (Matematika & Fisika)'
    },
    {
      id: 'abs-019',
      siswaId: 'std-006',
      siswaNama: 'Elvira Nathania Zahra',
      kodeSiswa: 'SGM-SMA-002',
      tanggal: `${currentYM}-12`,
      jam: '16:00',
      status: 'Hadir',
      materi: 'Biologi: Sintesis Protein & Kode Genetik',
      catatan: 'Bagan transkripsi-translasi dipahami',
      tutor: 'Kak Amanda Putri, S.Pd (Kimia & Biologi)'
    },
    {
      id: 'abs-020',
      siswaId: 'std-007',
      siswaNama: 'Farhan Dwi Saputra',
      kodeSiswa: 'SGM-SD-003',
      tanggal: today,
      jam: '14:00',
      status: 'Hadir',
      materi: 'Perkalian & Pembagian Dasar Kelas 4',
      catatan: 'Sesi perdana siswa baru',
      tutor: 'Kak Fitri Nur Azizah, S.Pd (Bahasa Indonesia & SD)'
    }
  ];
}

export function generateMockKas(): TransaksiKas[] {
  const currentYM = getCurrentYearMonth();

  return [
    // Pemasukan SPP Siswa Terkait
    {
      id: 'kas-001',
      tanggal: `${currentYM}-05`,
      jenis: 'Masuk',
      kategori: 'SPP Les Bulanan',
      keterangan: 'Pembayaran SPP Ahmad Faiz Pratama (4 Sesi x Rp 50.000)',
      nominal: 200000,
      metodeBayar: 'Transfer Bank',
      siswaId: 'std-001',
      bulanTagihan: currentYM
    },
    {
      id: 'kas-002',
      tanggal: `${currentYM}-08`,
      jenis: 'Masuk',
      kategori: 'SPP Les Bulanan',
      keterangan: 'Pembayaran SPP Alya Putri Salsabila (2 Sesi x Rp 85.000)',
      nominal: 170000,
      metodeBayar: 'QRIS',
      siswaId: 'std-002',
      bulanTagihan: currentYM
    },
    {
      id: 'kas-003',
      tanggal: `${currentYM}-10`,
      jenis: 'Masuk',
      kategori: 'SPP Les Bulanan',
      keterangan: 'Pembayaran DP SPP Chelsea Olivia Clarissa (1 Sesi)',
      nominal: 100000,
      metodeBayar: 'Tunai / Cash',
      siswaId: 'std-004',
      bulanTagihan: currentYM
    },
    {
      id: 'kas-004',
      tanggal: `${currentYM}-12`,
      jenis: 'Masuk',
      kategori: 'SPP Les Bulanan',
      keterangan: 'Pelunasan SPP Daffa Rizky Maulana (4 Sesi x Rp 80.000)',
      nominal: 320000,
      metodeBayar: 'Transfer Bank',
      siswaId: 'std-005',
      bulanTagihan: currentYM
    },
    {
      id: 'kas-005',
      tanggal: `${currentYM}-01`,
      jenis: 'Masuk',
      kategori: 'Biaya Pendaftaran Siswa',
      keterangan: 'Pendaftaran Siswa Baru - Farhan Dwi Saputra (SD)',
      nominal: 150000,
      metodeBayar: 'Tunai / Cash'
    },
    {
      id: 'kas-006',
      tanggal: `${currentYM}-03`,
      jenis: 'Masuk',
      kategori: 'Buku & Modul Sigma',
      keterangan: 'Penjualan Paket Modul UTBK & Bank Soal',
      nominal: 350000,
      metodeBayar: 'Transfer Bank'
    },
    {
      id: 'kas-007',
      tanggal: `${currentYM}-07`,
      jenis: 'Masuk',
      kategori: 'Tryout & Ujian Simulasi',
      keterangan: 'Tiket Tryout Akbar UTBK SNBT Batch 1 (5 Peserta)',
      nominal: 250000,
      metodeBayar: 'QRIS'
    },

    // Pengeluaran Operasional
    {
      id: 'kas-008',
      tanggal: `${currentYM}-01`,
      jenis: 'Keluar',
      kategori: 'Sewa Tempat & Gedung',
      keterangan: 'Sewa Ruang Kelas Bimbel Sigma Periode Bulan Berjalan',
      nominal: 1500000,
      metodeBayar: 'Transfer Bank'
    },
    {
      id: 'kas-009',
      tanggal: `${currentYM}-04`,
      jenis: 'Keluar',
      kategori: 'Listrik & Internet/WiFi',
      keterangan: 'Tagihan Listrik PLN 3500VA & WiFi Indihome 100 Mbps',
      nominal: 550000,
      metodeBayar: 'Transfer Bank'
    },
    {
      id: 'kas-010',
      tanggal: `${currentYM}-06`,
      jenis: 'Keluar',
      kategori: 'ATK, Modul & Cetak',
      keterangan: 'Pembelian Kertas HVS A4, Spidol Whiteboard & Cetak Modul Siswa',
      nominal: 320000,
      metodeBayar: 'Tunai / Cash'
    },
    {
      id: 'kas-011',
      tanggal: `${currentYM}-09`,
      jenis: 'Keluar',
      kategori: 'Konsumsi & Snack Siswa',
      keterangan: 'Air Mineral Galon & Snack Break Belajar Siswa',
      nominal: 125000,
      metodeBayar: 'Tunai / Cash'
    },
    {
      id: 'kas-012',
      tanggal: `${currentYM}-10`,
      jenis: 'Keluar',
      kategori: 'Gaji / Honor Tutor',
      keterangan: 'Honor Tutor Kak Fitri Nur Azizah (Sesi Mengajar SD Pekan 1-2)',
      nominal: 450000,
      metodeBayar: 'Transfer Bank'
    },
    {
      id: 'kas-013',
      tanggal: `${currentYM}-12`,
      jenis: 'Keluar',
      kategori: 'Gaji / Honor Tutor',
      keterangan: 'Honor Tutor Kak Amanda Putri (Sesi Kimia & Biologi)',
      nominal: 400000,
      metodeBayar: 'Transfer Bank'
    }
  ];
}
