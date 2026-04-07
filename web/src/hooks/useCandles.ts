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
};

type UseCandlesResult = {
  candles: CandleItem[];
  coverageMeta: CandleCoverageMeta | null;
  setCandles: React.Dispatch<React.SetStateAction<CandleItem[]>>;
  loadingCandles: boolean;
  candlesError: string;
  reloadCandles: (showLoader?: boolean) => Promise<void>;
};

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

function timeframeToWindowMs(
  timeframe: string,
  mode: "full" | "incremental"
): number {
  const normalized = normalizeTimeframe(timeframe);

  if (mode === "incremental") {
    if (normalized === "1m") return 2 * 60 * 60 * 1000;
    if (normalized === "3m") return 4 * 60 * 60 * 1000;
    if (normalized === "5m") return 6 * 60 * 60 * 1000;
    if (normalized === "15m") return 12 * 60 * 60 * 1000;
    if (normalized === "30m") return 24 * 60 * 60 * 1000;
    if (normalized === "1h") return 2 * 24 * 60 * 60 * 1000;
    if (normalized === "4h") return 7 * 24 * 60 * 60 * 1000;
    return 30 * 24 * 60 * 60 * 1000;
  }

  if (normalized === "1m") return 24 * 60 * 60 * 1000;
  if (normalized === "3m") return 24 * 60 * 60 * 1000;
  if (normalized === "5m") return 24 * 60 * 60 * 1000;
  if (normalized === "15m") return 3 * 24 * 60 * 60 * 1000;
  if (normalized === "30m") return 3 * 24 * 60 * 60 * 1000;
  if (normalized === "1h") return 15 * 24 * 60 * 60 * 1000;
  if (normalized === "4h") return 15 * 24 * 60 * 60 * 1000;

  return 60 * 24 * 60 * 60 * 1000;
}

function buildRange(
  timeframe: string,
  mode: "full" | "incremental"
): { startAt: string; endAt: string } {
  const now = new Date();
  const start = new Date(now.getTime() - timeframeToWindowMs(timeframe, mode));

  return {
    startAt: start.toISOString(),
    endAt: now.toISOString(),
  };
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

  return {
    id: typeof candidate.id === "string" ? candidate.id : candidate.open_time,
    asset_id: typeof candidate.asset_id === "string" ? candidate.asset_id : null,
    symbol: normalizeSymbol(candidate.symbol),
    timeframe: normalizeTimeframe(candidate.timeframe),
    open_time: candidate.open_time,
    close_time:
      typeof candidate.close_time === "string"
        ? candidate.close_time
        : candidate.open_time,
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
    const left = new Date(a.open_time).getTime();
    const right = new Date(b.open_time).getTime();
    return left - right;
  });
}

function dedupeCandlesByOpenTime(items: CandleItem[]): CandleItem[] {
  const map = new Map<string, CandleItem>();

  for (const item of items) {
    map.set(item.open_time, item);
  }

  return sortCandles(Array.from(map.values()));
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
  payload: Partial<CandleListResponse> | null,
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
        ? payload.first_open_time
        : derived.firstOpenTime,
    last_close_time:
      typeof payload?.last_close_time === "string" && payload.last_close_time
        ? payload.last_close_time
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

function useCandles({
  effectiveChartSymbol,
  effectiveChartTimeframe,
}: UseCandlesParams): UseCandlesResult {
  const [candles, setCandles] = useState<CandleItem[]>([]);
  const [coverageMeta, setCoverageMeta] = useState<CandleCoverageMeta | null>(null);
  const [loadingCandles, setLoadingCandles] = useState(false);
  const [candlesError, setCandlesError] = useState("");

  const requestKey = useMemo(() => {
    return [
      normalizeSymbol(effectiveChartSymbol),
      normalizeTimeframe(effectiveChartTimeframe),
    ].join("::");
  }, [effectiveChartSymbol, effectiveChartTimeframe]);

  const activeRequestKeyRef = useRef("");
  const candlesRef = useRef<CandleItem[]>([]);

  useEffect(() => {
    candlesRef.current = candles;
  }, [candles]);

  const fetchCandles = useCallback(
    async (mode: "full" | "incremental", showLoader: boolean) => {
      const symbol = normalizeSymbol(effectiveChartSymbol);
      const timeframe = normalizeTimeframe(effectiveChartTimeframe);

      if (!symbol || !timeframe) {
        return { items: [], coverageMeta: null as CandleCoverageMeta | null };
      }

      const currentRequestKey = `${symbol}::${timeframe}`;
      activeRequestKeyRef.current = currentRequestKey;

      if (showLoader) {
        setLoadingCandles(true);
      }

      setCandlesError("");

      try {
        const { startAt, endAt } = buildRange(timeframe, mode);

        const params = new URLSearchParams({
          symbol,
          timeframe,
          start_at: startAt,
          end_at: endAt,
          limit: mode === "full" ? "5000" : "1000",
          mode,
        });

        const response = await fetch(
          `${API_HTTP_BASE_URL}/candles?${params.toString()}`,
          {
            method: "GET",
            headers: {
              Accept: "application/json",
            },
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const payload = await response.json();
        const parsed = parsePayload(
          payload,
          symbol,
          timeframe,
          mode,
          startAt,
          endAt
        );

        if (activeRequestKeyRef.current !== currentRequestKey) {
          return { items: [], coverageMeta: null as CandleCoverageMeta | null };
        }

        return parsed;
      } catch (error) {
        if (activeRequestKeyRef.current !== `${symbol}::${timeframe}`) {
          return { items: [], coverageMeta: null as CandleCoverageMeta | null };
        }

        setCandlesError(
          error instanceof Error
            ? error.message
            : "Erro desconhecido ao carregar candles locais."
        );

        return { items: [], coverageMeta: null as CandleCoverageMeta | null };
      } finally {
        if (activeRequestKeyRef.current === `${symbol}::${timeframe}`) {
          setLoadingCandles(false);
        }
      }
    },
    [effectiveChartSymbol, effectiveChartTimeframe]
  );

  const reloadCandles = useCallback(
    async (showLoader = true) => {
      const symbol = normalizeSymbol(effectiveChartSymbol);
      const timeframe = normalizeTimeframe(effectiveChartTimeframe);

      if (!symbol || !timeframe) {
        return;
      }

      const parsed = await fetchCandles("incremental", showLoader);
      const nextCoverageMeta = parsed.coverageMeta;

      if (parsed.items.length > 0) {
        setCandles((prev) => mergeCandles(prev, parsed.items, "incremental"));
      }

      if (nextCoverageMeta) {
        const mergedItems = mergeCandles(
          candlesRef.current,
          parsed.items,
          "incremental"
        );

        setCoverageMeta(
          buildCoverageMeta(
            {
              ...nextCoverageMeta,
              count: mergedItems.length,
            },
            mergedItems,
            symbol,
            timeframe,
            "incremental",
            nextCoverageMeta.start_at,
            nextCoverageMeta.end_at
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

    void (async () => {
      const parsed = await fetchCandles("full", true);

      if (parsed.coverageMeta) {
        setCoverageMeta(parsed.coverageMeta);
      }

      setCandles(mergeCandles([], parsed.items, "full"));
    })();
  }, [requestKey, fetchCandles, effectiveChartSymbol, effectiveChartTimeframe]);

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