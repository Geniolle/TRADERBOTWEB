// src/constants/config.ts

function readNumberEnv(
  rawValue: unknown,
  fallback: number,
  options?: { min?: number; max?: number }
): number {
  const parsed = Number(rawValue);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  let value = parsed;

  if (typeof options?.min === "number") {
    value = Math.max(options.min, value);
  }

  if (typeof options?.max === "number") {
    value = Math.min(options.max, value);
  }

  return value;
}

export const API_HTTP_BASE_URL = "http://127.0.0.1:8000/api/v1";
export const API_WS_BASE_URL = "ws://127.0.0.1:8000/api/v1/ws";
export const API_PROVIDERS_URL = `${API_HTTP_BASE_URL}/providers`;

export const FORCE_REALTIME_TEST = false;
export const FORCED_REALTIME_SYMBOL = "";
export const FORCED_REALTIME_TIMEFRAME = "";

export const CHART_STRATEGY_HIGHLIGHT_MIN_SCORE = readNumberEnv(
  import.meta.env.VITE_CHART_STRATEGY_HIGHLIGHT_MIN_SCORE,
  80,
  { min: 0, max: 100 }
);