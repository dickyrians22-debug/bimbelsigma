import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { AbsensiRecord, JenisKelas, JenisKas, MetodeBayar, PengaturanBimbel, StatusKehadiran, StatusSiswa, Student, TingkatSekolah, TransaksiKas } from '../types';
import { DEFAULT_PENGATURAN, MOCK_STUDENTS, generateMockAbsensi, generateMockKas } from './storage';
import { getTodayDateString } from './helpers';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  isEnabled: boolean;
}

// Hanya menyimpan konfigurasi koneksi API (URL & Anon Key) di LocalStorage
const SUPABASE_CONFIG_KEY = 'sigma_supabase_config_v1';
const SHARED_REALTIME_HUB = 'sigma_bimbel_realtime_hub';

export const DEFAULT_SUPABASE_CONFIG: SupabaseConfig = {
  url: '',
  anonKey: '',
  isEnabled: false,
};

let cachedClient: SupabaseClient | null = null;
let currentClientUrl = '';
let currentClientKey = '';
let activeRealtimeChannel: RealtimeChannel | null = null;

/**
 * Mendapatkan konfigurasi Supabase yang tersimpan di LocalStorage
 */
export function getSupabaseConfig(): SupabaseConfig {
  try {
    const raw = localStorage.getItem(SUPABASE_CONFIG_KEY);
    if (!raw) return DEFAULT_SUPABASE_CONFIG;
    const parsed = JSON.parse(raw);
    return {
      url: (parsed.url || '').trim(),
      anonKey: (parsed.anonKey || '').trim(),
      isEnabled: Boolean(parsed.isEnabled && parsed.url && parsed.anonKey),
    };
  } catch {
    return DEFAULT_SUPABASE_CONFIG;
  }
}

/**
 * Menyimpan konfigurasi Supabase ke LocalStorage (Hanya URL & Anon Key)
 */
export function saveSupabaseConfig(config: SupabaseConfig): void {
  localStorage.setItem(SUPABASE_CONFIG_KEY, JSON.stringify(config));
  if (config.url !== currentClientUrl || config.anonKey !== currentClientKey) {
    if (cachedClient && activeRealtimeChannel) {
      try {
        cachedClient.removeChannel(activeRealtimeChannel);
      } catch (e) {
        console.warn('Error removing old channel on config save:', e);
      }
    }
    cachedClient = null;
    activeRealtimeChannel = null;
  }
}

/**
 * Inisialisasi atau ambil instance Supabase Client
 */
export function getSupabaseClient(): SupabaseClient | null {
  const config = getSupabaseConfig();
  if (!config.isEnabled || !config.url || !config.anonKey) {
    return null;
  }

  if (cachedClient && currentClientUrl === config.url && currentClientKey === config.anonKey) {
    return cachedClient;
  }

  try {
    const client = createClient(config.url, config.anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      realtime: {
        params: {
          eventsPerSecond: 20,
        },
      },
    });

    cachedClient = client;
    currentClientUrl = config.url;
    currentClientKey = config.anonKey;
    return client;
  } catch (err) {
    console.error('Gagal menginisialisasi Supabase client:', err);
    return null;
  }
}

/**
 * Menguji koneksi ke Supabase Project
 */
export async function testSupabaseConnection(url: string, anonKey: string): Promise<{ success: boolean; message: string }> {
  if (!url || !anonKey) {
    return { success: false, message: 'URL Supabase dan Anon Key wajib diisi!' };
  }

  try {
    const cleanUrl = url.trim().replace(/\/$/, '');
    const cleanKey = anonKey.trim();

    const tempClient = createClient(cleanUrl, cleanKey, {
      auth: { persistSession: false },
    });

    const { error } = await tempClient.from('sigma_pengaturan').select('id').limit(1);

    if (error) {
      if (error.code === '42P01' || error.message.includes('relation') || error.message.includes('does not exist')) {
        return {
          success: true,
          message: 'Terkoneksi ke Supabase! Namun tabel sigma belum dibuat. Silakan jalankan Skrip SQL di bawah pada SQL Editor Supabase Anda.',
        };
      }
      return { success: false, message: `Gagal terhubung: ${error.message}` };
    }

    return { success: true, message: 'Koneksi ke database Supabase berhasil dan seluruh tabel siap digunakan!' };
  } catch (err: any) {
    return { success: false, message: `Kesalahan koneksi: ${err?.message || 'Periksa kembali URL dan Anon Key Anda'}` };
  }
}

// ----------------------------------------------------
// Parsers & Converters (Resilient to Postgres column casing & schema variations)
// ----------------------------------------------------

