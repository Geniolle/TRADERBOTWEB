// web/src/hooks/useCandles.ts

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { API_HTTP_BASE_URL } from "../constants/config";
import type {
  CandleCoverageMeta,
  CandleItem,
  CandleListResponse,
} from "../types/trading";

type UseCandlesParams = {
  effectiveChartSymbol: string;
  effectiveChartTimeframe: string;
  selectedProvider: string;
};

type UseCandlesResult = {
  candles: CandleItem[];
  coverageMeta: CandleCoverageMeta | null;
  setCandles: React.Dispatch<React.SetStateAction<CandleItem[]>>;
  loadingCandles: boolean;
  candlesError: string;
  reloadCandles: (showLoader?: boolean) => Promise<void>;
};

type FetchCandlesResult = {
  items: CandleItem[];
  coverageMeta: CandleCoverageMeta | null;
  preserveExisting: boolean;
};

type LatestCandleResponse = CandleItem | null;

const INCREMENTAL_LIMIT = 5000;

function normalizeSymbol(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().toUpperCase();
}

function normalizeTimeframe(value: unknown): string {
  if (typeof value !== "string") return "";

  const normalized = value.trim().toLowerCase();

  const aliases: Record<string, string> = {
    "1min": "1m",
    "3min": "3m",
    "5min": "5m",
    "15min": "15m",
    "30min": "30m",
    "60min": "1h",
    "1hr": "1h",
    "4hr": "4h",
    "1day": "1d",
  };

  return aliases[normalized] ?? normalized;
}

function normalizeProvider(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase();
}

function normalizeIsoString(value: unknown): string {
  if (typeof value !== "string") return "";

  const parsed = new Date(value).getTime();
  if (!Number.isFinite(parsed)) {
    return value.trim();
  }

  return new Date(parsed).toISOString();
}

