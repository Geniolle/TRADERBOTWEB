// src/hooks/useChartDerivedData.ts

import { useMemo } from "react";
import type { CandlestickData, UTCTimestamp } from "lightweight-charts";

import type {
  CandleItem,
  CandleTickState,
  ChartCandleMeta,
  FeedDiagnostics,
  OverlayLine,
  OverlayMarker,
  RunDetailsResponse,
} from "../types/trading";
import { getCaseAccentColor, toUtcTimestamp } from "../utils/chart";
import {
  formatBooleanLike,
  formatDateTime,
  formatMaybeNumber,
  formatUtcDateTime,
  parsePrice,
} from "../utils/format";

type UseChartDerivedDataParams = {
  candles: CandleItem[];
  runDetails: RunDetailsResponse | null;
  selectedCaseId: string;
  chartSize: {
    width: number;
    height: number;
  };
  effectiveChartSymbol: string;
  effectiveChartTimeframe: string;
  lastCandleTick: CandleTickState;
};

type UseChartDerivedDataResult = {
  candleMeta: ChartCandleMeta[];
  chartData: CandlestickData<UTCTimestamp>[];
  selectedCase: RunDetailsResponse["cases"][number] | null;
  priceBounds: {
    min: number;
    max: number;
    range: number;
  };
  feedDiagnostics: FeedDiagnostics;
  overlays: {
    markers: OverlayMarker[];
    lines: OverlayLine[];
  };
  legendCloseColor: string;
};

function useChartDerivedData({
  candles,
  runDetails,
  selectedCaseId,
  chartSize,
  effectiveChartSymbol,
  effectiveChartTimeframe,
  lastCandleTick,
}: UseChartDerivedDataParams): UseChartDerivedDataResult {
  const candleMeta = useMemo<ChartCandleMeta[]>(() => {
    return candles
      .map((item) => ({
        openTime: item.open_time,
        closeTime: item.close_time,
        time: toUtcTimestamp(item.open_time),
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
          Number.isFinite(item.close)
      );
  }, [candles]);

  const chartData = useMemo<CandlestickData<UTCTimestamp>[]>(() => {
    return candleMeta.map((item) => ({
      time: item.time,
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
    }));
  }, [candleMeta]);

  const selectedCase = useMemo(() => {
    if (!runDetails || !selectedCaseId) return null;
    return runDetails.cases.find((item) => item.id === selectedCaseId) ?? null;
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
    };
  }, [
    candles,
    candleMeta,
    effectiveChartSymbol,
    effectiveChartTimeframe,
    lastCandleTick,
  ]);

  const overlays = useMemo(() => {
    if (
      !selectedCase ||
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
      const normalized = (price - priceBounds.min) / priceBounds.range;
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
        time: selectedCase.trigger_candle_time || selectedCase.trigger_time,
        price: parsePrice(selectedCase.entry_price),
      },
      {
        id: "entry",
        label: "ENT",
        color: "#2563eb",
        time: selectedCase.entry_time,
        price: parsePrice(selectedCase.entry_price),
      },
      {
        id: "close",
        label: "CLS",
        color: getCaseAccentColor(selectedCase),
        time: selectedCase.close_time,
        price: parsePrice(selectedCase.close_price),
      },
    ];

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
  }, [selectedCase, candleMeta, chartSize, priceBounds]);

  const legendCloseColor = useMemo(() => {
    return getCaseAccentColor(selectedCase);
  }, [selectedCase]);

  return {
    candleMeta,
    chartData,
    selectedCase,
    priceBounds,
    feedDiagnostics,
    overlays,
    legendCloseColor,
  };
}

export default useChartDerivedData;