export function parseStudentRow(row: any): Student {
  if (!row) {
    return {
      id: `std-${Date.now()}`,
      kodeSiswa: '',
      nama: 'Siswa',
      tingkat: 'SD',
      jenisKelas: 'Grup',
      tarifPerSesi: 50000,
      kontak: '',
      tutorPembina: '',
      status: 'Aktif',
      tanggalDaftar: getTodayDateString(),
    };
  }

  const raw = row.raw_data && typeof row.raw_data === 'object' ? row.raw_data : {};

  return {
    id: String(raw.id || row.id || `std-${Date.now()}`),
    kodeSiswa: String(raw.kodeSiswa || row.kode_siswa || row.kodesiswa || row.kodeSiswa || ''),
    nama: String(raw.nama || row.nama || 'Siswa'),
    tingkat: (raw.tingkat || row.tingkat || 'SD') as TingkatSekolah,
    jenisKelas: (raw.jenisKelas || row.jenis_kelas || row.jeniskelas || row.jenisKelas || 'Grup') as JenisKelas,
    tarifPerSesi: Number(raw.tarifPerSesi !== undefined ? raw.tarifPerSesi : (row.tarif_per_sesi !== undefined ? row.tarif_per_sesi : (row.tarifpersesi !== undefined ? row.tarifpersesi : (row.tarifPerSesi || 0)))),
    kontak: String(raw.kontak || row.kontak || ''),
    tutorPembina: String(raw.tutorPembina || row.tutor_pembina || row.tutorpembina || row.tutorPembina || ''),
    status: (raw.status || row.status || 'Aktif') as StatusSiswa,
    tanggalDaftar: String(raw.tanggalDaftar || row.tanggal_daftar || row.tanggaldaftar || row.tanggalDaftar || getTodayDateString()),
  };
}

export function parseAbsensiRow(row: any): AbsensiRecord {
  if (!row) {
    return {
      id: `abs-${Date.now()}`,
      siswaId: '',
      siswaNama: '',
      kodeSiswa: '',
      tanggal: getTodayDateString(),
      jam: '15:00',
      status: 'Hadir',
      materi: '',
      catatan: '',
      tutor: '',
    };
  }

  const raw = row.raw_data && typeof row.raw_data === 'object' ? row.raw_data : {};

  return {
    id: String(raw.id || row.id || `abs-${Date.now()}`),
    siswaId: String(raw.siswaId || row.siswa_id || row.siswaid || row.siswaId || ''),
    siswaNama: String(raw.siswaNama || row.siswa_nama || row.siswanama || row.siswaNama || ''),
    kodeSiswa: String(raw.kodeSiswa || row.kode_siswa || row.kodesiswa || row.kodeSiswa || ''),
    tanggal: String(raw.tanggal || row.tanggal || getTodayDateString()),
    jam: String(raw.jam || row.jam || ''),
    status: (raw.status || row.status || 'Hadir') as StatusKehadiran,
    materi: String(raw.materi || row.materi || ''),
    catatan: String(raw.catatan || row.catatan || ''),
    tutor: String(raw.tutor || row.tutor || ''),
  };
}

export function parseKasRow(row: any): TransaksiKas {
  if (!row) {
    return {
      id: `kas-${Date.now()}`,
      tanggal: getTodayDateString(),
      jenis: 'Masuk',
      kategori: 'Lain-lain',
      keterangan: '',
      nominal: 0,
    };
  }

  const raw = row.raw_data && typeof row.raw_data === 'object' ? row.raw_data : {};

  return {
    id: String(raw.id || row.id || `kas-${Date.now()}`),
    tanggal: String(raw.tanggal || row.tanggal || getTodayDateString()),
    jenis: (raw.jenis || row.jenis || 'Masuk') as JenisKas,
    kategori: String(raw.kategori || row.kategori || 'Lain-lain'),
    keterangan: String(raw.keterangan || row.keterangan || ''),
    nominal: Number(raw.nominal !== undefined ? raw.nominal : (row.nominal || 0)),
    siswaId: (raw.siswaId || row.siswa_id || row.siswaid || row.siswaId || undefined) || undefined,
    bulanTagihan: (raw.bulanTagihan || row.bulan_tagihan || row.bulantagihan || row.bulanTagihan || undefined) || undefined,
    metodeBayar: (raw.metodeBayar || row.metode_bayar || row.metodebayar || row.metodeBayar || undefined) as MetodeBayar | undefined,
  };
}

// ----------------------------------------------------
// Smart Resilient Single/Bulk Upsert Helper
// ----------------------------------------------------