function candleTimestamp(value: string): number {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function candleKey(item: { open_time: string }): string {
  return String(candleTimestamp(item.open_time));
}

function normalizeCandleItem(item: unknown): CandleItem | null {
  if (!item || typeof item !== "object") return null;

  const candidate = item as Partial<CandleItem>;

  if (
    typeof candidate.symbol !== "string" ||
    typeof candidate.timeframe !== "string" ||
    typeof candidate.open_time !== "string"
  ) {
    return null;
  }

  const normalizedOpenTime = normalizeIsoString(candidate.open_time);
  const normalizedCloseTime = normalizeIsoString(
    typeof candidate.close_time === "string"
      ? candidate.close_time
      : candidate.open_time
  );

  return {
    id:
      typeof candidate.id === "string" && candidate.id.trim()
        ? candidate.id
        : normalizedOpenTime,
    asset_id: typeof candidate.asset_id === "string" ? candidate.asset_id : null,
    symbol: normalizeSymbol(candidate.symbol),
    timeframe: normalizeTimeframe(candidate.timeframe),
    open_time: normalizedOpenTime,
    close_time: normalizedCloseTime || normalizedOpenTime,
    open: String(candidate.open ?? "0"),
    high: String(candidate.high ?? "0"),
    low: String(candidate.low ?? "0"),
    close: String(candidate.close ?? "0"),
    volume: String(candidate.volume ?? "0"),
    source: typeof candidate.source === "string" ? candidate.source : null,
    provider:
      typeof candidate.provider === "string"
        ? candidate.provider
        : candidate.source ?? null,
    market_session:
      typeof candidate.market_session === "string"
        ? candidate.market_session
        : null,
    timezone: typeof candidate.timezone === "string" ? candidate.timezone : "UTC",
    is_delayed:
      typeof candidate.is_delayed === "boolean" ? candidate.is_delayed : false,
    is_mock: typeof candidate.is_mock === "boolean" ? candidate.is_mock : false,
  };
}

function sortCandles(items: CandleItem[]): CandleItem[] {
  return [...items].sort((a, b) => {
    return candleTimestamp(a.open_time) - candleTimestamp(b.open_time);
  });
}

function dedupeCandlesByOpenTime(items: CandleItem[]): CandleItem[] {
  const map = new Map<string, CandleItem>();
  let duplicatesRemoved = 0;

  for (const item of items) {
    const key = candleKey(item);

    if (map.has(key)) {
      duplicatesRemoved += 1;
    }

    map.set(key, item);
  }

  const deduped = sortCandles(Array.from(map.values()));

  if (duplicatesRemoved > 0) {
    console.warn("[HTTP] candles duplicados removidos no useCandles()", {
      totalRaw: items.length,
      totalDeduped: deduped.length,
      duplicatesRemoved,
      duplicatedTimes: items
        .map((item) => candleTimestamp(item.open_time))
        .filter((time, index, array) => array.indexOf(time) !== index),
    });
  }

  return deduped;
}

function mergeCandles(
  previous: CandleItem[],
  incoming: CandleItem[],
  mode: "full" | "incremental"
): CandleItem[] {
  if (mode === "full") {
    return dedupeCandlesByOpenTime(incoming);
  }

  if (incoming.length === 0) {
    return previous;
  }

  return dedupeCandlesByOpenTime([...previous, ...incoming]);
}

function getDerivedCoverageFromItems(items: CandleItem[]) {
  if (items.length === 0) {
    return {
      firstOpenTime: null as string | null,
      lastCloseTime: null as string | null,
    };
  }

  const firstItem = items[0];
  const lastItem = items[items.length - 1];

  return {
    firstOpenTime: firstItem?.open_time ?? null,
    lastCloseTime: lastItem?.close_time ?? lastItem?.open_time ?? null,
  };
}

function buildCoverageMeta(
  payload: Partial<CandleListResponse> | CandleCoverageMeta | null,
  items: CandleItem[],
  symbol: string,
  timeframe: string,
  mode: "full" | "incremental",
  startAt: string,
  endAt: string
): CandleCoverageMeta {
  const derived = getDerivedCoverageFromItems(items);

  return {
    symbol,
    timeframe,
    mode: (payload?.mode === "incremental" ? "incremental" : mode) as
      | "full"
      | "incremental",
    count: typeof payload?.count === "number" ? payload.count : items.length,
    start_at: typeof payload?.start_at === "string" ? payload.start_at : startAt,
    end_at: typeof payload?.end_at === "string" ? payload.end_at : endAt,
    first_open_time:
      typeof payload?.first_open_time === "string" && payload.first_open_time
        ? normalizeIsoString(payload.first_open_time)
        : derived.firstOpenTime,
    last_close_time:
      typeof payload?.last_close_time === "string" && payload.last_close_time
        ? normalizeIsoString(payload.last_close_time)
        : derived.lastCloseTime,
  };
}

function parsePayload(
  payload: unknown,
  symbol: string,
  timeframe: string,
  mode: "full" | "incremental",
  startAt: string,
  endAt: string
): { items: CandleItem[]; coverageMeta: CandleCoverageMeta } {
  if (Array.isArray(payload)) {
    const items = dedupeCandlesByOpenTime(
      payload
        .map((item) => normalizeCandleItem(item))
        .filter((item): item is CandleItem => item !== null)
    );

    return {
      items,
      coverageMeta: buildCoverageMeta(
        null,
        items,
        symbol,
        timeframe,
        mode,
        startAt,
        endAt
      ),
    };
  }

  if (payload && typeof payload === "object") {
    const response = payload as Partial<CandleListResponse>;
    const rawItems = Array.isArray(response.items) ? response.items : [];

    const items = dedupeCandlesByOpenTime(
      rawItems
        .map((item) => normalizeCandleItem(item))
        .filter((item): item is CandleItem => item !== null)
    );

    return {
      items,
      coverageMeta: buildCoverageMeta(
        response,
        items,
        symbol,
        timeframe,
        mode,
        startAt,
        endAt
      ),
    };
  }

  const emptyItems: CandleItem[] = [];

  return {
    items: emptyItems,
    coverageMeta: buildCoverageMeta(
      null,
      emptyItems,
      symbol,
      timeframe,
      mode,
      startAt,
      endAt
    ),
  };
}

function extractErrorMessage(status: number, payloadText: string): string {
  const text = String(payloadText ?? "").trim();

  try {
    const parsed = JSON.parse(text) as { detail?: unknown; message?: unknown };

    if (typeof parsed.detail === "string" && parsed.detail.trim()) {
      return parsed.detail;
    }

    if (typeof parsed.message === "string" && parsed.message.trim()) {
      return parsed.message;
    }
  } catch {
    // ignora parse inválido
  }

  if (text) {
    return text;
  }

  return `HTTP ${status}`;
}

function getMinimumCandlesForStableSnapshot(timeframe: string): number {
  const normalized = normalizeTimeframe(timeframe);

  if (normalized === "1m") return 30;
  if (normalized === "3m") return 30;
  if (normalized === "5m") return 30;
  if (normalized === "15m") return 20;
  if (normalized === "30m") return 20;
  if (normalized === "1h") return 12;
  if (normalized === "4h") return 8;
  if (normalized === "1d") return 5;

  return 10;
}

function isInsufficientSnapshot(
  items: CandleItem[],
  timeframe: string
): boolean {
  if (items.length === 0) return true;
  return items.length < getMinimumCandlesForStableSnapshot(timeframe);
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const payloadText = await response.text();
    throw new Error(extractErrorMessage(response.status, payloadText));
  }

  return response.json();
}

