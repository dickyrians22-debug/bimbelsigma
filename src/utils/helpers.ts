import { JenisKelas, TingkatSekolah } from '../types';

export const DAFTAR_TINGKAT_SEKOLAH: { value: TingkatSekolah; label: string; fullLabel: string; codePrefix: string; defaultTarifGrup: number; defaultTarifPrivat: number }[] = [
  { value: 'PAUD', label: 'PAUD', fullLabel: 'PAUD (Pendidikan Anak Usia Dini)', codePrefix: 'PAUD', defaultTarifGrup: 40000, defaultTarifPrivat: 75000 },
  { value: 'TK', label: 'TK', fullLabel: 'TK (Taman Kanak-Kanak)', codePrefix: 'TK', defaultTarifGrup: 45000, defaultTarifPrivat: 80000 },
  { value: 'SD', label: 'SD', fullLabel: 'SD (Sekolah Dasar)', codePrefix: 'SD', defaultTarifGrup: 50000, defaultTarifPrivat: 85000 },
  { value: 'SMP', label: 'SMP', fullLabel: 'SMP (Sekolah Menengah Pertama)', codePrefix: 'SMP', defaultTarifGrup: 65000, defaultTarifPrivat: 100000 },
  { value: 'SMA', label: 'SMA', fullLabel: 'SMA / SMK / UTBK SNBT', codePrefix: 'SMA', defaultTarifGrup: 80000, defaultTarifPrivat: 115000 },
  { value: 'Mahasiswa', label: 'Mahasiswa', fullLabel: 'Mahasiswa / Perguruan Tinggi', codePrefix: 'MHS', defaultTarifGrup: 100000, defaultTarifPrivat: 135000 },
  { value: 'Umum', label: 'Umum', fullLabel: 'Umum / Kursus Profesional & Dewasa', codePrefix: 'UMUM', defaultTarifGrup: 100000, defaultTarifPrivat: 135000 },
];

export function getTingkatBadgeClass(tingkat: TingkatSekolah | string): string {
  switch (tingkat) {
    case 'PAUD':
      return 'bg-pink-100 text-pink-800 border-pink-200';
    case 'TK':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'SD':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'SMP':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'SMA':
      return 'bg-indigo-100 text-indigo-800 border-indigo-200';
    case 'Mahasiswa':
      return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'Umum':
      return 'bg-teal-100 text-teal-800 border-teal-200';
    default:
      return 'bg-slate-100 text-slate-800 border-slate-200';
  }
}

export function getDefaultTarifByTingkat(tingkat: TingkatSekolah | string, jenisKelas: JenisKelas | string): number {
  const found = DAFTAR_TINGKAT_SEKOLAH.find((t) => t.value === tingkat);
  if (found) {
    return jenisKelas === 'Privat' ? found.defaultTarifPrivat : found.defaultTarifGrup;
  }
  return jenisKelas === 'Privat' ? 85000 : 50000;
}

export function getKodePrefixByTingkat(tingkat: TingkatSekolah | string): string {
  const found = DAFTAR_TINGKAT_SEKOLAH.find((t) => t.value === tingkat);
  return found ? found.codePrefix : (tingkat ? String(tingkat).toUpperCase() : 'SD');
}

export const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export const NAMA_HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getCurrentYearMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function formatYearMonth(ymString: string): string {
  if (!ymString) return '';
  const parts = ymString.split('-');
  if (parts.length < 2) return ymString;
  const year = parseInt(parts[0], 10);
  const monthIdx = parseInt(parts[1], 10) - 1;
  return `${NAMA_BULAN[monthIdx] || ''} ${year}`;
}

export function getCurrentTimeString(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function formatRupiah(nominal: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(nominal || 0);
}

export function formatIndonesianDate(dateStr: string, withDay: boolean = true): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dayName = NAMA_HARI[date.getDay()];
  const monthName = NAMA_BULAN[m - 1];

  if (withDay) {
    return `${dayName}, ${d} ${monthName} ${y}`;
  }
  return `${d} ${monthName} ${y}`;
}

