// web/src/hooks/useCandlestickChart.ts

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  LineSeries,
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

function useCandlestickChart({
  candles,
  indicatorSeries = [],
}: UseCandlestickChartParams): UseCandlestickChartResult {
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const indicatorSeriesRefs = useRef<Map<string, ISeriesApi<"Line">>>(new Map());

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
        rightPriceScale: {
          borderColor: "#dbe2ea",
        },
        timeScale: {
          borderColor: "#dbe2ea",
          timeVisible: true,
          secondsVisible: true,
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
      });

      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: "#16a34a",
        downColor: "#dc2626",
        wickUpColor: "#16a34a",
        wickDownColor: "#dc2626",
        borderUpColor: "#16a34a",
        borderDownColor: "#dc2626",
      });

      chartRef.current = chart;
      candleSeriesRef.current = candleSeries;
    }

    const chart = chartRef.current;
    const indicatorMap = indicatorSeriesRefs.current;

    chart.applyOptions({ width, height });
    setChartSize({ width, height });

    if (candleSeriesRef.current) {
      candleSeriesRef.current.setData(chartData);
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
      });

      setChartSize({
        width: nextWidth,
        height: CHART_HEIGHT,
      });

      if (chartData.length > 0) {
        applyStableVisibleRange(chartRef.current, chartData.length);
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