// src/utils/format.ts

export function formatDateTime(value: string | null): string {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("pt-PT", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatUtcDateTime(value: string | null): string {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toISOString();
}

export function parsePrice(value: string | null): number | null {
  if (!value) return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatMaybeNumber(
  value: number | null | undefined,
  decimals = 2
): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return value.toFixed(decimals);
}

export function formatBooleanLike(value: boolean | null | undefined): string {
  if (value === true) return "true";
  if (value === false) return "false";
  return "-";
}

export function floorToMinuteIso(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  date.setSeconds(0, 0);
  return date.toISOString();
}