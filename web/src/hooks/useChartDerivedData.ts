// C:\TraderBotWeb\web\src\hooks\useChartDerivedData.ts

import { useMemo } from "react";

import { CHART_STRATEGY_HIGHLIGHT_MIN_SCORE } from "../constants/config";
import type {
  CandleCoverageMeta,
  CandleItem,
  CandleTickState,
  FeedDiagnostics,
  RunCaseItem,
  RunDetailsResponse,
} from "../types/trading";
import { getCaseAccentColor } from "../utils/chart";
import {
  formatBooleanLike,
  formatDateTime,
  formatMaybeNumber,
  formatUtcDateTime,
  parsePrice,
} from "../utils/format";

export type OverlayLine = {
  id: string;
  label: string;
  value: number;
  top: number;
  color: string;
  dashed?: boolean;
};

export type OverlayMarker = {
  id: string;
  label: string;
  price: number;
  left: number;
  top: number;
  color: string;
  timeLabel: string;
};

export type OverlayBox = {
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
  fill: string;
  borderColor: string;
  borderWidth?: number;
  dashed?: boolean;
  label?: string;
  labelColor?: string;
  labelBackground?: string;
};

export type OverlayCircle = {
  id: string;
  left: number;
  top: number;
  radius: number;
  color: string;
  borderColor?: string;
  borderWidth?: number;
  dashed?: boolean;
  label?: string;
  labelColor?: string;
  labelBackground?: string;
};

export type OverlaySegment = {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  width?: number;
  dashed?: boolean;
  label?: string;
  labelColor?: string;
  labelBackground?: string;
};

export type OverlayText = {
  id: string;
  left: number;
  top: number;
  text: string;
  color: string;
  background: string;
  borderColor?: string;
};

export type ChartOverlaySet = {
  markers: OverlayMarker[];
  lines: OverlayLine[];
  boxes: OverlayBox[];
  circles: OverlayCircle[];
  segments: OverlaySegment[];
  texts: OverlayText[];
};

type UseChartDerivedDataParams = {
  candles: CandleItem[];
  coverageMeta: CandleCoverageMeta | null;
  runDetails: RunDetailsResponse | null;
  selectedCaseId: string;
  chartSize: {
    width: number;
    height: number;
  };
  effectiveChartSymbol: string;
  effectiveChartTimeframe: string;
  lastCandleTick: CandleTickState;
  marketStrategyCards: Array<{
    id: string;
    title: string;
    score: number;
  }>;
};

type UseChartDerivedDataResult = {
  feedDiagnostics: FeedDiagnostics;
  overlays: ChartOverlaySet;
  legendCloseColor: string;
};

type CaseMetadata = Record<string, unknown>;

type ExtendedRunCaseItem = RunCaseItem & {
  trigger_candle_time?: string | null;
  metadata?: CaseMetadata;
};

type ContextualStrategyCard = {
  id: string;
  title: string;
  score: number;
};

type CandleMeta = {
  openTime: string;
  closeTime: string;
  open: number;
  high: number;
  low: number;
  close: number;
};

function createEmptyChartOverlays(): ChartOverlaySet {
  return {
    markers: [],
    lines: [],
    boxes: [],
    circles: [],
    segments: [],
    texts: [],
  };
}

function calculateEMA(values: number[], period: number): number | null {
  if (values.length < period) return null;

  const multiplier = 2 / (period + 1);
  let average =
    values.slice(0, period).reduce((acc, value) => acc + value, 0) / period;

  for (let index = period; index < values.length; index += 1) {
    average = (values[index] - average) * multiplier + average;
  }

  return average;
}

function getBestContextualStrategy(
  marketStrategyCards: ContextualStrategyCard[],
): ContextualStrategyCard | null {
  const eligible = marketStrategyCards
    .filter(
      (item) =>
        Number.isFinite(item.score) &&
        Number(item.score) >= CHART_STRATEGY_HIGHLIGHT_MIN_SCORE,
    )
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      return a.title.localeCompare(b.title, "pt-PT");
    });

  return eligible[0] ?? null;
}

