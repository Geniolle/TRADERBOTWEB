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

export function normalizeCandles(items: CandleItem[]): CandleItem[] {
  return items
    .slice()
    .sort(
      (a, b) => new Date(a.open_time).getTime() - new Date(b.open_time).getTime()
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

  const existingIndex = previous.findIndex(
    (item) => item.open_time === tick.open_time
  );

  if (existingIndex >= 0) {
    const updated = previous.slice();
    updated[existingIndex] = nextCandle;
    return normalizeCandles(updated);
  }

  return normalizeCandles([...previous, nextCandle]);
}