function buildCandlesUrl(params: {
  symbol: string;
  timeframe: string;
  provider?: string;
  startAt?: string;
  endAt?: string;
  limit?: number;
  mode?: "full" | "incremental";
}): string {
  const query = new URLSearchParams({
    symbol: params.symbol,
    timeframe: params.timeframe,
  });

  if (params.provider) {
    query.set("provider", params.provider);
  }

  if (params.startAt) {
    query.set("start_at", params.startAt);
  }

  if (params.endAt) {
    query.set("end_at", params.endAt);
  }

  if (typeof params.limit === "number" && Number.isFinite(params.limit)) {
    query.set("limit", String(params.limit));
  }

  if (params.mode) {
    query.set("mode", params.mode);
  }

  return `${API_HTTP_BASE_URL}/candles?${query.toString()}`;
}

function buildLatestUrl(
  symbol: string,
  timeframe: string,
  provider?: string
): string {
  const query = new URLSearchParams({
    symbol,
    timeframe,
  });

  if (provider) {
    query.set("provider", provider);
  }

  return `${API_HTTP_BASE_URL}/candles/latest?${query.toString()}`;
}

function useCandles({
  effectiveChartSymbol,
  effectiveChartTimeframe,
  selectedProvider,
}: UseCandlesParams): UseCandlesResult {
  const [candles, setCandles] = useState<CandleItem[]>([]);
  const [coverageMeta, setCoverageMeta] = useState<CandleCoverageMeta | null>(null);
  const [loadingCandles, setLoadingCandles] = useState(false);
  const [candlesError, setCandlesError] = useState("");

  const requestKey = useMemo(() => {
    return [
      normalizeProvider(selectedProvider),
      normalizeSymbol(effectiveChartSymbol),
      normalizeTimeframe(effectiveChartTimeframe),
    ].join("::");
  }, [effectiveChartSymbol, effectiveChartTimeframe, selectedProvider]);

  const activeRequestKeyRef = useRef("");
  const candlesRef = useRef<CandleItem[]>([]);
  const coverageMetaRef = useRef<CandleCoverageMeta | null>(null);

  useEffect(() => {
    candlesRef.current = candles;
  }, [candles]);

  useEffect(() => {
    coverageMetaRef.current = coverageMeta;
  }, [coverageMeta]);

  const fetchCandles = useCallback(
    async (
      mode: "full" | "incremental",
      showLoader: boolean
    ): Promise<FetchCandlesResult> => {
      const symbol = normalizeSymbol(effectiveChartSymbol);
      const timeframe = normalizeTimeframe(effectiveChartTimeframe);
      const provider = normalizeProvider(selectedProvider);

      if (!symbol || !timeframe) {
        return {
          items: [],
          coverageMeta: null,
          preserveExisting: false,
        };
      }

      const currentRequestKey = `${provider}::${symbol}::${timeframe}`;
      activeRequestKeyRef.current = currentRequestKey;

      if (showLoader) {
        setLoadingCandles(true);
      }

      setCandlesError("");

      try {
        if (mode === "full") {
          const nowIso = new Date().toISOString();

          const payload = await fetchJson(
            buildCandlesUrl({
              symbol,
              timeframe,
              provider,
              mode: "full",
            })
          );

          const parsed = parsePayload(
            payload,
            symbol,
            timeframe,
            "full",
            "",
            nowIso
          );

          if (activeRequestKeyRef.current !== currentRequestKey) {
            return {
              items: [],
              coverageMeta: null,
              preserveExisting: false,
            };
          }

          return {
            items: parsed.items,
            coverageMeta: parsed.coverageMeta,
            preserveExisting: false,
          };
        }

        const frontendLastCandle =
          candlesRef.current.length > 0
            ? candlesRef.current[candlesRef.current.length - 1]
            : null;

        const latestPayload = await fetchJson(
          buildLatestUrl(symbol, timeframe, provider)
        );
        const latestCandle = normalizeCandleItem(
          latestPayload as LatestCandleResponse
        );

        if (activeRequestKeyRef.current !== currentRequestKey) {
          return {
            items: [],
            coverageMeta: null,
            preserveExisting: false,
          };
        }

        if (!latestCandle) {
          return {
            items: [],
            coverageMeta: coverageMetaRef.current,
            preserveExisting: candlesRef.current.length > 0,
          };
        }

        if (!frontendLastCandle) {
          const nowIso = new Date().toISOString();

          const payload = await fetchJson(
            buildCandlesUrl({
              symbol,
              timeframe,
              provider,
              mode: "full",
            })
          );

          const parsed = parsePayload(
            payload,
            symbol,
            timeframe,
            "full",
            "",
            nowIso
          );

          return {
            items: parsed.items,
            coverageMeta: parsed.coverageMeta,
            preserveExisting: false,
          };
        }

        const frontendLastOpenMs = candleTimestamp(frontendLastCandle.open_time);
        const backendLatestOpenMs = candleTimestamp(latestCandle.open_time);

        if (backendLatestOpenMs <= frontendLastOpenMs) {
          return {
            items: [],
            coverageMeta: buildCoverageMeta(
              coverageMetaRef.current,
              candlesRef.current,
              symbol,
              timeframe,
              "incremental",
              coverageMetaRef.current?.start_at ?? frontendLastCandle.open_time,
              coverageMetaRef.current?.end_at ?? latestCandle.close_time
            ),
            preserveExisting: false,
          };
        }

        const startAt = frontendLastCandle.open_time;
        const endAt = latestCandle.close_time || latestCandle.open_time;

        const payload = await fetchJson(
          buildCandlesUrl({
            symbol,
            timeframe,
            provider,
            startAt,
            endAt,
            limit: INCREMENTAL_LIMIT,
            mode: "incremental",
          })
        );

        const parsed = parsePayload(
          payload,
          symbol,
          timeframe,
          "incremental",
          startAt,
          endAt
        );

        if (activeRequestKeyRef.current !== currentRequestKey) {
          return {
            items: [],
            coverageMeta: null,
            preserveExisting: false,
          };
        }

        return {
          items: parsed.items,
          coverageMeta: parsed.coverageMeta,
          preserveExisting: false,
        };
      } catch (error) {
        if (activeRequestKeyRef.current !== currentRequestKey) {
          return {
            items: [],
            coverageMeta: null,
            preserveExisting: false,
          };
        }

        const message =
          error instanceof Error
            ? error.message
            : "Erro desconhecido ao carregar candles locais.";

        setCandlesError(message);

        return {
          items: [],
          coverageMeta: coverageMetaRef.current,
          preserveExisting: candlesRef.current.length > 0,
        };
      } finally {
        if (activeRequestKeyRef.current === currentRequestKey) {
          setLoadingCandles(false);
        }
      }
    },
    [effectiveChartSymbol, effectiveChartTimeframe, selectedProvider]
  );

  const reloadCandles = useCallback(
    async (showLoader = true) => {
      const symbol = normalizeSymbol(effectiveChartSymbol);
      const timeframe = normalizeTimeframe(effectiveChartTimeframe);

      if (!symbol || !timeframe) {
        return;
      }

      const parsed = await fetchCandles("incremental", showLoader);

      if (parsed.preserveExisting) {
        return;
      }

      const mergedItems = mergeCandles(
        candlesRef.current,
        parsed.items,
        "incremental"
      );

      const incomingIsInsufficient = isInsufficientSnapshot(parsed.items, timeframe);
      const mergedIsInsufficient = isInsufficientSnapshot(mergedItems, timeframe);
      const hasPreviousSnapshot = candlesRef.current.length > 0;

      if (
        parsed.items.length > 0 &&
        !(incomingIsInsufficient && mergedIsInsufficient && hasPreviousSnapshot)
      ) {
        setCandles(mergedItems);
      } else if (hasPreviousSnapshot && parsed.items.length > 0) {
        console.warn(
          "[HTTP] snapshot incremental insuficiente; último snapshot válido foi preservado",
          {
            symbol,
            timeframe,
            incomingCount: parsed.items.length,
            mergedCount: mergedItems.length,
            preservedCount: candlesRef.current.length,
          }
        );
      }

      if (parsed.coverageMeta) {
        const coverageItems =
          mergedItems.length > 0 &&
          !(incomingIsInsufficient && mergedIsInsufficient && hasPreviousSnapshot)
            ? mergedItems
            : candlesRef.current;

        setCoverageMeta(
          buildCoverageMeta(
            {
              ...parsed.coverageMeta,
              count: coverageItems.length,
            },
            coverageItems,
            symbol,
            timeframe,
            "incremental",
            parsed.coverageMeta.start_at,
            parsed.coverageMeta.end_at
          )
        );
      }
    },
    [effectiveChartSymbol, effectiveChartTimeframe, fetchCandles]
  );

  useEffect(() => {
    const symbol = normalizeSymbol(effectiveChartSymbol);
    const timeframe = normalizeTimeframe(effectiveChartTimeframe);

    if (!symbol || !timeframe) {
      activeRequestKeyRef.current = requestKey;
      setCandles([]);
      setCoverageMeta(null);
      setLoadingCandles(false);
      setCandlesError("");
      return;
    }

    setCandles([]);
    setCoverageMeta(null);
    setCandlesError("");

    void (async () => {
      const parsed = await fetchCandles("full", true);

      if (parsed.preserveExisting) {
        return;
      }

      const nextCandles = mergeCandles([], parsed.items, "full");
      const incomingIsInsufficient = isInsufficientSnapshot(nextCandles, timeframe);
      const hasPreviousSnapshot = candlesRef.current.length > 0;

      if (nextCandles.length > 0 && !(incomingIsInsufficient && hasPreviousSnapshot)) {
        setCandles(nextCandles);

        if (parsed.coverageMeta) {
          setCoverageMeta(
            buildCoverageMeta(
              {
                ...parsed.coverageMeta,
                count: nextCandles.length,
              },
              nextCandles,
              symbol,
              timeframe,
              "full",
              parsed.coverageMeta.start_at,
              parsed.coverageMeta.end_at
            )
          );
        }

        return;
      }

      if (hasPreviousSnapshot) {
        console.warn(
          "[HTTP] snapshot insuficiente recebido; último snapshot válido foi preservado",
          {
            symbol,
            timeframe,
            incomingCount: nextCandles.length,
            preservedCount: candlesRef.current.length,
          }
        );

        if (parsed.coverageMeta) {
          setCoverageMeta(
            buildCoverageMeta(
              {
                ...parsed.coverageMeta,
                count: candlesRef.current.length,
              },
              candlesRef.current,
              symbol,
              timeframe,
              "full",
              parsed.coverageMeta.start_at,
              parsed.coverageMeta.end_at
            )
          );
        }

        return;
      }

      if (parsed.coverageMeta) {
        setCoverageMeta(parsed.coverageMeta);
      }

      setCandles(nextCandles);
    })();
  }, [
    requestKey,
    fetchCandles,
    effectiveChartSymbol,
    effectiveChartTimeframe,
    selectedProvider,
  ]);

  return {
    candles,
    coverageMeta,
    setCandles,
    loadingCandles,
    candlesError,
    reloadCandles,
  };
}

export default useCandles;