function findClosestCandleIndexByTime(
  candleMeta: CandleMeta[],
  value: string | null,
): number | null {
  if (!value || candleMeta.length === 0) return null;

  const target = new Date(value).getTime();
  if (Number.isNaN(target)) return null;

  let bestIndex = 0;
  let bestDiff = Number.POSITIVE_INFINITY;

  for (let index = 0; index < candleMeta.length; index += 1) {
    const candleTime = new Date(candleMeta[index].openTime).getTime();
    const diff = Math.abs(candleTime - target);

    if (diff < bestDiff) {
      bestDiff = diff;
      bestIndex = index;
    }
  }

  return bestIndex;
}

function buildSelectedCaseOverlays(params: {
  selectedCase: ExtendedRunCaseItem;
  candleMeta: CandleMeta[];
  runStrategyKey: string;
  xFromIndex: (index: number) => number;
  yFromPrice: (price: number) => number;
}): ChartOverlaySet {
  const { selectedCase, candleMeta, runStrategyKey, xFromIndex, yFromPrice } =
    params;

  const metadata = (selectedCase.metadata ?? {}) as CaseMetadata;
  const selectedCaseStrategyKey =
    typeof metadata.strategy_key === "string" && metadata.strategy_key.trim()
      ? metadata.strategy_key.trim().toLowerCase()
      : runStrategyKey.trim().toLowerCase();

  const ffFdOutsideTime =
    typeof metadata.previous_candle_time === "string"
      ? metadata.previous_candle_time
      : selectedCase.trigger_candle_time ?? selectedCase.trigger_time ?? null;

  const ffFdConfirmationTime =
    typeof metadata.confirmation_candle_time === "string"
      ? metadata.confirmation_candle_time
      : selectedCase.entry_time ?? null;

  const ffFdSide =
    typeof metadata.side === "string" ? metadata.side.trim().toLowerCase() : "";

  const ffFdOutsidePrice =
    parsePrice(selectedCase.trigger_price) ?? parsePrice(selectedCase.entry_price);

  const ffFdConfirmationPrice = parsePrice(selectedCase.entry_price);

  const markerDefs: Array<{
    id: string;
    label: string;
    color: string;
    time: string | null;
    price: number | null;
  }> = [
    {
      id: "trigger",
      label: "TRG",
      color: "#7c3aed",
      time: selectedCase.trigger_candle_time || selectedCase.trigger_time || null,
      price: parsePrice(selectedCase.entry_price),
    },
    {
      id: "entry",
      label: "ENT",
      color: "#2563eb",
      time: selectedCase.entry_time ?? null,
      price: parsePrice(selectedCase.entry_price),
    },
    {
      id: "close",
      label: "CLS",
      color: getCaseAccentColor(selectedCase),
      time: selectedCase.close_time ?? null,
      price: parsePrice(selectedCase.close_price),
    },
  ];

  if (selectedCaseStrategyKey === "ff_fd") {
    markerDefs.unshift(
      {
        id: "fffd-outside",
        label: ffFdSide === "sell" ? "FF↑" : "FF↓",
        color: "#f59e0b",
        time: ffFdOutsideTime,
        price: ffFdOutsidePrice,
      },
      {
        id: "fffd-inside",
        label: ffFdSide === "sell" ? "FD↓" : "FD↑",
        color: "#0ea5e9",
        time: ffFdConfirmationTime,
        price: ffFdConfirmationPrice,
      },
    );
  }

  const lineDefs: Array<{
    id: string;
    label: string;
    color: string;
    value: number | null;
    dashed?: boolean;
  }> = [
    {
      id: "entry-line",
      label: "ENTRY",
      color: "#2563eb",
      value: parsePrice(selectedCase.entry_price),
    },
    {
      id: "target-line",
      label: "TARGET",
      color: "#16a34a",
      value: parsePrice(selectedCase.target_price),
      dashed: true,
    },
    {
      id: "invalid-line",
      label: "INVALID",
      color: "#dc2626",
      value: parsePrice(selectedCase.invalidation_price),
      dashed: true,
    },
    {
      id: "close-line",
      label: "CLOSE",
      color: getCaseAccentColor(selectedCase),
      value: parsePrice(selectedCase.close_price),
      dashed: true,
    },
  ];

  const overlays = createEmptyChartOverlays();

  for (const item of markerDefs) {
    if (!item.time || item.price === null) continue;
    const index = findClosestCandleIndexByTime(candleMeta, item.time);
    if (index === null) continue;

    overlays.markers.push({
      id: item.id,
      label: item.label,
      color: item.color,
      left: xFromIndex(index),
      top: yFromPrice(item.price),
      price: item.price,
      timeLabel: formatDateTime(item.time),
    });
  }

  for (const item of lineDefs) {
    if (item.value === null) continue;

    overlays.lines.push({
      id: item.id,
      label: item.label,
      color: item.color,
      top: yFromPrice(item.value),
      value: item.value,
      dashed: item.dashed,
    });
  }

  return overlays;
}

