// C:\TraderBotWeb\web\src\components\runs\run-history\analysis.ts

import type {
  AnalysisSnapshot,
  StageTestRunTechnicalAnalysis,
} from "../../../types/trading";
import type {
  EmaDirectionSummary,
  StrategicCaseFilters,
  TrendPanelData,
  TrendStrengthResult,
} from "./types";
import {
  clamp,
  formatAnalysisNumber,
  formatCompactPercent,
  formatDateTime,
  formatDirectionalEmaValue,
} from "./formatters";
import {
  findIndicatorNumeric,
  getCandleNumeric,
  getMomentumNumeric,
  toNumeric,
} from "./data";
import { normalizeDisplayText, normalizeRuleLabel } from "./normalizers";
import { getArrowVisual, getRuleVisualState } from "./status";

type AnalysisMetadataRecord = Record<string, unknown>;

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object") {
    return value as Record<string, unknown>;
  }

  return {};
}

function getSnapshotTrend(
  snapshot: AnalysisSnapshot | null | undefined
): Record<string, unknown> {
  const record = asRecord(snapshot);
  return asRecord(record.trend);
}

function getTrendNumeric(
  snapshot: AnalysisSnapshot | null | undefined,
  ...keys: string[]
): number | null {
  const trend = getSnapshotTrend(snapshot);

  for (const key of keys) {
    const value = trend[key];
    const numeric = toNumeric(
      typeof value === "string" || typeof value === "number" ? value : null
    );
    if (numeric != null) {
      return numeric;
    }
  }

  return null;
}

function resolveTradeBias(
  analysis: StageTestRunTechnicalAnalysis | null,
  signalLabel: string,
  metadata?: AnalysisMetadataRecord | null
): "buy" | "sell" | null {
  const normalizedSignal = signalLabel.trim().toLowerCase();

  if (["compradora", "buy", "long"].includes(normalizedSignal)) {
    return "buy";
  }

  if (["vendedora", "sell", "short"].includes(normalizedSignal)) {
    return "sell";
  }

  const metadataBiasCandidates = [
    metadata?.trade_bias,
    metadata?.direction,
    metadata?.side,
  ];

  for (const candidate of metadataBiasCandidates) {
    const raw = String(candidate ?? "")
      .trim()
      .toLowerCase();

    if (["buy", "long", "compradora"].includes(raw)) {
      return "buy";
    }

    if (["sell", "short", "vendedora"].includes(raw)) {
      return "sell";
    }
  }

  const normalizedAnalysisDirection = (analysis?.direction ?? "")
    .trim()
    .toLowerCase();

  if (["buy", "long"].includes(normalizedAnalysisDirection)) {
    return "buy";
  }

  if (["sell", "short"].includes(normalizedAnalysisDirection)) {
    return "sell";
  }

  return null;
}

function getMetadataNumeric(
  metadata: AnalysisMetadataRecord | null | undefined,
  ...keys: string[]
): number | null {
  if (!metadata) return null;

  for (const key of keys) {
    const value = metadata[key];
    const numeric = toNumeric(
      typeof value === "string" || typeof value === "number" ? value : null
    );
    if (numeric != null) {
      return numeric;
    }
  }

  return null;
}

function getSlopeDirectionFromText(
  value: unknown
): "up" | "down" | "flat" | null {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  if (!normalized) return null;
  if (["up", "bullish", "rising"].includes(normalized)) return "up";
  if (["down", "bearish", "falling"].includes(normalized)) return "down";
  if (["flat", "neutral", "sideways"].includes(normalized)) return "flat";

  return null;
}

function buildCrossConfirmationFromMetadata(
  metadata: AnalysisMetadataRecord | null | undefined,
  tradeBias: "buy" | "sell" | null
): boolean | null {
  const previousShort = getMetadataNumeric(metadata, "previous_short_ema");
  const previousLong = getMetadataNumeric(metadata, "previous_long_ema");
  const currentShort = getMetadataNumeric(metadata, "current_short_ema");
  const currentLong = getMetadataNumeric(metadata, "current_long_ema");

  if (
    previousShort == null ||
    previousLong == null ||
    currentShort == null ||
    currentLong == null
  ) {
    return null;
  }

  if (tradeBias === "buy") {
    return previousShort <= previousLong && currentShort > currentLong;
  }

  if (tradeBias === "sell") {
    return previousShort >= previousLong && currentShort < currentLong;
  }

  return null;
}

