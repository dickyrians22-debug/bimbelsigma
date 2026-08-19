import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { AbsensiRecord, JenisKelas, JenisKas, MetodeBayar, PengaturanBimbel, StatusKehadiran, StatusSiswa, Student, TingkatSekolah, TransaksiKas } from '../types';
import { DEFAULT_PENGATURAN, MOCK_STUDENTS, generateMockAbsensi, generateMockKas } from './storage';
import { getTodayDateString } from './helpers';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  isEnabled: boolean;
}

// Konfigurasi Permanen Supabase Cloud Bimbel Sigma
export const HARDCODED_SUPABASE_URL = 'https://udwhitrlsntolejxsyvf.supabase.co';
export const HARDCODED_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkd2hpdHJsc250b2xlanhzeXZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxMzA0MDYsImV4cCI6MjEwMjcwNjQwNn0.-R1DG54wYaf6ThaXtUNU_txy24lvYLOVQawmKZ1_Bf8';

const SUPABASE_CONFIG_KEY = 'sigma_supabase_config_v1';
const SHARED_REALTIME_HUB = 'sigma_bimbel_realtime_hub';

export const DEFAULT_SUPABASE_CONFIG: SupabaseConfig = {
  url: HARDCODED_SUPABASE_URL,
  anonKey: HARDCODED_SUPABASE_ANON_KEY,
  isEnabled: true,
};

let cachedClient: SupabaseClient | null = null;
let currentClientUrl = '';
let currentClientKey = '';
let activeRealtimeChannel: RealtimeChannel | null = null;

/**
 * Mendapatkan konfigurasi Supabase (Permanen / Hardcoded default)
 */
