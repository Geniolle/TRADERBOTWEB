// web/src/hooks/useCandlestickChart.ts

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  LineSeries,
  LineStyle,
  createChart,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";

import {
  CHART_BAR_SPACING,
  CHART_HEIGHT,
  CHART_MIN_BAR_SPACING,
  CHART_RIGHT_OFFSET,
} from "../constants/chart";
import type { CandleItem } from "../types/trading";
import { applyStableVisibleRange, toUtcTimestamp } from "../utils/chart";
import type { ChartIndicatorSeries } from "./useChartIndicators";

type UseCandlestickChartParams = {
  candles: CandleItem[];
  indicatorSeries?: ChartIndicatorSeries[];
};

type UseCandlestickChartResult = {
  chartContainerRef: React.RefObject<HTMLDivElement | null>;
  chartSize: {
    width: number;
    height: number;
  };
  chartData: CandlestickData<UTCTimestamp>[];
};

const LISBON_TIME_FORMATTER = new Intl.DateTimeFormat("pt-PT", {
  timeZone: "Europe/Lisbon",
  hour: "2-digit",
  minute: "2-digit",
});

const LISBON_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("pt-PT", {
  timeZone: "Europe/Lisbon",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function toDateFromChartTime(value: Time): Date | null {
  if (typeof value === "number") {
    return new Date(value * 1000);
  }

  if (value && typeof value === "object" && "year" in value) {
    const year = Number(value.year);
    const month = Number(value.month);
    const day = Number(value.day);

    if (
      Number.isFinite(year) &&
      Number.isFinite(month) &&
      Number.isFinite(day)
    ) {
      return new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
    }
  }

  return null;
}

function formatLisbonTick(value: Time): string {
  const date = toDateFromChartTime(value);
  if (!date) return "";
  return LISBON_TIME_FORMATTER.format(date);
}

function formatLisbonDateTime(value: Time): string {
  const date = toDateFromChartTime(value);
  if (!date) return "";
  return LISBON_DATE_TIME_FORMATTER.format(date);
}

function buildChartData(candles: CandleItem[]): CandlestickData<UTCTimestamp>[] {
  const rawItems = candles
    .map((item) => ({
      time: toUtcTimestamp(item.open_time),
      open: Number(item.open),
      high: Number(item.high),
      low: Number(item.low),
      close: Number(item.close),
    }))
    .filter(
      (item) =>
        Number.isFinite(item.time) &&
        Number.isFinite(item.open) &&
        Number.isFinite(item.high) &&
        Number.isFinite(item.low) &&
        Number.isFinite(item.close)
    )
    .sort((a, b) => Number(a.time) - Number(b.time));

  const dedupedMap = new Map<number, CandlestickData<UTCTimestamp>>();
  let duplicateCount = 0;

  for (const item of rawItems) {
    const key = Number(item.time);

    if (dedupedMap.has(key)) {
      duplicateCount += 1;
    }

    dedupedMap.set(key, item);
  }

  const dedupedItems = Array.from(dedupedMap.values()).sort(
    (a, b) => Number(a.time) - Number(b.time)
  );

  if (duplicateCount > 0) {
    console.warn("[CHART] candles duplicados removidos antes do setData()", {
      totalRaw: rawItems.length,
      totalDeduped: dedupedItems.length,
      duplicatesRemoved: duplicateCount,
      duplicatedTimes: rawItems
        .map((item) => Number(item.time))
        .filter((time, index, array) => array.indexOf(time) !== index),
    });
  }

  return dedupedItems;
}

function useCandlestickChart({
  candles,
  indicatorSeries = [],
}: UseCandlestickChartParams): UseCandlestickChartResult {
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const indicatorSeriesRefs = useRef<Map<string, ISeriesApi<"Line">>>(new Map());
  const lastRenderedChartDataRef = useRef<CandlestickData<UTCTimestamp>[]>([]);

  const [chartSize, setChartSize] = useState({
    width: 0,
    height: CHART_HEIGHT,
  });

  const chartData = useMemo<CandlestickData<UTCTimestamp>[]>(() => {
    return buildChartData(candles);
  }, [candles]);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const container = chartContainerRef.current;
    const width = Math.max(container.clientWidth, 300);
    const height = CHART_HEIGHT;

    if (!chartRef.current) {
      const chart = createChart(container, {
        width,
        height,
        layout: {
          background: { type: ColorType.Solid, color: "#ffffff" },
          textColor: "#222222",
        },
        grid: {
          vertLines: { color: "#eef2f7" },
          horzLines: { color: "#eef2f7" },
        },
        leftPriceScale: {
          visible: false,
        },
        rightPriceScale: {
          visible: true,
          autoScale: true,
          borderVisible: true,
          borderColor: "#dbe2ea",
          scaleMargins: {
            top: 0.08,
            bottom: 0.08,
          },
          minimumWidth: 72,
          entireTextOnly: true,
          ticksVisible: true,
        },
        timeScale: {
          borderColor: "#dbe2ea",
          timeVisible: true,
          secondsVisible: false,
          rightOffset: CHART_RIGHT_OFFSET,
          barSpacing: CHART_BAR_SPACING,
          minBarSpacing: CHART_MIN_BAR_SPACING,
          fixLeftEdge: false,
          fixRightEdge: false,
          lockVisibleTimeRangeOnResize: true,
          tickMarkFormatter: formatLisbonTick,
        },
        localization: {
          locale: "pt-PT",
          priceFormatter: (price: number) => price.toFixed(5),
          timeFormatter: formatLisbonDateTime,
        },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: {
            visible: true,
            labelVisible: true,
            width: 1,
            style: LineStyle.LargeDashed,
            color: "rgba(100, 116, 139, 0.75)",
            labelBackgroundColor: "#0f172a",
          },
          horzLine: {
            visible: true,
            labelVisible: true,
            width: 1,
            style: LineStyle.LargeDashed,
            color: "rgba(100, 116, 139, 0.75)",
            labelBackgroundColor: "#475569",
          },
        },
      });

      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: "#16a34a",
        downColor: "#dc2626",
        wickUpColor: "#16a34a",
        wickDownColor: "#dc2626",
        borderUpColor: "#16a34a",
        borderDownColor: "#dc2626",
        priceLineVisible: true,
        priceLineWidth: 1,
        priceLineStyle: LineStyle.LargeDashed,
        priceLineColor: "#2563eb",
        lastValueVisible: true,
        title: "",
      });

      chartRef.current = chart;
      candleSeriesRef.current = candleSeries;
    }

    const chart = chartRef.current;
    const indicatorMap = indicatorSeriesRefs.current;

    chart.applyOptions({
      width,
      height,
      rightPriceScale: {
        visible: true,
        autoScale: true,
        borderVisible: true,
        borderColor: "#dbe2ea",
        scaleMargins: {
          top: 0.08,
          bottom: 0.08,
        },
        minimumWidth: 72,
        entireTextOnly: true,
        ticksVisible: true,
      },
      timeScale: {
        borderColor: "#dbe2ea",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: CHART_RIGHT_OFFSET,
        barSpacing: CHART_BAR_SPACING,
        minBarSpacing: CHART_MIN_BAR_SPACING,
        fixLeftEdge: false,
        fixRightEdge: false,
        lockVisibleTimeRangeOnResize: true,
        tickMarkFormatter: formatLisbonTick,
      },
      localization: {
        locale: "pt-PT",
        priceFormatter: (price: number) => price.toFixed(5),
        timeFormatter: formatLisbonDateTime,
      },
    });

    setChartSize({ width, height });

    if (candleSeriesRef.current) {
      if (chartData.length > 0) {
        candleSeriesRef.current.setData(chartData);
        lastRenderedChartDataRef.current = chartData;
      } else if (lastRenderedChartDataRef.current.length > 0) {
        candleSeriesRef.current.setData(lastRenderedChartDataRef.current);

        console.warn(
          "[CHART] dataset vazio recebido; último snapshot válido foi preservado",
          {
            preservedCount: lastRenderedChartDataRef.current.length,
          }
        );
      } else {
        candleSeriesRef.current.setData([]);
      }
    }

    const incomingIds = new Set(indicatorSeries.map((item) => item.id));

    for (const [seriesId, seriesRef] of indicatorMap.entries()) {
      if (!incomingIds.has(seriesId)) {
        chart.removeSeries(seriesRef);
        indicatorMap.delete(seriesId);
      }
    }

    for (const indicator of indicatorSeries) {
      let seriesRef = indicatorMap.get(indicator.id);

      if (!seriesRef) {
        seriesRef = chart.addSeries(LineSeries, {
          color: indicator.color,
          lineWidth: indicator.lineWidth ?? 2,
          lineStyle: indicator.lineStyle,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        });

        indicatorMap.set(indicator.id, seriesRef);
      }

      seriesRef.applyOptions({
        color: indicator.color,
        lineWidth: indicator.lineWidth ?? 2,
        lineStyle: indicator.lineStyle,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });

      seriesRef.setData(indicator.data);
    }

    if (chartData.length > 0) {
      applyStableVisibleRange(chart, chartData.length);
      chart.timeScale().scrollToRealTime();
    } else if (lastRenderedChartDataRef.current.length > 0) {
      applyStableVisibleRange(chart, lastRenderedChartDataRef.current.length);
      chart.timeScale().scrollToRealTime();
    } else {
      chart.timeScale().fitContent();
    }

    const handleResize = () => {
      if (!chartContainerRef.current || !chartRef.current) return;

      const nextWidth = Math.max(chartContainerRef.current.clientWidth, 300);

      chartRef.current.applyOptions({
        width: nextWidth,
        height: CHART_HEIGHT,
      });

      setChartSize({
        width: nextWidth,
        height: CHART_HEIGHT,
      });

      if (lastRenderedChartDataRef.current.length > 0) {
        applyStableVisibleRange(
          chartRef.current,
          lastRenderedChartDataRef.current.length
        );
        chartRef.current.timeScale().scrollToRealTime();
      } else {
        chartRef.current.timeScale().fitContent();
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [chartData, indicatorSeries]);

  useEffect(() => {
    const indicatorMap = indicatorSeriesRefs.current;

    return () => {
      indicatorMap.clear();
      lastRenderedChartDataRef.current = [];

      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }

      candleSeriesRef.current = null;
    };
  }, []);

  return {
    chartContainerRef,
    chartSize,
    chartData,
  };
}

export default useCandlestickChart;