function buildPullbackContextualOverlays(params: {
  candleMeta: CandleMeta[];
  score: number;
  xFromIndex: (index: number) => number;
  yFromPrice: (price: number) => number;
  priceRange: number;
  chartHeight: number;
}): ChartOverlaySet {
  const { candleMeta, score, xFromIndex, yFromPrice, priceRange, chartHeight } =
    params;

  const overlays = createEmptyChartOverlays();

  if (candleMeta.length < 16) {
    return overlays;
  }

  const closes = candleMeta.map((item) => item.close);
  const currentPrice = closes[closes.length - 1] ?? null;
  const ema9 = calculateEMA(closes, 9);
  const ema21 = calculateEMA(closes, 21);

  if (currentPrice === null || ema9 === null || ema21 === null) {
    return overlays;
  }

  const side: "buy" | "sell" = ema9 >= ema21 ? "buy" : "sell";
  const zoneTop = Math.max(ema9, ema21);
  const zoneBottom = Math.min(ema9, ema21);

  const lastIndex = candleMeta.length - 1;
  const searchStart = Math.max(0, lastIndex - 22);

  let triggerIndex: number | null = null;

  for (let index = lastIndex; index >= searchStart; index -= 1) {
    const candle = candleMeta[index];
    const touchedZone = candle.high >= zoneBottom && candle.low <= zoneTop;

    if (!touchedZone) continue;

    const rejection =
      side === "buy"
        ? candle.close >= zoneTop || candle.close > candle.open
        : candle.close <= zoneBottom || candle.close < candle.open;

    if (rejection) {
      triggerIndex = index;
      break;
    }
  }

  if (triggerIndex === null) {
    return overlays;
  }

  let swingStartIndex = Math.max(0, triggerIndex - 10);
  let swingEndIndex = Math.max(0, triggerIndex - 2);

  if (side === "buy") {
    const baseStart = Math.max(0, triggerIndex - 24);
    let localLowIndex = baseStart;
    let minLow = candleMeta[baseStart].low;

    for (let i = baseStart; i <= Math.max(baseStart, triggerIndex - 4); i += 1) {
      if (candleMeta[i].low < minLow) {
        minLow = candleMeta[i].low;
        localLowIndex = i;
      }
    }

    let localHighIndex = localLowIndex;
    let maxHigh = candleMeta[localLowIndex].high;

    for (
      let i = localLowIndex;
      i <= Math.max(localLowIndex, triggerIndex - 2);
      i += 1
    ) {
      if (candleMeta[i].high > maxHigh) {
        maxHigh = candleMeta[i].high;
        localHighIndex = i;
      }
    }

    swingStartIndex = localLowIndex;
    swingEndIndex = localHighIndex;
  } else {
    const baseStart = Math.max(0, triggerIndex - 24);
    let localHighIndex = baseStart;
    let maxHigh = candleMeta[baseStart].high;

    for (let i = baseStart; i <= Math.max(baseStart, triggerIndex - 4); i += 1) {
      if (candleMeta[i].high > maxHigh) {
        maxHigh = candleMeta[i].high;
        localHighIndex = i;
      }
    }

    let localLowIndex = localHighIndex;
    let minLow = candleMeta[localHighIndex].low;

    for (
      let i = localHighIndex;
      i <= Math.max(localHighIndex, triggerIndex - 2);
      i += 1
    ) {
      if (candleMeta[i].low < minLow) {
        minLow = candleMeta[i].low;
        localLowIndex = i;
      }
    }

    swingStartIndex = localHighIndex;
    swingEndIndex = localLowIndex;
  }

  const triggerCandle = candleMeta[triggerIndex];
  const compactMode = score < 85;

  const impulseStartPrice =
    side === "buy"
      ? candleMeta[swingStartIndex].low
      : candleMeta[swingStartIndex].high;

  const impulseEndPrice =
    side === "buy"
      ? candleMeta[swingEndIndex].high
      : candleMeta[swingEndIndex].low;

  const recentWindow = candleMeta.slice(
    Math.max(0, triggerIndex - 6),
    lastIndex + 1,
  );

  const recentHigh =
    recentWindow.length > 0
      ? Math.max(...recentWindow.map((item) => item.high))
      : currentPrice;

  const recentLow =
    recentWindow.length > 0
      ? Math.min(...recentWindow.map((item) => item.low))
      : currentPrice;

  const padding = Math.max(priceRange * 0.12, 0.00001);
  const entry = side === "buy" ? zoneTop : zoneBottom;
  const target =
    side === "buy"
      ? Math.max(recentHigh, entry + padding)
      : Math.min(recentLow, entry - padding);

  const invalidation =
    side === "buy" ? zoneBottom - padding * 0.55 : zoneTop + padding * 0.55;

  const zoneLeftIndex = Math.max(0, triggerIndex - 2);
  const zoneRightIndex = Math.min(lastIndex, triggerIndex + 2);
  const riskLeftIndex = triggerIndex;
  const riskRightIndex = Math.min(lastIndex, triggerIndex + 3);

  const zoneLeft = xFromIndex(zoneLeftIndex);
  const zoneRight = xFromIndex(zoneRightIndex);
  const riskLeft = xFromIndex(riskLeftIndex);
  const riskRight = xFromIndex(riskRightIndex);

  const zoneTopPx = yFromPrice(zoneTop);
  const zoneBottomPx = yFromPrice(zoneBottom);
  const entryPx = yFromPrice(entry);
  const targetPx = yFromPrice(target);
  const invalidPx = yFromPrice(invalidation);

  overlays.boxes.push({
    id: "ctx-pullback-zone",
    left: Math.min(zoneLeft, zoneRight),
    top: Math.min(zoneTopPx, zoneBottomPx),
    width: Math.abs(zoneRight - zoneLeft),
    height: Math.max(Math.abs(zoneBottomPx - zoneTopPx), 10),
    fill: "rgba(59, 130, 246, 0.12)",
    borderColor: "rgba(37, 99, 235, 0.82)",
    borderWidth: 1,
    label: "M9 / M21",
    labelColor: "#0f172a",
    labelBackground: "rgba(255,255,255,0.9)",
  });

  overlays.segments.push({
    id: "ctx-pullback-impulse",
    x1: xFromIndex(swingStartIndex),
    y1: yFromPrice(impulseStartPrice),
    x2: xFromIndex(swingEndIndex),
    y2: yFromPrice(impulseEndPrice),
    color: "rgba(15, 23, 42, 0.8)",
    width: 2,
  });

  const tagLeft = Math.max(10, xFromIndex(triggerIndex) - 32);
  const tagTop = Math.max(
    12,
    Math.min(chartHeight - 40, Math.min(zoneTopPx, zoneBottomPx) - 28),
  );

  overlays.texts.push({
    id: "ctx-pullback-text",
    left: tagLeft,
    top: tagTop,
    text: compactMode
      ? `Pullback ${side === "buy" ? "BUY" : "SELL"} · preparação`
      : `Pullback ${side === "buy" ? "BUY" : "SELL"} · ${score}%`,
    color: "#ffffff",
    background:
      side === "buy"
        ? "rgba(22, 163, 74, 0.92)"
        : "rgba(180, 83, 9, 0.92)",
    borderColor:
      side === "buy"
        ? "rgba(134, 239, 172, 0.92)"
        : "rgba(253, 186, 116, 0.92)",
  });

  if (!compactMode) {
    overlays.circles.push({
      id: "ctx-pullback-trigger-circle",
      left: xFromIndex(triggerIndex),
      top: yFromPrice(side === "buy" ? triggerCandle.low : triggerCandle.high),
      radius: 18,
      color: "transparent",
      borderColor: "#2563eb",
      borderWidth: 3,
      dashed: true,
    });

    overlays.boxes.push(
      {
        id: "ctx-pullback-reward",
        left: Math.min(riskLeft, riskRight),
        top: Math.min(entryPx, targetPx),
        width: Math.abs(riskRight - riskLeft),
        height: Math.max(Math.abs(targetPx - entryPx), 10),
        fill: "rgba(34, 197, 94, 0.18)",
        borderColor: "rgba(22, 163, 74, 0.88)",
        borderWidth: 1,
      },
      {
        id: "ctx-pullback-risk",
        left: Math.min(riskLeft, riskRight),
        top: Math.min(entryPx, invalidPx),
        width: Math.abs(riskRight - riskLeft),
        height: Math.max(Math.abs(invalidPx - entryPx), 10),
        fill: "rgba(239, 68, 68, 0.18)",
        borderColor: "rgba(220, 38, 38, 0.88)",
        borderWidth: 1,
      },
    );

    overlays.texts.push({
      id: "ctx-pullback-entry-text",
      left: Math.max(10, xFromIndex(triggerIndex) - 22),
      top: Math.max(12, zoneBottomPx + 8),
      text: `Entry ${formatMaybeNumber(entry)}`,
      color: "#1e3a8a",
      background: "rgba(219, 234, 254, 0.96)",
      borderColor: "rgba(37, 99, 235, 0.92)",
    });
  }

  return overlays;
}

