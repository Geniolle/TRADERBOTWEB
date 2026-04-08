// src/utils/candles.ts

import type { CandleItem, CandleTickState } from "../types/trading";

export function buildFallbackStartAt(): string {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return date.toISOString();
}

export function buildRealtimeTestStartAt(): string {
  const date = new Date();
  date.setHours(date.getHours() - 3);
  return date.toISOString();
}

function toCandleTimestamp(value: string): number {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function getCandleKey(value: { open_time: string }): string {
  return String(toCandleTimestamp(value.open_time));
}

export function normalizeCandles(items: CandleItem[]): CandleItem[] {
  const map = new Map<string, CandleItem>();

  for (const item of items) {
    map.set(getCandleKey(item), item);
  }

  return Array.from(map.values()).sort(
    (a, b) => toCandleTimestamp(a.open_time) - toCandleTimestamp(b.open_time)
  );
}

export function upsertRealtimeCandle(
  previous: CandleItem[],
  tick: NonNullable<CandleTickState>
): CandleItem[] {
  const nextCandle: CandleItem = {
    id: `ws-${tick.symbol}-${tick.timeframe}-${tick.open_time}`,
    asset_id: null,
    symbol: tick.symbol,
    timeframe: tick.timeframe,
    open_time: tick.open_time,
    close_time: tick.open_time,
    open: tick.open.toString(),
    high: tick.high.toString(),
    low: tick.low.toString(),
    close: tick.close.toString(),
    volume: "0",
    source: tick.source ?? "websocket",
    provider: tick.provider ?? null,
    market_session: tick.market_session ?? null,
    timezone: tick.timezone ?? null,
    is_delayed: tick.is_delayed ?? null,
    is_mock: tick.is_mock ?? null,
  };

  const nextKey = getCandleKey(nextCandle);

  const existingIndex = previous.findIndex(
    (item) => getCandleKey(item) === nextKey
  );

  if (existingIndex >= 0) {
    const updated = previous.slice();
    updated[existingIndex] = nextCandle;
    return normalizeCandles(updated);
  }

  return normalizeCandles([...previous, nextCandle]);
}