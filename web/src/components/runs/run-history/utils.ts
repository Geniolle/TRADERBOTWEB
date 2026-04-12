// C:\TraderBotWeb\web\src\components\runs\run-history\utils.ts

import type {
  AnalysisSnapshot,
  StageTestRunCaseItem,
  StageTestRunRuleItem,
  StageTestRunTechnicalAnalysis,
  StageTestSummaryItem,
} from "../../../types/trading";
import type { ExecutionLogStatus } from "../../../hooks/useStageTests";
import type {
  DirectionArrowVisual,
  EmaDirectionSummary,
  RuleVisualState,
  StrategicCaseFilters,
  TrendPanelData,
  TrendStrengthResult,
} from "./types";

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

export function normalizeOutcome(value: string | null | undefined): string {
  const raw = (value ?? "").trim().toLowerCase();

  if (["hit", "win", "target", "target_hit", "tp", "profit"].includes(raw)) {
    return "hit";
  }

  if (["fail", "loss", "stop", "stop_loss", "sl"].includes(raw)) {
    return "fail";
  }

  if (["timeout", "expired", "time_out"].includes(raw)) {
    return "timeout";
  }

  return raw || "other";
}

export function normalizeDisplayText(value: string | null | undefined): string {
  const raw = (value ?? "").trim();
  if (!raw) return "-";

  const normalized = raw.toLowerCase();

  const map: Record<string, string> = {
    buy: "Compradora",
    sell: "Vendedora",
    long: "Compradora",
    short: "Vendedora",
    bullish: "Altista",
    bearish: "Baixista",
    mixed: "Misto",
    neutral: "Neutra",
    oversold: "Sobrevendida",
    overbought: "Sobrecomprada",
    above: "Acima",
    below: "Abaixo",
    touching: "Encostado",
    asia: "Ásia",
    london: "Londres",
    "new york": "Nova Iorque",
    new_york: "Nova Iorque",
    newyork: "Nova Iorque",
    range: "Lateral",
    trending: "Tendencial",
    bullish_cross: "Bullish cross",
    bearish_cross: "Bearish cross",
    bearish_below_signal: "bearish_below_signal",
    bullish_above_signal: "bullish_above_signal",
    up: "up",
    down: "down",
    flat: "flat",
    mid_range: "Meio do range",
    balanced: "Equilibrado",
    normal: "Normal",
    high: "Alta",
    low: "Baixa",
    ready: "Sem sinal",
    local_ok: "Entrada validada",
    local_error: "Run com erro",
    hit: "Hit",
    fail: "Fail",
    timeout: "Timeout",
    closed: "Fechado",
    pullback: "Pullback",
  };

  return map[normalized] ?? raw;
}

export function normalizeRuleLabel(label: string): string {
  const map: Record<string, string> = {
    "BB reentry long": "Reentrada Bollinger (long)",
    "BB reentry short": "Reentrada Bollinger (short)",
    "EMA trend confirmed long": "Tendência EMA confirmada (long)",
    "EMA trend confirmed short": "Tendência EMA confirmada (short)",
    "RSI recovery long": "Recuperação RSI (long)",
    "RSI recovery short": "Recuperação RSI (short)",
    "MACD confirmation long": "Confirmação MACD (long)",
    "MACD confirmation short": "Confirmação MACD (short)",
    "Countertrend long": "Sinal contrário comprador",
    "Countertrend short": "Sinal contrário vendedor",
    "Reentrada na banda (long)": "Reentrada na banda (long)",
    "Reentrada na banda (short)": "Reentrada na banda (short)",
    "Fecho abaixo da banda inferior": "Fecho abaixo da banda inferior",
    "Fecho acima da banda superior": "Fecho acima da banda superior",
  };

  return map[label] ?? label;
}

export function getDirectionAccent(direction: string): {
  color: string;
  background: string;
  border: string;
} {
  const normalized = direction.trim().toLowerCase();

  if (normalized === "compradora") {
    return {
      color: "#166534",
      background: "#f0fdf4",
      border: "#86efac",
    };
  }

  if (normalized === "vendedora") {
    return {
      color: "#991b1b",
      background: "#fef2f2",
      border: "#fca5a5",
    };
  }

  return {
    color: "#0f172a",
    background: "transparent",
    border: "transparent",
  };
}

export function getArrowVisual(isUp: boolean): DirectionArrowVisual {
  if (isUp) {
    return {
      arrow: "↑",
      color: "#166534",
      border: "#86efac",
      background: "#f0fdf4",
    };
  }

  return {
    arrow: "↓",
    color: "#991b1b",
    border: "#fca5a5",
    background: "#fef2f2",
  };
}

export function compareStageTestsByHitRate(
  left: StageTestSummaryItem,
  right: StageTestSummaryItem
): number {
  const leftHitRate = Number.isFinite(left.hit_rate) ? left.hit_rate : -1;
  const rightHitRate = Number.isFinite(right.hit_rate) ? right.hit_rate : -1;

  if (rightHitRate !== leftHitRate) {
    return rightHitRate - leftHitRate;
  }

  const leftRuns = Number.isFinite(left.total_runs) ? left.total_runs : 0;
  const rightRuns = Number.isFinite(right.total_runs) ? right.total_runs : 0;

  if (rightRuns !== leftRuns) {
    return rightRuns - leftRuns;
  }

  return left.strategy_name.localeCompare(right.strategy_name, "pt-PT", {
    sensitivity: "base",
  });
}

