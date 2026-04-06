// web/src/utils/strategyHelpers.ts

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function roundScore(value: number): number {
  return Math.round(clamp(value, 0, 100));
}

export function toPercentLabel(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "--";
  return `${Math.round(value)}%`;
}

export function formatPrice(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "--";
  return value.toFixed(5).replace(".", ",");
}

export function isBelow(price?: number, ref?: number): boolean {
  if (price == null || ref == null) return false;
  return price < ref;
}

export function isAbove(price?: number, ref?: number): boolean {
  if (price == null || ref == null) return false;
  return price > ref;
}

export function calcDistancePercent(price?: number, ref?: number): number | null {
  if (price == null || ref == null || ref === 0) return null;
  return ((price - ref) / ref) * 100;
}