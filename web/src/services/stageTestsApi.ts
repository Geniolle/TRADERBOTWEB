// C:\TraderBotWeb\web\src\services\stageTestsApi.ts
// Backend:
// - GET  /api/v1/stage-tests/options
// - POST /api/v1/stage-tests/run

import { API_HTTP_BASE_URL } from "../constants/config";
import type {
  StageTestOptionsResponse,
  StageTestRunRequest,
  StageTestRunResponse,
  StageTestStrategyOption,
} from "../types/stageTests";
import type { StageTestRunCaseItem } from "../types/trading";

type ErrorPayload = {
  detail?: string;
};

type UnknownRecord = Record<string, unknown>;

async function handleResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const payload: unknown = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    let detail = "Erro inesperado na API";

    if (typeof payload === "string" && payload.trim()) {
      detail = payload;
    } else if (
      typeof payload === "object" &&
      payload !== null &&
      "detail" in payload
    ) {
      const errorPayload = payload as ErrorPayload;
      if (typeof errorPayload.detail === "string" && errorPayload.detail.trim()) {
        detail = errorPayload.detail;
      }
    }

    throw new Error(detail);
  }

  return payload as T;
}

function asRecord(value: unknown): UnknownRecord | null {
  if (!value || typeof value !== "object") return null;
  return value as UnknownRecord;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asStringNumberOrNull(value: unknown): string | number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    return value;
  }

  return null;
}

function normalizeStrategyOption(value: unknown): StageTestStrategyOption | null {
  if (typeof value === "string" && value.trim()) {
    return {
      key: value,
      label: value,
      description: null,
    };
  }

  const record = asRecord(value);
  if (!record) return null;

  const key = asString(record.key).trim();
  const label =
    asString(record.label).trim() ||
    asString(record.name).trim() ||
    key;

  if (!key) return null;

  return {
    key,
    label,
    description: asString(record.description) || null,
  };
}

function normalizeOptionsResponse(payload: unknown): StageTestOptionsResponse {
  const record = asRecord(payload);

  const rawItems = Array.isArray(record?.items) ? record.items : [];
  const rawStrategies = Array.isArray(record?.strategies) ? record.strategies : [];

  const items = rawItems
    .map((item) => {
      const candidate = asRecord(item);
      if (!candidate) return null;

      const symbol = asString(candidate.symbol).trim();
      const timeframe = asString(candidate.timeframe).trim();

      if (!symbol || !timeframe) return null;

      return {
        symbol,
        timeframe,
        candles_count: asNumber(candidate.candles_count) ?? 0,
        first_candle: asString(candidate.first_candle),
        last_candle: asString(candidate.last_candle),
      };
    })
    .filter((item): item is StageTestOptionsResponse["items"][number] => item !== null);

  const strategies = rawStrategies
    .map(normalizeStrategyOption)
    .filter(
      (item): item is StageTestStrategyOption =>
        item !== null && Boolean(item.key)
    );

  return {
    items,
    strategies,
    refreshed_at: asString(record?.refreshed_at),
  };
}

