// web/src/types/stageTests.ts

import type { StageTestRunCaseItem } from "./trading";

export interface StageTestOptionItem {
  symbol: string;
  timeframe: string;
  candles_count: number;
  first_candle: string;
  last_candle: string;
}

export interface StageTestStrategyOption {
  key: string;
  label: string;
  description?: string | null;
}

export interface StageTestOptionsResponse {
  strategies: StageTestStrategyOption[];
  items: StageTestOptionItem[];
  refreshed_at: string;
}

export interface StageTestRunRequest {
  symbol: string;
  timeframe: string;
  strategy: string;
  min_candles?: number;
  extra_args?: string[];
}

export interface StageTestRunMetrics {
  strategy_class?: string | null;
  runtime_strategy?: string | null;
  total_candles?: number | null;
  warmup?: number | null;
  triggers?: number | null;
  closed_cases?: number | null;
  hits?: number | null;
  fails?: number | null;
  timeouts?: number | null;
  hit_rate?: number | null;
  fail_rate?: number | null;
  timeout_rate?: number | null;
  first_candle?: string | null;
  last_candle?: string | null;
}

export interface StageTestRunOrdersSummary {
  policy_enabled?: boolean;
  min_confirmation_score?: number;
  max_orders_per_run?: number;
  test_mode?: boolean;
  quote_order_qty?: string;
  total_cases?: number;
  eligible_cases?: number;
  attempted_orders?: number;
  created_orders?: number;
  failed_orders?: number;
  skipped_orders?: number;
  service_error?: string;
}

export interface StageTestRunResponse {
  ok: boolean;
  command: string[];
  return_code: number;
  stdout: string;
  stderr: string;
  metrics?: StageTestRunMetrics | null;
  cases?: StageTestRunCaseItem[] | null;
  orders?: StageTestRunOrdersSummary | null;
  persisted?: boolean;
  persisted_run_id?: string | null;
  persistence_error?: string | null;
}