export function formatMonthYear(year: number, monthIndex: number): string {
  return `${NAMA_BULAN[monthIndex]} ${year}`;
}

/**
 * Native CSV Exporter using Blob and URL.createObjectURL
 * Strictly fulfills requirement: FUNGSI DOWNLOAD NATIVE exportToCSV(data, filename)
 */
export function exportToCSV(rows: (string | number)[][], filename: string): void {
  const csvContent = '\uFEFF' + rows.map(row => 
    row.map(cell => {
      const str = String(cell ?? '');
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes(';')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(',')
  ).join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function cleanPhoneNumber(phone: string): string {
  if (!phone) return '';
  let cleaned = phone.replace(/[^0-9]/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.substring(1);
  } else if (cleaned.startsWith('8')) {
    cleaned = '62' + cleaned;
  }
  return cleaned;
}

/**
 * Utility to synchronize and clean tutor references across students and absensi records
 * based on the single source of truth: daftarTutor in Pengaturan.
 */
export function cleanAndSyncTutorData(
  students: any[],
  absensi: any[],
  validDaftarTutor: string[]
): {
  cleanedStudents: any[];
  cleanedAbsensi: any[];
  cleanedStudentsCount: number;
  cleanedAbsensiCount: number;
} {
  const defaultTutor = validDaftarTutor[0] || '';

  let cleanedStudentsCount = 0;
  let cleanedAbsensiCount = 0;

  const cleanedStudents = students.map((s) => {
    const raw = (s.tutorPembina || '').trim();
    if (!raw) return s;

    // Check exact or case-insensitive or partial match
    const matched = validDaftarTutor.find(
      (vt) => vt.trim().toLowerCase() === raw.toLowerCase()
    );
    if (matched) {
      if (s.tutorPembina !== matched) {
        cleanedStudentsCount++;
        return { ...s, tutorPembina: matched };
      }
      return s;
    }

    // Try finding by tutor's name prefix (e.g., 'Kak Dimas' inside 'Kak Dimas Setiawan, M.Si (Matematika & Fisika)')
    const partialMatch = validDaftarTutor.find((vt) => {
      const vtLower = vt.toLowerCase();
      const rawLower = raw.toLowerCase();
      return vtLower.includes(rawLower) || rawLower.includes(vtLower.split(' ')[0] + ' ' + (vtLower.split(' ')[1] || ''));
    });

    if (partialMatch) {
      cleanedStudentsCount++;
      return { ...s, tutorPembina: partialMatch };
    }

    // If not found in registered tutors, reset to default registered tutor or first tutor
    cleanedStudentsCount++;
    return { ...s, tutorPembina: defaultTutor };
  });

  const cleanedAbsensi = absensi.map((a) => {
    const raw = (a.tutor || '').trim();
    if (!raw) {
      if (defaultTutor) {
        cleanedAbsensiCount++;
        return { ...a, tutor: defaultTutor };
      }
      return a;
    }

    const matched = validDaftarTutor.find(
      (vt) => vt.trim().toLowerCase() === raw.toLowerCase()
    );
    if (matched) {
      if (a.tutor !== matched) {
        cleanedAbsensiCount++;
        return { ...a, tutor: matched };
      }
      return a;
    }

    const partialMatch = validDaftarTutor.find((vt) => {
      const vtLower = vt.toLowerCase();
      const rawLower = raw.toLowerCase();
      return vtLower.includes(rawLower) || rawLower.includes(vtLower.split(' ')[0] + ' ' + (vtLower.split(' ')[1] || ''));
    });

    if (partialMatch) {
      cleanedAbsensiCount++;
      return { ...a, tutor: partialMatch };
    }

    cleanedAbsensiCount++;
    return { ...a, tutor: defaultTutor };
  });

  return {
    cleanedStudents,
    cleanedAbsensi,
    cleanedStudentsCount,
    cleanedAbsensiCount,
  };
}