/**
 * Melakukan upsert cerdas yang otomatis mendeteksi jika kolom tertentu tidak ada di tabel Supabase
 * pengguna (PGRST204), lalu menghapus kolom tersebut dari payload dan mencoba kembali tanpa
 * melanggar NOT NULL constraint (seperti tanggal, nama, status, jenis).
 */
async function smartUpsert(
  table: string,
  payload: Record<string, any> | Array<Record<string, any>>
): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: true };

  let currentPayload = Array.isArray(payload)
    ? payload.map((row) => ({ ...row }))
    : { ...payload };

  const MAX_RETRIES = 5;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const { error } = await client.from(table).upsert(currentPayload as any, { onConflict: 'id' });
      if (!error) {
        return { success: true };
      }

      // Deteksi nama kolom yang tidak ditemukan di skema Supabase
      const missingColumnMatch =
        error.message?.match(/Could not find the '([^']+)' column/) ||
        error.details?.match(/column "([^"]+)" does not exist/) ||
        error.message?.match(/column "([^"]+)" of relation/);

      if ((error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('schema cache')) && missingColumnMatch) {
        const missingCol = missingColumnMatch[1];
        console.warn(`Kolom '${missingCol}' tidak ditemukan di tabel '${table}', mencoba ulang tanpa kolom tersebut...`);

        if (Array.isArray(currentPayload)) {
          currentPayload = currentPayload.map((row) => {
            const copy = { ...row };
            delete copy[missingCol];
            return copy;
          });
        } else {
          delete currentPayload[missingCol];
        }
        continue; // Retry dengan kolom yang sudah disesuaikan
      }

      // Fallback penghapusan kolom opsional jika regex tidak mencakup teks pesan error
      if (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('schema cache')) {
        const optionalCols = ['raw_data', 'updated_at', 'siswa_id', 'bulan_tagihan', 'metode_bayar', 'tutor', 'catatan', 'jam', 'materi', 'kode_siswa', 'siswa_nama', 'jeniskelas', 'tarifpersesi', 'tutorpembina', 'tanggaldaftar', 'kodesiswa', 'jenis_kelas', 'tarif_per_sesi', 'tutor_pembina', 'tanggal_daftar'];
        let stripped = false;
        for (const col of optionalCols) {
          const hasCol = Array.isArray(currentPayload) ? currentPayload.some((r) => col in r) : col in currentPayload;
          if (hasCol && (error.message?.includes(col) || attempt > 1)) {
            if (Array.isArray(currentPayload)) {
              currentPayload.forEach((r) => delete r[col]);
            } else {
              delete currentPayload[col];
            }
            stripped = true;
            break;
          }
        }
        if (stripped) continue;
      }

      console.error(`Gagal upsert ke tabel ${table}:`, error);
      return { success: false, error: error.message };
    } catch (err: any) {
      console.error(`Exception saat upsert ke tabel ${table}:`, err);
      return { success: false, error: err?.message };
    }
  }

  return { success: false, error: `Batas percobaan upsert tercapai untuk tabel ${table}` };
}

// ----------------------------------------------------
// Cloud Database CRUD Actions (SELECT *, INSERT, UPDATE, DELETE)
// ----------------------------------------------------

/**
 * 1. UTAMAKAN SUPABASE: Melakukan 'SELECT *' langsung ke semua tabel Supabase
 */
export async function fetchAllCloudData(): Promise<{
  students: Student[];
  absensi: AbsensiRecord[];
  kas: TransaksiKas[];
  pengaturan: PengaturanBimbel;
  isTableEmpty: boolean;
} | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const [resStudents, resAbsensi, resKas, resPengaturan] = await Promise.all([
      client.from('sigma_students').select('*'),
      client.from('sigma_absensi').select('*'),
      client.from('sigma_kas').select('*'),
      client.from('sigma_pengaturan').select('*').eq('id', 'main_config').maybeSingle(),
    ]);

    if (resStudents.error) throw resStudents.error;
    if (resAbsensi.error) throw resAbsensi.error;
    if (resKas.error) throw resKas.error;

    // Map & sort in memory to avoid PostgreSQL identifier casing conflicts
    const students = (resStudents.data || [])
      .map(parseStudentRow)
      .sort((a, b) => (a.kodeSiswa || '').localeCompare(b.kodeSiswa || ''));

    const absensi = (resAbsensi.data || [])
      .map(parseAbsensiRow)
      .sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || ''));

    const kas = (resKas.data || [])
      .map(parseKasRow)
      .sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || ''));

    const pengaturan = (resPengaturan.data?.data as PengaturanBimbel) || DEFAULT_PENGATURAN;

    const isTableEmpty = students.length === 0 && absensi.length === 0 && kas.length === 0;

    return {
      students,
      absensi,
      kas,
      pengaturan,
      isTableEmpty,
    };
  } catch (err) {
    console.error('Error fetching cloud data from Supabase:', err);
    return null;
  }
}