export function getStatusDotColor(status: ExecutionLogStatus): string {
  if (status === "running") return "#2563eb";
  if (status === "success") return "#16a34a";
  if (status === "error") return "#dc2626";
  if (status === "waiting") return "#d97706";
  return "#64748b";
}

export function getStatusBackground(status: ExecutionLogStatus): string {
  if (status === "running") return "#eff6ff";
  if (status === "success") return "#f0fdf4";
  if (status === "error") return "#fef2f2";
  if (status === "waiting") return "#fffbeb";
  return "#f8fafc";
}

export function getStatusBorder(status: ExecutionLogStatus): string {
  if (status === "running") return "#bfdbfe";
  if (status === "success") return "#bbf7d0";
  if (status === "error") return "#fecaca";
  if (status === "waiting") return "#fde68a";
  return "#cbd5e1";
}

export function getAnalysisStatusBadge(status: string | null | undefined) {
  const normalized = (status ?? "").trim().toLowerCase();

  if (normalized === "local_ok") {
    return {
      label: "Entrada validada",
      background: "#dcfce7",
      color: "#166534",
      border: "#86efac",
    };
  }

  if (normalized === "local_error") {
    return {
      label: "Run com erro",
      background: "#fee2e2",
      color: "#991b1b",
      border: "#fca5a5",
    };
  }

  if (normalized === "ready") {
    return {
      label: "Sem sinal",
      background: "#f1f5f9",
      color: "#475569",
      border: "#cbd5e1",
    };
  }

  if (normalized === "hit") {
    return {
      label: "Hit",
      background: "#dcfce7",
      color: "#166534",
      border: "#86efac",
    };
  }

  if (normalized === "fail") {
    return {
      label: "Fail",
      background: "#fee2e2",
      color: "#991b1b",
      border: "#fca5a5",
    };
  }

  if (normalized === "timeout") {
    return {
      label: "Timeout",
      background: "#fffbeb",
      color: "#92400e",
      border: "#fcd34d",
    };
  }

  return {
    label: status || "Sem estado",
    background: "#f8fafc",
    color: "#334155",
    border: "#cbd5e1",
  };
}

export function getOutcomeBadge(outcome: string | null | undefined) {
  const normalized = normalizeOutcome(outcome);

  if (normalized === "hit") {
    return {
      label: "HIT",
      background: "#dcfce7",
      color: "#166534",
      border: "#86efac",
    };
  }

  if (normalized === "fail") {
    return {
      label: "FAIL",
      background: "#fee2e2",
      color: "#991b1b",
      border: "#fca5a5",
    };
  }

  if (normalized === "timeout") {
    return {
      label: "TIMEOUT",
      background: "#fffbeb",
      color: "#92400e",
      border: "#fcd34d",
    };
  }

  return {
    label: outcome || "OUTRO",
    background: "#f8fafc",
    color: "#475569",
    border: "#cbd5e1",
  };
}

export function getRuleVisualState(
  rule: StageTestRunRuleItem,
  direction: string | null | undefined
): RuleVisualState {
  const normalizedDirection = (direction ?? "").trim().toLowerCase();
  const normalizedLabel = (rule?.label ?? "").trim().toLowerCase();
  const passed = rule?.passed;

  if (passed === false) {
    return "inactive";
  }

  if (passed == null) {
    return "contextual";
  }

  const isLongRule =
    normalizedLabel.includes("long") ||
    normalizedLabel.includes("comprador") ||
    normalizedLabel.includes("abaixo da banda inferior");

  const isShortRule =
    normalizedLabel.includes("short") ||
    normalizedLabel.includes("vendedor") ||
    normalizedLabel.includes("acima da banda superior");

  if (normalizedDirection === "buy" || normalizedDirection === "long") {
    if (isLongRule) return "confirmed";
    if (isShortRule) return "contrary";
  }

  if (normalizedDirection === "sell" || normalizedDirection === "short") {
    if (isShortRule) return "confirmed";
    if (isLongRule) return "contrary";
  }

  return "contextual";
}

export function getRuleStateStyles(state: RuleVisualState) {
  if (state === "confirmed") {
    return {
      background: "#ecfdf5",
      border: "#86efac",
      color: "#166534",
      label: "Confirmado",
    };
  }

  if (state === "contrary") {
    return {
      background: "#fff7ed",
      border: "#fdba74",
      color: "#9a3412",
      label: "Contrário",
    };
  }

  if (state === "inactive") {
    return {
      background: "#f8fafc",
      border: "#cbd5e1",
      color: "#64748b",
      label: "Inativo",
    };
  }

  return {
    background: "#eff6ff",
    border: "#93c5fd",
    color: "#1d4ed8",
    label: "Contextual",
  };
}

export function getConflictLevel(conflicts: number): string {
  if (conflicts <= 0) return "Baixo";
  if (conflicts === 1) return "Moderado";
  return "Alto";
}

export function toNumeric(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;

  const normalized = String(value).trim().replace(",", ".");
  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object") {
    return value as Record<string, unknown>;
  }

  return {};
}

export function getSnapshotCandle(
  snapshot: AnalysisSnapshot | null | undefined
): Record<string, unknown> {
  const record = asRecord(snapshot);
  return asRecord(record.candle);
}

