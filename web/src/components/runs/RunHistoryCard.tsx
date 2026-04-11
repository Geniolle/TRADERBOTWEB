import { useMemo, useState } from "react";
import type {
  AnalysisSnapshot,
  StageTestRunCaseItem,
  StageTestRunRuleItem,
  StageTestRunTechnicalAnalysis,
  StageTestSummaryItem,
} from "../../types/trading";
import type { ExecutionLogStatus } from "../../hooks/useStageTests";

type RunHistoryCardProps = {
  sidebarCardStyle: React.CSSProperties;
  runSearch: string;
  setRunSearch: (value: string) => void;
  loadingRuns: boolean;
  runsError: string;
  actionError: string;
  filteredStageTests: StageTestSummaryItem[];
  selectedRunId: string;
  onClearRuns: () => Promise<void>;
  isClearingRuns: boolean;
  isCreatingRuns: boolean;
  lastExecutionLog: string;
  lastExecutionStatus: ExecutionLogStatus;
  runningStrategyKey: string;
  selectedSymbol: string;
  selectedTimeframe: string;
  onRunStageTest: (strategyKey: string) => Promise<void>;
};

type CaseFilter = "all" | "hit" | "fail" | "timeout";
type RuleVisualState = "confirmed" | "contrary" | "inactive" | "contextual";

type TrendStrengthResult = {
  pct: number;
  direction: string;
  label: string;
  summary: string;
};

type StrategicCaseFilters = {
  session: string;
  marketStructure: string;
  emaAlignment: string;
  priceVsEma20: string;
  priceVsEma40: string;
  ema20Slope: string;
  ema40Slope: string;
  entryLocation: string;
  rsiZone: string;
  rsiSlope: string;
  macdState: string;
  trendBias: string;
  signalQuality: string;
  trendStrengthPct: string;
  trendDirection: string;
  trendLabel: string;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "0,00%";
  return `${value.toFixed(2).replace(".", ",")}%`;
}

function formatCompactPercent(value: number): string {
  if (!Number.isFinite(value)) return "-";
  return `${value.toFixed(0)}%`;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleString("pt-PT");
}

function formatValue(value: string | number | null | undefined): string {
  if (value == null) return "-";
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  const text = String(value).trim();
  return text || "-";
}

