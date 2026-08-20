export type TingkatSekolah = 'PAUD' | 'TK' | 'SD' | 'SMP' | 'SMA' | 'Mahasiswa' | 'Umum';
export type JenisKelas = 'Privat' | 'Grup';
export type StatusSiswa = 'Aktif' | 'Non-Aktif';
export type StatusKehadiran = 'Hadir' | 'Izin' | 'Sakit' | 'Alpha';
export type JenisKas = 'Masuk' | 'Keluar';
export type StatusTagihanSiswa = 'Lunas' | 'Kurang Bayar' | 'Belum Bayar' | 'Belum Ada Sesi';
export type MetodeBayar = 'Transfer Bank' | 'Tunai / Cash' | 'QRIS' | 'Lainnya';

export interface Student {
  id: string;
  kodeSiswa: string;
  nama: string;
  tingkat: TingkatSekolah;
  jenisKelas: JenisKelas;
  tarifPerSesi: number;
  kontak: string;
  tutorPembina: string;
  status: StatusSiswa;
  tanggalDaftar: string;
}

export interface AbsensiRecord {
  id: string;
  siswaId: string;
  siswaNama: string;
  kodeSiswa: string;
  tanggal: string; // YYYY-MM-DD
  jam: string; // HH:mm
  status: StatusKehadiran;
  materi: string;
  catatan?: string;
  tutor: string;
}

export interface TransaksiKas {
  id: string;
  tanggal: string; // YYYY-MM-DD
  jenis: JenisKas;
  kategori: string;
  keterangan: string;
  nominal: number;
  siswaId?: string;
  bulanTagihan?: string; // Format: YYYY-MM (e.g. '2026-08') untuk mengaitkan ke siswa & bulan tagihan
  metodeBayar?: MetodeBayar;
}

export interface PengaturanBimbel {
  namaLembaga: string;
  tagline: string;
  pimpinan: string;
  nik: string;
  kota?: string;
  alamat: string;
  kontak: string;
  email: string;
  daftarTutor: string[];
  kategoriMasuk: string[];
  kategoriKeluar: string[];
  adminPin?: string;
  requireLogin?: boolean;
  lokasiTandaTangan?: string;
  tanggalTandaTangan?: string;
  jabatanPimpinan?: string;
  persentaseGajiGrup?: number; // Persentase honor tutor kelas grup (e.g. 60%)
  persentaseGajiPrivat?: number; // Persentase honor tutor kelas privat (e.g. 75%)
  durasiMenitPerSesi?: number; // Durasi standar mengajar per sesi dalam menit (e.g. 90 menit = 1.5 jam)
}

export interface AuthSession {
  isAuthenticated: boolean;
  username: string;
  role: 'Admin' | 'Pengelola' | 'Tutor';
  loginAt: string;
}

export type CloudSyncStatus = 'offline' | 'connecting' | 'connected' | 'error' | 'syncing';

export interface ToastMessage {
  id: string;
  text: string;
  type: 'success' | 'info' | 'error' | 'warning';
}

export interface ConfirmModalState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  isDanger?: boolean;
  onConfirm: () => void;
}