export function getSnapshotMomentum(
  snapshot: AnalysisSnapshot | null | undefined
): Record<string, unknown> {
  const record = asRecord(snapshot);
  return asRecord(record.momentum);
}

export function getMomentumNumeric(
  snapshot: AnalysisSnapshot | null | undefined,
  ...keys: string[]
): number | null {
  const momentum = getSnapshotMomentum(snapshot);

  for (const key of keys) {
    const value = momentum[key];
    const numeric = toNumeric(
      typeof value === "string" || typeof value === "number" ? value : null
    );
    if (numeric != null) return numeric;
  }

  return null;
}

export function getCandleNumeric(
  snapshot: AnalysisSnapshot | null | undefined,
  ...keys: string[]
): number | null {
  const candle = getSnapshotCandle(snapshot);

  for (const key of keys) {
    const value = candle[key];
    const numeric = toNumeric(
      typeof value === "string" || typeof value === "number" ? value : null
    );
    if (numeric != null) return numeric;
  }

  return null;
}

export function findIndicatorValue(
  analysis: StageTestRunTechnicalAnalysis | null | undefined,
  candidateLabels: string[]
): string | null {
  const indicators = analysis?.indicators ?? [];
  if (indicators.length === 0) return null;

  const normalizedCandidates = candidateLabels.map((label) =>
    label.trim().toLowerCase()
  );

  for (const indicator of indicators) {
    const normalizedLabel = indicator.label.trim().toLowerCase();
    if (normalizedCandidates.includes(normalizedLabel)) {
      return indicator.value;
    }
  }

  return null;
}

export function findIndicatorNumeric(
  analysis: StageTestRunTechnicalAnalysis | null | undefined,
  candidateLabels: string[]
): number | null {
  const value = findIndicatorValue(analysis, candidateLabels);
  return toNumeric(value);
}

export function resolveCaseDirection(item: StageTestRunCaseItem): string {
  const rawSide = normalizeDisplayText(
    typeof item.side === "string" ? item.side : null
  );

  if (rawSide !== "-") {
    return rawSide;
  }

  const analysisDirection = normalizeDisplayText(item.analysis?.direction);

  if (analysisDirection !== "-") {
    return analysisDirection;
  }

  return "-";
}

export function buildEmaDirectionSummary(
  analysis: StageTestRunTechnicalAnalysis | null,
  signalLabel: string
): EmaDirectionSummary {
  const m9Value =
    findIndicatorNumeric(analysis, [
      "EMA 9",
      "M9",
      "ema9",
      "ema_9",
      "ema 09",
      "m 9",
    ]) ??
    findIndicatorNumeric(analysis, ["EMA curta", "EMA short", "Short EMA"]) ??
    null;

  const m21Value =
    findIndicatorNumeric(analysis, [
      "EMA 21",
      "M21",
      "ema21",
      "ema_21",
      "m 21",
    ]) ??
    findIndicatorNumeric(analysis, ["EMA longa", "EMA long", "Long EMA"]) ??
    null;

  const m9Slope =
    findIndicatorNumeric(analysis, [
      "Inclinação EMA 9",
      "Slope EMA 9",
      "EMA 9 slope",
      "inclinação ema9",
    ]) ?? null;

  const m21Slope =
    findIndicatorNumeric(analysis, [
      "Inclinação EMA 21",
      "Slope EMA 21",
      "EMA 21 slope",
      "inclinação ema21",
    ]) ?? null;

  const normalizedSignal = signalLabel.trim().toLowerCase();
  const isBuyer = ["compradora", "buy", "long"].includes(normalizedSignal);
  const isSeller = ["vendedora", "sell", "short"].includes(normalizedSignal);

  const normalizedAnalysisDirection = (analysis?.direction ?? "").trim().toLowerCase();
  const isBuyerByAnalysis = ["buy", "long"].includes(normalizedAnalysisDirection);
  const isSellerByAnalysis = ["sell", "short"].includes(normalizedAnalysisDirection);

  const finalIsBuyer = isBuyer || isBuyerByAnalysis;
  const finalIsSeller = isSeller || isSellerByAnalysis;

  const m9IsUp =
    m9Slope != null ? m9Slope >= 0 : finalIsBuyer ? true : finalIsSeller ? false : true;

  const m21IsUp =
    m21Slope != null
      ? m21Slope >= 0
      : finalIsBuyer
        ? true
        : finalIsSeller
          ? false
          : true;

  const crossConfirmed =
    m9Value != null && m21Value != null
      ? finalIsBuyer
        ? m9Value > m21Value
        : finalIsSeller
          ? m9Value < m21Value
          : null
      : null;

  const crossConfirmedLabel =
    crossConfirmed == null
      ? "Cruzamento por confirmar"
      : crossConfirmed
        ? "Cruzamento confirmado"
        : "Cruzamento não confirmado";

  const crossConfirmedColor =
    crossConfirmed === false ? "#991b1b" : "#166534";

  const crossConfirmedBackground =
    crossConfirmed === false ? "#fef2f2" : "#f0fdf4";

  const crossConfirmedBorder =
    crossConfirmed === false ? "#fca5a5" : "#86efac";

  return {
    m9Value: formatDirectionalEmaValue(m9Value, 6),
    m21Value: formatDirectionalEmaValue(m21Value, 6),
    m9Arrow: getArrowVisual(m9IsUp),
    m21Arrow: getArrowVisual(m21IsUp),
    crossConfirmedLabel,
    crossConfirmedColor,
    crossConfirmedBackground,
    crossConfirmedBorder,
  };
}

