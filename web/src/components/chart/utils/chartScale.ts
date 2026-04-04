// web/src/components/chart/utils/chartScale.ts

import type { CandlestickData, UTCTimestamp } from "lightweight-charts";
import { clamp } from "./chartMath";

type PriceScaleData = {
  levels: Array<{ value: number; top: number }>;
  currentPriceTop: number | null;
};

export function buildPriceScaleData(
  chartData: CandlestickData<UTCTimestamp>[],
  currentPrice: number | null,
  chartHeight: number
): PriceScaleData {
  if (chartData.length === 0) {
    return {
      levels: [],
      currentPriceTop: null,
    };
  }

  const minPrice = Math.min(...chartData.map((item) => item.low));
  const maxPrice = Math.max(...chartData.map((item) => item.high));

  const range = Math.max(maxPrice - minPrice, 0.00001);
  const padding = range * 0.08;
  const visualMin = minPrice - padding;
  const visualMax = maxPrice + padding;
  const visualRange = Math.max(visualMax - visualMin, 0.00001);

  const topPadding = 10;
  const bottomPadding = 10;
  const usableHeight = chartHeight - topPadding - bottomPadding;
  const totalSteps = 12;

  const levels = Array.from({ length: totalSteps + 1 }, (_, index) => {
    const ratio = index / totalSteps;
    const value = visualMax - visualRange * ratio;
    const top = topPadding + usableHeight * ratio;

    return { value, top };
  });

  let currentPriceTop: number | null = null;

  if (currentPrice !== null && Number.isFinite(currentPrice)) {
    const ratio = (visualMax - currentPrice) / visualRange;
    currentPriceTop = topPadding + usableHeight * clamp(ratio, 0, 1);
  }

  return {
    levels,
    currentPriceTop,
  };
}