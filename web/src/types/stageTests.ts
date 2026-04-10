// web/src/types/stageTests.ts

export interface StageTestOptionItem {
  symbol: string;
  timeframe: string;
  candles_count: number;
  first_candle: string;
  last_candle: string;
}

export interface StageTestOptionsResponse {
  strategies: string[];
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