export function calculateTrendStrength(
  analysis: StageTestRunTechnicalAnalysis | null
): TrendStrengthResult {
  const snapshot = analysis?.snapshot;
  if (!snapshot) {
    return {
      pct: 0,
      direction: "-",
      label: "-",
      summary: "Sem snapshot técnico",
    };
  }

  const direction = (analysis?.direction ?? "").trim().toLowerCase();
  const isBuy = direction === "buy" || direction === "long";
  const isSell = direction === "sell" || direction === "short";

  const alignment = (snapshot.trend?.ema_alignment ?? "").trim().toLowerCase();
  const priceVs20 = (snapshot.trend?.price_vs_ema_20 ?? "").trim().toLowerCase();
  const priceVs40 = (snapshot.trend?.price_vs_ema_40 ?? "").trim().toLowerCase();
  const marketStructure = (snapshot.structure?.market_structure ?? "")
    .trim()
    .toLowerCase();
  const rsiSlope = (snapshot.momentum?.rsi_slope ?? "").trim().toLowerCase();
  const macdState = (snapshot.momentum?.macd_state ?? "").trim().toLowerCase();

  const ema20Slope = toNumeric(snapshot.trend?.ema_20_slope);
  const ema40Slope = toNumeric(snapshot.trend?.ema_40_slope);

  let score = 0;

  if (isBuy) {
    if (alignment === "bullish") score += 25;
    if (priceVs20 === "above") score += 15;
    if (priceVs40 === "above") score += 20;
    if (ema20Slope != null && ema20Slope > 0) score += 15;
    if (ema40Slope != null && ema40Slope > 0) score += 15;
    if (marketStructure === "trending") score += 10;
    if (rsiSlope === "up") score += 5;
    if (macdState === "bullish_cross" || macdState === "bullish_above_signal") {
      score += 5;
    }

    if (marketStructure === "range") score -= 20;
    if (priceVs40 === "below") score -= 15;
    if (alignment === "bearish") score -= 20;
  } else if (isSell) {
    if (alignment === "bearish") score += 25;
    if (priceVs20 === "below") score += 15;
    if (priceVs40 === "below") score += 20;
    if (ema20Slope != null && ema20Slope < 0) score += 15;
    if (ema40Slope != null && ema40Slope < 0) score += 15;
    if (marketStructure === "trending") score += 10;
    if (rsiSlope === "down") score += 5;
    if (macdState === "bearish_cross" || macdState === "bearish_below_signal") {
      score += 5;
    }

    if (marketStructure === "range") score -= 20;
    if (priceVs40 === "above") score -= 15;
    if (alignment === "bullish") score -= 20;
  } else {
    if (marketStructure === "trending") score += 20;
    if (alignment === "bullish" || alignment === "bearish") score += 20;
  }

  const pct = clamp(score, 0, 100);

  let label = "Fraca";
  if (pct >= 80) label = "Alta";
  else if (pct >= 60) label = "Favorável";
  else if (pct >= 40) label = "Neutra";

  let dominantDirection = "Indefinida";
  if (alignment === "bullish") dominantDirection = "Alta";
  if (alignment === "bearish") dominantDirection = "Baixa";
  if (marketStructure === "range") dominantDirection = "Lateral";

  const summary = `${dominantDirection} ${label.toLowerCase()}`;

  return {
    pct,
    direction: dominantDirection,
    label,
    summary,
  };
}

export function getTrendBiasLabel(
  analysis: StageTestRunTechnicalAnalysis | null
): string {
  const snapshot = analysis?.snapshot;
  if (!snapshot) return "-";

  const direction = (analysis?.direction ?? "").trim().toLowerCase();
  const structure = (snapshot.structure?.market_structure ?? "")
    .trim()
    .toLowerCase();
  const alignment = (snapshot.trend?.ema_alignment ?? "").trim().toLowerCase();
  const priceVs20 = (snapshot.trend?.price_vs_ema_20 ?? "").trim().toLowerCase();
  const priceVs40 = (snapshot.trend?.price_vs_ema_40 ?? "").trim().toLowerCase();

  if (structure === "range") {
    return "Mercado lateral";
  }

  if (
    (direction === "buy" || direction === "long") &&
    alignment === "bullish" &&
    priceVs20 === "above" &&
    priceVs40 === "above"
  ) {
    return "Compra a favor da tendência";
  }

  if (
    (direction === "sell" || direction === "short") &&
    alignment === "bearish" &&
    priceVs20 === "below" &&
    priceVs40 === "below"
  ) {
    return "Venda a favor da tendência";
  }

  if ((direction === "buy" || direction === "long") && alignment === "bearish") {
    return "Compra contra tendência";
  }

  if ((direction === "sell" || direction === "short") && alignment === "bullish") {
    return "Venda contra tendência";
  }

  return "Tendência indefinida";
}

