/** 825088 → "825,088" (en-GB grouping). Non-finite input renders as "0". */
const COUNT_FORMAT = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });

export function formatCount(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return COUNT_FORMAT.format(value);
}
