export type StageTestOptionItem = {
  symbol: string;
  timeframe: string;
  candles_count: number;
  first_candle: string;
  last_candle: string;
};

export type StageTestOptionsResponse = {
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

export type StageTestRunResponse = {
  ok: boolean;
  command: string[];
  symbol: string;
  timeframe: string;
  strategy: string;
  stdout: string;
  stderr: string;
  return_code: number;
};