function useChartDerivedData({
  candles,
  coverageMeta,
  runDetails,
  selectedCaseId,
  chartSize,
  effectiveChartSymbol,
  effectiveChartTimeframe,
  lastCandleTick,
  marketStrategyCards,
}: UseChartDerivedDataParams): UseChartDerivedDataResult {
  const candleMeta = useMemo(() => {
    return candles
      .map((item) => ({
        openTime: item.open_time,
        closeTime: item.close_time,
        open: Number(item.open),
        high: Number(item.high),
        low: Number(item.low),
        close: Number(item.close),
      }))
      .filter(
        (item) =>
          Number.isFinite(item.open) &&
          Number.isFinite(item.high) &&
          Number.isFinite(item.low) &&
          Number.isFinite(item.close),
      );
  }, [candles]);

  const selectedCase = useMemo<ExtendedRunCaseItem | null>(() => {
    if (!runDetails || !selectedCaseId) return null;

    const found =
      runDetails.cases.find((item) => item.id === selectedCaseId) ?? null;

    return found as ExtendedRunCaseItem | null;
  }, [runDetails, selectedCaseId]);

  const priceBounds = useMemo(() => {
    if (candleMeta.length === 0) {
      return { min: 0, max: 1, range: 1 };
    }

    const min = Math.min(...candleMeta.map((item) => item.low));
    const max = Math.max(...candleMeta.map((item) => item.high));
    const range = max - min || 1;

    return { min, max, range };
  }, [candleMeta]);

  const feedDiagnostics = useMemo<FeedDiagnostics>(() => {
    const firstCandle = candles[0] ?? null;
    const lastCandle = candles[candles.length - 1] ?? null;
    const runtimeTimezone =
      Intl.DateTimeFormat().resolvedOptions().timeZone || "-";

    const minLow =
      candleMeta.length > 0 ? Math.min(...candleMeta.map((item) => item.low)) : null;
    const maxHigh =
      candleMeta.length > 0 ? Math.max(...candleMeta.map((item) => item.high)) : null;

    return {
      symbol: effectiveChartSymbol || "-",
      timeframe: effectiveChartTimeframe || "-",
      totalCandles: candles.length,
      firstCandleUtc: formatUtcDateTime(firstCandle?.open_time ?? null),
      lastCandleUtc: formatUtcDateTime(lastCandle?.open_time ?? null),
      firstCandleLocal: formatDateTime(firstCandle?.open_time ?? null),
      lastCandleLocal: formatDateTime(lastCandle?.open_time ?? null),
      lastClose: lastCandle ? formatMaybeNumber(Number(lastCandle.close), 5) : "-",
      priceRange:
        minLow !== null && maxHigh !== null
          ? `${minLow.toFixed(5)} → ${maxHigh.toFixed(5)}`
          : "-",
      candleSource: lastCandle?.source ?? "-",
      candleProvider: lastCandle?.provider ?? "-",
      candleSession: lastCandle?.market_session ?? "-",
      candleTimezone: lastCandle?.timezone ?? "-",
      candleIsDelayed: formatBooleanLike(lastCandle?.is_delayed),
      candleIsMock: formatBooleanLike(lastCandle?.is_mock),
      lastTickUtc: formatUtcDateTime(lastCandleTick?.open_time ?? null),
      lastTickLocal: formatDateTime(lastCandleTick?.open_time ?? null),
      tickSource: lastCandleTick?.source ?? "-",
      tickProvider: lastCandleTick?.provider ?? "-",
      tickSession: lastCandleTick?.market_session ?? "-",
      tickTimezone: lastCandleTick?.timezone ?? "-",
      tickIsDelayed: formatBooleanLike(lastCandleTick?.is_delayed),
      tickIsMock: formatBooleanLike(lastCandleTick?.is_mock),
      runtimeTimezone,
      coverageMode: coverageMeta?.mode ?? "-",
      coverageCount: coverageMeta?.count ?? 0,
      coverageStartUtc: formatUtcDateTime(coverageMeta?.start_at ?? null),
      coverageEndUtc: formatUtcDateTime(coverageMeta?.end_at ?? null),
      coverageFirstOpenUtc: formatUtcDateTime(coverageMeta?.first_open_time ?? null),
      coverageLastCloseUtc: formatUtcDateTime(coverageMeta?.last_close_time ?? null),
      coverageFirstOpenLocal: formatDateTime(coverageMeta?.first_open_time ?? null),
      coverageLastCloseLocal: formatDateTime(coverageMeta?.last_close_time ?? null),
    };
  }, [
    candles,
    candleMeta,
    coverageMeta,
    effectiveChartSymbol,
    effectiveChartTimeframe,
    lastCandleTick,
  ]);

  const overlays = useMemo(() => {
    if (
      candleMeta.length === 0 ||
      chartSize.width <= 0 ||
      chartSize.height <= 0
    ) {
      return createEmptyChartOverlays();
    }

    const width = chartSize.width;
    const height = chartSize.height;
    const leftPadding = 12;
    const rightPadding = 70;
    const topPadding = 12;
    const bottomPadding = 24;
    const plotWidth = Math.max(width - leftPadding - rightPadding, 1);
    const plotHeight = Math.max(height - topPadding - bottomPadding, 1);

    const xFromIndex = (index: number) => {
      if (candleMeta.length === 1) return leftPadding + plotWidth / 2;
      return leftPadding + (index / Math.max(candleMeta.length - 1, 1)) * plotWidth;
    };

    const yFromPrice = (price: number) => {
      const clamped = Math.max(priceBounds.min, Math.min(price, priceBounds.max));
      const normalized = (clamped - priceBounds.min) / priceBounds.range;
      return topPadding + (1 - normalized) * plotHeight;
    };

    const bestContextualStrategy = getBestContextualStrategy(marketStrategyCards);

    if (bestContextualStrategy?.id === "strategy-pullback") {
      return buildPullbackContextualOverlays({
        candleMeta,
        score: bestContextualStrategy.score,
        xFromIndex,
        yFromPrice,
        priceRange: priceBounds.range,
        chartHeight: height,
      });
    }

    if (selectedCase) {
      return buildSelectedCaseOverlays({
        selectedCase,
        candleMeta,
        runStrategyKey: runDetails?.run?.strategy_key ?? "",
        xFromIndex,
        yFromPrice,
      });
    }

    return createEmptyChartOverlays();
  }, [
    selectedCase,
    candleMeta,
    chartSize,
    priceBounds,
    runDetails?.run?.strategy_key,
    marketStrategyCards,
  ]);

  const legendCloseColor = useMemo(() => {
    return getCaseAccentColor(selectedCase);
  }, [selectedCase]);

  return {
    feedDiagnostics,
    overlays,
    legendCloseColor,
  };
}

export default useChartDerivedData;