/**
 * Inisialisasi data awal (seed) ke Supabase jika tabel masih kosong
 */
export async function seedInitialCloudData(): Promise<{ success: boolean; message: string }> {
  const mockStudents = MOCK_STUDENTS;
  const mockAbsensi = generateMockAbsensi();
  const mockKas = generateMockKas();
  const mockPengaturan = DEFAULT_PENGATURAN;

  return await uploadAllLocalDataToCloud(mockStudents, mockAbsensi, mockKas, mockPengaturan);
}

/**
 * Upload bulk data ke Supabase Cloud
 */
export async function uploadAllLocalDataToCloud(
  students: Student[],
  absensi: AbsensiRecord[],
  kas: TransaksiKas[],
  pengaturan: PengaturanBimbel
): Promise<{ success: boolean; message: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, message: 'Supabase client belum terhubung. Periksa konfigurasi di menu Pengaturan.' };
  }

  const today = getTodayDateString();

  try {
    // 1. Upload Students (Pastikan nama selalu ada nilai)
    if (students.length > 0) {
      const studentRows = students.map((s) => ({
        id: s.id,
        kode_siswa: s.kodeSiswa || '',
        kodesiswa: s.kodeSiswa || '',
        nama: s.nama || 'Siswa',
        tingkat: s.tingkat || 'SD',
        jenis_kelas: s.jenisKelas || 'Grup',
        jeniskelas: s.jenisKelas || 'Grup',
        tarif_per_sesi: Number(s.tarifPerSesi || 0),
        tarifpersesi: Number(s.tarifPerSesi || 0),
        kontak: s.kontak || '',
        tutor_pembina: s.tutorPembina || '',
        tutorpembina: s.tutorPembina || '',
        status: s.status || 'Aktif',
        tanggal_daftar: s.tanggalDaftar || today,
        tanggaldaftar: s.tanggalDaftar || today,
        raw_data: s,
        updated_at: new Date().toISOString(),
      }));
      const res = await smartUpsert('sigma_students', studentRows);
      if (!res.success) throw new Error(res.error);
    }

    // 2. Upload Absensi (Pastikan tanggal & status selalu ada nilai)
    if (absensi.length > 0) {
      const absensiRows = absensi.map((a) => ({
        id: a.id,
        siswa_id: a.siswaId || '',
        siswa_nama: a.siswaNama || '',
        kode_siswa: a.kodeSiswa || '',
        tanggal: a.tanggal || today,
        jam: a.jam || '',
        status: a.status || 'Hadir',
        materi: a.materi || '',
        catatan: a.catatan || '',
        tutor: a.tutor || '',
        raw_data: a,
        updated_at: new Date().toISOString(),
      }));
      const res = await smartUpsert('sigma_absensi', absensiRows);
      if (!res.success) throw new Error(res.error);
    }

    // 3. Upload Kas (Pastikan tanggal & jenis selalu ada nilai)
    if (kas.length > 0) {
      const kasRows = kas.map((k) => ({
        id: k.id,
        tanggal: k.tanggal || today,
        jenis: k.jenis || 'Masuk',
        kategori: k.kategori || 'Lain-lain',
        keterangan: k.keterangan || '',
        nominal: Number(k.nominal || 0),
        siswa_id: k.siswaId || null,
        bulan_tagihan: k.bulanTagihan || null,
        metode_bayar: k.metodeBayar || null,
        raw_data: k,
        updated_at: new Date().toISOString(),
      }));
      const res = await smartUpsert('sigma_kas', kasRows);
      if (!res.success) throw new Error(res.error);
    }

    // 4. Upload Pengaturan
    const { error: errPengaturan } = await client.from('sigma_pengaturan').upsert(
      {
        id: 'main_config',
        data: pengaturan,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
    if (errPengaturan) throw errPengaturan;

    return {
      success: true,
      message: `Seluruh data (${students.length} Siswa, ${absensi.length} Presensi, ${kas.length} Transaksi Kas, & Profil) berhasil disimpan ke Supabase Cloud!`,
    };
  } catch (err: any) {
    console.error('Gagal upload ke Supabase:', err);
    return { success: false, message: `Gagal menyimpan ke cloud: ${err?.message || 'Periksa tabel dan izin RLS di Supabase'}` };
  }
}

// ----------------------------------------------------
// Direct Single Record CRUD Operations (Supabase First)
// ----------------------------------------------------

/**
 * Siswa CRUD
 */
export async function upsertCloudStudent(student: Student): Promise<{ success: boolean; error?: string }> {
  const today = getTodayDateString();
  const payload = {
    id: student.id,
    kode_siswa: student.kodeSiswa || '',
    kodesiswa: student.kodeSiswa || '',
    nama: student.nama || 'Siswa',
    tingkat: student.tingkat || 'SD',
    jenis_kelas: student.jenisKelas || 'Grup',
    jeniskelas: student.jenisKelas || 'Grup',
    tarif_per_sesi: Number(student.tarifPerSesi || 0),
    tarifpersesi: Number(student.tarifPerSesi || 0),
    kontak: student.kontak || '',
    tutor_pembina: student.tutorPembina || '',
    tutorpembina: student.tutorPembina || '',
    status: student.status || 'Aktif',
    tanggal_daftar: student.tanggalDaftar || today,
    tanggaldaftar: student.tanggalDaftar || today,
    raw_data: student,
    updated_at: new Date().toISOString(),
  };

  return await smartUpsert('sigma_students', payload);
}

export async function deleteCloudStudent(id: string): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: true };
  try {
    const { error } = await client.from('sigma_students').delete().eq('id', id);
    if (error) throw error;
    return { success: true };
  } catch (e: any) {
    console.error('Failed to delete student from Supabase:', e);
    return { success: false, error: e?.message };
  }
}