export function getSignalQualityLabel(
  analysis: StageTestRunTechnicalAnalysis | null
): string {
  const snapshot = analysis?.snapshot;
  if (!snapshot) return "-";

  const structure = (snapshot.structure?.market_structure ?? "")
    .trim()
    .toLowerCase();
  const alignment = (snapshot.trend?.ema_alignment ?? "").trim().toLowerCase();
  const entryLocation = (snapshot.structure?.entry_location ?? "")
    .trim()
    .toLowerCase();
  const rsiZone = (snapshot.momentum?.rsi_zone ?? "").trim().toLowerCase();
  const macdState = (snapshot.momentum?.macd_state ?? "").trim().toLowerCase();

  let score = 0;

  if (structure === "trending") score += 2;
  if (alignment === "bullish" || alignment === "bearish") score += 2;
  if (entryLocation && entryLocation !== "mid_range") score += 1;
  if (rsiZone && rsiZone !== "neutral") score += 1;
  if (
    macdState === "bullish_cross" ||
    macdState === "bearish_cross" ||
    macdState === "bullish_above_signal" ||
    macdState === "bearish_below_signal"
  ) {
    score += 1;
  }

  if (structure === "range") score -= 2;
  if (entryLocation === "mid_range") score -= 1;
  if (rsiZone === "neutral") score -= 1;

  if (score >= 4) return "Forte";
  if (score >= 2) return "Médio";
  return "Fraco";
}

export function buildStrategicCaseFilters(
  analysis: StageTestRunTechnicalAnalysis | null
): StrategicCaseFilters {
  const snapshot = analysis?.snapshot;
  const trendStrength = calculateTrendStrength(analysis);

  if (!snapshot) {
    return {
      session: "-",
      marketStructure: "-",
      emaAlignment: "-",
      priceVsEma20: "-",
      priceVsEma40: "-",
      ema20Slope: "-",
      ema40Slope: "-",
      entryLocation: "-",
      rsiZone: "-",
      rsiSlope: "-",
      macdState: "-",
      trendBias: "-",
      signalQuality: "-",
      trendStrengthPct: "-",
      trendDirection: "-",
      trendLabel: "-",
    };
  }

  return {
    session: normalizeDisplayText(snapshot.trigger_context?.session),
    marketStructure: normalizeDisplayText(snapshot.structure?.market_structure),
    emaAlignment: normalizeDisplayText(snapshot.trend?.ema_alignment),
    priceVsEma20: normalizeDisplayText(snapshot.trend?.price_vs_ema_20),
    priceVsEma40: normalizeDisplayText(snapshot.trend?.price_vs_ema_40),
    ema20Slope: formatAnalysisNumber(snapshot.trend?.ema_20_slope, 6),
    ema40Slope: formatAnalysisNumber(snapshot.trend?.ema_40_slope, 6),
    entryLocation: normalizeDisplayText(snapshot.structure?.entry_location),
    rsiZone: normalizeDisplayText(snapshot.momentum?.rsi_zone),
    rsiSlope: normalizeDisplayText(snapshot.momentum?.rsi_slope),
    macdState: normalizeDisplayText(snapshot.momentum?.macd_state),
    trendBias: getTrendBiasLabel(analysis),
    signalQuality: getSignalQualityLabel(analysis),
    trendStrengthPct: formatCompactPercent(trendStrength.pct),
    trendDirection: trendStrength.direction,
    trendLabel: trendStrength.label,
  };
}

export function scoreTechnicalAnalysis(
  analysis: StageTestRunTechnicalAnalysis
): {
  overall: number;
  trend: number;
  momentum: number;
  structure: number;
  entry: number;
  risk: number;
} {
  const snapshot = analysis.snapshot;

  if (!snapshot) {
    return {
      overall: 5,
      trend: 5,
      momentum: 5,
      structure: 5,
      entry: 5,
      risk: 5,
    };
  }

  let trend = 5;
  let momentum = 5;
  let structure = 5;
  let entry = 5;
  let risk = 7;

  const direction = (analysis.direction ?? "").trim().toLowerCase();
  const alignment = (snapshot.trend?.ema_alignment ?? "").trim().toLowerCase();
  const priceVsEma20 = (snapshot.trend?.price_vs_ema_20 ?? "")
    .trim()
    .toLowerCase();
  const priceVsEma40 = (snapshot.trend?.price_vs_ema_40 ?? "")
    .trim()
    .toLowerCase();
  const marketStructure = (snapshot.structure?.market_structure ?? "")
    .trim()
    .toLowerCase();
  const entryLocation = (snapshot.structure?.entry_location ?? "")
    .trim()
    .toLowerCase();
  const rsiZone = (snapshot.momentum?.rsi_zone ?? "").trim().toLowerCase();
  const macdState = (snapshot.momentum?.macd_state ?? "").trim().toLowerCase();

  if ((direction === "buy" || direction === "long") && alignment === "bullish") {
    trend += 2;
  }

  if ((direction === "sell" || direction === "short") && alignment === "bearish") {
    trend += 2;
  }

  if ((direction === "buy" || direction === "long") && priceVsEma20 === "above") {
    trend += 1.5;
  }

  if ((direction === "buy" || direction === "long") && priceVsEma40 === "above") {
    trend += 1.5;
  }

  if ((direction === "sell" || direction === "short") && priceVsEma20 === "below") {
    trend += 1.5;
  }

  if ((direction === "sell" || direction === "short") && priceVsEma40 === "below") {
    trend += 1.5;
  }

  if (
    (direction === "buy" || direction === "long") &&
    (macdState === "bullish_cross" || macdState === "bullish_above_signal")
  ) {
    momentum += 2;
  }

  if (
    (direction === "sell" || direction === "short") &&
    (macdState === "bearish_cross" || macdState === "bearish_below_signal")
  ) {
    momentum += 2;
  }

  if (rsiZone === "neutral") {
    momentum -= 1;
  } else if (rsiZone === "oversold" || rsiZone === "overbought") {
    momentum += 0.5;
  }

  if (marketStructure === "range") {
    structure = 4;
    risk -= 1.5;
  } else if (marketStructure === "trending") {
    structure = 8;
  }

  if (entryLocation === "mid_range") {
    entry = 5;
    risk -= 1;
  } else {
    entry = 7;
  }

  const contraryRules =
    analysis.rules?.filter(
      (rule) =>
        rule.passed === true &&
        getRuleVisualState(rule, analysis.direction) === "contrary"
    ).length ?? 0;

  risk -= contraryRules * 1.5;

  trend = Math.max(0, Math.min(10, trend));
  momentum = Math.max(0, Math.min(10, momentum));
  structure = Math.max(0, Math.min(10, structure));
  entry = Math.max(0, Math.min(10, entry));
  risk = Math.max(0, Math.min(10, risk));

  const overall = Number(
    ((trend + momentum + structure + entry + risk) / 5).toFixed(1)
  );

  return {
    overall,
    trend: Number(trend.toFixed(1)),
    momentum: Number(momentum.toFixed(1)),
    structure: Number(structure.toFixed(1)),
    entry: Number(entry.toFixed(1)),
    risk: Number(risk.toFixed(1)),
  };
}

