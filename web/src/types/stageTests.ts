// C:\TraderBotWeb\web\src\types\stageTests.ts
// Backend:
// - GET  /api/v1/stage-tests/options
// - POST /api/v1/stage-tests/run

export type StageTestStrategyOption = {
  key: string;
  label: string;
  description: string | null;
};

export type StageTestOptionItem = {
  symbol: string;
  timeframe: string;
  candles_count: number;
  first_candle: string | null;
  last_candle: string | null;
};

export type StageTestOptionsResponse = {
  strategies: StageTestStrategyOption[];
  items: StageTestOptionItem[];
  refreshed_at: string;
};

export type StageTestRunRequest = {
  symbol: string;
  timeframe: string;
  strategy: string;
  min_candles: number;
  extra_args: string[];
};

export type StageTestMetrics = {
  strategy_class: string;
  runtime_strategy: string;
  total_candles: number;
  warmup: number;
  triggers: number;
  open_cases_final: number;
  closed_cases: number;
  hits: number;
  fails: number;
  timeouts: number;
  others: number;
  hit_rate: number;
  fail_rate: number;
  timeout_rate: number;
  first_candle: string | null;
  last_candle: string | null;
};

export type StageTestRunResponse = {
  ok: boolean;
  command: string[];
  symbol: string;
  timeframe: string;
  strategy: string;
  stdout: string;
  stderr: string;
  return_code: number;
  metrics: StageTestMetrics | null;
};