/**
 * Absensi CRUD (Guaranteed Non-Null tanggal & status)
 */
export async function upsertCloudAbsensi(record: AbsensiRecord): Promise<{ success: boolean; error?: string }> {
  const today = getTodayDateString();
  const payload = {
    id: record.id,
    siswa_id: record.siswaId || '',
    siswa_nama: record.siswaNama || '',
    kode_siswa: record.kodeSiswa || '',
    tanggal: record.tanggal || today,
    jam: record.jam || '',
    status: record.status || 'Hadir',
    materi: record.materi || '',
    catatan: record.catatan || '',
    tutor: record.tutor || '',
    raw_data: record,
    updated_at: new Date().toISOString(),
  };

  return await smartUpsert('sigma_absensi', payload);
}

export async function deleteCloudAbsensi(id: string): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: true };
  try {
    const { error } = await client.from('sigma_absensi').delete().eq('id', id);
    if (error) throw error;
    return { success: true };
  } catch (e: any) {
    console.error('Failed to delete absensi from Supabase:', e);
    return { success: false, error: e?.message };
  }
}

/**
 * Kas CRUD (Guaranteed Non-Null tanggal & jenis)
 */
export async function upsertCloudKas(kasItem: TransaksiKas): Promise<{ success: boolean; error?: string }> {
  const today = getTodayDateString();
  const payload = {
    id: kasItem.id,
    tanggal: kasItem.tanggal || today,
    jenis: kasItem.jenis || 'Masuk',
    kategori: kasItem.kategori || 'Lain-lain',
    keterangan: kasItem.keterangan || '',
    nominal: Number(kasItem.nominal || 0),
    siswa_id: kasItem.siswaId || null,
    bulan_tagihan: kasItem.bulanTagihan || null,
    metode_bayar: kasItem.metodeBayar || null,
    raw_data: kasItem,
    updated_at: new Date().toISOString(),
  };

  return await smartUpsert('sigma_kas', payload);
}

export async function deleteCloudKas(id: string): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: true };
  try {
    const { error } = await client.from('sigma_kas').delete().eq('id', id);
    if (error) throw error;
    return { success: true };
  } catch (e: any) {
    console.error('Failed to delete kas from Supabase:', e);
    return { success: false, error: e?.message };
  }
}

/**
 * Pengaturan CRUD
 */
