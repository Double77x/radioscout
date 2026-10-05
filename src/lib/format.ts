/** 825088 → "825,088" (en-GB grouping). Non-finite input renders as "0". */
const COUNT_FORMAT = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });

export function formatCount(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return COUNT_FORMAT.format(value);
}

/** Compact age for song history: ISO timestamp → "45s", "5m", "3h", "2d". Empty when unparseable. */
export function formatRelativeTime(iso: string, now: number = Date.now()): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "";
  const abs = Math.max(0, Math.round((now - then) / 1000));
  if (abs < 60) return `${abs}s`;
  if (abs < 3600) return `${Math.trunc(abs / 60)}m`;
  if (abs < 86_400) return `${Math.trunc(abs / 3600)}h`;
  return `${Math.trunc(abs / 86_400)}d`;
}