export function buildAnalysisNarrative(
  analysis: StageTestRunTechnicalAnalysis
): {
  executiveSummary: string;
  positives: string[];
  negatives: string[];
  conflicts: string[];
} {
  const snapshot = analysis.snapshot;
  const rules = analysis.rules ?? [];
  const positives: string[] = [];
  const negatives: string[] = [];
  const conflicts: string[] = [];

  if (!snapshot) {
    return {
      executiveSummary:
        "O backend devolveu a análise técnica, mas sem snapshot completo para interpretação avançada.",
      positives,
      negatives,
      conflicts,
    };
  }

  const direction = (analysis.direction ?? "").trim().toLowerCase();
  const marketStructure = snapshot.structure?.market_structure ?? "";
  const entryLocation = snapshot.structure?.entry_location ?? "";
  const rsiZone = snapshot.momentum?.rsi_zone ?? "";
  const emaAlignment = snapshot.trend?.ema_alignment ?? "";
  const macdState = snapshot.momentum?.macd_state ?? "";
  const priceVsEma20 = snapshot.trend?.price_vs_ema_20 ?? "";
  const priceVsEma40 = snapshot.trend?.price_vs_ema_40 ?? "";
  const trendStrength = calculateTrendStrength(analysis);

  const isBuy = direction === "buy" || direction === "long";
  const isSell = direction === "sell" || direction === "short";

  positives.push(
    `Força da tendência no gatilho: ${formatCompactPercent(
      trendStrength.pct
    )} (${trendStrength.summary}).`
  );

  if (isBuy && priceVsEma20.toLowerCase() === "above") {
    positives.push("O preço estava acima da EMA 20.");
  }

  if (isBuy && priceVsEma40.toLowerCase() === "above") {
    positives.push("O preço estava acima da EMA 40.");
  }

  if (isSell && priceVsEma20.toLowerCase() === "below") {
    positives.push("O preço estava abaixo da EMA 20.");
  }

  if (isSell && priceVsEma40.toLowerCase() === "below") {
    positives.push("O preço estava abaixo da EMA 40.");
  }

  if (emaAlignment) {
    positives.push(
      `As médias estavam alinhadas em viés ${normalizeDisplayText(emaAlignment)}.`
    );
  }

  if (macdState) {
    positives.push(
      `O MACD apresentava estado ${normalizeDisplayText(macdState)}.`
    );
  }

  if (marketStructure) {
    negatives.push(
      `A estrutura geral do mercado permanecia em ${normalizeDisplayText(
        marketStructure
      )}.`
    );
  }

  if (entryLocation) {
    negatives.push(
      `A entrada ocorreu em ${normalizeDisplayText(entryLocation)}.`
    );
  }

  if (rsiZone) {
    negatives.push(`O RSI estava em zona ${normalizeDisplayText(rsiZone)}.`);
  }

  if (trendStrength.pct < 60) {
    negatives.push(
      `A percentagem da tendência no gatilho foi baixa para um EMA Cross (${formatCompactPercent(
        trendStrength.pct
      )}).`
    );
  }

  rules.forEach((rule) => {
    if (
      rule.passed === true &&
      getRuleVisualState(rule, analysis.direction) === "contrary"
    ) {
      conflicts.push(`${normalizeRuleLabel(rule.label)} estava ativo.`);
    }
  });

  const executiveSummary =
    trendStrength.pct >= 60
      ? `O gatilho ocorreu com ${formatCompactPercent(
          trendStrength.pct
        )} de força de tendência, o que sugere um cruzamento com contexto mais limpo.`
      : `O gatilho ocorreu com apenas ${formatCompactPercent(
          trendStrength.pct
        )} de força de tendência, o que sugere um cruzamento potencialmente fraco ou filtrável.`;

  return {
    executiveSummary,
    positives,
    negatives,
    conflicts,
  };
}

