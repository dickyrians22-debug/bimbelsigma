export type TingkatSekolah = 'SD' | 'SMP' | 'SMA';
export type JenisKelas = 'Privat' | 'Grup';
export type StatusSiswa = 'Aktif' | 'Non-Aktif';
export type StatusKehadiran = 'Hadir' | 'Izin' | 'Sakit' | 'Alpha';
export type JenisKas = 'Masuk' | 'Keluar';
export type StatusTagihanSiswa = 'Lunas' | 'Belum Lunas' | 'Belum Ada Sesi';
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
