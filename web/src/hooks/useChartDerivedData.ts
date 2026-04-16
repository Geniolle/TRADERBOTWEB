// C:\TraderBotWeb\web\src\hooks\useChartDerivedData.ts

import { useMemo } from "react";

import type {
  CandleCoverageMeta,
  CandleItem,
  CandleTickState,
  FeedDiagnostics,
  OverlayLine,
  OverlayMarker,
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
  overlays: {
    markers: OverlayMarker[];
    lines: OverlayLine[];
  };
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

function calculateSMA(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((acc, value) => acc + value, 0) / period;
}

function calculateCloud(
  highs: number[],
  lows: number[],
  closes: number[],
): { top: number | null; bottom: number | null; price: number | null } {
  if (highs.length < 52 || lows.length < 52 || closes.length === 0) {
    return { top: null, bottom: null, price: null };
  }

  const conversionHigh = Math.max(...highs.slice(-9));
  const conversionLow = Math.min(...lows.slice(-9));
  const conversion = (conversionHigh + conversionLow) / 2;

  const baseHigh = Math.max(...highs.slice(-26));
  const baseLow = Math.min(...lows.slice(-26));
  const base = (baseHigh + baseLow) / 2;

  const spanA = (conversion + base) / 2;

  const spanBHigh = Math.max(...highs.slice(-52));
  const spanBLow = Math.min(...lows.slice(-52));
  const spanB = (spanBHigh + spanBLow) / 2;

  return {
    top: Math.max(spanA, spanB),
    bottom: Math.min(spanA, spanB),
    price: closes[closes.length - 1] ?? null,
  };
}

function getBestContextualStrategy(
  marketStrategyCards: ContextualStrategyCard[],
): ContextualStrategyCard | null {
  const eligible = marketStrategyCards
    .filter(
      (item) => Number.isFinite(item.score) && Number(item.score) >= 80,
    )
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      return a.title.localeCompare(b.title, "pt-PT");
    });

  return eligible[0] ?? null;
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
      return {
        markers: [] as OverlayMarker[],
        lines: [] as OverlayLine[],
      };
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

    const findClosestCandleIndexByTime = (value: string | null): number | null => {
      if (!value || candleMeta.length === 0) return null;

      const target = new Date(value).getTime();
      if (Number.isNaN(target)) return null;

      let bestIndex = 0;
      let bestDiff = Number.POSITIVE_INFINITY;

      for (let i = 0; i < candleMeta.length; i += 1) {
        const candleTime = new Date(candleMeta[i].openTime).getTime();
        const diff = Math.abs(candleTime - target);

        if (diff < bestDiff) {
          bestDiff = diff;
          bestIndex = i;
        }
      }

      return bestIndex;
    };

    if (selectedCase) {
      const metadata = (selectedCase.metadata ?? {}) as CaseMetadata;
      const selectedCaseStrategyKey =
        typeof metadata.strategy_key === "string" && metadata.strategy_key.trim()
          ? metadata.strategy_key.trim().toLowerCase()
          : (runDetails?.run?.strategy_key ?? "").trim().toLowerCase();

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

      const markers: OverlayMarker[] = [];
      const lines: OverlayLine[] = [];

      for (const item of markerDefs) {
        if (!item.time || item.price === null) continue;
        const index = findClosestCandleIndexByTime(item.time);
        if (index === null) continue;

        markers.push({
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
        lines.push({
          id: item.id,
          label: item.label,
          color: item.color,
          top: yFromPrice(item.value),
          value: item.value,
          dashed: item.dashed,
        });
      }

      return { markers, lines };
    }

    const bestContextualStrategy = getBestContextualStrategy(marketStrategyCards);

    if (!bestContextualStrategy) {
      return {
        markers: [] as OverlayMarker[],
        lines: [] as OverlayLine[],
      };
    }

    const closes = candleMeta.map((item) => item.close);
    const highs = candleMeta.map((item) => item.high);
    const lows = candleMeta.map((item) => item.low);

    const currentPrice = closes[closes.length - 1] ?? null;
    const ema9 = calculateEMA(closes, 9);
    const ema21 = calculateEMA(closes, 21);
    const sma200 = calculateSMA(closes, 200);

    const recentWindow = candleMeta.slice(-20);
    const recentHigh =
      recentWindow.length > 0
        ? Math.max(...recentWindow.map((item) => item.high))
        : null;
    const recentLow =
      recentWindow.length > 0
        ? Math.min(...recentWindow.map((item) => item.low))
        : null;

    const cloud = calculateCloud(highs, lows, closes);

    const lastIndex = candleMeta.length - 1;
    const lastTime = candleMeta[lastIndex]?.openTime ?? null;
    const padding = Math.max(priceBounds.range * 0.08, 0.00001);

    const markers: OverlayMarker[] = [];
    const lines: OverlayLine[] = [];

    const pushMarker = (
      id: string,
      label: string,
      color: string,
      price: number | null,
      time: string | null = lastTime,
    ) => {
      if (price === null || !time) return;

      const index = findClosestCandleIndexByTime(time);
      if (index === null) return;

      markers.push({
        id,
        label,
        color,
        left: xFromIndex(index),
        top: yFromPrice(price),
        price,
        timeLabel: formatDateTime(time),
      });
    };

    const pushLine = (
      id: string,
      label: string,
      color: string,
      value: number | null,
      dashed = false,
    ) => {
      if (value === null) return;

      lines.push({
        id,
        label,
        color,
        top: yFromPrice(value),
        value,
        dashed,
      });
    };

    switch (bestContextualStrategy.id) {
      case "strategy-pullback": {
        if (currentPrice === null) break;

        const bullish =
          ema9 !== null &&
          ema21 !== null &&
          currentPrice >= ema9 &&
          ema9 >= ema21;

        const bearish =
          ema9 !== null &&
          ema21 !== null &&
          currentPrice <= ema9 &&
          ema9 <= ema21;

        if (bullish) {
          const trigger = ema9 ?? currentPrice;
          const entry = ema21 ?? ema9 ?? currentPrice;
          const target = recentHigh ?? currentPrice + padding * 2;
          const invalidation = Math.min(
            recentLow ?? entry - padding,
            entry - padding,
          );

          pushMarker("ctx-pullback-trigger", "TRG", "#7c3aed", trigger);
          pushLine("ctx-pullback-entry", "ENTRY", "#2563eb", entry);
          pushLine("ctx-pullback-target", "TARGET", "#16a34a", target, true);
          pushLine(
            "ctx-pullback-invalid",
            "INVALID",
            "#dc2626",
            invalidation,
            true,
          );
          break;
        }

        if (bearish) {
          const trigger = ema9 ?? currentPrice;
          const entry = ema21 ?? ema9 ?? currentPrice;
          const target = recentLow ?? currentPrice - padding * 2;
          const invalidation = Math.max(
            recentHigh ?? entry + padding,
            entry + padding,
          );

          pushMarker("ctx-pullback-trigger", "TRG", "#7c3aed", trigger);
          pushLine("ctx-pullback-entry", "ENTRY", "#2563eb", entry);
          pushLine("ctx-pullback-target", "TARGET", "#16a34a", target, true);
          pushLine(
            "ctx-pullback-invalid",
            "INVALID",
            "#dc2626",
            invalidation,
            true,
          );
          break;
        }

        pushMarker("ctx-pullback-radar", "CTX", "#0ea5e9", currentPrice);
        pushLine("ctx-pullback-current", "ENTRY", "#2563eb", currentPrice, true);
        break;
      }

      case "strategy-moving-average-crossover": {
        if (currentPrice === null) break;

        const bullish = ema9 !== null && ema21 !== null && ema9 > ema21;
        const bearish = ema9 !== null && ema21 !== null && ema9 < ema21;

        if (bullish) {
          const trigger = ema9 ?? currentPrice;
          const entry = currentPrice;
          const target = recentHigh ?? currentPrice + padding * 2;
          const invalidation = ema21 ?? sma200 ?? currentPrice - padding;

          pushMarker("ctx-cross-trigger", "TRG", "#7c3aed", trigger);
          pushLine("ctx-cross-entry", "ENTRY", "#2563eb", entry);
          pushLine("ctx-cross-target", "TARGET", "#16a34a", target, true);
          pushLine(
            "ctx-cross-invalid",
            "INVALID",
            "#dc2626",
            invalidation,
            true,
          );
          break;
        }

        if (bearish) {
          const trigger = ema9 ?? currentPrice;
          const entry = currentPrice;
          const target = recentLow ?? currentPrice - padding * 2;
          const invalidation = ema21 ?? sma200 ?? currentPrice + padding;

          pushMarker("ctx-cross-trigger", "TRG", "#7c3aed", trigger);
          pushLine("ctx-cross-entry", "ENTRY", "#2563eb", entry);
          pushLine("ctx-cross-target", "TARGET", "#16a34a", target, true);
          pushLine(
            "ctx-cross-invalid",
            "INVALID",
            "#dc2626",
            invalidation,
            true,
          );
          break;
        }

        pushMarker("ctx-cross-radar", "CTX", "#0ea5e9", currentPrice);
        pushLine("ctx-cross-current", "ENTRY", "#2563eb", currentPrice, true);
        break;
      }

      case "strategy-volatility-breakout": {
        if (cloud.top !== null && cloud.bottom !== null) {
          pushMarker("ctx-vol-up", "TRG↑", "#16a34a", cloud.top);
          pushMarker("ctx-vol-down", "TRG↓", "#dc2626", cloud.bottom);
          pushLine("ctx-vol-top", "TRIGGER-UP", "#16a34a", cloud.top, true);
          pushLine("ctx-vol-bottom", "TRIGGER-DOWN", "#dc2626", cloud.bottom, true);
        } else if (currentPrice !== null) {
          pushMarker("ctx-vol-radar", "CTX", "#0ea5e9", currentPrice);
          pushLine("ctx-vol-current", "ENTRY", "#2563eb", currentPrice, true);
        }
        break;
      }

      case "strategy-range-breakout": {
        if (recentLow === null || currentPrice === null) break;

        const entry = recentLow;
        const target = recentLow - padding * 1.8;
        const invalidation = (recentHigh ?? currentPrice) + padding * 0.4;

        pushMarker("ctx-range-trigger", "TRG", "#7c3aed", entry);
        pushLine("ctx-range-entry", "ENTRY", "#2563eb", entry);
        pushLine("ctx-range-target", "TARGET", "#16a34a", target, true);
        pushLine("ctx-range-invalid", "INVALID", "#dc2626", invalidation, true);
        break;
      }

      case "strategy-mean-reversion": {
        if (currentPrice === null || ema21 === null) break;

        const buySide = currentPrice < ema21;
        const entry = currentPrice;
        const target = ema21;
        const invalidation = buySide
          ? (recentLow ?? currentPrice - padding) - padding * 0.4
          : (recentHigh ?? currentPrice + padding) + padding * 0.4;

        pushMarker("ctx-mean-trigger", "TRG", "#7c3aed", entry);
        pushLine("ctx-mean-entry", "ENTRY", "#2563eb", entry);
        pushLine("ctx-mean-target", "TARGET", "#16a34a", target, true);
        pushLine("ctx-mean-invalid", "INVALID", "#dc2626", invalidation, true);
        break;
      }

      case "strategy-fade": {
        if (currentPrice === null) break;

        const entry = currentPrice;
        const target = ema9 ?? currentPrice + padding;
        const invalidation = (recentLow ?? currentPrice - padding) - padding * 0.4;

        pushMarker("ctx-fade-trigger", "TRG", "#7c3aed", entry);
        pushLine("ctx-fade-entry", "ENTRY", "#2563eb", entry);
        pushLine("ctx-fade-target", "TARGET", "#16a34a", target, true);
        pushLine("ctx-fade-invalid", "INVALID", "#dc2626", invalidation, true);
        break;
      }

      default: {
        if (currentPrice !== null) {
          pushMarker("ctx-default", "CTX", "#0ea5e9", currentPrice);
          pushLine("ctx-default-entry", "ENTRY", "#2563eb", currentPrice, true);
        }
      }
    }

    return { markers, lines };
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