export function buildEmaDirectionSummary(
  analysis: StageTestRunTechnicalAnalysis | null,
  signalLabel: string,
  metadata?: AnalysisMetadataRecord | null
): EmaDirectionSummary {
  const snapshot = analysis?.snapshot ?? null;
  const tradeBias = resolveTradeBias(analysis, signalLabel, metadata ?? null);

  const shortValue =
    getMetadataNumeric(metadata ?? null, "current_short_ema") ??
    findIndicatorNumeric(analysis, [
      "EMA curta",
      "EMA short",
      "Short EMA",
      "EMA 9",
      "M9",
      "ema9",
      "ema_9",
      "ema 09",
      "m 9",
    ]) ??
    getTrendNumeric(snapshot, "ema_9", "ema9", "m9", "ema_09") ??
    null;

  const longValue =
    getMetadataNumeric(metadata ?? null, "current_long_ema") ??
    findIndicatorNumeric(analysis, [
      "EMA longa",
      "EMA long",
      "Long EMA",
      "EMA 21",
      "M21",
      "ema21",
      "ema_21",
      "m 21",
    ]) ??
    getTrendNumeric(snapshot, "ema_21", "ema21", "m21") ??
    null;

  const shortSlopeText =
    getSlopeDirectionFromText(metadata?.current_short_ema_slope) ??
    getSlopeDirectionFromText(
      getSnapshotTrend(snapshot).ema_9_slope ??
        getSnapshotTrend(snapshot).ema9_slope ??
        getSnapshotTrend(snapshot).slope_ema_9 ??
        getSnapshotTrend(snapshot).slope_m9
    ) ??
    null;

  const longSlopeText =
    getSlopeDirectionFromText(metadata?.current_long_ema_slope) ??
    getSlopeDirectionFromText(
      getSnapshotTrend(snapshot).ema_21_slope ??
        getSnapshotTrend(snapshot).ema21_slope ??
        getSnapshotTrend(snapshot).slope_ema_21 ??
        getSnapshotTrend(snapshot).slope_m21
    ) ??
    null;

  const shortSlopeNumeric =
    findIndicatorNumeric(analysis, [
      "Inclinação EMA curta",
      "Short EMA slope",
      "Inclinação EMA 9",
      "Slope EMA 9",
      "EMA 9 slope",
      "inclinação ema9",
    ]) ??
    getTrendNumeric(
      snapshot,
      "ema_9_slope",
      "ema9_slope",
      "slope_ema_9",
      "slope_m9"
    ) ??
    null;

  const longSlopeNumeric =
    findIndicatorNumeric(analysis, [
      "Inclinação EMA longa",
      "Long EMA slope",
      "Inclinação EMA 21",
      "Slope EMA 21",
      "EMA 21 slope",
      "inclinação ema21",
    ]) ??
    getTrendNumeric(
      snapshot,
      "ema_21_slope",
      "ema21_slope",
      "slope_ema_21",
      "slope_m21"
    ) ??
    null;

  let shortIsUp =
    shortSlopeText != null
      ? shortSlopeText !== "down"
      : shortSlopeNumeric != null
        ? shortSlopeNumeric >= 0
        : tradeBias === "buy"
          ? true
          : tradeBias === "sell"
            ? false
            : true;

  let longIsUp =
    longSlopeText != null
      ? longSlopeText !== "down"
      : longSlopeNumeric != null
        ? longSlopeNumeric >= 0
        : tradeBias === "buy"
          ? true
          : tradeBias === "sell"
            ? false
            : true;

  let crossConfirmed =
    buildCrossConfirmationFromMetadata(metadata ?? null, tradeBias);

  if (crossConfirmed == null && shortValue != null && longValue != null) {
    if (tradeBias === "buy") {
      crossConfirmed = shortValue > longValue;
    } else if (tradeBias === "sell") {
      crossConfirmed = shortValue < longValue;
    } else if (shortValue !== longValue) {
      crossConfirmed = true;
    }
  }

  // Ajuste visual pedido:
  // - compradora + cruzamento confirmado => curta verde / longa vermelha
  // - vendedora + cruzamento confirmado => curta vermelha / longa verde
  if (crossConfirmed === true) {
    if (tradeBias === "buy") {
      shortIsUp = true;
      longIsUp = false;
    } else if (tradeBias === "sell") {
      shortIsUp = false;
      longIsUp = true;
    }
  }

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
    m9Value: formatDirectionalEmaValue(shortValue, 6),
    m21Value: formatDirectionalEmaValue(longValue, 6),
    m9Arrow: getArrowVisual(shortIsUp),
    m21Arrow: getArrowVisual(longIsUp),
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
    if (
      macdState === "bearish_cross" ||
      macdState === "bearish_below_signal"
    ) {
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

  if (
    (direction === "sell" || direction === "short") &&
    alignment === "bullish"
  ) {
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
      contextText:
        "Não foi possível reconstruir o contexto técnico do momento da entrada.",
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
  const histogramValue = getMomentumNumeric(
    snapshot,
    "macd_histogram",
    "histogram"
  );

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
        value:
          referencePrice != null
            ? formatAnalysisNumber(referencePrice, 5)
            : "-",
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
          histogramValue != null
            ? formatAnalysisNumber(histogramValue, 6)
            : "-",
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