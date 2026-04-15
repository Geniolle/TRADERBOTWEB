// C:\TraderBotWeb\web\src\components\runs\run-history\CasesSection.tsx

import { useMemo, useState, type ReactNode } from "react";
import { CaseAnalysisBlock } from "./CaseAnalysisBlock";
import { CasesFilterButton } from "./RunHistoryShared";
import {
  buildEmaDirectionSummary,
  formatDateTime,
  formatValue,
  getDirectionAccent,
  getOutcomeBadge,
  normalizeDisplayText,
  normalizeOutcome,
  resolveCaseDirection,
} from "./utils";
import type { CaseFilter, StageTestRunCaseItem } from "./types";

type ArrowVisual = {
  symbol: "↑" | "↓" | "•";
  color: string;
  border: string;
  background: string;
};

type MovingAverageBadge = {
  label: string;
  value: string;
  arrow: ArrowVisual;
};

type TradePipMetrics = {
  realizedPips: number | null;
  targetPips: number | null;
  riskPips: number | null;
  rewardRiskRatio: number | null;
};

function toNumeric(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().replace(",", ".");
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object") {
    return value as Record<string, unknown>;
  }

  return {};
}

function asString(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asString(item).trim())
    .filter((item) => item.length > 0);
}

function formatTokenLabel(value: unknown): string {
  const text = asString(value).trim();
  if (!text) return "-";

  return text
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeInstrumentSymbol(
  item: StageTestRunCaseItem,
  fallbackChartSymbol?: string,
  fallbackMarketSymbol?: string
): string {
  const metadata = asRecord(item.metadata);

  return (
    asString(metadata.symbol).trim() ||
    asString(metadata.asset_symbol).trim() ||
    asString(metadata.instrument_symbol).trim() ||
    asString(metadata.market_symbol).trim() ||
    asString(fallbackChartSymbol).trim() ||
    asString(fallbackMarketSymbol).trim()
  ).toUpperCase();
}

function getPipSize(symbol: string): number {
  const compact = symbol.replace(/[/\s-]/g, "").toUpperCase();

  if (!compact) return 0.0001;
  if (compact.includes("JPY")) return 0.01;
  if (compact.startsWith("XAU") || compact.startsWith("XAG")) return 0.1;

  return 0.0001;
}

function getTradePipMetrics(
  item: StageTestRunCaseItem,
  fallbackChartSymbol?: string,
  fallbackMarketSymbol?: string
): TradePipMetrics {
  const entry = toNumeric(item.entry_price);
  const close = toNumeric(item.close_price);
  const target = toNumeric(item.target_price);
  const invalidation = toNumeric(item.invalidation_price);

  if (entry == null) {
    return {
      realizedPips: null,
      targetPips: null,
      riskPips: null,
      rewardRiskRatio: null,
    };
  }

  const directionRaw = String(
    item.side ?? asRecord(item.metadata).setup_direction ?? ""
  )
    .trim()
    .toLowerCase();

  const isSell = ["sell", "short", "venda"].includes(directionRaw);
  const isBuy = ["buy", "long", "compra"].includes(directionRaw);

  const symbol = normalizeInstrumentSymbol(
    item,
    fallbackChartSymbol,
    fallbackMarketSymbol
  );
  const pipSize = getPipSize(symbol);

  const toPips = (distance: number | null): number | null => {
    if (distance == null) return null;
    if (!Number.isFinite(distance) || pipSize <= 0) return null;
    return distance / pipSize;
  };

  let realizedDistance: number | null = null;
  let targetDistance: number | null = null;
  let riskDistance: number | null = null;

  if (close != null) {
    if (isSell) realizedDistance = entry - close;
    else if (isBuy) realizedDistance = close - entry;
    else realizedDistance = Math.abs(close - entry);
  }

  if (target != null) {
    if (isSell) targetDistance = entry - target;
    else if (isBuy) targetDistance = target - entry;
    else targetDistance = Math.abs(target - entry);
  }

  if (invalidation != null) {
    if (isSell) riskDistance = invalidation - entry;
    else if (isBuy) riskDistance = entry - invalidation;
    else riskDistance = Math.abs(invalidation - entry);
  }

  const realizedPips = toPips(realizedDistance);
  const targetPips = toPips(targetDistance);
  const riskPips = toPips(riskDistance);

  const rewardRiskRatio =
    targetPips != null && riskPips != null && riskPips > 0
      ? targetPips / riskPips
      : null;

  return {
    realizedPips,
    targetPips,
    riskPips,
    rewardRiskRatio,
  };
}

function formatPips(value: number | null, signed = false): string {
  if (value == null || !Number.isFinite(value)) return "-";
  const normalized = Number(value.toFixed(2));
  return `${signed && normalized > 0 ? "+" : ""}${normalized.toFixed(2)} pips`;
}

function formatRatio(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "-";
  return `${value.toFixed(2)}R`;
}

function getUpArrow(): ArrowVisual {
  return {
    symbol: "↑",
    color: "#166534",
    border: "#86efac",
    background: "#f0fdf4",
  };
}

function getDownArrow(): ArrowVisual {
  return {
    symbol: "↓",
    color: "#991b1b",
    border: "#fca5a5",
    background: "#fef2f2",
  };
}

function getNeutralArrow(): ArrowVisual {
  return {
    symbol: "•",
    color: "#475569",
    border: "#cbd5e1",
    background: "#f8fafc",
  };
}

function getArrowByComparison(
  currentValue: number | null,
  previousValue: number | null
): ArrowVisual {
  if (currentValue != null && previousValue != null) {
    return currentValue >= previousValue ? getUpArrow() : getDownArrow();
  }

  return getNeutralArrow();
}

function getArrowBySlopeText(value: unknown): ArrowVisual {
  const normalized = String(value ?? "").trim().toLowerCase();

  if (["up", "bullish", "rising", "above"].includes(normalized)) {
    return getUpArrow();
  }

  if (["down", "bearish", "falling", "below"].includes(normalized)) {
    return getDownArrow();
  }

  return getNeutralArrow();
}

function formatMaValue(value: number | null): string {
  if (value == null) return "-";
  return value.toFixed(6).replace(".", ",");
}

function renderArrowBadge(arrow: ArrowVisual) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 22,
        width: 22,
        height: 22,
        padding: 0,
        borderRadius: 999,
        color: arrow.color,
        background: arrow.background,
        border: `1px solid ${arrow.border}`,
        fontWeight: 700,
        fontSize: 11,
        lineHeight: 1,
        flexShrink: 0,
      }}
    >
      {arrow.symbol}
    </span>
  );
}