export async function saveCloudPengaturan(pengaturan: PengaturanBimbel): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: true };
  try {
    const { error } = await client.from('sigma_pengaturan').upsert(
      {
        id: 'main_config',
        data: pengaturan,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
    if (error) throw error;
    return { success: true };
  } catch (e: any) {
    console.error('Failed to save pengaturan to Supabase:', e);
    return { success: false, error: e?.message };
  }
}

// ----------------------------------------------------
// 2. Realtime Subscription Setup (Bidirectional Sync + Realtime Broadcast)
// ----------------------------------------------------

export interface RealtimeHandlers {
  onStudentUpsert: (student: Student) => void;
  onStudentDelete: (id: string) => void;
  onAllStudentsSync?: (students: Student[]) => void;
  onAbsensiUpsert: (record: AbsensiRecord) => void;
  onAbsensiDelete: (id: string) => void;
  onAllAbsensiSync?: (absensi: AbsensiRecord[]) => void;
  onKasUpsert: (item: TransaksiKas) => void;
  onKasDelete: (id: string) => void;
  onAllKasSync?: (kas: TransaksiKas[]) => void;
  onPengaturanUpdate: (pengaturan: PengaturanBimbel) => void;
  onStatusChange?: (status: 'SUBSCRIBED' | 'TIMED_OUT' | 'CLOSED' | 'CHANNEL_ERROR') => void;
}

/**
 * Mengirim pesan broadcast instan ke semua browser/HP yang terhubung ke kanal realtime
 */
export async function broadcastToCloud(event: string, payload: any): Promise<void> {
  if (activeRealtimeChannel) {
    try {
      await activeRealtimeChannel.send({
        type: 'broadcast',
        event,
        payload,
      });
    } catch (e) {
      console.warn('Broadcast send error:', e);
    }
  }
}

export function subscribeToSupabaseRealtime(handlers: RealtimeHandlers): RealtimeChannel | null {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    // 1. Bersihkan channel aktif sebelumnya untuk menghindari duplikasi
    const existing = client.getChannels().find((ch) => ch.topic === `realtime:${SHARED_REALTIME_HUB}` || ch.topic === SHARED_REALTIME_HUB);
    if (existing) {
      try {
        client.removeChannel(existing);
      } catch (e) {
        console.warn('Error removing previous channel:', e);
      }
    }

    // 2. Buat instance channel bersama dengan broadcast diaktifkan
    const channel = client.channel(SHARED_REALTIME_HUB, {
      config: {
        broadcast: { self: false },
      },
    });
    
    // 3. Pasang Listener Database (postgres_changes)
    channel
      // Students
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sigma_students' },
        (payload) => {
          if (payload.new) handlers.onStudentUpsert(parseStudentRow(payload.new));
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sigma_students' },
        (payload) => {
          if (payload.new) handlers.onStudentUpsert(parseStudentRow(payload.new));
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'sigma_students' },
        (payload) => {
          const deletedId = payload.old?.id;
          if (deletedId) handlers.onStudentDelete(deletedId);
        }
      )
      // Absensi
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sigma_absensi' },
        (payload) => {
          if (payload.new) handlers.onAbsensiUpsert(parseAbsensiRow(payload.new));
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sigma_absensi' },
        (payload) => {
          if (payload.new) handlers.onAbsensiUpsert(parseAbsensiRow(payload.new));
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'sigma_absensi' },
        (payload) => {
          const deletedId = payload.old?.id;
          if (deletedId) handlers.onAbsensiDelete(deletedId);
        }
      )
      // Kas
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sigma_kas' },
        (payload) => {
          if (payload.new) handlers.onKasUpsert(parseKasRow(payload.new));
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sigma_kas' },
        (payload) => {
          if (payload.new) handlers.onKasUpsert(parseKasRow(payload.new));
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'sigma_kas' },
        (payload) => {
          const deletedId = payload.old?.id;
          if (deletedId) handlers.onKasDelete(deletedId);
        }
      )
      // Pengaturan
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sigma_pengaturan' },
        (payload) => {
          const newRecord = payload.new as Record<string, any> | undefined;
          if (newRecord && newRecord.data) {
            handlers.onPengaturanUpdate(newRecord.data as PengaturanBimbel);
          }
        }
      );

    // 4. Pasang Listener Realtime Broadcast (Instant P2P Multi-Device Sync)
    channel
      .on('broadcast', { event: 'SYNC_STUDENTS' }, ({ payload }) => {
        if (payload && Array.isArray(payload) && handlers.onAllStudentsSync) {
          handlers.onAllStudentsSync(payload.map(parseStudentRow));
        }
      })
      .on('broadcast', { event: 'SYNC_ABSENSI' }, ({ payload }) => {
        if (payload && Array.isArray(payload) && handlers.onAllAbsensiSync) {
          handlers.onAllAbsensiSync(payload.map(parseAbsensiRow));
        }
      })
      .on('broadcast', { event: 'SYNC_KAS' }, ({ payload }) => {
        if (payload && Array.isArray(payload) && handlers.onAllKasSync) {
          handlers.onAllKasSync(payload.map(parseKasRow));
        }
      })
      .on('broadcast', { event: 'SYNC_PENGATURAN' }, ({ payload }) => {
        if (payload) {
          handlers.onPengaturanUpdate(payload);
        }
      })
      .on('broadcast', { event: 'SYNC_STUDENT_UPSERT' }, ({ payload }) => {
        if (payload) handlers.onStudentUpsert(parseStudentRow(payload));
      })
      .on('broadcast', { event: 'SYNC_STUDENT_DELETE' }, ({ payload }) => {
        if (payload?.id) handlers.onStudentDelete(payload.id);
      })
      .on('broadcast', { event: 'SYNC_ABSENSI_UPSERT' }, ({ payload }) => {
        if (payload) handlers.onAbsensiUpsert(parseAbsensiRow(payload));
      })
      .on('broadcast', { event: 'SYNC_ABSENSI_DELETE' }, ({ payload }) => {
        if (payload?.id) handlers.onAbsensiDelete(payload.id);
      })
      .on('broadcast', { event: 'SYNC_KAS_UPSERT' }, ({ payload }) => {
        if (payload) handlers.onKasUpsert(parseKasRow(payload));
      })
      .on('broadcast', { event: 'SYNC_KAS_DELETE' }, ({ payload }) => {
        if (payload?.id) handlers.onKasDelete(payload.id);
      });

    // 5. Panggil .subscribe() setelah semua listener siap
    channel.subscribe((status) => {
      if (handlers.onStatusChange) {
        handlers.onStatusChange(status as any);
      }
    });

    activeRealtimeChannel = channel;
    return channel;
  } catch (err) {
    console.error('Error creating realtime channel:', err);
    return null;
  }
}

