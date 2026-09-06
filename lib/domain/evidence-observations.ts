/** Keep one observation per exact post within a scan; never merge changed text. */
export function uniqueEvidenceObservations<T extends { sourceUrl: string | null; quote: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (!row.sourceUrl?.trim()) return true;
    const key = JSON.stringify([row.sourceUrl, row.quote]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
