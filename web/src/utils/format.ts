// src/utils/format.ts

function toValidDate(value: string | null | undefined): Date | null {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

export function formatDateTime(value: string | null): string {
  const date = toValidDate(value);
  if (!date) return value || "-";

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
  const date = toValidDate(value);
  if (!date) return value || "-";

  return date.toISOString();
}

export function parsePrice(
  value: string | number | null | undefined
): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

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
  const date = toValidDate(value);
  if (!date) {
    return value;
  }

  date.setSeconds(0, 0);
  return date.toISOString();
}

function normalizeTimeframe(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function timeframeToMinutes(timeframe: string): number {
  const normalized = normalizeTimeframe(timeframe);

  if (normalized === "1m") return 1;
  if (normalized === "3m") return 3;
  if (normalized === "5m") return 5;
  if (normalized === "15m") return 15;
  if (normalized === "30m") return 30;
  if (normalized === "1h") return 60;
  if (normalized === "4h") return 240;
  if (normalized === "1d") return 1440;

  return 1;
}

export function floorToTimeframeIso(value: string, timeframe: string): string {
  const date = toValidDate(value);
  if (!date) {
    return value;
  }

  const minutes = timeframeToMinutes(timeframe);

  date.setSeconds(0, 0);

  if (minutes < 60) {
    const currentMinutes = date.getUTCMinutes();
    const flooredMinutes = Math.floor(currentMinutes / minutes) * minutes;
    date.setUTCMinutes(flooredMinutes, 0, 0);
    return date.toISOString();
  }

  if (minutes === 60) {
    date.setUTCMinutes(0, 0, 0);
    return date.toISOString();
  }

  if (minutes === 240) {
    const currentHours = date.getUTCHours();
    const flooredHours = Math.floor(currentHours / 4) * 4;
    date.setUTCHours(flooredHours, 0, 0, 0);
    return date.toISOString();
  }

  if (minutes === 1440) {
    date.setUTCHours(0, 0, 0, 0);
    return date.toISOString();
  }

  return date.toISOString();
}