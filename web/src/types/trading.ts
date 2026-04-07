// web/src/types/trading.ts

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

export type CandleListResponse = {
  symbol: string;
  timeframe: string;
  mode: "full" | "incremental";
  count: number;
  start_at: string;
  end_at: string;
  first_open_time: string | null;
  last_close_time: string | null;
  items: CandleItem[];
};

export type CandleCoverageMeta = {
  symbol: string;
  timeframe: string;
  mode: "full" | "incremental";
  count: number;
  start_at: string;
  end_at: string;
  first_open_time: string | null;
  last_close_time: string | null;
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
  coverageMode: string;
  coverageCount: number;
  coverageStartUtc: string;
  coverageEndUtc: string;
  coverageFirstOpenUtc: string;
  coverageLastCloseUtc: string;
  coverageFirstOpenLocal: string;
  coverageLastCloseLocal: string;
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
  enabled?: boolean;
  supports_chart_overlays?: boolean;
  strategy_family?: string | null;
};

export type StrategyListResponse =
  | StrategyItem[]
  | {
      items?: StrategyItem[];
      strategies?: StrategyItem[];
      data?: StrategyItem[];
    };

export type RunHistoryItem = {
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
  total_candles_processed?: number;
  total_cases_opened?: number;
  total_cases_closed?: number;
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
  total_candles_processed?: number;
  total_cases_opened?: number;
  total_cases_closed?: number;
  candles_count: number;
  cases_count: number;
};

export type StageTestLatestRun = {
  run_id: string | null;
  status: string | null;
  symbol: string | null;
  timeframe: string | null;
  started_at: string | null;
  finished_at: string | null;
};

export type StageTestSummaryItem = {
  strategy_key: string;
  strategy_name: string;
  strategy_description: string | null;
  strategy_category: string | null;
  total_runs: number;
  total_cases: number;
  total_hits: number;
  total_fails: number;
  total_timeouts: number;
  hit_rate: number;
  fail_rate: number;
  timeout_rate: number;
  last_run: StageTestLatestRun | null;
};

export type RunMetricItem = {
  name: string;
  value: number | string | null;
};

export type AnalysisSnapshot = {
  snapshot_version?: string;
  trigger_context?: {
    reference_time?: string | null;
    reference_price?: string | null;
    session?: string | null;
    day_of_week?: string | null;
    hour_of_day?: number | null;
  };
  trend?: {
    ema_5?: string | null;
    ema_10?: string | null;
    ema_20?: string | null;
    ema_30?: string | null;
    ema_40?: string | null;
    ema_alignment?: string | null;
    price_vs_ema_20?: string | null;
    price_vs_ema_40?: string | null;
    ema_5_slope?: string | null;
    ema_10_slope?: string | null;
    ema_20_slope?: string | null;
    ema_30_slope?: string | null;
    ema_40_slope?: string | null;
  };
  bollinger?: {
    period?: number | null;
    stddev?: string | null;
    upper?: string | null;
    middle?: string | null;
    lower?: string | null;
    bandwidth?: string | null;
    close_position_in_band?: string | null;
    closed_below_lower_band?: boolean | null;
    closed_above_upper_band?: boolean | null;
    reentered_inside_band_long?: boolean | null;
    reentered_inside_band_short?: boolean | null;
  };
  momentum?: {
    rsi_14?: string | null;
    rsi_zone?: string | null;
    rsi_slope?: string | null;
    macd_line?: string | null;
    macd_signal?: string | null;
    macd_histogram?: string | null;
    macd_state?: string | null;
    macd_histogram_slope?: string | null;
  };
  volatility?: {
    atr_14?: string | null;
    atr_regime?: string | null;
    candle_range?: string | null;
    candle_range_vs_atr?: string | null;
  };
  structure?: {
    market_structure?: string | null;
    entry_location?: string | null;
    distance_to_recent_support?: string | null;
    distance_to_recent_resistance?: string | null;
    distance_to_ema_20?: string | null;
    distance_to_ema_40?: string | null;
  };
  trigger_candle?: {
    open?: string | null;
    high?: string | null;
    low?: string | null;
    close?: string | null;
    body_size?: string | null;
    upper_wick?: string | null;
    lower_wick?: string | null;
    body_ratio?: string | null;
    candle_type?: string | null;
  };
  patterns?: {
    bb_reentry_long?: boolean | null;
    bb_reentry_short?: boolean | null;
    ema_trend_confirmed_long?: boolean | null;
    ema_trend_confirmed_short?: boolean | null;
    rsi_recovery_long?: boolean | null;
    rsi_recovery_short?: boolean | null;
    macd_confirmation_long?: boolean | null;
    macd_confirmation_short?: boolean | null;
    countertrend_long?: boolean | null;
    countertrend_short?: boolean | null;
  };
};

export type RunCaseMetadata = {
  strategy_key?: string;
  strategy_family?: string;
  trade_bias?: string;
  setup_type?: string;
  close_reason?: string;
  analysis_snapshot?: AnalysisSnapshot;
  [key: string]: unknown;
};

export type RunCaseItem = {
  id: string;
  case_number?: number | null;
  side?: string | null;
  status?: string | null;
  outcome?: string | null;
  trigger_price?: number | null;
  entry_price?: number | null;
  close_price?: number | null;
  target_price?: number | null;
  invalidation_price?: number | null;
  trigger_time?: string | null;
  trigger_candle_time?: string | null;
  entry_time?: string | null;
  close_time?: string | null;
  bars_to_resolution?: number | null;
  max_favorable_excursion?: string | number | null;
  max_adverse_excursion?: string | number | null;
  metadata?: RunCaseMetadata;
};

export type RunDetailsResponse = {
  run: RunSummary;
  metrics: RunMetricItem[] | Record<string, unknown> | null;
  cases: RunCaseItem[];
};