export function groupIndicators(
  analysis: StageTestRunTechnicalAnalysis
): {
  context: Array<{ label: string; value: string }>;
  trend: Array<{ label: string; value: string }>;
  momentum: Array<{ label: string; value: string }>;
  volatility: Array<{ label: string; value: string }>;
  structure: Array<{ label: string; value: string }>;
  candle: Array<{ label: string; value: string }>;
  other: Array<{ label: string; value: string }>;
} {
  const indicators = [...(analysis.indicators ?? [])];
  const trendStrength = calculateTrendStrength(analysis);

  const contextBase = [
    {
      label: "Direção",
      value: normalizeDisplayText(analysis.direction),
    },
    {
      label: "Validação",
      value: formatDateTime(analysis.validated_at),
    },
    {
      label: "Gatilho",
      value: normalizeDisplayText(analysis.trigger_label),
    },
    {
      label: "Resumo",
      value: normalizeDisplayText(analysis.summary),
    },
    {
      label: "Força da tendência",
      value: String(trendStrength.pct),
    },
  ].filter((item) => item.value !== "-");

  const groups = {
    context: contextBase,
    trend: [] as Array<{ label: string; value: string }>,
    momentum: [] as Array<{ label: string; value: string }>,
    volatility: [] as Array<{ label: string; value: string }>,
    structure: [] as Array<{ label: string; value: string }>,
    candle: [] as Array<{ label: string; value: string }>,
    other: [] as Array<{ label: string; value: string }>,
  };

  indicators.forEach((item) => {
    const label = item.label.trim().toLowerCase();

    if (["sessão", "preço de referência"].includes(label)) {
      groups.context.push(item);
      return;
    }

    if (
      [
        "ema 5",
        "ema 9",
        "ema 10",
        "ema 20",
        "ema 21",
        "ema 30",
        "ema 40",
        "alinhamento ema",
        "preço vs ema 20",
        "preço vs ema 40",
        "inclinação ema 9",
        "inclinação ema 20",
        "inclinação ema 21",
        "inclinação ema 40",
      ].includes(label)
    ) {
      groups.trend.push(item);
      return;
    }

    if (
      [
        "rsi 14",
        "zona rsi",
        "inclinação rsi",
        "macd",
        "signal",
        "histograma",
        "estado macd",
        "inclinação histograma macd",
      ].includes(label)
    ) {
      groups.momentum.push(item);
      return;
    }

    if (
      ["atr 14", "regime atr", "range candle", "range vs atr", "bandwidth"].includes(
        label
      )
    ) {
      groups.volatility.push(item);
      return;
    }

    if (
      [
        "bollinger superior",
        "bollinger média",
        "bollinger inferior",
        "posição do close na banda",
        "estrutura de mercado",
        "local de entrada",
        "distância ao suporte",
        "distância à resistência",
        "distância à ema 20",
        "distância à ema 40",
      ].includes(label)
    ) {
      groups.structure.push(item);
      return;
    }

    if (
      [
        "candle open",
        "candle high",
        "candle low",
        "candle close",
        "body size",
        "upper wick",
        "lower wick",
        "body ratio",
        "tipo de candle",
      ].includes(label)
    ) {
      groups.candle.push(item);
      return;
    }

    groups.other.push(item);
  });

  const snapshot: AnalysisSnapshot | null | undefined = analysis.snapshot;
  if (snapshot?.trend?.ema_20_slope != null) {
    groups.trend.push({
      label: "Inclinação EMA 20",
      value: String(snapshot.trend.ema_20_slope),
    });
  }

  if (snapshot?.trend?.ema_40_slope != null) {
    groups.trend.push({
      label: "Inclinação EMA 40",
      value: String(snapshot.trend.ema_40_slope),
    });
  }

  const macdHistogramSlope = getMomentumNumeric(snapshot, "macd_histogram_slope");
  if (macdHistogramSlope != null) {
    groups.momentum.push({
      label: "Inclinação histograma MACD",
      value: String(macdHistogramSlope),
    });
  }

  return groups;
}

