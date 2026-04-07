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

function areCandlesEqual(
  left: CandlestickData<UTCTimestamp>,
  right: CandlestickData<UTCTimestamp>
): boolean {
  return (
    left.time === right.time &&
    left.open === right.open &&
    left.high === right.high &&
    left.low === right.low &&
    left.close === right.close
  );
}

function useCandlestickChart({
  candles,
  indicatorSeries = [],
}: UseCandlestickChartParams): UseCandlestickChartResult {
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const indicatorSeriesRefs = useRef<Map<string, ISeriesApi<"Line">>>(new Map());
  const previousChartDataRef = useRef<CandlestickData<UTCTimestamp>[]>([]);

  const [chartSize, setChartSize] = useState({
    width: 0,
    height: CHART_HEIGHT,
  });

  const chartData = useMemo<CandlestickData<UTCTimestamp>[]>(() => {
    return candles
      .map((item) => ({
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
        },
        localization: {
          priceFormatter: (price: number) => price.toFixed(5),
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

    setChartSize({ width, height });

    if (candleSeriesRef.current) {
      candleSeriesRef.current.applyOptions({
        priceLineVisible: true,
        priceLineWidth: 1,
        priceLineStyle: LineStyle.LargeDashed,
        priceLineColor: "#2563eb",
        lastValueVisible: true,
      });

      const previousData = previousChartDataRef.current;
      const nextData = chartData;

      const canUseIncrementalUpdate =
        previousData.length > 0 &&
        nextData.length > 0 &&
        (nextData.length === previousData.length ||
          nextData.length === previousData.length + 1);

      if (!canUseIncrementalUpdate) {
        candleSeriesRef.current.setData(nextData);
      } else {
        const previousLast = previousData[previousData.length - 1];
        const nextLast = nextData[nextData.length - 1];

        const samePrefix =
          previousData.length === 1 ||
          previousData
            .slice(0, Math.max(previousData.length - 1, 0))
            .every((item, index) => {
              const candidate = nextData[index];
              return Boolean(candidate) && areCandlesEqual(item, candidate);
            });

        if (!samePrefix || !nextLast) {
          candleSeriesRef.current.setData(nextData);
        } else if (
          previousLast &&
          previousLast.time === nextLast.time &&
          !areCandlesEqual(previousLast, nextLast)
        ) {
          candleSeriesRef.current.update(nextLast);
        } else if (
          previousLast &&
          previousLast.time !== nextLast.time &&
          nextData.length === previousData.length + 1
        ) {
          candleSeriesRef.current.update(nextLast);
        } else if (!previousLast) {
          candleSeriesRef.current.setData(nextData);
        } else if (!areCandlesEqual(previousLast, nextLast)) {
          candleSeriesRef.current.setData(nextData);
        }
      }

      previousChartDataRef.current = nextData;
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
    } else {
      chart.timeScale().fitContent();
    }

    const handleResize = () => {
      if (!chartContainerRef.current || !chartRef.current) return;

      const nextWidth = Math.max(chartContainerRef.current.clientWidth, 300);

      chartRef.current.applyOptions({
        width: nextWidth,
        height: CHART_HEIGHT,
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

      setChartSize({
        width: nextWidth,
        height: CHART_HEIGHT,
      });

      if (previousChartDataRef.current.length > 0) {
        applyStableVisibleRange(chartRef.current, previousChartDataRef.current.length);
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
      previousChartDataRef.current = [];

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