function normalizeCaseItem(value: unknown): StageTestRunCaseItem | null {
  const candidate = asRecord(value);
  if (!candidate) return null;

  const id =
    asString(candidate.id).trim() ||
    asString(candidate.case_id).trim() ||
    asString(candidate.uuid).trim();

  if (!id) return null;

  const normalized: StageTestRunCaseItem = {
    id,
    case_number: asNumber(candidate.case_number),
    side: asNullableString(candidate.side),
    status: asNullableString(candidate.status),
    outcome: asNullableString(candidate.outcome),
    trigger_price: asStringNumberOrNull(
      candidate.trigger_price ?? candidate.triggerPrice
    ),
    entry_price: asStringNumberOrNull(
      candidate.entry_price ?? candidate.entryPrice
    ),
    close_price: asStringNumberOrNull(
      candidate.close_price ?? candidate.closePrice
    ),
    target_price: asStringNumberOrNull(
      candidate.target_price ?? candidate.targetPrice
    ),
    invalidation_price: asStringNumberOrNull(
      candidate.invalidation_price ?? candidate.invalidationPrice
    ),
    trigger_time:
      asNullableString(candidate.trigger_time) ??
      asNullableString(candidate.triggerTime),
    trigger_candle_time:
      asNullableString(candidate.trigger_candle_time) ??
      asNullableString(candidate.triggerCandleTime),
    entry_time:
      asNullableString(candidate.entry_time) ??
      asNullableString(candidate.entryTime),
    close_time:
      asNullableString(candidate.close_time) ??
      asNullableString(candidate.closeTime),
    bars_to_resolution: asNumber(candidate.bars_to_resolution),
    max_favorable_excursion: asStringNumberOrNull(
      candidate.max_favorable_excursion ?? candidate.maxFavorableExcursion
    ),
    max_adverse_excursion: asStringNumberOrNull(
      candidate.max_adverse_excursion ?? candidate.maxAdverseExcursion
    ),
    close_reason:
      asNullableString(candidate.close_reason) ??
      asNullableString(candidate.closeReason),
    analysis: (candidate.analysis as StageTestRunCaseItem["analysis"]) ?? null,
    metadata: (candidate.metadata as Record<string, unknown> | null) ?? null,
  };

  return normalized;
}

function normalizeCases(rawCases: unknown): StageTestRunCaseItem[] {
  if (!Array.isArray(rawCases)) return [];

  return rawCases
    .map(normalizeCaseItem)
    .filter((item): item is StageTestRunCaseItem => item !== null);
}

function normalizeRunResponse(payload: unknown): StageTestRunResponse {
  const record = asRecord(payload);

  const rawMetrics = asRecord(record?.metrics);
  const nestedRun = asRecord(record?.run);

  const rawCases =
    record?.cases ??
    rawMetrics?.cases ??
    nestedRun?.cases ??
    null;

  return {
    ok: asBoolean(record?.ok, false),
    command: Array.isArray(record?.command)
      ? record.command.map((item) => String(item))
      : [],
    return_code: asNumber(record?.return_code) ?? -1,
    stdout: asString(record?.stdout),
    stderr: asString(record?.stderr),
    metrics: rawMetrics
      ? {
          strategy_class: asString(rawMetrics.strategy_class) || null,
          runtime_strategy: asString(rawMetrics.runtime_strategy) || null,
          total_candles: asNumber(rawMetrics.total_candles),
          warmup: asNumber(rawMetrics.warmup),
          triggers: asNumber(rawMetrics.triggers),
          closed_cases: asNumber(rawMetrics.closed_cases),
          hits: asNumber(rawMetrics.hits),
          fails: asNumber(rawMetrics.fails),
          timeouts: asNumber(rawMetrics.timeouts),
          hit_rate:
            typeof rawMetrics.hit_rate === "number" ? rawMetrics.hit_rate : null,
          fail_rate:
            typeof rawMetrics.fail_rate === "number"
              ? rawMetrics.fail_rate
              : null,
          timeout_rate:
            typeof rawMetrics.timeout_rate === "number"
              ? rawMetrics.timeout_rate
              : null,
          first_candle: asString(rawMetrics.first_candle) || null,
          last_candle: asString(rawMetrics.last_candle) || null,
        }
      : null,
    cases: normalizeCases(rawCases),
  };
}

export async function fetchStageTestOptions(
  minCandles = 1
): Promise<StageTestOptionsResponse> {
  const response = await fetch(
    `${API_HTTP_BASE_URL}/stage-tests/options?min_candles=${minCandles}`,
    {
      method: "GET",
    }
  );

  const payload = await handleResponse<unknown>(response);
  return normalizeOptionsResponse(payload);
}

export async function runStageTest(
  payload: StageTestRunRequest
): Promise<StageTestRunResponse> {
  const response = await fetch(`${API_HTTP_BASE_URL}/stage-tests/run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const rawPayload = await handleResponse<unknown>(response);
  return normalizeRunResponse(rawPayload);
}
