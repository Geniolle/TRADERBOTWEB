// src/types/trading.ts

export type CatalogProductSummary = {
  code: string;
  label: string;
  description: string;
  total_subproducts: number;
  total_items: number;
};

export type CatalogSubproduct = {
  code: string;
  label: string;
  description: string;
};

export type CatalogInstrument = {
  symbol: string;
  display_name: string;
  base_asset: string;
  quote_asset: string;
};

export type CatalogProductsResponse = {
  products: CatalogProductSummary[];
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

export type CandleTickState =
  | {
      symbol: string;
      timeframe: string;
      open_time: string;
      open: number;
      high: number;
      low: number;
      close: number;
      count: number;
      source: string | null;
      provider: string | null;
      market_session: string | null;
      timezone: string | null;
      is_delayed: boolean | null;
      is_mock: boolean | null;
    }
  | null;

export type WsEnvelope = {
  event?: string;
  data?: {
    message?: string;
    count?: number | string;
    reason?: string;
    symbol?: string;
    timeframe?: string;
    open_time?: string;
    open?: number | string;
    high?: number | string;
    low?: number | string;
    close?: number | string;
    source?: string;
    provider?: string;
    market_session?: string;
    timezone?: string;
    is_delayed?: boolean;
    is_mock?: boolean;
    candles?: CandleItem[];
    start_at?: string;
    end_at?: string;
    poll_seconds?: number;
  };
};

export type OverlayLine = {
  id: string;
  label: string;
  value: number;
  top: number;
  color: string;
  dashed?: boolean;
};

export type OverlayMarker = {
  id: string;
  label: string;
  price: number;
  left: number;
  top: number;
  color: string;
  timeLabel: string;
};

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
  strategy_config_id: string | null;
  symbol: string;
  timeframe: string;
  status: string;
  mode: string;
  started_at: string | null;
  finished_at: string | null;
  candles_count: number;
  cases_count: number;
};

export type RunSummary = {
  id: string;
  strategy_key: string | null;
  strategy_config_id: string | null;
  symbol: string;
  timeframe: string;
  status: string;
  mode: string;
  start_at: string | null;
  end_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  candles_count: number;
  cases_count: number;
};

export type RunMetricItem = {
  name: string;
  value: number | string | null;
};

export type RunCaseItem = {
  id: string;
  case_number?: number | null;
  side?: string | null;
  status?: string | null;
  trigger_price?: number | null;
  entry_price?: number | null;
  close_price?: number | null;
  target_price?: number | null;
  invalidation_price?: number | null;
  trigger_time?: string | null;
  trigger_candle_time?: string | null;
  entry_time?: string | null;
  close_time?: string | null;
  metadata?: Record<string, unknown>;
};

export type RunDetailsResponse = {
  run: RunSummary;
  metrics: RunMetricItem[];
  cases: RunCaseItem[];
};