// ----------------------------------------------------
// SQL Setup Schema Script Generator
// ----------------------------------------------------
export const SUPABASE_SQL_SETUP_SCRIPT = `-- ============================================================
-- SKRIP SQL SETUP DATABASE BIMBEL SIGMA UNTUK SUPABASE
-- Cara Pakai:
-- 1. Buka Dashboard Supabase Anda (https://supabase.com/dashboard)
-- 2. Pilih Proyek Anda -> Masuk ke menu "SQL Editor"
-- 3. Klik "New query", paste seluruh kode di bawah ini, lalu klik "Run"
-- ============================================================

-- 1. Tabel Siswa
CREATE TABLE IF NOT EXISTS public.sigma_students (
  id TEXT PRIMARY KEY,
  kode_siswa TEXT,
  kodesiswa TEXT,
  nama TEXT NOT NULL DEFAULT '',
  tingkat TEXT DEFAULT 'SD',
  jenis_kelas TEXT DEFAULT 'Grup',
  jeniskelas TEXT DEFAULT 'Grup',
  tarif_per_sesi NUMERIC DEFAULT 0,
  tarifpersesi NUMERIC DEFAULT 0,
  kontak TEXT DEFAULT '',
  tutor_pembina TEXT DEFAULT '',
  tutorpembina TEXT DEFAULT '',
  status TEXT DEFAULT 'Aktif',
  tanggal_daftar TEXT DEFAULT '',
  tanggaldaftar TEXT DEFAULT '',
  raw_data JSONB,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 2. Tabel Presensi / Absensi
CREATE TABLE IF NOT EXISTS public.sigma_absensi (
  id TEXT PRIMARY KEY,
  siswa_id TEXT DEFAULT '',
  siswa_nama TEXT DEFAULT '',
  kode_siswa TEXT DEFAULT '',
  tanggal TEXT NOT NULL,
  jam TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Hadir',
  materi TEXT DEFAULT '',
  catatan TEXT DEFAULT '',
  tutor TEXT DEFAULT '',
  raw_data JSONB,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 3. Tabel Kas Keluar Masuk
CREATE TABLE IF NOT EXISTS public.sigma_kas (
  id TEXT PRIMARY KEY,
  tanggal TEXT NOT NULL,
  jenis TEXT NOT NULL DEFAULT 'Masuk',
  kategori TEXT DEFAULT 'Lain-lain',
  keterangan TEXT DEFAULT '',
  nominal NUMERIC DEFAULT 0,
  siswa_id TEXT,
  bulan_tagihan TEXT,
  metode_bayar TEXT,
  raw_data JSONB,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 4. Tabel Pengaturan Lembaga
CREATE TABLE IF NOT EXISTS public.sigma_pengaturan (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- MIGRASI OTOMATIS JIKA TABEL SUDAH PERNAH DIBUAT DENGAN KOLOM LAMA
ALTER TABLE public.sigma_students ADD COLUMN IF NOT EXISTS kode_siswa TEXT;
ALTER TABLE public.sigma_students ADD COLUMN IF NOT EXISTS kodesiswa TEXT;
ALTER TABLE public.sigma_students ADD COLUMN IF NOT EXISTS jenis_kelas TEXT;
ALTER TABLE public.sigma_students ADD COLUMN IF NOT EXISTS jeniskelas TEXT;
ALTER TABLE public.sigma_students ADD COLUMN IF NOT EXISTS tarif_per_sesi NUMERIC DEFAULT 0;
ALTER TABLE public.sigma_students ADD COLUMN IF NOT EXISTS tarifpersesi NUMERIC DEFAULT 0;
ALTER TABLE public.sigma_students ADD COLUMN IF NOT EXISTS tutor_pembina TEXT;
ALTER TABLE public.sigma_students ADD COLUMN IF NOT EXISTS tutorpembina TEXT;
ALTER TABLE public.sigma_students ADD COLUMN IF NOT EXISTS tanggal_daftar TEXT;
ALTER TABLE public.sigma_students ADD COLUMN IF NOT EXISTS tanggaldaftar TEXT;
ALTER TABLE public.sigma_students ADD COLUMN IF NOT EXISTS raw_data JSONB;
ALTER TABLE public.sigma_students ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

ALTER TABLE public.sigma_absensi ADD COLUMN IF NOT EXISTS siswa_id TEXT;
ALTER TABLE public.sigma_absensi ADD COLUMN IF NOT EXISTS siswa_nama TEXT;
ALTER TABLE public.sigma_absensi ADD COLUMN IF NOT EXISTS kode_siswa TEXT;
ALTER TABLE public.sigma_absensi ADD COLUMN IF NOT EXISTS jam TEXT;
ALTER TABLE public.sigma_absensi ADD COLUMN IF NOT EXISTS materi TEXT;
ALTER TABLE public.sigma_absensi ADD COLUMN IF NOT EXISTS catatan TEXT;
ALTER TABLE public.sigma_absensi ADD COLUMN IF NOT EXISTS tutor TEXT;
ALTER TABLE public.sigma_absensi ADD COLUMN IF NOT EXISTS raw_data JSONB;
ALTER TABLE public.sigma_absensi ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

ALTER TABLE public.sigma_kas ADD COLUMN IF NOT EXISTS kategori TEXT;
ALTER TABLE public.sigma_kas ADD COLUMN IF NOT EXISTS keterangan TEXT;
ALTER TABLE public.sigma_kas ADD COLUMN IF NOT EXISTS nominal NUMERIC DEFAULT 0;
ALTER TABLE public.sigma_kas ADD COLUMN IF NOT EXISTS siswa_id TEXT;
ALTER TABLE public.sigma_kas ADD COLUMN IF NOT EXISTS bulan_tagihan TEXT;
ALTER TABLE public.sigma_kas ADD COLUMN IF NOT EXISTS metode_bayar TEXT;
ALTER TABLE public.sigma_kas ADD COLUMN IF NOT EXISTS raw_data JSONB;
ALTER TABLE public.sigma_kas ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

-- AKTIFKAN FULL REPLICA IDENTITY AGAR REALTIME DELETE MENGIRIMKAN ID LENGKAP
ALTER TABLE public.sigma_students REPLICA IDENTITY FULL;
ALTER TABLE public.sigma_absensi REPLICA IDENTITY FULL;
ALTER TABLE public.sigma_kas REPLICA IDENTITY FULL;
ALTER TABLE public.sigma_pengaturan REPLICA IDENTITY FULL;

-- AKTIFKAN ROW LEVEL SECURITY (RLS)
ALTER TABLE public.sigma_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sigma_absensi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sigma_kas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sigma_pengaturan ENABLE ROW LEVEL SECURITY;

-- IZINKAN AKSES PENUH UNTUK ANON KEY (SELECT, INSERT, UPDATE, DELETE)
DROP POLICY IF EXISTS "Anon Full Access Students" ON public.sigma_students;
CREATE POLICY "Anon Full Access Students" ON public.sigma_students FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anon Full Access Absensi" ON public.sigma_absensi;
CREATE POLICY "Anon Full Access Absensi" ON public.sigma_absensi FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anon Full Access Kas" ON public.sigma_kas;
CREATE POLICY "Anon Full Access Kas" ON public.sigma_kas FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anon Full Access Pengaturan" ON public.sigma_pengaturan;
CREATE POLICY "Anon Full Access Pengaturan" ON public.sigma_pengaturan FOR ALL USING (true) WITH CHECK (true);

-- AKTIFKAN SUPABASE REALTIME REPLICATION AGAR MULTI-DEVICE INSTANT SYNC
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sigma_students, public.sigma_absensi, public.sigma_kas, public.sigma_pengaturan;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN others THEN NULL;
  END;
END $$;
`;
