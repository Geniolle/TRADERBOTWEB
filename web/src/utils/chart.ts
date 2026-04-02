// src/utils/chart.ts

import type { IChartApi, UTCTimestamp } from "lightweight-charts";

import { CHART_RIGHT_OFFSET, CHART_VISIBLE_BARS } from "../constants/chart";
import type { RunDetailsCase } from "../types/trading";

export function toUtcTimestamp(value: string): UTCTimestamp {
  return Math.floor(new Date(value).getTime() / 1000) as UTCTimestamp;
}

export function getCaseAccentColor(item?: RunDetailsCase | null): string {
  if (!item) return "#64748b";

  const outcome = (item.outcome ?? "").toLowerCase();
  const status = (item.status ?? "").toLowerCase();

  if (outcome.includes("hit")) return "#16a34a";
  if (outcome.includes("fail")) return "#dc2626";
  if (outcome.includes("timeout")) return "#d97706";
  if (status.includes("closed")) return "#2563eb";
  return "#7c3aed";
}

export function applyStableVisibleRange(
  chart: IChartApi,
  totalBars: number
): void {
  const visibleBars = CHART_VISIBLE_BARS;
  const effectiveBars = Math.max(totalBars, visibleBars);
  const to = effectiveBars - 1 + CHART_RIGHT_OFFSET;
  const from = to - visibleBars + 1;

  chart.timeScale().setVisibleLogicalRange({ from, to });
}