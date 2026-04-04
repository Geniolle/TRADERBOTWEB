// web/src/components/chart/hooks/useCurrentPrice.ts

import type { CandleTickState } from "../../../types/trading";

export function getCurrentPrice(
  candles: Array<{ open_time: string; close?: string }>,
  lastCandleTick: CandleTickState
): number | null {
  if (lastCandleTick && Number.isFinite(lastCandleTick.close)) {
    return lastCandleTick.close;
  }

  const lastCandle = candles[candles.length - 1];
  if (!lastCandle) return null;

  const parsed = Number(lastCandle.close);
  return Number.isFinite(parsed) ? parsed : null;
}