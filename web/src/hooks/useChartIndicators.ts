// web/src/hooks/useChartIndicators.ts

import { useMemo } from "react";
import { LineStyle, type LineData, type UTCTimestamp } from "lightweight-charts";

import type { CandleItem } from "../types/trading";
import type { IndicatorSettings } from "./useIndicatorSettings";
import {
  calculateBollingerBands,
  calculateEMA,
  type NumericPoint,
} from "../utils/indicators";
import { toUtcTimestamp } from "../utils/chart";

export type ChartIndicatorSeries = {
  id: string;
  label: string;
  color: string;
  lineWidth?: 1 | 2 | 3 | 4;
  lineStyle?: LineStyle;
  data: LineData<UTCTimestamp>[];
};

type UseChartIndicatorsParams = {
  candles: CandleItem[];
  settings: IndicatorSettings;
};

type UseChartIndicatorsResult = {
  series: ChartIndicatorSeries[];
  activeLabels: string[];
};

function useChartIndicators({
  candles,
  settings,
}: UseChartIndicatorsParams): UseChartIndicatorsResult {
  const closeSeries = useMemo<NumericPoint[]>(() => {
    return candles
      .map((item) => ({
        time: item.open_time,
        value: Number(item.close),
      }))
      .filter((item) => Number.isFinite(item.value));
  }, [candles]);

  const series = useMemo<ChartIndicatorSeries[]>(() => {
    const nextSeries: ChartIndicatorSeries[] = [];

    if (settings.ema9) {
      const ema9 = calculateEMA(closeSeries, 9);

      nextSeries.push({
        id: "ema9",
        label: "EMA 9",
        color: "#2563eb",
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        data: ema9.map((item) => ({
          time: toUtcTimestamp(item.time),
          value: item.value,
        })),
      });
    }

    if (settings.ema21) {
      const ema21 = calculateEMA(closeSeries, 21);

      nextSeries.push({
        id: "ema21",
        label: "EMA 21",
        color: "#f59e0b",
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        data: ema21.map((item) => ({
          time: toUtcTimestamp(item.time),
          value: item.value,
        })),
      });
    }

    if (settings.bollinger) {
      const bands = calculateBollingerBands(
        closeSeries,
        settings.bollingerPeriod,
        settings.bollingerStdDev
      );

      nextSeries.push(
        {
          id: "bb-upper",
          label: `BB Upper (${settings.bollingerPeriod}, ${settings.bollingerStdDev})`,
          color: "#e5e7eb",
          lineWidth: 2,
          lineStyle: LineStyle.Solid,
          data: bands.map((item) => ({
            time: toUtcTimestamp(item.time),
            value: item.upper,
          })),
        },
        {
          id: "bb-middle",
          label: `BB Middle (${settings.bollingerPeriod}, ${settings.bollingerStdDev})`,
          color: "#fbbf24",
          lineWidth: 2,
          lineStyle: LineStyle.Solid,
          data: bands.map((item) => ({
            time: toUtcTimestamp(item.time),
            value: item.middle,
          })),
        },
        {
          id: "bb-lower",
          label: `BB Lower (${settings.bollingerPeriod}, ${settings.bollingerStdDev})`,
          color: "#e5e7eb",
          lineWidth: 2,
          lineStyle: LineStyle.Solid,
          data: bands.map((item) => ({
            time: toUtcTimestamp(item.time),
            value: item.lower,
          })),
        }
      );
    }

    return nextSeries;
  }, [closeSeries, settings]);

  const activeLabels = useMemo(() => {
    const labels: string[] = [];

    if (settings.ema9) labels.push("EMA 9");
    if (settings.ema21) labels.push("EMA 21");
    if (settings.bollinger) {
      labels.push(`Bollinger (${settings.bollingerPeriod}, ${settings.bollingerStdDev})`);
    }

    return labels;
  }, [settings]);

  return {
    series,
    activeLabels,
  };
}

export default useChartIndicators;