export function buildTrendPanelData(
  analysis: StageTestRunTechnicalAnalysis | null
): TrendPanelData {
  const snapshot = analysis?.snapshot;
  const filters = buildStrategicCaseFilters(analysis);
  const strength = calculateTrendStrength(analysis);

  if (!snapshot) {
    return {
      directionBadge: "-",
      strengthPct: "-",
      summaryTitle: "Tendência",
      summaryText: "Sem snapshot técnico disponível para este case.",
      contextTitle: "Contexto Geral",
      contextText: "Não foi possível reconstruir o contexto técnico do momento da entrada.",
      contextMetrics: [
        { label: "Tendência", value: "-" },
        { label: "Força %", value: "-" },
        { label: "Preço atual", value: "-" },
      ],
      movingAveragesTitle: "O Mapa de Médias",
      movingAveragesText: "Sem dados de médias móveis.",
      movingAveragesMetrics: [
        { label: "EMA 20", value: "-" },
        { label: "EMA 40", value: "-" },
        { label: "Alinhamento", value: "-" },
      ],
      confirmationTitle: "Força e Confirmação",
      confirmationText: "Sem confirmação suficiente no snapshot.",
      confirmationMetrics: [
        { label: "Estrutura", value: "-" },
        { label: "Sinal", value: "-" },
        { label: "Local", value: "-" },
      ],
      momentumTitle: "Momentum e Exaustão",
      momentumText: "Sem leitura de momentum disponível.",
      momentumMetrics: [
        { label: "RSI", value: "-" },
        { label: "MACD", value: "-" },
        { label: "Leitura", value: "-" },
      ],
    };
  }

  const direction = (analysis?.direction ?? "").trim().toLowerCase();
  const isBuy = direction === "buy" || direction === "long";
  const isSell = direction === "sell" || direction === "short";

  const referencePrice =
    toNumeric(snapshot.trigger_context?.reference_price) ??
    getCandleNumeric(snapshot, "close", "candle_close") ??
    getCandleNumeric(snapshot, "open", "candle_open");

  const ema20 = toNumeric(snapshot.trend?.ema_20);
  const ema40 = toNumeric(snapshot.trend?.ema_40);
  const rsiValue = toNumeric(snapshot.momentum?.rsi_14);
  const macdValue = getMomentumNumeric(snapshot, "macd_line", "macd");
  const signalValue = getMomentumNumeric(snapshot, "macd_signal", "signal");
  const histogramValue = getMomentumNumeric(snapshot, "macd_histogram", "histogram");

  const structureText =
    filters.marketStructure !== "-"
      ? `Estrutura ${filters.marketStructure.toLowerCase()}`
      : "Estrutura não disponível";

  const contextText =
    strength.pct >= 80
      ? "O contexto estava alinhado e com forte favorecimento da direção da entrada."
      : strength.pct >= 60
        ? "O contexto era favorável, embora sem máxima convicção estrutural."
        : strength.pct >= 40
          ? "O contexto era apenas neutro a moderado para a entrada."
          : "O contexto da entrada era fraco e pouco alinhado com a tendência.";

  const movingAveragesText =
    filters.emaAlignment !== "-"
      ? `As médias indicavam viés ${filters.emaAlignment.toLowerCase()} no momento do gatilho.`
      : "As médias não devolvem leitura suficiente.";

  const confirmationText =
    filters.signalQuality !== "-"
      ? `Leitura de confirmação classificada como ${filters.signalQuality.toLowerCase()}.`
      : "Sem leitura consolidada de confirmação.";

  const momentumText =
    filters.rsiZone !== "-" || filters.macdState !== "-"
      ? `RSI em ${filters.rsiZone.toLowerCase()} e MACD em ${filters.macdState.toLowerCase()}.`
      : "Sem leitura consolidada de momentum.";

  return {
    directionBadge: strength.direction,
    strengthPct: formatCompactPercent(strength.pct),
    summaryTitle: "Tendência",
    summaryText: `${strength.label} | ${contextText}`,
    contextTitle: "Contexto Geral",
    contextText,
    contextMetrics: [
      { label: "Tendência", value: strength.direction },
      { label: "Força %", value: formatCompactPercent(strength.pct) },
      {
        label: "Preço atual",
        value: referencePrice != null ? formatAnalysisNumber(referencePrice, 5) : "-",
      },
    ],
    movingAveragesTitle: "O Mapa de Médias",
    movingAveragesText,
    movingAveragesMetrics: [
      {
        label: "EMA 20",
        value: ema20 != null ? formatAnalysisNumber(ema20, 5) : "-",
      },
      {
        label: "EMA 40",
        value: ema40 != null ? formatAnalysisNumber(ema40, 5) : "-",
      },
      { label: "Alinhamento", value: filters.emaAlignment },
      { label: "Preço vs EMA 20", value: filters.priceVsEma20 },
      { label: "Preço vs EMA 40", value: filters.priceVsEma40 },
    ],
    confirmationTitle: "Força e Confirmação",
    confirmationText,
    confirmationMetrics: [
      { label: "Estrutura", value: filters.marketStructure },
      { label: "Viés", value: filters.trendBias },
      { label: "Local", value: filters.entryLocation },
      { label: "Qualidade", value: filters.signalQuality },
      { label: "EMA 20 slope", value: filters.ema20Slope },
      { label: "EMA 40 slope", value: filters.ema40Slope },
    ],
    momentumTitle: "Momentum e Exaustão",
    momentumText,
    momentumMetrics: [
      {
        label: "RSI",
        value: rsiValue != null ? formatAnalysisNumber(rsiValue, 2) : "-",
      },
      { label: "Zona RSI", value: filters.rsiZone },
      {
        label: "MACD",
        value: macdValue != null ? formatAnalysisNumber(macdValue, 6) : "-",
      },
      {
        label: "Sinal",
        value: signalValue != null ? formatAnalysisNumber(signalValue, 6) : "-",
      },
      {
        label: "Histograma",
        value:
          histogramValue != null ? formatAnalysisNumber(histogramValue, 6) : "-",
      },
      { label: "Estado MACD", value: filters.macdState },
      { label: "Sessão", value: filters.session },
      {
        label: "Direção da entrada",
        value: isBuy ? "Compradora" : isSell ? "Vendedora" : "-",
      },
      { label: "Estrutura base", value: structureText },
    ],
  };
}