// C:\TraderBotWeb\web\src\components\runs\run-history\CasesSection.tsx

import { useMemo, useState, type ReactNode } from "react";
import { CaseAnalysisBlock } from "./CaseAnalysisBlock";
import { CasesFilterButton, DetailRow } from "./RunHistoryShared";
import { TrendInlineHeader } from "./TrendPanels";
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

function CompactIndicatorRow({
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
        gridTemplateColumns: "56px minmax(0, 1fr)",
        gap: 6,
        alignItems: "center",
        minWidth: 0,
        justifySelf: "start",
        textAlign: "left",
      }}
    >
      <span
        style={{
          color: "#64748b",
          fontSize: 11,
          lineHeight: 1.2,
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>

      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "flex-start",
          minWidth: 0,
        }}
      >
        {value}
      </span>
    </div>
  );
}

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
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

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

function buildMovingAverageBadges(item: StageTestRunCaseItem): MovingAverageBadge[] {
  const metadata = asRecord(item.metadata);
  const analysis = item.analysis ? asRecord(item.analysis) : {};
  const snapshot = asRecord(analysis.snapshot);
  const trend = asRecord(snapshot.trend);

  const currentShort =
    toNumeric(metadata.current_short_ema) ??
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

function renderArrowBadge(arrow: ArrowVisual) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 20,
        width: 20,
        height: 20,
        padding: 0,
        borderRadius: 999,
        color: arrow.color,
        background: arrow.background,
        border: `1px solid ${arrow.border}`,
        fontWeight: 700,
        fontSize: 11,
        lineHeight: 1,
      }}
    >
      {arrow.symbol}
    </span>
  );
}

