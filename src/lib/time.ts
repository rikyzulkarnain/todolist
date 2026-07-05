// Helper tanggal/jam sadar-timezone. due_time task disimpan wall-clock lokal
// tanpa tz, jadi perhitungan "hari ini" & "jam sekarang" di server memakai
// timezone user (fallback WIB) agar benar lintas zona.

export const DEFAULT_TZ = "Asia/Jakarta";

/** "yyyy-MM-dd" untuk saat ini di timezone tertentu. */
export function todayInTz(timeZone?: string | null): string {
  // en-CA menghasilkan format YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timeZone || DEFAULT_TZ,
  }).format(new Date());
}

/** "HH:mm" 24 jam untuk saat ini di timezone tertentu. */
export function nowTimeInTz(timeZone?: string | null): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timeZone || DEFAULT_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

/** "yyyy-MM-dd" N hari lalu, dihitung dari hari ini di timezone tertentu. */
export function daysAgoInTz(days: number, timeZone?: string | null): string {
  const today = todayInTz(timeZone);
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}
