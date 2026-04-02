// src/hooks/useCandlestickChart.ts

import { useEffect, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type UTCTimestamp,
} from "lightweight-charts";

import {
  CHART_BAR_SPACING,
  CHART_HEIGHT,
  CHART_MIN_BAR_SPACING,
  CHART_RIGHT_OFFSET,
} from "../constants/chart";
import { applyStableVisibleRange } from "../utils/chart";

type UseCandlestickChartParams = {
  chartData: CandlestickData<UTCTimestamp>[];
};

type UseCandlestickChartResult = {
  chartContainerRef: React.RefObject<HTMLDivElement | null>;
  chartSize: {
    width: number;
    height: number;
  };
};

function useCandlestickChart({
  chartData,
}: UseCandlestickChartParams): UseCandlestickChartResult {
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  const [chartSize, setChartSize] = useState({
    width: 0,
    height: CHART_HEIGHT,
  });

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
          priceFormatter: (price: number) => price.toFixed(2),
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

    chartRef.current.applyOptions({ width, height });
    setChartSize({ width, height });

    if (candleSeriesRef.current) {
      candleSeriesRef.current.setData(chartData);
    }

    if (chartData.length > 0 && chartRef.current) {
      applyStableVisibleRange(chartRef.current, chartData.length);
      chartRef.current.timeScale().scrollToRealTime();
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
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [chartData]);

  useEffect(() => {
    return () => {
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        candleSeriesRef.current = null;
      }
    };
  }, []);

  return {
    chartContainerRef,
    chartSize,
  };
}

export default useCandlestickChart;