export function CasesSection({
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
    () =>
      cases.filter((item) => normalizeOutcome(item.outcome) === "timeout")
        .length,
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
        <div style={{ display: "grid", gap: 10 }}>
          {filteredCases.map((item, index) => {
            const caseId = item.id ?? `case-${index + 1}`;
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
                    justifyItems: "start",
                    alignItems: "start",
                    textAlign: "left",
                  }}
                >
                  <DetailRow label="Case ID" value={caseId} />

                  <DetailRow
                    label="Sinal"
                    value={
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "flex-start",
                          gap: 6,
                          padding: resolvedSignal === "-" ? 0 : "2px 8px",
                          borderRadius: 999,
                          color: signalAccent.color,
                          background: signalAccent.background,
                          border:
                            resolvedSignal === "-"
                              ? "none"
                              : `1px solid ${signalAccent.border}`,
                          fontWeight: 700,
                          width: "fit-content",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {resolvedSignal}
                      </span>
                    }
                  />

                  <div
                    style={{
                      gridColumn: "span 2",
                      minWidth: 460,
                      maxWidth: "100%",
                      justifySelf: "start",
                    }}
                  >
                    <DetailRow
                      label="Direção"
                      value={
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "flex-start",
                            gap: 8,
                            flexWrap: "nowrap",
                            whiteSpace: "nowrap",
                            lineHeight: 1.5,
                            width: "fit-content",
                            maxWidth: "100%",
                            overflow: "hidden",
                            textAlign: "left",
                          }}
                        >
                          <span style={{ color: "#0f172a", flexShrink: 0 }}>
                            Curta
                          </span>

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
                              fontWeight: 700,
                              flexShrink: 0,
                            }}
                          >
                            {emaDirectionSummary.m9Arrow.arrow}
                          </span>

                          <span style={{ color: "#0f172a", flexShrink: 0 }}>
                            {emaDirectionSummary.m9Value}
                          </span>

                          <span style={{ color: "#94a3b8", flexShrink: 0 }}>/</span>

                          <span style={{ color: "#0f172a", flexShrink: 0 }}>
                            Longa
                          </span>

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
                              fontWeight: 700,
                              flexShrink: 0,
                            }}
                          >
                            {emaDirectionSummary.m21Arrow.arrow}
                          </span>

                          <span style={{ color: "#0f172a", flexShrink: 0 }}>
                            {emaDirectionSummary.m21Value}
                          </span>

                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "flex-start",
                              padding: "2px 8px",
                              borderRadius: 999,
                              color: emaDirectionSummary.crossConfirmedColor,
                              background:
                                emaDirectionSummary.crossConfirmedBackground,
                              border: `1px solid ${emaDirectionSummary.crossConfirmedBorder}`,
                              fontWeight: 700,
                              flexShrink: 0,
                            }}
                          >
                            {emaDirectionSummary.crossConfirmedLabel}
                          </span>
                        </span>
                      }
                    />
                  </div>

                  <div
                    style={{
                      gridColumn: "span 2",
                      minWidth: 420,
                      maxWidth: "100%",
                      justifySelf: "start",
                    }}
                  >
                    <DetailRow
                      label="Médias"
                      value={
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "flex-start",
                            gap: 8,
                            flexWrap: "wrap",
                            lineHeight: 1.5,
                            width: "fit-content",
                            maxWidth: "100%",
                            textAlign: "left",
                          }}
                        >
                          {movingAverageBadges.map((itemBadge) => (
                            <span
                              key={itemBadge.label}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                padding: "2px 8px",
                                borderRadius: 999,
                                border: `1px solid ${itemBadge.arrow.border}`,
                                background: "#ffffff",
                                color: "#0f172a",
                                fontWeight: 700,
                                whiteSpace: "nowrap",
                              }}
                            >
                              <span>{itemBadge.label}</span>
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  minWidth: 20,
                                  height: 20,
                                  padding: "0 6px",
                                  borderRadius: 999,
                                  color: itemBadge.arrow.color,
                                  background: itemBadge.arrow.background,
                                  border: `1px solid ${itemBadge.arrow.border}`,
                                  fontWeight: 700,
                                }}
                              >
                                {itemBadge.arrow.symbol}
                              </span>
                              <span>{itemBadge.value}</span>
                            </span>
                          ))}
                        </span>
                      }
                    />
                  </div>

                  <CompactIndicatorRow
                    label="ADX"
                    value={renderArrowBadge(adxArrow)}
                  />
                  <CompactIndicatorRow
                    label="Volume"
                    value={renderArrowBadge(volumeArrow)}
                  />
                  <CompactIndicatorRow
                    label="Nuvem"
                    value={renderArrowBadge(cloudArrow)}
                  />
                  <CompactIndicatorRow
                    label="RSI"
                    value={renderArrowBadge(rsiArrow)}
                  />
                  <CompactIndicatorRow
                    label="MACD"
                    value={renderArrowBadge(macdArrow)}
                  />

                  <DetailRow
                    label="Outcome"
                    value={normalizeDisplayText(formatValue(item.outcome))}
                  />
                  <DetailRow
                    label="Trigger"
                    value={formatDateTime(item.trigger_time)}
                  />
                  <DetailRow
                    label="Trigger candle"
                    value={formatDateTime(item.trigger_candle_time)}
                  />
                  <DetailRow label="Entrada" value={formatValue(item.entry_price)} />
                  <DetailRow label="Fecho" value={formatValue(item.close_price)} />
                  <DetailRow
                    label="Trigger price"
                    value={formatValue(item.trigger_price)}
                  />
                  <DetailRow label="Target" value={formatValue(item.target_price)} />
                  <DetailRow
                    label="Invalidação"
                    value={formatValue(item.invalidation_price)}
                  />
                  <DetailRow
                    label="Entry time"
                    value={formatDateTime(item.entry_time)}
                  />
                  <DetailRow
                    label="Close time"
                    value={formatDateTime(item.close_time)}
                  />
                  <DetailRow
                    label="Bars resolução"
                    value={formatValue(item.bars_to_resolution)}
                  />
                  <DetailRow
                    label="MFE"
                    value={formatValue(item.max_favorable_excursion)}
                  />
                  <DetailRow
                    label="MAE"
                    value={formatValue(item.max_adverse_excursion)}
                  />
                  <DetailRow
                    label="Close reason"
                    value={formatValue(item.close_reason)}
                  />
                </div>

                <TrendInlineHeader analysis={item.analysis ?? null} />

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