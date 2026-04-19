// src/constants/config.ts

function readStringEnv(rawValue: unknown): string {
  return typeof rawValue === "string" ? rawValue.trim().replace(/\/$/, "") : "";
}

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

function readBooleanEnv(rawValue: unknown, fallback: boolean): boolean {
  if (typeof rawValue === "boolean") {
    return rawValue;
  }

  if (typeof rawValue === "string") {
    const normalized = rawValue.trim().toLowerCase();
    if (["1", "true", "yes", "y", "on"].includes(normalized)) {
      return true;
    }
    if (["0", "false", "no", "n", "off"].includes(normalized)) {
      return false;
    }
  }

  return fallback;
}

function toWebSocketOrigin(httpOrigin: string): string {
  if (httpOrigin.startsWith("https://")) {
    return `wss://${httpOrigin.slice("https://".length)}`;
  }

  if (httpOrigin.startsWith("http://")) {
    return `ws://${httpOrigin.slice("http://".length)}`;
  }

  return httpOrigin;
}

function resolveApiOriginBaseUrl(): string {
  return readStringEnv(import.meta.env.VITE_API_BASE_URL);
}

function resolveApiWebSocketBaseUrl(apiOriginBaseUrl: string): string {
  const configuredWsBase = readStringEnv(import.meta.env.VITE_API_WS_BASE_URL);

  if (configuredWsBase) {
    return configuredWsBase;
  }

  if (apiOriginBaseUrl) {
    return `${toWebSocketOrigin(apiOriginBaseUrl)}/api/v1/ws`;
  }

  if (typeof window !== "undefined") {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}/api/v1/ws`;
  }

  return "ws://localhost:8000/api/v1/ws";
}

export const API_ORIGIN_BASE_URL = resolveApiOriginBaseUrl();
export const API_HTTP_BASE_URL = API_ORIGIN_BASE_URL
  ? `${API_ORIGIN_BASE_URL}/api/v1`
  : "/api/v1";
export const API_WS_BASE_URL = resolveApiWebSocketBaseUrl(API_ORIGIN_BASE_URL);
export const API_PROVIDERS_URL = `${API_HTTP_BASE_URL}/providers`;

export const FORCE_REALTIME_TEST = false;
export const FORCED_REALTIME_SYMBOL = "";
export const FORCED_REALTIME_TIMEFRAME = "";

export const CHART_STRATEGY_HIGHLIGHT_MIN_SCORE = readNumberEnv(
  import.meta.env.VITE_CHART_STRATEGY_HIGHLIGHT_MIN_SCORE,
  80,
  { min: 0, max: 100 }
);

export const REALTIME_AUTO_ORDER_ENABLED = readBooleanEnv(
  import.meta.env.VITE_REALTIME_AUTO_ORDER_ENABLED,
  true,
);

export const REALTIME_AUTO_ORDER_MIN_SCORE = readNumberEnv(
  import.meta.env.VITE_REALTIME_AUTO_ORDER_MIN_SCORE,
  100,
  { min: 0, max: 100 },
);

export const REALTIME_AUTO_ORDER_QUOTE_QTY = readNumberEnv(
  import.meta.env.VITE_REALTIME_AUTO_ORDER_QUOTE_QTY,
  20,
  { min: 1 },
);

export const REALTIME_AUTO_ORDER_MAX_LOG_ITEMS = readNumberEnv(
  import.meta.env.VITE_REALTIME_AUTO_ORDER_MAX_LOG_ITEMS,
  60,
  { min: 10, max: 500 },
);