function formatAnalysisNumber(
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

function formatIndicatorValueByLabel(label: string, value: string): string {
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
      "ema 10",
      "ema 20",
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

function normalizeOutcome(value: string | null | undefined): string {
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

function normalizeDisplayText(value: string | null | undefined): string {
  const raw = (value ?? "").trim();
  if (!raw) return "-";

  const normalized = raw.toLowerCase();

  const map: Record<string, string> = {
    buy: "Compra",
    sell: "Venda",
    long: "Compra",
    short: "Venda",
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
    range: "Lateral",
    trending: "Tendencial",
    bullish_cross: "Bullish cross",
    bearish_cross: "Bearish cross",
    up: "Ascendente",
    down: "Descendente",
    flat: "Lateral",
    mid_range: "Meio do range",
    balanced: "Equilibrado",
    normal: "Normal",
    high: "Alto",
    low: "Baixo",
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

function normalizeRuleLabel(label: string): string {
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

function metricPill(
  label: string,
  value: string | number,
  accentColor: string,
  backgroundColor: string
) {
  return (
    <div
      style={{
        border: `1px solid ${accentColor}`,
        borderRadius: 10,
        padding: "8px 10px",
        background: backgroundColor,
        display: "grid",
        gap: 4,
        minWidth: 0,
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: "#64748b",
          textTransform: "uppercase",
          letterSpacing: 0.3,
          lineHeight: 1.1,
        }}
      >
        {label}
      </span>

      <span
        style={{
          fontSize: 16,
          fontWeight: 700,
          color: "#0f172a",
          lineHeight: 1.1,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function detailRow(label: string, value: string) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "120px minmax(0, 1fr)",
        gap: 10,
        alignItems: "start",
      }}
    >
      <span style={{ color: "#64748b", fontSize: 12 }}>{label}</span>
      <strong
        style={{
          color: "#0f172a",
          fontSize: 12,
          fontWeight: 600,
          wordBreak: "break-word",
        }}
      >
        {value}
      </strong>
    </div>
  );
}

function compareStageTestsByHitRate(
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

function getStatusDotColor(status: ExecutionLogStatus): string {
  if (status === "running") return "#2563eb";
  if (status === "success") return "#16a34a";
  if (status === "error") return "#dc2626";
  if (status === "waiting") return "#d97706";
  return "#64748b";
}

function getStatusBackground(status: ExecutionLogStatus): string {
  if (status === "running") return "#eff6ff";
  if (status === "success") return "#f0fdf4";
  if (status === "error") return "#fef2f2";
  if (status === "waiting") return "#fffbeb";
  return "#f8fafc";
}

function getStatusBorder(status: ExecutionLogStatus): string {
  if (status === "running") return "#bfdbfe";
  if (status === "success") return "#bbf7d0";
  if (status === "error") return "#fecaca";
  if (status === "waiting") return "#fde68a";
  return "#cbd5e1";
}

function getAnalysisStatusBadge(status: string | null | undefined) {
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

function getOutcomeBadge(outcome: string | null | undefined) {
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

function getRuleVisualState(
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

function getRuleStateStyles(state: RuleVisualState) {
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

function getConflictLevel(conflicts: number): string {
  if (conflicts <= 0) return "Baixo";
  if (conflicts === 1) return "Moderado";
  return "Alto";
}

function toNumeric(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;

  const normalized = String(value).trim().replace(",", ".");
  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function calculateTrendStrength(
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
    if (macdState === "bullish_cross") score += 5;

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
    if (macdState === "bearish_cross") score += 5;

    if (marketStructure === "range") score -= 20;
    if (priceVs40 === "above") score -= 15;
    if (alignment === "bullish") score -= 20;
  } else {
    if (marketStructure === "trending") score += 20;
    if (alignment === "bullish" || alignment === "bearish") score += 20;
  }

  const pct = clamp(score, 0, 100);

  let label = "Fraca";
  if (pct >= 80) label = "Forte";
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

function getTrendBiasLabel(
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

  if (
    (direction === "buy" || direction === "long") &&
    alignment === "bearish"
  ) {
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

function getSignalQualityLabel(
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
  if (macdState === "bullish_cross" || macdState === "bearish_cross") score += 1;

  if (structure === "range") score -= 2;
  if (entryLocation === "mid_range") score -= 1;
  if (rsiZone === "neutral") score -= 1;

  if (score >= 4) return "Forte";
  if (score >= 2) return "Médio";
  return "Fraco";
}

function buildStrategicCaseFilters(
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

function scoreTechnicalAnalysis(
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

  if ((direction === "buy" || direction === "long") && macdState === "bullish_cross") {
    momentum += 2;
  }

  if ((direction === "sell" || direction === "short") && macdState === "bearish_cross") {
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

function buildAnalysisNarrative(
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
      `A percentagem de tendência no gatilho foi baixa para um EMA Cross (${formatCompactPercent(
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

function groupIndicators(
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
        "ema 10",
        "ema 20",
        "ema 30",
        "ema 40",
        "alinhamento ema",
        "preço vs ema 20",
        "preço vs ema 40",
        "inclinação ema 20",
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
  if (snapshot?.momentum?.macd_histogram_slope != null) {
    groups.momentum.push({
      label: "Inclinação histograma MACD",
      value: String(snapshot.momentum.macd_histogram_slope),
    });
  }

  return groups;
}

function AnalysisSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        padding: 12,
        background: "#ffffff",
        display: "grid",
        gap: 10,
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: "#0f172a",
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function AnalysisMetricCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 10,
        padding: "10px 12px",
        background: "#ffffff",
        display: "grid",
        gap: 4,
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: "#64748b",
          textTransform: "uppercase",
          letterSpacing: 0.3,
          lineHeight: 1.2,
        }}
      >
        {label}
      </span>

      <strong
        style={{
          fontSize: 13,
          color: "#0f172a",
          lineHeight: 1.3,
          wordBreak: "break-word",
        }}
      >
        {value}
      </strong>
    </div>
  );
}

function ScoreBox({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 10,
        padding: 12,
        background: "#ffffff",
        display: "grid",
        gap: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 8,
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: 12, color: "#475569", fontWeight: 600 }}>
          {label}
        </span>
        <strong style={{ fontSize: 13, color: "#0f172a" }}>
          {value.toFixed(1)}/10
        </strong>
      </div>

      <div
        style={{
          height: 8,
          borderRadius: 999,
          background: "#e2e8f0",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${Math.max(0, Math.min(100, value * 10))}%`,
            height: "100%",
            background: "#0f172a",
          }}
        />
      </div>
    </div>
  );
}

function RulePill({
  label,
  state,
  value,
}: {
  label: string;
  state: RuleVisualState;
  value?: string;
}) {
  const styles = getRuleStateStyles(state);

  return (
    <div
      style={{
        border: `1px solid ${styles.border}`,
        borderRadius: 10,
        padding: "10px 12px",
        background: styles.background,
        display: "grid",
        gap: 4,
      }}
    >
      <strong
        style={{
          fontSize: 12,
          color: styles.color,
          lineHeight: 1.35,
          wordBreak: "break-word",
        }}
      >
        {label}
      </strong>

      <span
        style={{
          fontSize: 11,
          color: styles.color,
          fontWeight: 700,
        }}
      >
        {styles.label}
      </span>

      {value ? (
        <span
          style={{
            fontSize: 11,
            color: styles.color,
            opacity: 0.9,
            wordBreak: "break-word",
          }}
        >
          {value}
        </span>
      ) : null}
    </div>
  );
}

function CaseAnalysisBlock({
  analysis,
  runStatus,
  caseId,
  caseNumber,
}: {
  analysis: StageTestRunTechnicalAnalysis | null;
  runStatus: string | null | undefined;
  caseId: string;
  caseNumber: number | string;
}) {
  const statusBadge = getAnalysisStatusBadge(runStatus);

  if (!analysis) {
    return (
      <div
        style={{
          marginTop: 12,
          border: "1px solid #dbe2ea",
          borderRadius: 12,
          padding: 12,
          background: "#f8fafc",
          display: "grid",
          gap: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "grid", gap: 6 }}>
            <strong style={{ fontSize: 14, color: "#0f172a" }}>
              Análise técnica do case #{caseNumber}
            </strong>

            <span
              style={{
                fontSize: 12,
                color: "#475569",
                lineHeight: 1.45,
              }}
            >
              Snapshot técnico do momento exato do gatilho de confirmação.
            </span>

            <span
              style={{
                fontSize: 12,
                color: "#334155",
                lineHeight: 1.45,
                wordBreak: "break-word",
              }}
            >
              <strong>Case ID:</strong> {caseId}
            </span>
          </div>

          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: "4px 8px",
              borderRadius: 999,
              background: statusBadge.background,
              color: statusBadge.color,
              border: `1px solid ${statusBadge.border}`,
              whiteSpace: "nowrap",
            }}
          >
            {statusBadge.label}
          </span>
        </div>

        <div
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: 10,
            padding: 12,
            background: "#ffffff",
            fontSize: 12,
            color: "#64748b",
            lineHeight: 1.5,
          }}
        >
          Este case não devolveu análise técnica individual no backend.
        </div>
      </div>
    );
  }

  const rules = analysis.rules ?? [];
  const grouped = groupIndicators(analysis);
  const scores = scoreTechnicalAnalysis(analysis);
  const narrative = buildAnalysisNarrative(analysis);
  const filters = buildStrategicCaseFilters(analysis);

  const conflictsCount = narrative.conflicts.length;

  const confirmedRules = rules.filter(
    (rule) =>
      rule.passed === true &&
      getRuleVisualState(rule, analysis.direction) === "confirmed"
  );

  const contraryRules = rules.filter(
    (rule) =>
      rule.passed === true &&
      getRuleVisualState(rule, analysis.direction) === "contrary"
  );

  const contextualRules = rules.filter(
    (rule) =>
      rule.passed == null ||
      getRuleVisualState(rule, analysis.direction) === "contextual"
  );

  const inactiveRules = rules.filter((rule) => rule.passed === false);

  const qualityLabel =
    scores.overall >= 8 ? "Alta" : scores.overall >= 6 ? "Média" : "Baixa";

  const renderIndicatorGroup = (
    groupTitle: string,
    items: Array<{ label: string; value: string }>
  ) => {
    if (items.length === 0) return null;

    return (
      <AnalysisSection title={groupTitle}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 8,
          }}
        >
          {items.map((indicator, index) => (
            <AnalysisMetricCard
              key={`${caseId}-${groupTitle}-${indicator.label}-${index}`}
              label={indicator.label}
              value={formatIndicatorValueByLabel(indicator.label, indicator.value)}
            />
          ))}
        </div>
      </AnalysisSection>
    );
  };

  return (
    <div
      style={{
        marginTop: 12,
        border: "1px solid #dbe2ea",
        borderRadius: 12,
        padding: 12,
        background: "#f8fafc",
        display: "grid",
        gap: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "grid", gap: 6 }}>
          <strong style={{ fontSize: 14, color: "#0f172a" }}>
            Análise técnica do case #{caseNumber}
          </strong>

          <span
            style={{
              fontSize: 12,
              color: "#475569",
              lineHeight: 1.45,
            }}
          >
            Snapshot técnico do momento exato do gatilho de confirmação.
          </span>

          <span
            style={{
              fontSize: 12,
              color: "#334155",
              lineHeight: 1.45,
              wordBreak: "break-word",
            }}
          >
            <strong>Case ID:</strong> {caseId}
          </span>
        </div>

        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            padding: "4px 8px",
            borderRadius: 999,
            background: statusBadge.background,
            color: statusBadge.color,
            border: `1px solid ${statusBadge.border}`,
            whiteSpace: "nowrap",
          }}
        >
          {statusBadge.label}
        </span>
      </div>

      <AnalysisSection title="Tendência no momento do gatilho">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 8,
          }}
        >
          <AnalysisMetricCard
            label="Força da tendência"
            value={filters.trendStrengthPct}
          />
          <AnalysisMetricCard
            label="Direção dominante"
            value={filters.trendDirection}
          />
          <AnalysisMetricCard
            label="Leitura"
            value={filters.trendLabel}
          />
          <AnalysisMetricCard
            label="Alinhamento EMA"
            value={filters.emaAlignment}
          />
          <AnalysisMetricCard
            label="Preço vs EMA 20"
            value={filters.priceVsEma20}
          />
          <AnalysisMetricCard
            label="Preço vs EMA 40"
            value={filters.priceVsEma40}
          />
          <AnalysisMetricCard
            label="Inclinação EMA 20"
            value={filters.ema20Slope}
          />
          <AnalysisMetricCard
            label="Inclinação EMA 40"
            value={filters.ema40Slope}
          />
          <AnalysisMetricCard
            label="Estrutura do mercado"
            value={filters.marketStructure}
          />
          <AnalysisMetricCard
            label="Viés"
            value={filters.trendBias}
          />
        </div>
      </AnalysisSection>

      <AnalysisSection title="Filtros estratégicos do case">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 8,
          }}
        >
          <AnalysisMetricCard label="Sessão" value={filters.session} />
          <AnalysisMetricCard
            label="Local da entrada"
            value={filters.entryLocation}
          />
          <AnalysisMetricCard label="Zona RSI" value={filters.rsiZone} />
          <AnalysisMetricCard
            label="Inclinação RSI"
            value={filters.rsiSlope}
          />
          <AnalysisMetricCard label="Estado MACD" value={filters.macdState} />
          <AnalysisMetricCard
            label="Qualidade do sinal"
            value={filters.signalQuality}
          />
        </div>
      </AnalysisSection>

      <AnalysisSection title="Resumo executivo do case">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 8,
          }}
        >
          <AnalysisMetricCard
            label="Gatilho"
            value={normalizeDisplayText(analysis.trigger_label)}
          />
          <AnalysisMetricCard
            label="Estrutura"
            value={normalizeDisplayText(analysis.summary)}
          />
          <AnalysisMetricCard
            label="Qualidade do setup"
            value={qualityLabel}
          />
          <AnalysisMetricCard
            label="Nível de conflito"
            value={getConflictLevel(conflictsCount)}
          />
        </div>
      </AnalysisSection>

      <AnalysisSection title="Diagnóstico do case">
        <div style={{ display: "grid", gap: 12 }}>
          <div
            style={{
              fontSize: 13,
              color: "#334155",
              lineHeight: 1.6,
            }}
          >
            {narrative.executiveSummary}
          </div>

          <div
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              padding: 12,
              background: "#ffffff",
              fontSize: 12,
              lineHeight: 1.65,
              color: "#334155",
            }}
          >
            O objetivo deste bloco é facilitar a comparação entre fails e hits. A percentagem da tendência deve ajudar a descobrir filtros como “abortar gatilho quando a força da tendência estiver abaixo de 60%”.
          </div>
        </div>
      </AnalysisSection>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 8,
        }}
      >
        <AnalysisSection title="Fatores a favor">
          {narrative.positives.length === 0 ? (
            <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.45 }}>
              Nenhum fator positivo detalhado foi identificado a partir do snapshot.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {narrative.positives.map((item, index) => (
                <div
                  key={`positive-${caseId}-${index}`}
                  style={{
                    border: "1px solid #86efac",
                    borderRadius: 10,
                    padding: "10px 12px",
                    background: "#ecfdf5",
                    color: "#166534",
                    fontSize: 12,
                    lineHeight: 1.5,
                    fontWeight: 600,
                  }}
                >
                  {item}
                </div>
              ))}
            </div>
          )}
        </AnalysisSection>

        <AnalysisSection title="Fatores contra">
          {narrative.negatives.length === 0 ? (
            <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.45 }}>
              Nenhum fator negativo detalhado foi identificado a partir do snapshot.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {narrative.negatives.map((item, index) => (
                <div
                  key={`negative-${caseId}-${index}`}
                  style={{
                    border: "1px solid #fca5a5",
                    borderRadius: 10,
                    padding: "10px 12px",
                    background: "#fef2f2",
                    color: "#991b1b",
                    fontSize: 12,
                    lineHeight: 1.5,
                    fontWeight: 600,
                  }}
                >
                  {item}
                </div>
              ))}
            </div>
          )}
        </AnalysisSection>
      </div>

      {narrative.conflicts.length > 0 && (
        <AnalysisSection title="Conflitos detectados">
          <div style={{ display: "grid", gap: 8 }}>
            {narrative.conflicts.map((item, index) => (
              <div
                key={`conflict-${caseId}-${index}`}
                style={{
                  border: "1px solid #fdba74",
                  borderRadius: 10,
                  padding: "10px 12px",
                  background: "#fff7ed",
                  color: "#9a3412",
                  fontSize: 12,
                  lineHeight: 1.5,
                  fontWeight: 600,
                }}
              >
                {item}
              </div>
            ))}
          </div>
        </AnalysisSection>
      )}

      <AnalysisSection title="Score do case">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 8,
          }}
        >
          <ScoreBox label="Geral" value={scores.overall} />
          <ScoreBox label="Tendência" value={scores.trend} />
          <ScoreBox label="Momentum" value={scores.momentum} />
          <ScoreBox label="Estrutura" value={scores.structure} />
          <ScoreBox label="Entrada" value={scores.entry} />
          <ScoreBox label="Risco contextual" value={scores.risk} />
        </div>
      </AnalysisSection>

      {renderIndicatorGroup("Contexto", grouped.context)}
      {renderIndicatorGroup("Tendência", grouped.trend)}
      {renderIndicatorGroup("Momentum", grouped.momentum)}
      {renderIndicatorGroup("Volatilidade", grouped.volatility)}
      {renderIndicatorGroup("Estrutura e localização", grouped.structure)}
      {renderIndicatorGroup("Candle", grouped.candle)}
      {renderIndicatorGroup("Outros indicadores", grouped.other)}

      <AnalysisSection title="Regras de validação do case">
        {rules.length === 0 ? (
          <div
            style={{
              fontSize: 12,
              color: "#64748b",
              lineHeight: 1.45,
            }}
          >
            Nenhuma regra detalhada foi devolvida pelo backend para este case.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 8,
            }}
          >
            {confirmedRules.map((rule, index) => (
              <RulePill
                key={`confirmed-${caseId}-${rule.label}-${index}`}
                label={normalizeRuleLabel(rule.label)}
                state="confirmed"
                value={rule.value}
              />
            ))}

            {contraryRules.map((rule, index) => (
              <RulePill
                key={`contrary-${caseId}-${rule.label}-${index}`}
                label={normalizeRuleLabel(rule.label)}
                state="contrary"
                value={rule.value}
              />
            ))}

            {contextualRules.map((rule, index) => (
              <RulePill
                key={`contextual-${caseId}-${rule.label}-${index}`}
                label={normalizeRuleLabel(rule.label)}
                state="contextual"
                value={rule.value}
              />
            ))}

            {inactiveRules.map((rule, index) => (
              <RulePill
                key={`inactive-${caseId}-${rule.label}-${index}`}
                label={normalizeRuleLabel(rule.label)}
                state="inactive"
                value={rule.value}
              />
            ))}
          </div>
        )}
      </AnalysisSection>
    </div>
  );
}

function CasesFilterButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        height: 32,
        padding: "0 12px",
        borderRadius: 999,
        border: active ? "1px solid #2563eb" : "1px solid #cbd5e1",
        background: active ? "#eff6ff" : "#ffffff",
        color: active ? "#1d4ed8" : "#334155",
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function CasesSection({
  strategyKey,
  cases,
  expandedCaseAnalysisById,
  onToggleCaseAnalysis,
}: {
  strategyKey: string;
  cases: StageTestRunCaseItem[];
  expandedCaseAnalysisById: Record<string, boolean>;
  onToggleCaseAnalysis: (caseKey: string) => void;
}) {
  const [filter, setFilter] = useState<CaseFilter>("all");

  const filteredCases = useMemo(() => {
    if (filter === "all") return cases;
    return cases.filter((item) => normalizeOutcome(item.outcome) === filter);
  }, [cases, filter]);

  const totalHits = useMemo(
    () => cases.filter((item) => normalizeOutcome(item.outcome) === "hit").length,
    [cases]
  );
  const totalFails = useMemo(
    () => cases.filter((item) => normalizeOutcome(item.outcome) === "fail").length,
    [cases]
  );
  const totalTimeouts = useMemo(
    () => cases.filter((item) => normalizeOutcome(item.outcome) === "timeout").length,
    [cases]
  );

  return (
    <div
      style={{
        marginTop: 12,
        border: "1px solid #dbe2ea",
        borderRadius: 12,
        padding: 12,
        background: "#f8fafc",
        display: "grid",
        gap: 12,
      }}
    >
      <div
        style={{
          display: "grid",
          gap: 8,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "grid", gap: 6 }}>
            <strong style={{ fontSize: 14, color: "#0f172a" }}>
              Casos do último run
            </strong>

            <span
              style={{
                fontSize: 12,
                color: "#475569",
                lineHeight: 1.45,
              }}
            >
              O foco aqui é encontrar padrões recorrentes nos fails para afinar a regra da estratégia.
            </span>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: "4px 8px",
                borderRadius: 999,
                background: "#dcfce7",
                color: "#166534",
                border: "1px solid #86efac",
              }}
            >
              Hits {totalHits}
            </span>

            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: "4px 8px",
                borderRadius: 999,
                background: "#fee2e2",
                color: "#991b1b",
                border: "1px solid #fca5a5",
              }}
            >
              Fails {totalFails}
            </span>

            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: "4px 8px",
                borderRadius: 999,
                background: "#fffbeb",
                color: "#92400e",
                border: "1px solid #fcd34d",
              }}
            >
              Timeouts {totalTimeouts}
            </span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <CasesFilterButton
            active={filter === "all"}
            label={`Todos (${cases.length})`}
            onClick={() => setFilter("all")}
          />
          <CasesFilterButton
            active={filter === "hit"}
            label={`Hits (${totalHits})`}
            onClick={() => setFilter("hit")}
          />
          <CasesFilterButton
            active={filter === "fail"}
            label={`Fails (${totalFails})`}
            onClick={() => setFilter("fail")}
          />
          <CasesFilterButton
            active={filter === "timeout"}
            label={`Timeouts (${totalTimeouts})`}
            onClick={() => setFilter("timeout")}
          />
        </div>
      </div>

      {filteredCases.length === 0 ? (
        <div
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: 10,
            padding: 12,
            background: "#ffffff",
            fontSize: 12,
            color: "#64748b",
          }}
        >
          Nenhum caso encontrado para este filtro.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {filteredCases.map((item, index) => {
            const caseId = item.id ?? `case-${index + 1}`;
            const caseNumber = item.case_number ?? index + 1;
            const caseKey = `${strategyKey}::${caseId}`;
            const badge = getOutcomeBadge(item.outcome);
            const isExpanded = Boolean(expandedCaseAnalysisById[caseKey]);
            const filters = buildStrategicCaseFilters(item.analysis ?? null);

            return (
              <div
                key={caseKey}
                style={{
                  border: "1px solid #dbe2ea",
                  borderRadius: 10,
                  padding: 12,
                  background: "#ffffff",
                  display: "grid",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ display: "grid", gap: 4 }}>
                    <strong style={{ fontSize: 13, color: "#0f172a" }}>
                      Case #{caseNumber}
                    </strong>
                    <span
                      style={{
                        fontSize: 12,
                        color: "#0f172a",
                        fontWeight: 700,
                        wordBreak: "break-word",
                      }}
                    >
                      ID: {caseId}
                    </span>
                    <span style={{ fontSize: 12, color: "#64748b" }}>
                      Trigger: {formatDateTime(item.trigger_time)}
                    </span>
                  </div>

                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "4px 8px",
                      borderRadius: 999,
                      background: badge.background,
                      color: badge.color,
                      border: `1px solid ${badge.border}`,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {badge.label}
                  </span>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 8,
                  }}
                >
                  {detailRow("Case ID", caseId)}
                  {detailRow("Direção", normalizeDisplayText(formatValue(item.side)))}
                  {detailRow("Status", normalizeDisplayText(formatValue(item.status)))}
                  {detailRow("Outcome", normalizeDisplayText(formatValue(item.outcome)))}
                  {detailRow("Trigger", formatDateTime(item.trigger_time))}
                  {detailRow("Trigger candle", formatDateTime(item.trigger_candle_time))}
                  {detailRow("Entrada", formatValue(item.entry_price))}
                  {detailRow("Fecho", formatValue(item.close_price))}
                  {detailRow("Trigger price", formatValue(item.trigger_price))}
                  {detailRow("Target", formatValue(item.target_price))}
                  {detailRow("Invalidação", formatValue(item.invalidation_price))}
                  {detailRow("Entry time", formatDateTime(item.entry_time))}
                  {detailRow("Close time", formatDateTime(item.close_time))}
                  {detailRow("Bars resolução", formatValue(item.bars_to_resolution))}
                  {detailRow("MFE", formatValue(item.max_favorable_excursion))}
                  {detailRow("MAE", formatValue(item.max_adverse_excursion))}
                  {detailRow("Close reason", formatValue(item.close_reason))}
                </div>

                <AnalysisSection title="Leitura rápida para comparação entre cases">
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                      gap: 8,
                    }}
                  >
                    <AnalysisMetricCard label="Sessão" value={filters.session} />
                    <AnalysisMetricCard
                      label="Estrutura"
                      value={filters.marketStructure}
                    />
                    <AnalysisMetricCard
                      label="Força tendência"
                      value={filters.trendStrengthPct}
                    />
                    <AnalysisMetricCard
                      label="Direção dominante"
                      value={filters.trendDirection}
                    />
                    <AnalysisMetricCard
                      label="Leitura"
                      value={filters.trendLabel}
                    />
                    <AnalysisMetricCard
                      label="Alinhamento EMA"
                      value={filters.emaAlignment}
                    />
                    <AnalysisMetricCard
                      label="Preço vs EMA 20"
                      value={filters.priceVsEma20}
                    />
                    <AnalysisMetricCard
                      label="Preço vs EMA 40"
                      value={filters.priceVsEma40}
                    />
                    <AnalysisMetricCard
                      label="EMA 20 slope"
                      value={filters.ema20Slope}
                    />
                    <AnalysisMetricCard
                      label="EMA 40 slope"
                      value={filters.ema40Slope}
                    />
                    <AnalysisMetricCard
                      label="Local entrada"
                      value={filters.entryLocation}
                    />
                    <AnalysisMetricCard label="Zona RSI" value={filters.rsiZone} />
                    <AnalysisMetricCard
                      label="Estado MACD"
                      value={filters.macdState}
                    />
                    <AnalysisMetricCard
                      label="Qualidade do sinal"
                      value={filters.signalQuality}
                    />
                  </div>
                </AnalysisSection>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => onToggleCaseAnalysis(caseKey)}
                    style={{
                      height: 34,
                      padding: "0 12px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      background: "#ffffff",
                      color: "#0f172a",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {isExpanded
                      ? "Ocultar análise do case"
                      : "Exibir análise do case"}
                  </button>
                </div>

                {isExpanded && (
                  <CaseAnalysisBlock
                    analysis={item.analysis ?? null}
                    runStatus={item.outcome}
                    caseId={caseId}
                    caseNumber={caseNumber}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RunHistoryCard({
  sidebarCardStyle,
  runSearch,
  setRunSearch,
  loadingRuns,
  runsError,
  actionError,
  filteredStageTests,
  selectedRunId,
  onClearRuns,
  isClearingRuns,
  isCreatingRuns,
  lastExecutionLog,
  lastExecutionStatus,
  runningStrategyKey,
  selectedSymbol,
  selectedTimeframe,
  onRunStageTest,
}: RunHistoryCardProps) {
  const [expanded, setExpanded] = useState(true);
  const [expandedCasesByStrategy, setExpandedCasesByStrategy] = useState<
    Record<string, boolean>
  >({});
  const [expandedCaseAnalysisById, setExpandedCaseAnalysisById] = useState<
    Record<string, boolean>
  >({});

  const orderedStageTests = useMemo(() => {
    return [...filteredStageTests].sort(compareStageTestsByHitRate);
  }, [filteredStageTests]);

  const hasManualContext = Boolean(selectedSymbol && selectedTimeframe);

  const executionStatusLabel = isCreatingRuns
    ? "Run manual em execução..."
    : "Execução manual disponível";

  const executionStatusDescription = isCreatingRuns
    ? "Uma estratégia está a ser executada manualmente neste momento."
    : hasManualContext
      ? "Escolha uma estratégia da lista e clique em Run para executar manualmente no símbolo e timeframe selecionados."
      : "Selecione símbolo e timeframe no painel do mercado para liberar a execução manual.";

  const toggleCases = (strategyKey: string) => {
    setExpandedCasesByStrategy((previous) => ({
      ...previous,
      [strategyKey]: !previous[strategyKey],
    }));
  };

  const toggleCaseAnalysis = (caseKey: string) => {
    setExpandedCaseAnalysisById((previous) => ({
      ...previous,
      [caseKey]: !previous[caseKey],
    }));
  };

  return (
    <div
      style={{
        ...sidebarCardStyle,
        padding: 0,
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((previous) => !previous)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "14px 16px",
          background: "#f8fafc",
          border: "none",
          borderBottom: expanded ? "1px solid #e2e8f0" : "none",
          cursor: "pointer",
          textAlign: "left",
        }}
        aria-expanded={expanded}
        aria-label={expanded ? "Ocultar Stage Testes" : "Expandir Stage Testes"}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            minWidth: 0,
          }}
        >
          <strong
            style={{
              fontSize: 18,
              color: "#0f172a",
              lineHeight: 1.2,
            }}
          >
            Stage Testes
          </strong>

          <span
            style={{
              fontSize: 12,
              color: "#64748b",
              lineHeight: 1.4,
            }}
          >
            Catálogo do backend com execução manual
          </span>
        </div>

        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: 34,
            width: 34,
            height: 34,
            borderRadius: 999,
            border: "1px solid #cbd5e1",
            background: "#ffffff",
            color: "#0f172a",
            fontSize: 16,
            fontWeight: 700,
            lineHeight: 1,
            flexShrink: 0,
          }}
        >
          {expanded ? "−" : "+"}
        </span>
      </button>

      {expanded ? (
        <div style={{ padding: 16 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: 8,
              alignItems: "stretch",
              marginBottom: 12,
            }}
          >
            <div
              style={{
                border: `1px solid ${getStatusBorder(lastExecutionStatus)}`,
                borderRadius: 10,
                padding: "10px 12px",
                background: getStatusBackground(lastExecutionStatus),
                display: "grid",
                gap: 6,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 999,
                    background: getStatusDotColor(lastExecutionStatus),
                    flexShrink: 0,
                  }}
                />

                <strong
                  style={{
                    fontSize: 13,
                    color: "#0f172a",
                  }}
                >
                  {executionStatusLabel}
                </strong>
              </div>

              <span
                style={{
                  fontSize: 12,
                  color: "#475569",
                  lineHeight: 1.45,
                }}
              >
                {executionStatusDescription}
              </span>

              <span
                style={{
                  fontSize: 12,
                  color: "#334155",
                  lineHeight: 1.45,
                  wordBreak: "break-word",
                }}
              >
                <strong>Último log:</strong> {lastExecutionLog}
              </span>
            </div>

            <button
              onClick={() => void onClearRuns()}
              disabled={isClearingRuns || isCreatingRuns}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid #dc2626",
                background: isClearingRuns ? "#fee2e2" : "#fff",
                color: "#b91c1c",
                fontWeight: 700,
                cursor:
                  isClearingRuns || isCreatingRuns ? "not-allowed" : "pointer",
                opacity: isClearingRuns || isCreatingRuns ? 0.7 : 1,
                whiteSpace: "nowrap",
              }}
            >
              {isClearingRuns ? "A limpar..." : "Limpar runs locais"}
            </button>
          </div>

          <input
            value={runSearch}
            onChange={(e) => setRunSearch(e.target.value)}
            placeholder="Buscar por estratégia, símbolo..."
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #cbd5e1",
              marginBottom: 12,
              outline: "none",
              fontSize: 14,
            }}
          />

          {actionError && (
            <div style={{ marginBottom: 12 }}>
              <p style={{ color: "#dc2626", fontWeight: "bold", margin: 0 }}>
                Erro de ação
              </p>
              <p style={{ margin: "6px 0 0 0" }}>{actionError}</p>
            </div>
          )}

          {loadingRuns && <p style={{ margin: 0 }}>A carregar Stage Testes...</p>}

          {!loadingRuns && runsError && (
            <div>
              <p style={{ color: "#dc2626", fontWeight: "bold" }}>
                Erro ao carregar Stage Testes
              </p>
              <p>{runsError}</p>
            </div>
          )}

          {!loadingRuns && !runsError && orderedStageTests.length === 0 && (
            <p style={{ margin: 0 }}>Nenhuma estratégia encontrada.</p>
          )}

          {!loadingRuns && !runsError && orderedStageTests.length > 0 && (
            <div style={{ display: "grid", gap: 12 }}>
              {orderedStageTests.map((item, index) => {
                const latestRunId = item.last_run?.run_id ?? "";
                const isSelected =
                  latestRunId !== "" && selectedRunId === latestRunId;
                const isRunning = runningStrategyKey === item.strategy_key;
                const cases = item.last_run?.cases ?? [];
                const hasCases = cases.length > 0;
                const isCasesExpanded = Boolean(
                  expandedCasesByStrategy[item.strategy_key]
                );

                return (
                  <div
                    key={item.strategy_key}
                    style={{
                      textAlign: "left",
                      border: isSelected
                        ? "2px solid #0f172a"
                        : "1px solid #cbd5e1",
                      borderRadius: 12,
                      padding: 12,
                      background: isSelected ? "#f1f5f9" : "#fff",
                      boxShadow: isSelected
                        ? "0 1px 3px rgba(15, 23, 42, 0.08)"
                        : "none",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: 8,
                        marginBottom: 8,
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            flexWrap: "wrap",
                            marginBottom: 4,
                          }}
                        >
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              minWidth: 28,
                              height: 22,
                              padding: "0 8px",
                              borderRadius: 999,
                              border: "1px solid #cbd5e1",
                              background: "#f8fafc",
                              color: "#475569",
                              fontSize: 11,
                              fontWeight: 700,
                            }}
                          >
                            #{index + 1}
                          </span>

                          <div
                            style={{
                              fontSize: 15,
                              fontWeight: 700,
                              lineHeight: 1.35,
                              wordBreak: "break-word",
                              color: "#0f172a",
                            }}
                          >
                            {item.strategy_name}
                          </div>
                        </div>

                        <div
                          style={{
                            fontSize: 12,
                            color: "#64748b",
                            wordBreak: "break-word",
                          }}
                        >
                          {item.strategy_key}
                        </div>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          flexWrap: "wrap",
                          justifyContent: "flex-end",
                        }}
                      >
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: "4px 8px",
                            borderRadius: 999,
                            background: latestRunId ? "#dbeafe" : "#f1f5f9",
                            color: latestRunId ? "#1d4ed8" : "#64748b",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {latestRunId ? "COM RUN" : "SEM RUN"}
                        </span>

                        <button
                          type="button"
                          onClick={() => void onRunStageTest(item.strategy_key)}
                          disabled={!hasManualContext || isCreatingRuns}
                          style={{
                            height: 32,
                            padding: "0 12px",
                            borderRadius: 8,
                            border: "none",
                            background:
                              !hasManualContext || isCreatingRuns
                                ? "#cbd5e1"
                                : "#2563eb",
                            color: "#ffffff",
                            fontWeight: 700,
                            cursor:
                              !hasManualContext || isCreatingRuns
                                ? "not-allowed"
                                : "pointer",
                          }}
                        >
                          {isRunning ? "A executar..." : "Run"}
                        </button>
                      </div>
                    </div>

                    {item.strategy_description && (
                      <div
                        style={{
                          fontSize: 12,
                          color: "#475569",
                          lineHeight: 1.5,
                          marginBottom: 10,
                        }}
                      >
                        {item.strategy_description}
                      </div>
                    )}

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
                        gap: 8,
                        marginBottom: 12,
                      }}
                    >
                      {metricPill("Runs", item.total_runs, "#cbd5e1", "#f8fafc")}
                      {metricPill("Cases", item.total_cases, "#cbd5e1", "#f8fafc")}
                      {metricPill("Hits", item.total_hits, "#16a34a", "#f0fdf4")}
                      {metricPill("Fails", item.total_fails, "#dc2626", "#fef2f2")}
                      {metricPill(
                        "Timeout",
                        item.total_timeouts,
                        "#f59e0b",
                        "#fffbeb"
                      )}
                      {metricPill(
                        "Hit Rate",
                        formatPercent(item.hit_rate),
                        "#16a34a",
                        "#f0fdf4"
                      )}
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                        gap: 8,
                        fontSize: 12,
                        lineHeight: 1.55,
                        color: "#334155",
                      }}
                    >
                      {detailRow("Categoria", item.strategy_category ?? "-")}
                      {detailRow("Fail Rate", formatPercent(item.fail_rate))}
                      {detailRow("Timeout Rate", formatPercent(item.timeout_rate))}
                      {detailRow("Último run", latestRunId || "-")}
                      {detailRow("Último símbolo", item.last_run?.symbol ?? "-")}
                      {detailRow("Último timeframe", item.last_run?.timeframe ?? "-")}
                      {detailRow("Último status", item.last_run?.status ?? "-")}
                      {detailRow(
                        "Último início",
                        formatDateTime(item.last_run?.started_at)
                      )}
                    </div>

                    {hasCases && (
                      <div
                        style={{
                          marginTop: 12,
                          display: "flex",
                          justifyContent: "flex-end",
                          gap: 8,
                          flexWrap: "wrap",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => toggleCases(item.strategy_key)}
                          style={{
                            height: 34,
                            padding: "0 12px",
                            borderRadius: 8,
                            border: "1px solid #cbd5e1",
                            background: "#ffffff",
                            color: "#0f172a",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          {isCasesExpanded ? "Ocultar cases" : "Exibir cases"}
                        </button>
                      </div>
                    )}

                    {hasCases && isCasesExpanded && (
                      <CasesSection
                        strategyKey={item.strategy_key}
                        cases={cases}
                        expandedCaseAnalysisById={expandedCaseAnalysisById}
                        onToggleCaseAnalysis={toggleCaseAnalysis}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default RunHistoryCard;