function InfoField({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div
      style={{
        display: "grid",
        gap: 4,
        minWidth: 0,
      }}
    >
      <span
        style={{
          fontSize: 11,
          color: "#64748b",
          fontWeight: 600,
          lineHeight: 1.2,
        }}
      >
        {label}
      </span>

      <div
        style={{
          fontSize: 12,
          color: "#0f172a",
          fontWeight: 700,
          lineHeight: 1.35,
          minWidth: 0,
          wordBreak: "break-word",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function GroupCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        background: "#ffffff",
        padding: 12,
        display: "grid",
        gap: 10,
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 800,
          color: "#0f172a",
          letterSpacing: 0.2,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function Chip({
  children,
  color = "#0f172a",
  background = "#ffffff",
  border = "#dbe2ea",
}: {
  children: ReactNode;
  color?: string;
  background?: string;
  border?: string;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 999,
        border: `1px solid ${border}`,
        background,
        color,
        fontSize: 12,
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function ListCard({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "positive" | "negative";
}) {
  const palette =
    tone === "positive"
      ? {
          background: "#f0fdf4",
          border: "#bbf7d0",
          title: "#166534",
          itemBackground: "#ffffff",
          itemBorder: "#dcfce7",
          itemText: "#14532d",
        }
      : {
          background: "#fef2f2",
          border: "#fecaca",
          title: "#991b1b",
          itemBackground: "#ffffff",
          itemBorder: "#fee2e2",
          itemText: "#7f1d1d",
        };

  return (
    <div
      style={{
        border: `1px solid ${palette.border}`,
        borderRadius: 12,
        background: palette.background,
        padding: 12,
        display: "grid",
        gap: 8,
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 800,
          color: palette.title,
        }}
      >
        {title}
      </div>

      {items.length === 0 ? (
        <div
          style={{
            fontSize: 12,
            color: "#64748b",
          }}
        >
          Nenhum.
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          {items.map((item) => (
            <span
              key={`${title}-${item}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "6px 10px",
                borderRadius: 999,
                background: palette.itemBackground,
                border: `1px solid ${palette.itemBorder}`,
                color: palette.itemText,
                fontSize: 12,
                fontWeight: 700,
                lineHeight: 1.2,
              }}
            >
              {formatTokenLabel(item)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function buildMovingAverageBadges(item: StageTestRunCaseItem): MovingAverageBadge[] {
  const metadata = asRecord(item.metadata);
  const analysis = item.analysis ? asRecord(item.analysis) : {};
  const snapshot = asRecord(analysis.snapshot);
  const trend = asRecord(snapshot.trend);

  const currentShort =
    toNumeric(metadata.current_short_ema) ??
    toNumeric(trend.short_ema) ??
    toNumeric(trend.ema_9) ??
    toNumeric(trend.ema9) ??
    toNumeric(trend.m9);

  const previousShort =
    toNumeric(metadata.previous_short_ema) ??
    toNumeric(metadata.previous_ema_9) ??
    toNumeric(metadata.previous_ema9) ??
    toNumeric(metadata.previous_m9);

  const currentLong =
    toNumeric(metadata.current_long_ema) ??
    toNumeric(trend.long_ema) ??
    toNumeric(trend.ema_21) ??
    toNumeric(trend.ema21) ??
    toNumeric(trend.m21);

  const previousLong =
    toNumeric(metadata.previous_long_ema) ??
    toNumeric(metadata.previous_ema_21) ??
    toNumeric(metadata.previous_ema21) ??
    toNumeric(metadata.previous_m21);

  const current200 =
    toNumeric(metadata.current_ema_200) ??
    toNumeric(metadata.ema_200) ??
    toNumeric(trend.ema_200) ??
    toNumeric(trend.ema200) ??
    toNumeric(trend.m200);

  const previous200 =
    toNumeric(metadata.previous_ema_200) ??
    toNumeric(metadata.previous_ema200) ??
    toNumeric(metadata.previous_m200);

  const shortArrow = getArrowByComparison(currentShort, previousShort);
  const longArrow = getArrowByComparison(currentLong, previousLong);

  const ma200Arrow =
    current200 != null && previous200 != null
      ? getArrowByComparison(current200, previous200)
      : getArrowBySlopeText(
          trend.ema_200_slope ??
            trend.ema200_slope ??
            trend.m200_slope ??
            trend.slope_ema_200
        );

  return [
    {
      label: "M9",
      value: formatMaValue(currentShort),
      arrow: shortArrow,
    },
    {
      label: "M21",
      value: formatMaValue(currentLong),
      arrow: longArrow,
    },
    {
      label: "M200",
      value: formatMaValue(current200),
      arrow: ma200Arrow,
    },
  ];
}

function buildAdxArrow(item: StageTestRunCaseItem): ArrowVisual {
  const analysis = item.analysis ? asRecord(item.analysis) : {};
  const snapshot = asRecord(analysis.snapshot);
  const trend = asRecord(snapshot.trend);
  const structure = asRecord(snapshot.structure);
  const metadata = asRecord(item.metadata);

  const currentAdx =
    toNumeric(trend.adx) ??
    toNumeric(trend.adx_14) ??
    toNumeric(structure.adx) ??
    toNumeric(structure.adx_14);

  const previousAdx =
    toNumeric(metadata.previous_adx) ?? toNumeric(metadata.previous_adx_14);

  if (currentAdx != null && previousAdx != null) {
    return getArrowByComparison(currentAdx, previousAdx);
  }

  if (currentAdx != null) {
    return currentAdx >= 20 ? getUpArrow() : getDownArrow();
  }

  return getNeutralArrow();
}

function buildVolumeArrow(item: StageTestRunCaseItem): ArrowVisual {
  const analysis = item.analysis ? asRecord(item.analysis) : {};
  const snapshot = asRecord(analysis.snapshot);
  const volume = asRecord(snapshot.volume);
  const momentum = asRecord(snapshot.momentum);

  const ratio =
    toNumeric(volume.ratio) ??
    toNumeric(volume.relative_volume) ??
    toNumeric(volume.zscore) ??
    toNumeric(momentum.volume_ratio);

  if (ratio != null) {
    if (ratio > 1) return getUpArrow();
    if (ratio < 1) return getDownArrow();
    return getNeutralArrow();
  }

  const signalText = String(
    volume.signal ?? volume.relative_state ?? volume.context ?? ""
  )
    .trim()
    .toLowerCase();

  if (
    ["high", "strong", "bullish", "above_average", "expanding"].includes(
      signalText
    )
  ) {
    return getUpArrow();
  }

  if (
    ["low", "weak", "bearish", "below_average", "contracting"].includes(
      signalText
    )
  ) {
    return getDownArrow();
  }

  return getNeutralArrow();
}

function buildCloudArrow(item: StageTestRunCaseItem): ArrowVisual {
  const analysis = item.analysis ? asRecord(item.analysis) : {};
  const snapshot = asRecord(analysis.snapshot);
  const trend = asRecord(snapshot.trend);
  const structure = asRecord(snapshot.structure);

  const emaAlignment = String(trend.ema_alignment ?? "")
    .trim()
    .toLowerCase();

  const priceVsEma20 = String(trend.price_vs_ema_20 ?? "")
    .trim()
    .toLowerCase();

  const priceVsEma40 = String(trend.price_vs_ema_40 ?? "")
    .trim()
    .toLowerCase();

  const marketStructure = String(structure.market_structure ?? "")
    .trim()
    .toLowerCase();

  if (
    emaAlignment === "bullish" &&
    priceVsEma20 === "above" &&
    priceVsEma40 === "above"
  ) {
    return getUpArrow();
  }

  if (
    emaAlignment === "bearish" &&
    priceVsEma20 === "below" &&
    priceVsEma40 === "below"
  ) {
    return getDownArrow();
  }

  if (marketStructure === "bullish" && priceVsEma40 === "above") {
    return getUpArrow();
  }

  if (marketStructure === "bearish" && priceVsEma40 === "below") {
    return getDownArrow();
  }

  return getNeutralArrow();
}

function buildRsiArrow(item: StageTestRunCaseItem): ArrowVisual {
  const analysis = item.analysis ? asRecord(item.analysis) : {};
  const snapshot = asRecord(analysis.snapshot);
  const momentum = asRecord(snapshot.momentum);

  return getArrowBySlopeText(momentum.rsi_slope);
}

function buildMacdArrow(item: StageTestRunCaseItem): ArrowVisual {
  const analysis = item.analysis ? asRecord(item.analysis) : {};
  const snapshot = asRecord(analysis.snapshot);
  const momentum = asRecord(snapshot.momentum);

  const macdState = String(momentum.macd_state ?? "")
    .trim()
    .toLowerCase();

  if (["bullish_cross", "bullish_above_signal", "bullish"].includes(macdState)) {
    return getUpArrow();
  }

  if (
    ["bearish_cross", "bearish_below_signal", "bearish"].includes(macdState)
  ) {
    return getDownArrow();
  }

  return getArrowBySlopeText(momentum.macd_histogram_slope);
}

function getCandlestickPhase2(item: StageTestRunCaseItem): Record<string, unknown> {
  const analysis = item.analysis ? asRecord(item.analysis) : {};
  const snapshot = asRecord(analysis.snapshot);
  const intelligence = asRecord(snapshot.candlestick_intelligence);
  return asRecord(intelligence.phase_2_sequence_patterns);
}

function getCandlestickPhase3(item: StageTestRunCaseItem): Record<string, unknown> {
  const analysis = item.analysis ? asRecord(item.analysis) : {};
  const snapshot = asRecord(analysis.snapshot);
  const intelligence = asRecord(snapshot.candlestick_intelligence);
  return asRecord(intelligence.phase_3_confirmation);
}

function getActionBadgeStyle(action: string) {
  const normalized = action.trim().toLowerCase();

  if (normalized === "validar_entrada") {
    return {
      color: "#166534",
      border: "#86efac",
      background: "#f0fdf4",
    };
  }

  if (normalized === "aceitar_com_confirmacao") {
    return {
      color: "#1d4ed8",
      border: "#93c5fd",
      background: "#eff6ff",
    };
  }

  if (normalized === "ter_cautela") {
    return {
      color: "#92400e",
      border: "#fcd34d",
      background: "#fffbeb",
    };
  }

  return {
    color: "#991b1b",
    border: "#fca5a5",
    background: "#fef2f2",
  };
}

function getConfirmationBadgeStyle(label: string) {
  const normalized = label.trim().toLowerCase();

  if (normalized === "forte") {
    return {
      color: "#166534",
      border: "#86efac",
      background: "#f0fdf4",
    };
  }

  if (normalized === "boa") {
    return {
      color: "#1d4ed8",
      border: "#93c5fd",
      background: "#eff6ff",
    };
  }

  if (normalized === "neutra") {
    return {
      color: "#92400e",
      border: "#fcd34d",
      background: "#fffbeb",
    };
  }

  return {
    color: "#991b1b",
    border: "#fca5a5",
    background: "#fef2f2",
  };
}

function resolveChartSymbol(
  item: StageTestRunCaseItem,
  fallbackChartSymbol?: string,
  fallbackMarketSymbol?: string
): string {
  const metadata = asRecord(item.metadata);

  return (
    asString(metadata.symbol).trim() ||
    asString(metadata.asset_symbol).trim() ||
    asString(metadata.instrument_symbol).trim() ||
    asString(metadata.market_symbol).trim() ||
    asString(fallbackChartSymbol).trim() ||
    asString(fallbackMarketSymbol).trim()
  );
}

function resolveChartTimeframe(
  item: StageTestRunCaseItem,
  fallbackChartTimeframe?: string,
  fallbackMarketTimeframe?: string
): string {
  const metadata = asRecord(item.metadata);

  return (
    asString(metadata.timeframe).trim() ||
    asString(metadata.chart_timeframe).trim() ||
    asString(metadata.market_timeframe).trim() ||
    asString(fallbackChartTimeframe).trim() ||
    asString(fallbackMarketTimeframe).trim()
  );
}

export function CasesSection({
  strategyKey,
  cases,
  expandedCaseAnalysisById,
  onToggleCaseAnalysis,
  chartSymbol,
  chartTimeframe,
  strategyLabel,
  marketSymbol,
  marketTimeframe,
  onOpenCaseChart,
}: {
  strategyKey: string;
  cases: StageTestRunCaseItem[];
  expandedCaseAnalysisById: Record<string, boolean>;
  onToggleCaseAnalysis: (caseKey: string) => void;
  chartSymbol?: string;
  chartTimeframe?: string;
  strategyLabel?: string;
  marketSymbol?: string;
  marketTimeframe?: string;
  onOpenCaseChart: (
    caseItem: StageTestRunCaseItem,
    chartSymbol: string,
    chartTimeframe: string,
    strategyLabel: string
  ) => void;
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

  const resolvedStrategyLabel = strategyLabel?.trim() || strategyKey;

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
      <div style={{ display: "grid", gap: 8 }}>
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
              O foco aqui é encontrar padrões recorrentes nos fails para afinar a
              regra da estratégia.
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
        <div style={{ display: "grid", gap: 12 }}>
          {filteredCases.map((item, index) => {
            const caseId = String(item.id ?? `case-${index + 1}`);
            const caseNumber = item.case_number ?? index + 1;
            const caseKey = `${strategyKey}::${caseId}`;
            const badge = getOutcomeBadge(item.outcome);
            const isExpanded = Boolean(expandedCaseAnalysisById[caseKey]);

            const resolvedSignal = resolveCaseDirection(item);
            const signalAccent = getDirectionAccent(resolvedSignal);

            const emaDirectionSummary = buildEmaDirectionSummary(
              item.analysis ?? null,
              resolvedSignal,
              item.metadata ?? null
            );

            const movingAverageBadges = buildMovingAverageBadges(item);
            const adxArrow = buildAdxArrow(item);
            const volumeArrow = buildVolumeArrow(item);
            const cloudArrow = buildCloudArrow(item);
            const rsiArrow = buildRsiArrow(item);
            const macdArrow = buildMacdArrow(item);

            const phase2 = getCandlestickPhase2(item);
            const phase3 = getCandlestickPhase3(item);

            const entryLocation = formatTokenLabel(phase2.entry_location);
            const sequenceBias = formatTokenLabel(phase2.sequence_bias);
            const dominantPattern = formatTokenLabel(phase2.dominant_pattern);
            const sequenceSummary = asString(phase2.sequence_summary).trim() || "-";

            const confirmationScore = asString(phase3.confirmation_score).trim() || "-";
            const confirmationLabelRaw = asString(phase3.confirmation_label).trim();
            const confirmationLabel = confirmationLabelRaw
              ? formatTokenLabel(confirmationLabelRaw)
              : "-";

            const recommendedActionRaw = asString(phase3.recommended_action).trim();
            const recommendedAction = recommendedActionRaw
              ? formatTokenLabel(recommendedActionRaw)
              : "-";

            const reasonsFor = asStringArray(phase3.reasons_for);
            const reasonsAgainst = asStringArray(phase3.reasons_against);

            const confirmationBadgeStyle = getConfirmationBadgeStyle(
              confirmationLabelRaw
            );
            const actionBadgeStyle = getActionBadgeStyle(recommendedActionRaw);

            const currentCaseChartSymbol = resolveChartSymbol(
              item,
              chartSymbol,
              marketSymbol
            );
            const currentCaseChartTimeframe = resolveChartTimeframe(
              item,
              chartTimeframe,
              marketTimeframe
            );

            const pipMetrics = getTradePipMetrics(
              item,
              chartSymbol,
              marketSymbol
            );

            const canOpenChart = Boolean(
              currentCaseChartSymbol &&
                currentCaseChartTimeframe &&
                (item.trigger_time ||
                  item.trigger_candle_time ||
                  item.entry_time ||
                  item.close_time)
            );

            return (
              <div
                key={caseKey}
                style={{
                  border: "1px solid #dbe2ea",
                  borderRadius: 14,
                  padding: 14,
                  background: "#ffffff",
                  display: "grid",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ display: "grid", gap: 4 }}>
                    <strong style={{ fontSize: 14, color: "#0f172a" }}>
                      Case #{caseNumber}
                    </strong>

                    <span
                      style={{
                        fontSize: 12,
                        color: "#475569",
                        fontWeight: 600,
                      }}
                    >
                      ID: {caseId}
                    </span>

                    <span
                      style={{
                        fontSize: 12,
                        color: "#64748b",
                      }}
                    >
                      Trigger: {formatDateTime(item.trigger_time)}
                    </span>
                  </div>

                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      padding: "5px 10px",
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

                <GroupCard title="Resumo principal">
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                      gap: 12,
                    }}
                  >
                    <InfoField
                      label="Sinal"
                      value={
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: resolvedSignal === "-" ? 0 : "4px 10px",
                            borderRadius: 999,
                            color: signalAccent.color,
                            background: signalAccent.background,
                            border:
                              resolvedSignal === "-"
                                ? "none"
                                : `1px solid ${signalAccent.border}`,
                            fontWeight: 800,
                            width: "fit-content",
                          }}
                        >
                          {resolvedSignal}
                        </span>
                      }
                    />

                    <InfoField
                      label="Confirmação"
                      value={
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: confirmationLabel === "-" ? 0 : "4px 10px",
                            borderRadius: 999,
                            color: confirmationBadgeStyle.color,
                            background:
                              confirmationLabel === "-"
                                ? "transparent"
                                : confirmationBadgeStyle.background,
                            border:
                              confirmationLabel === "-"
                                ? "none"
                                : `1px solid ${confirmationBadgeStyle.border}`,
                            fontWeight: 800,
                            width: "fit-content",
                          }}
                        >
                          {confirmationLabel}
                        </span>
                      }
                    />

                    <InfoField
                      label="Ação sugerida"
                      value={
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: recommendedAction === "-" ? 0 : "4px 10px",
                            borderRadius: 999,
                            color: actionBadgeStyle.color,
                            background:
                              recommendedAction === "-"
                                ? "transparent"
                                : actionBadgeStyle.background,
                            border:
                              recommendedAction === "-"
                                ? "none"
                                : `1px solid ${actionBadgeStyle.border}`,
                            fontWeight: 800,
                            width: "fit-content",
                          }}
                        >
                          {recommendedAction}
                        </span>
                      }
                    />

                    <InfoField label="Score" value={<span>{confirmationScore}</span>} />

                    <InfoField
                      label="Entrada tipo"
                      value={<span>{normalizeDisplayText(entryLocation)}</span>}
                    />

                    <InfoField
                      label="Viés sequência"
                      value={<span>{normalizeDisplayText(sequenceBias)}</span>}
                    />

                    <InfoField
                      label="Padrão dominante"
                      value={<span>{normalizeDisplayText(dominantPattern)}</span>}
                    />

                    <InfoField
                      label="Resumo sequência"
                      value={<span>{normalizeDisplayText(sequenceSummary)}</span>}
                    />
                  </div>
                </GroupCard>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
                    gap: 12,
                  }}
                >
                  <GroupCard title="Direção e médias">
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 8,
                        alignItems: "center",
                      }}
                    >
                      <Chip>
                        <span>Curta</span>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            minWidth: 22,
                            height: 22,
                            padding: "0 6px",
                            borderRadius: 999,
                            color: emaDirectionSummary.m9Arrow.color,
                            background: emaDirectionSummary.m9Arrow.background,
                            border: `1px solid ${emaDirectionSummary.m9Arrow.border}`,
                            fontWeight: 800,
                          }}
                        >
                          {emaDirectionSummary.m9Arrow.arrow}
                        </span>
                        <span>{emaDirectionSummary.m9Value}</span>
                      </Chip>

                      <Chip>
                        <span>Longa</span>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            minWidth: 22,
                            height: 22,
                            padding: "0 6px",
                            borderRadius: 999,
                            color: emaDirectionSummary.m21Arrow.color,
                            background: emaDirectionSummary.m21Arrow.background,
                            border: `1px solid ${emaDirectionSummary.m21Arrow.border}`,
                            fontWeight: 800,
                          }}
                        >
                          {emaDirectionSummary.m21Arrow.arrow}
                        </span>
                        <span>{emaDirectionSummary.m21Value}</span>
                      </Chip>

                      <Chip
                        color={emaDirectionSummary.crossConfirmedColor}
                        background={emaDirectionSummary.crossConfirmedBackground}
                        border={emaDirectionSummary.crossConfirmedBorder}
                      >
                        {emaDirectionSummary.crossConfirmedLabel}
                      </Chip>

                      {movingAverageBadges.map((itemBadge) => (
                        <Chip
                          key={itemBadge.label}
                          color="#0f172a"
                          background="#ffffff"
                          border={itemBadge.arrow.border}
                        >
                          <span>{itemBadge.label}</span>
                          {renderArrowBadge(itemBadge.arrow)}
                          <span>{itemBadge.value}</span>
                        </Chip>
                      ))}
                    </div>
                  </GroupCard>

                  <GroupCard title="Leitura rápida dos indicadores">
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 10,
                      }}
                    >
                      <Chip>{renderArrowBadge(adxArrow)} ADX</Chip>
                      <Chip>{renderArrowBadge(volumeArrow)} Volume</Chip>
                      <Chip>{renderArrowBadge(cloudArrow)} Nuvem</Chip>
                      <Chip>{renderArrowBadge(rsiArrow)} RSI</Chip>
                      <Chip>{renderArrowBadge(macdArrow)} MACD</Chip>
                    </div>
                  </GroupCard>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                    gap: 12,
                  }}
                >
                  <ListCard title="Pontos a favor" items={reasonsFor} tone="positive" />
                  <ListCard title="Pontos contra" items={reasonsAgainst} tone="negative" />
                </div>

                <GroupCard title="Dados do trade">
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
                      gap: 12,
                    }}
                  >
                    <InfoField
                      label="Outcome"
                      value={normalizeDisplayText(formatValue(item.outcome))}
                    />
                    <InfoField label="Trigger" value={formatDateTime(item.trigger_time)} />
                    <InfoField
                      label="Trigger candle"
                      value={formatDateTime(item.trigger_candle_time)}
                    />
                    <InfoField label="Entrada" value={formatValue(item.entry_price)} />
                    <InfoField label="Fecho" value={formatValue(item.close_price)} />
                    <InfoField
                      label="Trigger price"
                      value={formatValue(item.trigger_price)}
                    />
                    <InfoField label="Target" value={formatValue(item.target_price)} />
                    <InfoField
                      label="Invalidação"
                      value={formatValue(item.invalidation_price)}
                    />
                    <InfoField label="Entry time" value={formatDateTime(item.entry_time)} />
                    <InfoField label="Close time" value={formatDateTime(item.close_time)} />
                    <InfoField
                      label="Bars resolução"
                      value={formatValue(item.bars_to_resolution)}
                    />
                    <InfoField
                      label="Pips realizados"
                      value={formatPips(pipMetrics.realizedPips, true)}
                    />
                    <InfoField
                      label="Pips alvo"
                      value={formatPips(pipMetrics.targetPips)}
                    />
                    <InfoField
                      label="Pips risco"
                      value={formatPips(pipMetrics.riskPips)}
                    />
                    <InfoField
                      label="R:R"
                      value={formatRatio(pipMetrics.rewardRiskRatio)}
                    />
                    <InfoField
                      label="MFE"
                      value={formatValue(item.max_favorable_excursion)}
                    />
                    <InfoField
                      label="MAE"
                      value={formatValue(item.max_adverse_excursion)}
                    />
                    <InfoField
                      label="Close reason"
                      value={formatValue(item.close_reason)}
                    />
                  </div>
                </GroupCard>

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
                      height: 36,
                      padding: "0 14px",
                      borderRadius: 10,
                      border: "1px solid #cbd5e1",
                      background: "#ffffff",
                      color: "#0f172a",
                      fontWeight: 800,
                      cursor: "pointer",
                    }}
                  >
                    {isExpanded
                      ? "Ocultar análise do case"
                      : "Exibir análise do case"}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      onOpenCaseChart(
                        item,
                        currentCaseChartSymbol,
                        currentCaseChartTimeframe,
                        resolvedStrategyLabel
                      )
                    }
                    disabled={!canOpenChart}
                    style={{
                      height: 36,
                      padding: "0 14px",
                      borderRadius: 10,
                      border: canOpenChart
                        ? "1px solid #2563eb"
                        : "1px solid #cbd5e1",
                      background: canOpenChart ? "#2563eb" : "#f8fafc",
                      color: canOpenChart ? "#ffffff" : "#64748b",
                      fontWeight: 800,
                      cursor: canOpenChart ? "pointer" : "not-allowed",
                    }}
                    title={
                      canOpenChart
                        ? `Abrir este trade no gráfico (${currentCaseChartSymbol} / ${currentCaseChartTimeframe})`
                        : "Sem símbolo, timeframe ou horários suficientes para abrir o gráfico"
                    }
                  >
                    Ver no gráfico
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