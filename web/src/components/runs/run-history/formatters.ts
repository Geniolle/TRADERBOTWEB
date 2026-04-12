// C:\TraderBotWeb\web\src\components\runs\run-history\formatters.ts

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "0,00%";
  return `${value.toFixed(2).replace(".", ",")}%`;
}

export function formatCompactPercent(value: number): string {
  if (!Number.isFinite(value)) return "-";
  return `${value.toFixed(0)}%`;
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleString("pt-PT");
}

export function formatValue(value: string | number | null | undefined): string {
  if (value == null) return "-";
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  const text = String(value).trim();
  return text || "-";
}

export function formatAnalysisNumber(
  value: string | number | null | undefined,
  digits = 5
): string {
  if (value == null) return "-";

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "-";
    return value.toFixed(digits);
  }

  const text = String(value).trim();
  if (!text) return "-";

  const normalized = text.replace(",", ".");
  const parsed = Number(normalized);

  if (!Number.isFinite(parsed)) {
    return text;
  }

  return parsed.toFixed(digits);
}

export function formatDirectionalEmaValue(
  value: string | number | null | undefined,
  digits = 6
): string {
  const formatted = formatAnalysisNumber(value, digits);
  return formatted === "-" ? "-" : formatted.replace(".", ",");
}

export function formatIndicatorValueByLabel(label: string, value: string): string {
  const normalizedLabel = label.trim().toLowerCase();

  if (
    [
      "rsi 14",
      "posição do close na banda",
      "body ratio",
      "hit rate",
      "fail rate",
      "timeout rate",
      "força da tendência",
    ].includes(normalizedLabel)
  ) {
    return formatAnalysisNumber(value, 2);
  }

  if (
    [
      "macd",
      "signal",
      "histograma",
      "atr 14",
      "inclinação ema 20",
      "inclinação ema 40",
      "inclinação ema 9",
      "inclinação ema 21",
      "inclinação rsi",
      "inclinação histograma macd",
    ].includes(normalizedLabel)
  ) {
    return formatAnalysisNumber(value, 6);
  }

  if (
    [
      "preço de referência",
      "ema 5",
      "ema 9",
      "ema 10",
      "ema 20",
      "ema 21",
      "ema 30",
      "ema 40",
      "bollinger superior",
      "bollinger média",
      "bollinger inferior",
      "range candle",
      "range vs atr",
      "distância ao suporte",
      "distância à resistência",
      "distância à ema 20",
      "distância à ema 40",
      "candle open",
      "candle high",
      "candle low",
      "candle close",
      "body size",
      "upper wick",
      "lower wick",
      "bandwidth",
      "entrada",
      "fecho",
      "target",
      "invalidação",
      "trigger price",
    ].includes(normalizedLabel)
  ) {
    return formatAnalysisNumber(value, 5);
  }

  return value;
}
