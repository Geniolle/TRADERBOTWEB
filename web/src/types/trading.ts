// src/types/trading.ts

import type { UTCTimestamp } from "lightweight-charts";

export type HealthResponse = {
  status: string;
  app_name: string;
  environment: string;
};

export type StrategyItem = {
  key: string;
  name: string;
  version: string;
  description: string;
  category: string;
};

export type RunHistoryItem = {
  id: string;
  strategy_key: string | null;
  strategy_config_id: string;
  mode: string;
  asset_id: string | null;
  symbol: string;
  timeframe: string;
  start_at: string;
  end_at: string;
  status: string;
  total_candles_processed: number;
  total_cases_opened: number;
  total_cases_closed: number;
  started_at: string | null;
  finished_at: string | null;
};

export type RunDetailsMetrics = {
  run_id: string;
  total_cases: number;
  total_hits: number;
  total_fails: number;
  total_timeouts: number;
  hit_rate: string;
  fail_rate: string;
  timeout_rate: string;
  avg_bars_to_resolution: string;
  avg_time_to_resolution_seconds: string;
  avg_mfe: string;
  avg_mae: string;
} | null;

export type RunDetailsCase = {
  id: string;
  run_id: string;
  strategy_config_id: string;
  asset_id: string | null;
  symbol: string;
  timeframe: string;
  trigger_time: string;
  trigger_candle_time: string;
  entry_time: string;
  entry_price: string;
  target_price: string;
  invalidation_price: string;
  timeout_at: string | null;
  status: string;
  outcome: string | null;
  close_time: string | null;
  close_price: string | null;
  bars_to_resolution: number;
  max_favorable_excursion: string;
  max_adverse_excursion: string;
  metadata: Record<string, unknown>;
};

export type RunDetailsResponse = {
  run: RunHistoryItem;
  metrics: RunDetailsMetrics;
  cases: RunDetailsCase[];
};

export type CandleItem = {
  id: string;
  asset_id: string | null;
  symbol: string;
  timeframe: string;
  open_time: string;
  close_time: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  source: string | null;
  provider?: string | null;
  market_session?: string | null;
  timezone?: string | null;
  is_delayed?: boolean | null;
  is_mock?: boolean | null;
};

export type ChartCandleMeta = {
  openTime: string;
  closeTime: string;
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type OverlayMarker = {
  id: string;
  label: string;
  color: string;
  left: number;
  top: number;
  price: number;
  timeLabel: string;
};

export type OverlayLine = {
  id: string;
  label: string;
  color: string;
  top: number;
  value: number;
  dashed?: boolean;
};

export type CatalogProductSummary = {
  code: string;
  label: string;
  description: string;
  total_subproducts: number;
  total_items: number;
};

export type CatalogProductsResponse = {
  products: CatalogProductSummary[];
};

export type CatalogInstrument = {
  symbol: string;
  display_name: string;
  base_asset: string;
  quote_asset: string;
};

export type CatalogSubproduct = {
  code: string;
  label: string;
  description: string;
  items: CatalogInstrument[];
};

export type CatalogProductResponse = {
  code: string;
  label: string;
  description: string;
  subproducts: CatalogSubproduct[];
};

export type CatalogItemsResponse = {
  product: string;
  subproduct: string | null;
  total_items: number;
  items: CatalogInstrument[];
};

export type WsEnvelope = {
  event: string;
  data?: Record<string, unknown>;
};

export type CandleTickState = {
  symbol: string;
  timeframe: string;
  open_time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  count: number;
  source?: string | null;
  provider?: string | null;
  market_session?: string | null;
  timezone?: string | null;
  is_delayed?: boolean | null;
  is_mock?: boolean | null;
} | null;

export type FeedDiagnostics = {
  symbol: string;
  timeframe: string;
  totalCandles: number;
  firstCandleUtc: string;
  lastCandleUtc: string;
  firstCandleLocal: string;
  lastCandleLocal: string;
  lastClose: string;
  priceRange: string;
  candleSource: string;
  candleProvider: string;
  candleSession: string;
  candleTimezone: string;
  candleIsDelayed: string;
  candleIsMock: string;
  lastTickUtc: string;
  lastTickLocal: string;
  tickSource: string;
  tickProvider: string;
  tickSession: string;
  tickTimezone: string;
  tickIsDelayed: string;
  tickIsMock: string;
  runtimeTimezone: string;
};