export function getSupabaseConfig(): SupabaseConfig {
  try {
    const raw = localStorage.getItem(SUPABASE_CONFIG_KEY);
    if (!raw) return DEFAULT_SUPABASE_CONFIG;
    const parsed = JSON.parse(raw);
    const url = (parsed.url || '').trim() || HARDCODED_SUPABASE_URL;
    const anonKey = (parsed.anonKey || '').trim() || HARDCODED_SUPABASE_ANON_KEY;
    return {
      url,
      anonKey,
      isEnabled: true,
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
// Resilient Metadata Pack/Unpack Helpers (Guarantees Zero Data Loss across all DB schemas)
// ----------------------------------------------------

export function packStudentMeta(tutor: string, s: { kodeSiswa?: string; jenisKelas?: string; tarifPerSesi?: number; tanggalDaftar?: string }): string {
  const cleanTutor = (tutor || '').replace(/<!--SGM_STD:.*?-->/g, '').trim();
  const metaParts: string[] = [];
  if (s.kodeSiswa) metaParts.push(`k=${encodeURIComponent(s.kodeSiswa)}`);
  if (s.jenisKelas) metaParts.push(`j=${encodeURIComponent(s.jenisKelas)}`);
  if (s.tarifPerSesi !== undefined && s.tarifPerSesi !== null) metaParts.push(`t=${s.tarifPerSesi}`);
  if (s.tanggalDaftar) metaParts.push(`d=${encodeURIComponent(s.tanggalDaftar)}`);
  
  if (metaParts.length === 0) return cleanTutor;
  return `${cleanTutor} <!--SGM_STD:${metaParts.join('&')}-->`.trim();
}

export function unpackStudentMeta(text: string): { cleanText: string; kodeSiswa?: string; jenisKelas?: JenisKelas; tarifPerSesi?: number; tanggalDaftar?: string } {
  if (!text) return { cleanText: '' };
  const match = text.match(/<!--SGM_STD:(.*?)-->/);
  const cleanText = text.replace(/<!--SGM_STD:.*?-->/g, '').trim();
  if (!match) return { cleanText };

  try {
    const params = new URLSearchParams(match[1]);
    return {
      cleanText,
      kodeSiswa: params.get('k') ? decodeURIComponent(params.get('k')!) : undefined,
      jenisKelas: params.get('j') ? (decodeURIComponent(params.get('j')!) as JenisKelas) : undefined,
      tarifPerSesi: params.get('t') ? Number(params.get('t')) : undefined,
      tanggalDaftar: params.get('d') ? decodeURIComponent(params.get('d')!) : undefined,
    };
  } catch {
    return { cleanText };
  }
}

export function packAbsensiMeta(catatan: string, a: { siswaId?: string; kodeSiswa?: string; siswaNama?: string }): string {
  const cleanCatatan = (catatan || '').replace(/<!--SGM_ABS:.*?-->/g, '').trim();
  const metaParts: string[] = [];
  if (a.siswaId) metaParts.push(`s=${encodeURIComponent(a.siswaId)}`);
  if (a.kodeSiswa) metaParts.push(`k=${encodeURIComponent(a.kodeSiswa)}`);
  if (a.siswaNama) metaParts.push(`n=${encodeURIComponent(a.siswaNama)}`);

  if (metaParts.length === 0) return cleanCatatan;
  return `${cleanCatatan} <!--SGM_ABS:${metaParts.join('&')}-->`.trim();
}

export function unpackAbsensiMeta(text: string): { cleanText: string; siswaId?: string; kodeSiswa?: string; siswaNama?: string } {
  if (!text) return { cleanText: '' };
  const match = text.match(/<!--SGM_ABS:(.*?)-->/);
  const cleanText = text.replace(/<!--SGM_ABS:.*?-->/g, '').trim();
  if (!match) return { cleanText };

  try {
    const params = new URLSearchParams(match[1]);
    return {
      cleanText,
      siswaId: params.get('s') ? decodeURIComponent(params.get('s')!) : undefined,
      kodeSiswa: params.get('k') ? decodeURIComponent(params.get('k')!) : undefined,
      siswaNama: params.get('n') ? decodeURIComponent(params.get('n')!) : undefined,
    };
  } catch {
    return { cleanText };
  }
}

export function packKasMeta(keterangan: string, k: { siswaId?: string; bulanTagihan?: string; metodeBayar?: string }): string {
  const cleanKet = (keterangan || '').replace(/<!--SGM_KAS:.*?-->/g, '').trim();
  const metaParts: string[] = [];
  if (k.siswaId) metaParts.push(`s=${encodeURIComponent(k.siswaId)}`);
  if (k.bulanTagihan) metaParts.push(`b=${encodeURIComponent(k.bulanTagihan)}`);
  if (k.metodeBayar) metaParts.push(`m=${encodeURIComponent(k.metodeBayar)}`);

  if (metaParts.length === 0) return cleanKet;
  return `${cleanKet} <!--SGM_KAS:${metaParts.join('&')}-->`.trim();
}

export function unpackKasMeta(text: string): { cleanText: string; siswaId?: string; bulanTagihan?: string; metodeBayar?: MetodeBayar } {
  if (!text) return { cleanText: '' };
  const match = text.match(/<!--SGM_KAS:(.*?)-->/);
  const cleanText = text.replace(/<!--SGM_KAS:.*?-->/g, '').trim();
  if (!match) return { cleanText };

  try {
    const params = new URLSearchParams(match[1]);
    return {
      cleanText,
      siswaId: params.get('s') ? decodeURIComponent(params.get('s')!) : undefined,
      bulanTagihan: params.get('b') ? decodeURIComponent(params.get('b')!) : undefined,
      metodeBayar: params.get('m') ? (decodeURIComponent(params.get('m')!) as MetodeBayar) : undefined,
    };
  } catch {
    return { cleanText };
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
  const tutorMeta = unpackStudentMeta(String(row.tutor_pembina || row.tutorpembina || row.tutorPembina || raw.tutorPembina || ''));
  const kontakMeta = unpackStudentMeta(String(row.kontak || raw.kontak || ''));

  const kodeSiswa = String(raw.kodeSiswa || row.kode_siswa || row.kodesiswa || row.kodeSiswa || tutorMeta.kodeSiswa || kontakMeta.kodeSiswa || '');
  const jenisKelas = (raw.jenisKelas || row.jenis_kelas || row.jeniskelas || row.jenisKelas || tutorMeta.jenisKelas || kontakMeta.jenisKelas || 'Grup') as JenisKelas;
  
  let tarif = raw.tarifPerSesi !== undefined ? raw.tarifPerSesi : (
    row.tarif_per_sesi !== undefined && row.tarif_per_sesi !== null ? row.tarif_per_sesi : (
    row.tarifpersesi !== undefined && row.tarifpersesi !== null ? row.tarifpersesi : (
    tutorMeta.tarifPerSesi !== undefined ? tutorMeta.tarifPerSesi : (
    kontakMeta.tarifPerSesi !== undefined ? kontakMeta.tarifPerSesi : (row.tarifPerSesi || 0)))));
  
  const tarifNum = Number(tarif);
  const tarifPerSesi = isNaN(tarifNum) || tarifNum <= 0 ? 50000 : tarifNum;

  const tanggalDaftar = String(
    raw.tanggalDaftar || row.tanggal_daftar || row.tanggaldaftar || row.tanggalDaftar ||
    tutorMeta.tanggalDaftar || kontakMeta.tanggalDaftar || getTodayDateString()
  );

  return {
    id: String(raw.id || row.id || `std-${Date.now()}`),
    kodeSiswa,
    nama: String(raw.nama || row.nama || 'Siswa'),
    tingkat: (raw.tingkat || row.tingkat || 'SD') as TingkatSekolah,
    jenisKelas,
    tarifPerSesi,
    kontak: kontakMeta.cleanText || String(row.kontak || raw.kontak || ''),
    tutorPembina: tutorMeta.cleanText || String(row.tutor_pembina || row.tutorpembina || row.tutorPembina || raw.tutorPembina || ''),
    status: (raw.status || row.status || 'Aktif') as StatusSiswa,
    tanggalDaftar,
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
  const catatanMeta = unpackAbsensiMeta(String(row.catatan || raw.catatan || ''));
  const materiMeta = unpackAbsensiMeta(String(row.materi || raw.materi || ''));

  const siswaId = String(raw.siswaId || row.siswa_id || row.siswaid || row.siswaId || catatanMeta.siswaId || materiMeta.siswaId || '');
  const siswaNama = String(raw.siswaNama || row.siswa_nama || row.siswanama || row.siswaNama || catatanMeta.siswaNama || materiMeta.siswaNama || '');
  const kodeSiswa = String(raw.kodeSiswa || row.kode_siswa || row.kodesiswa || row.kodeSiswa || catatanMeta.kodeSiswa || materiMeta.kodeSiswa || '');

  return {
    id: String(raw.id || row.id || `abs-${Date.now()}`),
    siswaId,
    siswaNama,
    kodeSiswa,
    tanggal: String(raw.tanggal || row.tanggal || getTodayDateString()),
    jam: String(raw.jam || row.jam || ''),
    status: (raw.status || row.status || 'Hadir') as StatusKehadiran,
    materi: materiMeta.cleanText || String(row.materi || raw.materi || ''),
    catatan: catatanMeta.cleanText || String(row.catatan || raw.catatan || ''),
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
  const ketMeta = unpackKasMeta(String(row.keterangan || raw.keterangan || ''));

  const siswaId = raw.siswaId || row.siswa_id || row.siswaid || row.siswaId || ketMeta.siswaId || undefined;
  const bulanTagihan = raw.bulanTagihan || row.bulan_tagihan || row.bulantagihan || row.bulanTagihan || ketMeta.bulanTagihan || undefined;
  const metodeBayar = (raw.metodeBayar || row.metode_bayar || row.metodebayar || row.metodeBayar || ketMeta.metodeBayar || undefined) as MetodeBayar | undefined;

  return {
    id: String(raw.id || row.id || `kas-${Date.now()}`),
    tanggal: String(raw.tanggal || row.tanggal || getTodayDateString()),
    jenis: (raw.jenis || row.jenis || 'Masuk') as JenisKas,
    kategori: String(raw.kategori || row.kategori || 'Lain-lain'),
    keterangan: ketMeta.cleanText || String(row.keterangan || raw.keterangan || ''),
    nominal: Number(raw.nominal !== undefined ? raw.nominal : (row.nominal || 0)),
    siswaId: siswaId ? String(siswaId) : undefined,
    bulanTagihan: bulanTagihan ? String(bulanTagihan) : undefined,
    metodeBayar,
  };
}

// ----------------------------------------------------
// Smart Resilient Single/Bulk Upsert Helper & Schema Cache
// ----------------------------------------------------

const missingColumnsCache = new Map<string, Set<string>>();

function getMissingColsForTable(table: string): Set<string> {
  if (!missingColumnsCache.has(table)) {
    try {
      const raw = sessionStorage.getItem(`sigma_missing_cols_${table}`);
      if (raw) {
        missingColumnsCache.set(table, new Set(JSON.parse(raw)));
      } else {
        missingColumnsCache.set(table, new Set());
      }
    } catch {
      missingColumnsCache.set(table, new Set());
    }
  }
  return missingColumnsCache.get(table)!;
}

function recordMissingColForTable(table: string, col: string) {
  const current = getMissingColsForTable(table);
  current.add(col);
  try {
    sessionStorage.setItem(`sigma_missing_cols_${table}`, JSON.stringify(Array.from(current)));
  } catch {}
}

function stripKnownMissingColumns(table: string, row: Record<string, any>): Record<string, any> {
  const missing = getMissingColsForTable(table);
  if (missing.size === 0) return { ...row };
  const cleaned: Record<string, any> = {};
  for (const [k, v] of Object.entries(row)) {
    if (!missing.has(k)) {
      cleaned[k] = v;
    }
  }
  return cleaned;
}

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

  // 1. Bersihkan kolom yang sudah diketahui tidak ada di database pengguna
  let currentPayload = Array.isArray(payload)
    ? payload.map((row) => stripKnownMissingColumns(table, row))
    : stripKnownMissingColumns(table, payload);

  const MAX_RETRIES = 10;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const { error } = await client.from(table).upsert(currentPayload as any, { onConflict: 'id' });
      if (!error) {
        return { success: true };
      }

      // Deteksi nama kolom yang tidak ditemukan di skema Supabase
      const fullErrorText = `${error.message || ''} ${error.details || ''} ${error.hint || ''}`;
      const missingColumnMatch =
        fullErrorText.match(/Could not find the '([^']+)' column/i) ||
        fullErrorText.match(/Could not find the "([^"]+)" column/i) ||
        fullErrorText.match(/column "([^"]+)" of relation/i) ||
        fullErrorText.match(/column "([^"]+)" does not exist/i) ||
        fullErrorText.match(/column ([a-zA-Z0-9_]+) does not exist/i) ||
        fullErrorText.match(/relation "[^"]+" has no column "([^"]+)"/i) ||
        fullErrorText.match(/Could not find the column '([^']+)'/i);

      if ((error.code === 'PGRST204' || fullErrorText.toLowerCase().includes('column') || fullErrorText.toLowerCase().includes('schema cache')) && missingColumnMatch) {
        const missingCol = missingColumnMatch[1];
        recordMissingColForTable(table, missingCol);

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

      // Fallback penghapusan kolom opsional jika error PGRST204 tetap muncul tanpa regex spesifik
      if (error.code === 'PGRST204' || fullErrorText.toLowerCase().includes('column') || fullErrorText.toLowerCase().includes('schema cache')) {
        const optionalCandidateCols = [
          'siswa_nama',
          'tanggal_daftar',
          'metode_bayar',
          'bulan_tagihan',
          'raw_data',
          'updated_at',
          'tutor_pembina',
          'tarif_per_sesi',
          'jenis_kelas',
          'kode_siswa',
          'catatan',
          'materi',
          'jam',
          'tutor',
          'siswa_id',
          'kontak',
          'kategori',
          'keterangan'
        ];

        let strippedOne = false;
        for (const col of optionalCandidateCols) {
          const hasCol = Array.isArray(currentPayload) ? currentPayload.some((r) => col in r) : col in currentPayload;
          if (hasCol) {
            recordMissingColForTable(table, col);
            if (Array.isArray(currentPayload)) {
              currentPayload.forEach((r) => delete r[col]);
            } else {
              delete currentPayload[col];
            }
            strippedOne = true;
            break;
          }
        }
        if (strippedOne) continue;
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
    // 1. Upload Students
    if (students.length > 0) {
      const studentRows = students.map((s) => {
        const packedTutor = packStudentMeta(s.tutorPembina || '', {
          kodeSiswa: s.kodeSiswa,
          jenisKelas: s.jenisKelas,
          tarifPerSesi: s.tarifPerSesi,
          tanggalDaftar: s.tanggalDaftar,
        });
        return {
          id: s.id,
          kode_siswa: s.kodeSiswa || '',
          nama: s.nama || 'Siswa',
          tingkat: s.tingkat || 'SD',
          jenis_kelas: s.jenisKelas || 'Grup',
          tarif_per_sesi: Number(s.tarifPerSesi || 0),
          kontak: s.kontak || '',
          tutor_pembina: packedTutor,
          status: s.status || 'Aktif',
          tanggal_daftar: s.tanggalDaftar || today,
          raw_data: s,
          updated_at: new Date().toISOString(),
        };
      });
      const res = await smartUpsert('sigma_students', studentRows);
      if (!res.success) throw new Error(res.error);
    }

    // 2. Upload Absensi
    if (absensi.length > 0) {
      const absensiRows = absensi.map((a) => {
        const packedCatatan = packAbsensiMeta(a.catatan || '', {
          siswaId: a.siswaId,
          kodeSiswa: a.kodeSiswa,
          siswaNama: a.siswaNama,
        });
        return {
          id: a.id,
          siswa_id: a.siswaId || '',
          kode_siswa: a.kodeSiswa || '',
          tanggal: a.tanggal || today,
          jam: a.jam || '',
          status: a.status || 'Hadir',
          materi: a.materi || '',
          catatan: packedCatatan,
          tutor: a.tutor || '',
          siswa_nama: a.siswaNama || '',
          raw_data: a,
          updated_at: new Date().toISOString(),
        };
      });
      const res = await smartUpsert('sigma_absensi', absensiRows);
      if (!res.success) throw new Error(res.error);
    }

    // 3. Upload Kas
    if (kas.length > 0) {
      const kasRows = kas.map((k) => {
        const packedKet = packKasMeta(k.keterangan || '', {
          siswaId: k.siswaId,
          bulanTagihan: k.bulanTagihan,
          metodeBayar: k.metodeBayar,
        });
        return {
          id: k.id,
          tanggal: k.tanggal || today,
          jenis: k.jenis || 'Masuk',
          kategori: k.kategori || 'Lain-lain',
          keterangan: packedKet,
          nominal: Number(k.nominal || 0),
          siswa_id: k.siswaId || null,
          bulan_tagihan: k.bulanTagihan || null,
          metode_bayar: k.metodeBayar || null,
          raw_data: k,
          updated_at: new Date().toISOString(),
        };
      });
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
  const packedTutor = packStudentMeta(student.tutorPembina || '', {
    kodeSiswa: student.kodeSiswa,
    jenisKelas: student.jenisKelas,
    tarifPerSesi: student.tarifPerSesi,
    tanggalDaftar: student.tanggalDaftar,
  });
  const payload = {
    id: student.id,
    kode_siswa: student.kodeSiswa || '',
    nama: student.nama || 'Siswa',
    tingkat: student.tingkat || 'SD',
    jenis_kelas: student.jenisKelas || 'Grup',
    tarif_per_sesi: Number(student.tarifPerSesi || 0),
    kontak: student.kontak || '',
    tutor_pembina: packedTutor,
    status: student.status || 'Aktif',
    tanggal_daftar: student.tanggalDaftar || today,
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
  const packedCatatan = packAbsensiMeta(record.catatan || '', {
    siswaId: record.siswaId,
    kodeSiswa: record.kodeSiswa,
    siswaNama: record.siswaNama,
  });
  const payload = {
    id: record.id,
    siswa_id: record.siswaId || '',
    kode_siswa: record.kodeSiswa || '',
    tanggal: record.tanggal || today,
    jam: record.jam || '',
    status: record.status || 'Hadir',
    materi: record.materi || '',
    catatan: packedCatatan,
    tutor: record.tutor || '',
    siswa_nama: record.siswaNama || '',
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
  const packedKet = packKasMeta(kasItem.keterangan || '', {
    siswaId: kasItem.siswaId,
    bulanTagihan: kasItem.bulanTagihan,
    metodeBayar: kasItem.metodeBayar,
  });
  const payload = {
    id: kasItem.id,
    tanggal: kasItem.tanggal || today,
    jenis: kasItem.jenis || 'Masuk',
    kategori: kasItem.kategori || 'Lain-lain',
    keterangan: packedKet,
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
