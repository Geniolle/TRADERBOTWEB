// web/src/components/chart/utils/chartFormatters.ts

export function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatPrice(value: number): string {
  return value.toFixed(5);
}