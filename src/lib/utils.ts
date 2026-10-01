export { cn, type ClassValue } from "cn";

/** Narrow an unknown JSON value to a string-keyed record. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Read a string from import.meta.env without any-typed access. */
export function envString(key: string): string | undefined {
  const value: unknown = import.meta.env?.[key];
  return typeof value === "string" ? value : undefined;
}
