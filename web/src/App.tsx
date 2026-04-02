import { useEffect, useMemo, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";

type HealthResponse = {
  status: string;
  app_name: string;
  environment: string;
};

type StrategyItem = {
  key: string;
  name: string;
  version: string;
  description: string;
  category: string;
};

type RunHistoryItem = {
  id: string;
  strategy_key: string | null;
  strategy_config_id: string;
  mode: string;
  asset_id: string | null;
  symbol: string;
  timeframe: string;
  start_at: string;
  end_at: string;
  status: string;
  total_candles_processed: number;
  total_cases_opened: number;
  total_cases_closed: number;
  started_at: string | null;
  finished_at: string | null;
};

type RunDetailsMetrics = {
  run_id: string;
  total_cases: number;
  total_hits: number;
  total_fails: number;
  total_timeouts: number;
  hit_rate: string;
  fail_rate: string;
  timeout_rate: string;
  avg_bars_to_resolution: string;
  avg_time_to_resolution_seconds: string;
  avg_mfe: string;
  avg_mae: string;
} | null;

type RunDetailsCase = {
  id: string;
  run_id: string;
  strategy_config_id: string;
  asset_id: string | null;
  symbol: string;
  timeframe: string;
  trigger_time: string;
  trigger_candle_time: string;
  entry_time: string;
  entry_price: string;
  target_price: string;
  invalidation_price: string;
  timeout_at: string | null;
  status: string;
  outcome: string | null;
  close_time: string | null;
  close_price: string | null;
  bars_to_resolution: number;
  max_favorable_excursion: string;
  max_adverse_excursion: string;
  metadata: Record<string, unknown>;
};

type RunDetailsResponse = {
  run: RunHistoryItem;
  metrics: RunDetailsMetrics;
  cases: RunDetailsCase[];
};

type CandleItem = {
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
};

type ChartCandleMeta = {
  openTime: string;
  closeTime: string;
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
};

type OverlayMarker = {
  id: string;
  label: string;
  color: string;
  left: number;
  top: number;
  price: number;
  timeLabel: string;
};

type OverlayLine = {
  id: string;
  label: string;
  color: string;
  top: number;
  value: number;
  dashed?: boolean;
};

type CatalogProductSummary = {
  code: string;
  label: string;
  description: string;
  total_subproducts: number;
  total_items: number;
};

type CatalogProductsResponse = {
  products: CatalogProductSummary[];
};

type CatalogInstrument = {
  symbol: string;
  display_name: string;
  base_asset: string;
  quote_asset: string;
};

type CatalogSubproduct = {
  code: string;
  label: string;
  description: string;
  items: CatalogInstrument[];
};

type CatalogProductResponse = {
  code: string;
  label: string;
  description: string;
  subproducts: CatalogSubproduct[];
};

type CatalogItemsResponse = {
  product: string;
  subproduct: string | null;
  total_items: number;
  items: CatalogInstrument[];
};

type WsEnvelope = {
  event: string;
  data?: Record<string, unknown>;
};

type CandleTickState = {
  symbol: string;
  timeframe: string;
  open_time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  count: number;
} | null;

const API_HTTP_BASE_URL = "http://127.0.0.1:8000/api/v1";
const API_WS_BASE_URL = "ws://127.0.0.1:8000/api/v1/ws";

const FORCE_REALTIME_TEST = true;
const FORCED_REALTIME_SYMBOL = "AAPL";
const FORCED_REALTIME_TIMEFRAME = "1m";

function toUtcTimestamp(value: string): UTCTimestamp {
  return Math.floor(new Date(value).getTime() / 1000) as UTCTimestamp;
}

function formatDateTime(value: string | null): string {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("pt-PT", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function parsePrice(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function floorToMinuteIso(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  date.setSeconds(0, 0);
  return date.toISOString();
}

function getCaseAccentColor(item?: RunDetailsCase | null): string {
  if (!item) return "#64748b";

  const outcome = (item.outcome ?? "").toLowerCase();
  const status = (item.status ?? "").toLowerCase();

  if (outcome.includes("hit")) return "#16a34a";
  if (outcome.includes("fail")) return "#dc2626";
  if (outcome.includes("timeout")) return "#d97706";
  if (status.includes("closed")) return "#2563eb";
  return "#7c3aed";
}

function buildFallbackStartAt(): string {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return date.toISOString();
}

function buildRealtimeTestStartAt(): string {
  const date = new Date();
  date.setHours(date.getHours() - 3);
  return date.toISOString();
}

function normalizeCandles(items: CandleItem[]): CandleItem[] {
  return items
    .slice()
    .sort(
      (a, b) => new Date(a.open_time).getTime() - new Date(b.open_time).getTime()
    );
}

function upsertRealtimeCandle(
  previous: CandleItem[],
  tick: NonNullable<CandleTickState>
): CandleItem[] {
  const nextCandle: CandleItem = {
    id: `ws-${tick.symbol}-${tick.timeframe}-${tick.open_time}`,
    asset_id: null,
    symbol: tick.symbol,
    timeframe: tick.timeframe,
    open_time: tick.open_time,
    close_time: tick.open_time,
    open: tick.open.toString(),
    high: tick.high.toString(),
    low: tick.low.toString(),
    close: tick.close.toString(),
    volume: "0",
    source: "websocket",
  };

  const existingIndex = previous.findIndex(
    (item) => item.open_time === tick.open_time
  );

  if (existingIndex >= 0) {
    const updated = previous.slice();
    updated[existingIndex] = nextCandle;
    return normalizeCandles(updated);
  }

  return normalizeCandles([...previous, nextCandle]);
}

function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [strategies, setStrategies] = useState<StrategyItem[]>([]);
  const [runs, setRuns] = useState<RunHistoryItem[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string>("");
  const [runDetails, setRunDetails] = useState<RunDetailsResponse | null>(null);
  const [candles, setCandles] = useState<CandleItem[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string>("");
  const [chartSize, setChartSize] = useState({ width: 0, height: 680 });
  const [runSearch, setRunSearch] = useState("");

  const [wsStatus, setWsStatus] = useState("disconnected");
  const [lastWsEvent, setLastWsEvent] = useState("-");
  const [heartbeatCount, setHeartbeatCount] = useState<number | null>(null);
  const [heartbeatMessage, setHeartbeatMessage] = useState("-");
  const [candlesRefreshCount, setCandlesRefreshCount] = useState<number | null>(null);
  const [candlesRefreshReason, setCandlesRefreshReason] = useState("-");
  const [lastCandleTick, setLastCandleTick] = useState<CandleTickState>(null);

  const [marketTypes, setMarketTypes] = useState<CatalogProductSummary[]>([]);
  const [selectedMarketType, setSelectedMarketType] = useState("");
  const [marketTypeDetails, setMarketTypeDetails] = useState<CatalogProductResponse | null>(
    null
  );
  const [selectedCatalog, setSelectedCatalog] = useState("");
  const [catalogSymbols, setCatalogSymbols] = useState<CatalogInstrument[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState("");

  const [loadingHealth, setLoadingHealth] = useState(true);
  const [loadingStrategies, setLoadingStrategies] = useState(true);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [loadingRunDetails, setLoadingRunDetails] = useState(false);
  const [loadingCandles, setLoadingCandles] = useState(false);
  const [loadingMarketTypes, setLoadingMarketTypes] = useState(true);
  const [loadingCatalogs, setLoadingCatalogs] = useState(false);
  const [loadingSymbols, setLoadingSymbols] = useState(false);

  const [healthError, setHealthError] = useState("");
  const [strategiesError, setStrategiesError] = useState("");
  const [runsError, setRunsError] = useState("");
  const [runDetailsError, setRunDetailsError] = useState("");
  const [candlesError, setCandlesError] = useState("");
  const [marketTypesError, setMarketTypesError] = useState("");
  const [catalogsError, setCatalogsError] = useState("");
  const [symbolsError, setSymbolsError] = useState("");

  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const loadCandlesRef = useRef<((showLoader?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    const loadInitialData = async () => {
      const loadHealth = async () => {
        try {
          setLoadingHealth(true);
          setHealthError("");
          const response = await fetch(`${API_HTTP_BASE_URL}/health`);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const data: HealthResponse = await response.json();
          setHealth(data);
        } catch (err) {
          setHealthError(
            err instanceof Error ? err.message : "Erro desconhecido ao ligar à API"
          );
        } finally {
          setLoadingHealth(false);
        }
      };

      const loadStrategies = async () => {
        try {
          setLoadingStrategies(true);
          setStrategiesError("");
          const response = await fetch(`${API_HTTP_BASE_URL}/strategies`);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const data: StrategyItem[] = await response.json();
          setStrategies(data);
        } catch (err) {
          setStrategiesError(
            err instanceof Error ? err.message : "Erro desconhecido ao carregar estratégias"
          );
        } finally {
          setLoadingStrategies(false);
        }
      };

      const loadRuns = async () => {
        try {
          setLoadingRuns(true);
          setRunsError("");
          const response = await fetch(`${API_HTTP_BASE_URL}/run-history?limit=10`);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const data: RunHistoryItem[] = await response.json();
          setRuns(data);

          if (data.length > 0) {
            const preferredRun =
              data.find((item) => item.strategy_key && item.strategy_key.trim() !== "") ??
              data[0];
            setSelectedRunId(preferredRun.id);
          } else {
            setSelectedRunId("");
          }
        } catch (err) {
          setRunsError(
            err instanceof Error ? err.message : "Erro desconhecido ao carregar histórico"
          );
        } finally {
          setLoadingRuns(false);
        }
      };

      const loadMarketTypes = async () => {
        try {
          setLoadingMarketTypes(true);
          setMarketTypesError("");

          const response = await fetch(`${API_HTTP_BASE_URL}/catalog/products`);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);

          const data: CatalogProductsResponse = await response.json();
          const products = Array.isArray(data.products) ? data.products : [];

          setMarketTypes(products);
          setSelectedMarketType("");
          setMarketTypeDetails(null);
          setSelectedCatalog("");
          setCatalogSymbols([]);
          setSelectedSymbol("");
        } catch (err) {
          setMarketTypesError(
            err instanceof Error ? err.message : "Erro desconhecido ao carregar tipos"
          );
        } finally {
          setLoadingMarketTypes(false);
        }
      };

      await Promise.all([loadHealth(), loadStrategies(), loadRuns(), loadMarketTypes()]);
    };

    void loadInitialData();
  }, []);

  useEffect(() => {
    const loadCatalogs = async () => {
      if (!selectedMarketType) {
        setMarketTypeDetails(null);
        setSelectedCatalog("");
        setCatalogSymbols([]);
        setSelectedSymbol("");
        return;
      }

      try {
        setLoadingCatalogs(true);
        setCatalogsError("");

        const response = await fetch(
          `${API_HTTP_BASE_URL}/catalog/products/${selectedMarketType}`
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data: CatalogProductResponse = await response.json();
        setMarketTypeDetails(data);
        setSelectedCatalog("");
        setCatalogSymbols([]);
        setSelectedSymbol("");
      } catch (err) {
        setCatalogsError(
          err instanceof Error ? err.message : "Erro desconhecido ao carregar catálogos"
        );
        setMarketTypeDetails(null);
        setSelectedCatalog("");
        setCatalogSymbols([]);
        setSelectedSymbol("");
      } finally {
        setLoadingCatalogs(false);
      }
    };

    void loadCatalogs();
  }, [selectedMarketType]);

  useEffect(() => {
    const loadSymbols = async () => {
      if (!selectedMarketType || !selectedCatalog) {
        setCatalogSymbols([]);
        setSelectedSymbol("");
        return;
      }

      try {
        setLoadingSymbols(true);
        setSymbolsError("");

        const response = await fetch(
          `${API_HTTP_BASE_URL}/catalog/products/${selectedMarketType}/subproducts/${selectedCatalog}`
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data: CatalogItemsResponse = await response.json();
        const items = Array.isArray(data.items) ? data.items : [];

        setCatalogSymbols(items);
        setSelectedSymbol("");
      } catch (err) {
        setSymbolsError(
          err instanceof Error ? err.message : "Erro desconhecido ao carregar símbolos"
        );
        setCatalogSymbols([]);
        setSelectedSymbol("");
      } finally {
        setLoadingSymbols(false);
      }
    };

    void loadSymbols();
  }, [selectedMarketType, selectedCatalog]);

  useEffect(() => {
    const loadRunDetails = async () => {
      if (!selectedRunId) {
        setRunDetails(null);
        setSelectedCaseId("");
        return;
      }

      try {
        setLoadingRunDetails(true);
        setRunDetailsError("");

        const response = await fetch(`${API_HTTP_BASE_URL}/run-details/${selectedRunId}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data: RunDetailsResponse = await response.json();
        setRunDetails(data);

        if (data.cases.length > 0) {
          setSelectedCaseId((prev) => {
            const exists = data.cases.some((item) => item.id === prev);
            return exists ? prev : data.cases[0].id;
          });
        } else {
          setSelectedCaseId("");
        }
      } catch (err) {
        setRunDetailsError(
          err instanceof Error
            ? err.message
            : "Erro desconhecido ao carregar detalhes do run"
        );
      } finally {
        setLoadingRunDetails(false);
      }
    };

    void loadRunDetails();
  }, [selectedRunId]);

  const filteredRuns = useMemo(() => {
    const term = runSearch.trim().toLowerCase();
    if (!term) return runs;

    return runs.filter((run) => {
      return (
        run.id.toLowerCase().includes(term) ||
        (run.strategy_key ?? "").toLowerCase().includes(term) ||
        run.symbol.toLowerCase().includes(term) ||
        run.timeframe.toLowerCase().includes(term) ||
        run.status.toLowerCase().includes(term)
      );
    });
  }, [runs, runSearch]);

  const availableCatalogs = useMemo(() => {
    return marketTypeDetails?.subproducts ?? [];
  }, [marketTypeDetails]);

  const selectedMarketTypeLabel = useMemo(() => {
    return marketTypes.find((item) => item.code === selectedMarketType)?.label ?? "-";
  }, [marketTypes, selectedMarketType]);

  const selectedCatalogLabel = useMemo(() => {
    return availableCatalogs.find((item) => item.code === selectedCatalog)?.label ?? "-";
  }, [availableCatalogs, selectedCatalog]);

  const selectedSymbolData = useMemo(() => {
    return catalogSymbols.find((item) => item.symbol === selectedSymbol) ?? null;
  }, [catalogSymbols, selectedSymbol]);

  const effectiveChartSymbol = useMemo(() => {
    if (FORCE_REALTIME_TEST) return FORCED_REALTIME_SYMBOL;
    if (selectedSymbol) return selectedSymbol;
    return runDetails?.run.symbol ?? "";
  }, [selectedSymbol, runDetails]);

  const effectiveChartTimeframe = useMemo(() => {
    if (FORCE_REALTIME_TEST) return FORCED_REALTIME_TIMEFRAME;
    if (selectedSymbol) return "5m";
    return runDetails?.run.timeframe ?? "1h";
  }, [selectedSymbol, runDetails]);

  const effectiveChartStartAt = useMemo(() => {
    if (FORCE_REALTIME_TEST) return buildRealtimeTestStartAt();

    if (selectedSymbol) {
      const date = new Date();
      date.setDate(date.getDate() - 2);
      return date.toISOString();
    }

    return runDetails?.run.start_at ?? buildFallbackStartAt();
  }, [selectedSymbol, runDetails]);

  const effectiveChartEndAt = useMemo(() => {
    return new Date().toISOString();
  }, []);

  useEffect(() => {
    let cancelled = false;

    loadCandlesRef.current = async (showLoader = false) => {
      if (!effectiveChartSymbol) {
        if (!cancelled) {
          setCandles([]);
        }
        return;
      }

      try {
        if (!cancelled && showLoader) {
          setLoadingCandles(true);
        }

        if (!cancelled) {
          setCandlesError("");
        }

        const params = new URLSearchParams({
          symbol: effectiveChartSymbol,
          timeframe: effectiveChartTimeframe,
          start_at: effectiveChartStartAt,
          end_at: effectiveChartEndAt,
          limit: "500",
        });

        const response = await fetch(`${API_HTTP_BASE_URL}/candles?${params.toString()}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data: CandleItem[] = await response.json();

        if (!cancelled) {
          setCandles(normalizeCandles(data));
        }
      } catch (err) {
        if (!cancelled) {
          setCandlesError(
            err instanceof Error ? err.message : "Erro desconhecido ao carregar candles"
          );
        }
      } finally {
        if (!cancelled && showLoader) {
          setLoadingCandles(false);
        }
      }
    };

    void loadCandlesRef.current(true);

    return () => {
      cancelled = true;
      loadCandlesRef.current = null;
    };
  }, [
    effectiveChartSymbol,
    effectiveChartTimeframe,
    effectiveChartStartAt,
    effectiveChartEndAt,
  ]);

  useEffect(() => {
    let isMounted = true;
    const socket = new WebSocket(API_WS_BASE_URL);

    socket.onopen = () => {
      if (!isMounted) return;
      setWsStatus("connected");
      setLastWsEvent("connected");
      console.log("[WS] connected");
      socket.send("frontend_connected");
    };

    socket.onmessage = (event) => {
      if (!isMounted) return;

      console.log("[WS] message:", event.data);

      try {
        const parsed: WsEnvelope = JSON.parse(event.data);
        const nextEvent = parsed.event ?? "unknown";
        setLastWsEvent(nextEvent);

        if (nextEvent === "heartbeat") {
          const countValue = parsed.data?.count;
          const messageValue = parsed.data?.message;

          setHeartbeatCount(
            typeof countValue === "number" ? countValue : Number(countValue ?? 0)
          );
          setHeartbeatMessage(typeof messageValue === "string" ? messageValue : "-");
          return;
        }

        if (nextEvent === "candles_refresh") {
          const countValue = parsed.data?.count;
          const reasonValue = parsed.data?.reason;

          setCandlesRefreshCount(
            typeof countValue === "number" ? countValue : Number(countValue ?? 0)
          );
          setCandlesRefreshReason(typeof reasonValue === "string" ? reasonValue : "-");

          if (!FORCE_REALTIME_TEST) {
            void loadCandlesRef.current?.(false);
          }

          return;
        }

        if (nextEvent === "candle_tick") {
          const openTimeValue = parsed.data?.open_time;
          const symbolValue = parsed.data?.symbol;
          const timeframeValue = parsed.data?.timeframe;
          const openValue = Number(parsed.data?.open);
          const highValue = Number(parsed.data?.high);
          const lowValue = Number(parsed.data?.low);
          const closeValue = Number(parsed.data?.close);
          const countValue = Number(parsed.data?.count);

          const normalizedOpenTime =
            typeof openTimeValue === "string"
              ? floorToMinuteIso(openTimeValue)
              : "-";

          const nextTick: NonNullable<CandleTickState> = {
            symbol: typeof symbolValue === "string" ? symbolValue : "-",
            timeframe: typeof timeframeValue === "string" ? timeframeValue : "-",
            open_time: normalizedOpenTime,
            open: openValue,
            high: highValue,
            low: lowValue,
            close: closeValue,
            count: countValue,
          };

          setLastCandleTick(nextTick);

          if (
            nextTick.symbol === effectiveChartSymbol &&
            nextTick.timeframe === effectiveChartTimeframe
          ) {
            setCandles((prev) => upsertRealtimeCandle(prev, nextTick));
          }
        }
      } catch (error) {
        console.error("[WS] failed to parse message:", error);
      }
    };

    socket.onerror = (error) => {
      if (!isMounted) return;
      setWsStatus("error");
      console.error("[WS] error:", error);
    };

    socket.onclose = () => {
      if (!isMounted) return;
      setWsStatus("closed");
      console.log("[WS] closed");
    };

    return () => {
      isMounted = false;
      socket.close();
    };
  }, [effectiveChartSymbol, effectiveChartTimeframe]);

  const candleMeta = useMemo<ChartCandleMeta[]>(() => {
    return candles
      .map((item) => ({
        openTime: item.open_time,
        closeTime: item.close_time,
        time: toUtcTimestamp(item.open_time),
        open: Number(item.open),
        high: Number(item.high),
        low: Number(item.low),
        close: Number(item.close),
      }))
      .filter(
        (item) =>
          Number.isFinite(item.open) &&
          Number.isFinite(item.high) &&
          Number.isFinite(item.low) &&
          Number.isFinite(item.close)
      );
  }, [candles]);

  const chartData = useMemo<CandlestickData<UTCTimestamp>[]>(() => {
    return candleMeta.map((item) => ({
      time: item.time,
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
    }));
  }, [candleMeta]);

  const selectedCase = useMemo(() => {
    if (!runDetails || !selectedCaseId) return null;
    return runDetails.cases.find((item) => item.id === selectedCaseId) ?? null;
  }, [runDetails, selectedCaseId]);

  const priceBounds = useMemo(() => {
    if (candleMeta.length === 0) {
      return { min: 0, max: 1, range: 1 };
    }

    const min = Math.min(...candleMeta.map((item) => item.low));
    const max = Math.max(...candleMeta.map((item) => item.high));
    const range = max - min || 1;

    return { min, max, range };
  }, [candleMeta]);

  const overlays = useMemo(() => {
    if (
      !selectedCase ||
      candleMeta.length === 0 ||
      chartSize.width <= 0 ||
      chartSize.height <= 0
    ) {
      return {
        markers: [] as OverlayMarker[],
        lines: [] as OverlayLine[],
      };
    }

    const width = chartSize.width;
    const height = chartSize.height;
    const leftPadding = 12;
    const rightPadding = 70;
    const topPadding = 12;
    const bottomPadding = 24;
    const plotWidth = Math.max(width - leftPadding - rightPadding, 1);
    const plotHeight = Math.max(height - topPadding - bottomPadding, 1);

    const xFromIndex = (index: number) => {
      if (candleMeta.length === 1) return leftPadding + plotWidth / 2;
      return leftPadding + (index / (candleMeta.length - 1)) * plotWidth;
    };

    const yFromPrice = (price: number) => {
      const normalized = (price - priceBounds.min) / priceBounds.range;
      return topPadding + (1 - normalized) * plotHeight;
    };

    const findClosestCandleIndexByTime = (value: string | null): number | null => {
      if (!value || candleMeta.length === 0) return null;

      const target = new Date(value).getTime();
      if (Number.isNaN(target)) return null;

      let bestIndex = 0;
      let bestDiff = Number.POSITIVE_INFINITY;

      for (let i = 0; i < candleMeta.length; i += 1) {
        const candleTime = new Date(candleMeta[i].openTime).getTime();
        const diff = Math.abs(candleTime - target);

        if (diff < bestDiff) {
          bestDiff = diff;
          bestIndex = i;
        }
      }

      return bestIndex;
    };

    const markerDefs: Array<{
      id: string;
      label: string;
      color: string;
      time: string | null;
      price: number | null;
    }> = [
      {
        id: "trigger",
        label: "TRG",
        color: "#7c3aed",
        time: selectedCase.trigger_candle_time || selectedCase.trigger_time,
        price: parsePrice(selectedCase.entry_price),
      },
      {
        id: "entry",
        label: "ENT",
        color: "#2563eb",
        time: selectedCase.entry_time,
        price: parsePrice(selectedCase.entry_price),
      },
      {
        id: "close",
        label: "CLS",
        color: getCaseAccentColor(selectedCase),
        time: selectedCase.close_time,
        price: parsePrice(selectedCase.close_price),
      },
    ];

    const lineDefs: Array<{
      id: string;
      label: string;
      color: string;
      value: number | null;
      dashed?: boolean;
    }> = [
      {
        id: "entry-line",
        label: "ENTRY",
        color: "#2563eb",
        value: parsePrice(selectedCase.entry_price),
      },
      {
        id: "target-line",
        label: "TARGET",
        color: "#16a34a",
        value: parsePrice(selectedCase.target_price),
        dashed: true,
      },
      {
        id: "invalid-line",
        label: "INVALID",
        color: "#dc2626",
        value: parsePrice(selectedCase.invalidation_price),
        dashed: true,
      },
      {
        id: "close-line",
        label: "CLOSE",
        color: getCaseAccentColor(selectedCase),
        value: parsePrice(selectedCase.close_price),
        dashed: true,
      },
    ];

    const markers: OverlayMarker[] = [];
    const lines: OverlayLine[] = [];

    for (const item of markerDefs) {
      if (!item.time || item.price === null) continue;
      const index = findClosestCandleIndexByTime(item.time);
      if (index === null) continue;

      markers.push({
        id: item.id,
        label: item.label,
        color: item.color,
        left: xFromIndex(index),
        top: yFromPrice(item.price),
        price: item.price,
        timeLabel: formatDateTime(item.time),
      });
    }

    for (const item of lineDefs) {
      if (item.value === null) continue;
      lines.push({
        id: item.id,
        label: item.label,
        color: item.color,
        top: yFromPrice(item.value),
        value: item.value,
        dashed: item.dashed,
      });
    }

    return { markers, lines };
  }, [selectedCase, candleMeta, chartSize, priceBounds]);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const container = chartContainerRef.current;
    const width = Math.max(container.clientWidth, 300);
    const height = 680;

    if (!chartRef.current) {
      const chart = createChart(container, {
        width,
        height,
        layout: {
          background: { type: ColorType.Solid, color: "#ffffff" },
          textColor: "#222222",
        },
        grid: {
          vertLines: { color: "#eef2f7" },
          horzLines: { color: "#eef2f7" },
        },
        rightPriceScale: {
          borderColor: "#dbe2ea",
        },
        timeScale: {
          borderColor: "#dbe2ea",
          timeVisible: true,
          secondsVisible: true,
        },
        localization: {
          priceFormatter: (price: number) => price.toFixed(2),
        },
      });

      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: "#16a34a",
        downColor: "#dc2626",
        wickUpColor: "#16a34a",
        wickDownColor: "#dc2626",
        borderUpColor: "#16a34a",
        borderDownColor: "#dc2626",
      });

      chartRef.current = chart;
      candleSeriesRef.current = candleSeries;
    }

    chartRef.current.applyOptions({ width, height });
    setChartSize({ width, height });

    if (chartData.length > 0 && candleSeriesRef.current) {
      candleSeriesRef.current.setData(chartData);
      chartRef.current.timeScale().fitContent();
      chartRef.current.timeScale().scrollToRealTime();
    }

    const handleResize = () => {
      if (!chartContainerRef.current || !chartRef.current) return;

      const nextWidth = Math.max(chartContainerRef.current.clientWidth, 300);
      chartRef.current.applyOptions({ width: nextWidth, height: 680 });
      setChartSize({ width: nextWidth, height: 680 });

      if (chartData.length > 0) {
        chartRef.current.timeScale().fitContent();
        chartRef.current.timeScale().scrollToRealTime();
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [chartData]);

  useEffect(() => {
    return () => {
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        candleSeriesRef.current = null;
      }
    };
  }, []);

  const legendCloseColor = getCaseAccentColor(selectedCase);

  const sidebarCardStyle: React.CSSProperties = {
    border: "1px solid #dbe2ea",
    borderRadius: 14,
    padding: 14,
    background: "#ffffff",
    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
  };

  const mainCardStyle: React.CSSProperties = {
    border: "1px solid #dbe2ea",
    borderRadius: 16,
    padding: 20,
    background: "#ffffff",
    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
  };

  const sectionTitleStyle: React.CSSProperties = {
    marginTop: 0,
    marginBottom: 16,
    fontSize: 18,
    fontWeight: 700,
    color: "#0f172a",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          minHeight: "100vh",
          alignItems: "stretch",
        }}
      >
        <aside
          style={{
            width: 300,
            minWidth: 300,
            maxWidth: 300,
            borderRight: "1px solid #dbe2ea",
            background: "#ffffff",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              position: "sticky",
              top: 0,
              height: "100vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "24px 20px 16px 20px",
                borderBottom: "1px solid #eef2f7",
              }}
            >
              <h1
                style={{
                  margin: 0,
                  fontSize: 34,
                  fontWeight: 700,
                  color: "#0f172a",
                  lineHeight: 1.1,
                }}
              >
                Trader Bot
              </h1>
              <p
                style={{
                  margin: "8px 0 0 0",
                  color: "#475569",
                  fontSize: 15,
                }}
              >
                Dashboard
              </p>
            </div>

            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: 16,
                boxSizing: "border-box",
              }}
            >
              <div style={{ display: "grid", gap: 16 }}>
                <div style={sidebarCardStyle}>
                  <h2
                    style={{
                      marginTop: 0,
                      marginBottom: 12,
                      fontSize: 20,
                      fontWeight: 700,
                    }}
                  >
                    Mercado
                  </h2>

                  <div style={{ display: "grid", gap: 12 }}>
                    <div>
                      <label
                        htmlFor="market-type"
                        style={{
                          display: "block",
                          marginBottom: 6,
                          fontSize: 13,
                          fontWeight: 700,
                          color: "#334155",
                        }}
                      >
                        Tipo
                      </label>

                      <select
                        id="market-type"
                        value={selectedMarketType}
                        onChange={(e) => setSelectedMarketType(e.target.value)}
                        disabled={loadingMarketTypes || marketTypes.length === 0}
                        style={{
                          width: "100%",
                          boxSizing: "border-box",
                          padding: "10px 12px",
                          borderRadius: 10,
                          border: "1px solid #cbd5e1",
                          outline: "none",
                          fontSize: 14,
                          background: "#fff",
                        }}
                      >
                        <option value="">Selecione um tipo</option>
                        {marketTypes.map((item) => (
                          <option key={item.code} value={item.code}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="market-catalog"
                        style={{
                          display: "block",
                          marginBottom: 6,
                          fontSize: 13,
                          fontWeight: 700,
                          color: "#334155",
                        }}
                      >
                        Catálogo
                      </label>

                      <select
                        id="market-catalog"
                        value={selectedCatalog}
                        onChange={(e) => setSelectedCatalog(e.target.value)}
                        disabled={
                          !selectedMarketType ||
                          loadingCatalogs ||
                          availableCatalogs.length === 0
                        }
                        style={{
                          width: "100%",
                          boxSizing: "border-box",
                          padding: "10px 12px",
                          borderRadius: 10,
                          border: "1px solid #cbd5e1",
                          outline: "none",
                          fontSize: 14,
                          background: "#fff",
                        }}
                      >
                        <option value="">Selecione um catálogo</option>
                        {availableCatalogs.map((item) => (
                          <option key={item.code} value={item.code}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="market-symbol"
                        style={{
                          display: "block",
                          marginBottom: 6,
                          fontSize: 13,
                          fontWeight: 700,
                          color: "#334155",
                        }}
                      >
                        Símbolo
                      </label>

                      <select
                        id="market-symbol"
                        value={selectedSymbol}
                        onChange={(e) => setSelectedSymbol(e.target.value)}
                        disabled={
                          !selectedCatalog ||
                          loadingSymbols ||
                          catalogSymbols.length === 0
                        }
                        style={{
                          width: "100%",
                          boxSizing: "border-box",
                          padding: "10px 12px",
                          borderRadius: 10,
                          border: "1px solid #cbd5e1",
                          outline: "none",
                          fontSize: 14,
                          background: "#fff",
                        }}
                      >
                        <option value="">Selecione um símbolo</option>
                        {catalogSymbols.map((item) => (
                          <option key={item.symbol} value={item.symbol}>
                            {item.symbol}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {loadingMarketTypes && (
                    <p style={{ margin: "12px 0 0 0" }}>A carregar tipos...</p>
                  )}

                  {!loadingMarketTypes && marketTypesError && (
                    <div style={{ marginTop: 12 }}>
                      <p style={{ color: "#dc2626", fontWeight: "bold", marginBottom: 6 }}>
                        Erro ao carregar tipos
                      </p>
                      <p style={{ margin: 0 }}>{marketTypesError}</p>
                    </div>
                  )}

                  {!loadingCatalogs && catalogsError && (
                    <div style={{ marginTop: 12 }}>
                      <p style={{ color: "#dc2626", fontWeight: "bold", marginBottom: 6 }}>
                        Erro ao carregar catálogos
                      </p>
                      <p style={{ margin: 0 }}>{catalogsError}</p>
                    </div>
                  )}

                  {!loadingSymbols && symbolsError && (
                    <div style={{ marginTop: 12 }}>
                      <p style={{ color: "#dc2626", fontWeight: "bold", marginBottom: 6 }}>
                        Erro ao carregar símbolos
                      </p>
                      <p style={{ margin: 0 }}>{symbolsError}</p>
                    </div>
                  )}

                  {!loadingSymbols &&
                    !symbolsError &&
                    selectedMarketType &&
                    selectedCatalog &&
                    selectedSymbolData && (
                      <div
                        style={{
                          marginTop: 12,
                          fontSize: 13,
                          lineHeight: 1.5,
                          color: "#475569",
                        }}
                      >
                        <div>
                          <strong>Tipo selecionado:</strong> {selectedMarketTypeLabel}
                        </div>
                        <div>
                          <strong>Catálogo selecionado:</strong> {selectedCatalogLabel}
                        </div>
                        <div>
                          <strong>Símbolo:</strong> {selectedSymbolData.symbol}
                        </div>
                        <div>
                          <strong>Descrição:</strong> {selectedSymbolData.display_name}
                        </div>
                      </div>
                    )}
                </div>

                <div style={sidebarCardStyle}>
                  <h2
                    style={{
                      marginTop: 0,
                      marginBottom: 12,
                      fontSize: 20,
                      fontWeight: 700,
                    }}
                  >
                    Histórico de runs
                  </h2>

                  <input
                    value={runSearch}
                    onChange={(e) => setRunSearch(e.target.value)}
                    placeholder="Buscar por run, symbol, status..."
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1px solid #cbd5e1",
                      marginBottom: 12,
                      outline: "none",
                      fontSize: 14,
                    }}
                  />

                  {loadingRuns && <p style={{ margin: 0 }}>A carregar histórico...</p>}

                  {!loadingRuns && runsError && (
                    <div>
                      <p style={{ color: "#dc2626", fontWeight: "bold" }}>
                        Erro ao carregar histórico
                      </p>
                      <p>{runsError}</p>
                    </div>
                  )}

                  {!loadingRuns && !runsError && filteredRuns.length === 0 && (
                    <p style={{ margin: 0 }}>Nenhum run encontrado.</p>
                  )}

                  {!loadingRuns && !runsError && filteredRuns.length > 0 && (
                    <div style={{ display: "grid", gap: 12 }}>
                      {filteredRuns.map((run) => {
                        const selected = selectedRunId === run.id;

                        return (
                          <button
                            key={run.id}
                            onClick={() => setSelectedRunId(run.id)}
                            style={{
                              textAlign: "left",
                              border: selected ? "2px solid #0f172a" : "1px solid #cbd5e1",
                              borderRadius: 12,
                              padding: 12,
                              background: selected ? "#f1f5f9" : "#fff",
                              cursor: "pointer",
                              boxShadow: selected
                                ? "0 1px 3px rgba(15, 23, 42, 0.08)"
                                : "none",
                            }}
                          >
                            <div
                              style={{
                                fontSize: 15,
                                fontWeight: 700,
                                lineHeight: 1.35,
                                wordBreak: "break-word",
                                marginBottom: 8,
                                color: "#0f172a",
                              }}
                            >
                              {run.id}
                            </div>

                            <div
                              style={{
                                fontSize: 13,
                                lineHeight: 1.5,
                                color: "#1e293b",
                              }}
                            >
                              <div>
                                <strong>Symbol:</strong> {run.symbol}
                              </div>
                              <div>
                                <strong>Timeframe:</strong> {run.timeframe}
                              </div>
                              <div>
                                <strong>Status:</strong> {run.status}
                              </div>
                              <div>
                                <strong>Strategy:</strong> {run.strategy_key ?? "-"}
                              </div>
                              <div>
                                <strong>Candles:</strong> {run.total_candles_processed}
                              </div>
                              <div>
                                <strong>Cases:</strong> {run.total_cases_opened}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div style={sidebarCardStyle}>
                  <h2
                    style={{
                      marginTop: 0,
                      marginBottom: 12,
                      fontSize: 18,
                      fontWeight: 700,
                    }}
                  >
                    API
                  </h2>

                  {loadingHealth && <p style={{ margin: 0 }}>A carregar healthcheck...</p>}

                  {!loadingHealth && healthError && (
                    <div>
                      <p style={{ color: "#dc2626", fontWeight: "bold" }}>
                        Erro ao ligar à API
                      </p>
                      <p>{healthError}</p>
                    </div>
                  )}

                  {!loadingHealth && !healthError && health && (
                    <div style={{ fontSize: 14, lineHeight: 1.6, color: "#1e293b" }}>
                      <div>
                        <strong>Status:</strong> {health.status}
                      </div>
                      <div>
                        <strong>App:</strong> {health.app_name}
                      </div>
                      <div>
                        <strong>Environment:</strong> {health.environment}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </aside>

        <main
          style={{
            flex: 1,
            minWidth: 0,
            overflowY: "auto",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "none",
              margin: 0,
              padding: 16,
              boxSizing: "border-box",
              display: "grid",
              gap: 18,
            }}
          >
            <div style={mainCardStyle}>
              <h2
                style={{
                  marginTop: 0,
                  marginBottom: 20,
                  textAlign: "center",
                  fontSize: 24,
                  fontWeight: 700,
                  color: "#0f172a",
                }}
              >
                Análise do run selecionado
              </h2>

              {!selectedRunId && <p>Nenhum run selecionado.</p>}

              {selectedRunId && loadingRunDetails && <p>A carregar detalhes do run...</p>}

              {selectedRunId && !loadingRunDetails && runDetailsError && (
                <div>
                  <p style={{ color: "#dc2626", fontWeight: "bold" }}>
                    Erro ao carregar detalhes do run
                  </p>
                  <p>{runDetailsError}</p>
                </div>
              )}

              {selectedRunId && !loadingRunDetails && !runDetailsError && runDetails && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 14,
                    fontSize: 15,
                    color: "#334155",
                  }}
                >
                  <div>
                    <strong>ID:</strong> {runDetails.run.id}
                  </div>
                  <div>
                    <strong>Strategy:</strong>{" "}
                    {runDetails.run.strategy_key ?? "(sem strategy_key)"}
                  </div>
                  <div>
                    <strong>Symbol:</strong> {runDetails.run.symbol}
                  </div>
                  <div>
                    <strong>Timeframe:</strong> {runDetails.run.timeframe}
                  </div>
                  <div>
                    <strong>Status:</strong> {runDetails.run.status}
                  </div>
                  <div>
                    <strong>Mode:</strong> {runDetails.run.mode}
                  </div>
                  <div>
                    <strong>Start:</strong> {formatDateTime(runDetails.run.start_at)}
                  </div>
                  <div>
                    <strong>End:</strong> {formatDateTime(runDetails.run.end_at)}
                  </div>
                </div>
              )}
            </div>

            <div style={mainCardStyle}>
              <h2
                style={{
                  marginTop: 0,
                  marginBottom: 16,
                  textAlign: "center",
                  fontSize: 22,
                  fontWeight: 700,
                  color: "#0f172a",
                }}
              >
                Gráfico de candles
              </h2>

              {!loadingCandles && !candlesError && (
                <div
                  style={{
                    marginBottom: 16,
                    textAlign: "center",
                    fontSize: 14,
                    color: "#475569",
                    lineHeight: 1.7,
                  }}
                >
                  <div>
                    <strong>Modo teste realtime:</strong> {FORCE_REALTIME_TEST ? "ativo" : "desligado"}
                  </div>
                  <div>
                    <strong>Mercado:</strong> {selectedMarketTypeLabel}
                    <span style={{ margin: "0 8px" }}>•</span>
                    <strong>Catálogo:</strong> {selectedCatalogLabel}
                  </div>
                  <div>
                    <strong>Símbolo do gráfico:</strong> {effectiveChartSymbol || "-"}
                    {selectedSymbolData ? (
                      <>
                        <span style={{ margin: "0 8px" }}>•</span>
                        {selectedSymbolData.display_name}
                      </>
                    ) : null}
                  </div>
                  <div>
                    <strong>Timeframe:</strong> {effectiveChartTimeframe}
                  </div>
                  <div>
                    <strong>Atualização:</strong> candle_tick direto
                  </div>
                  <div>
                    <strong>WS:</strong> {API_WS_BASE_URL}
                  </div>
                  <div>
                    <strong>WS status:</strong> {wsStatus}
                  </div>
                  <div>
                    <strong>Último evento WS:</strong> {lastWsEvent}
                  </div>
                  <div>
                    <strong>Heartbeat count:</strong> {heartbeatCount ?? "-"}
                  </div>
                  <div>
                    <strong>Heartbeat message:</strong> {heartbeatMessage}
                  </div>
                  <div>
                    <strong>Candles refresh count:</strong> {candlesRefreshCount ?? "-"}
                  </div>
                  <div>
                    <strong>Candles refresh reason:</strong> {candlesRefreshReason}
                  </div>
                  <div>
                    <strong>Último candle tick:</strong>{" "}
                    {lastCandleTick ? formatDateTime(lastCandleTick.open_time) : "-"}
                  </div>
                  <div>
                    <strong>Tick símbolo:</strong> {lastCandleTick?.symbol ?? "-"}
                    <span style={{ margin: "0 8px" }}>•</span>
                    <strong>Tick timeframe:</strong> {lastCandleTick?.timeframe ?? "-"}
                  </div>
                  <div>
                    <strong>Tick OHLC:</strong>{" "}
                    {lastCandleTick
                      ? `${lastCandleTick.open.toFixed(5)} / ${lastCandleTick.high.toFixed(
                          5
                        )} / ${lastCandleTick.low.toFixed(5)} / ${lastCandleTick.close.toFixed(5)}`
                      : "-"}
                  </div>
                  <div>
                    <strong>Tick count:</strong> {lastCandleTick?.count ?? "-"}
                  </div>
                </div>
              )}

              {loadingCandles && <p>A carregar candles...</p>}

              {!loadingCandles && candlesError && (
                <div>
                  <p style={{ color: "#dc2626", fontWeight: "bold" }}>
                    Erro ao carregar candles
                  </p>
                  <p>{candlesError}</p>
                </div>
              )}

              <div style={{ width: "100%" }}>
                <div
                  style={{
                    position: "relative",
                    width: "100%",
                    height: 680,
                    border: "1px solid #dbe2ea",
                    borderRadius: 14,
                    background: "#fff",
                    overflow: "hidden",
                  }}
                >
                  <div
                    ref={chartContainerRef}
                    style={{
                      width: "100%",
                      height: "100%",
                    }}
                  />

                  {!loadingCandles && !candlesError && chartData.length === 0 && (
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "rgba(255,255,255,0.82)",
                        color: "#475569",
                        fontSize: 16,
                        fontWeight: 600,
                        zIndex: 2,
                      }}
                    >
                      Sem candles para este símbolo no período selecionado.
                    </div>
                  )}

                  {!loadingCandles && !candlesError && chartData.length > 0 && (
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        pointerEvents: "none",
                      }}
                    >
                      {overlays.lines.map((line) => (
                        <div
                          key={line.id}
                          style={{
                            position: "absolute",
                            left: 0,
                            right: 0,
                            top: line.top,
                            transform: "translateY(-50%)",
                          }}
                        >
                          <div
                            style={{
                              borderTop: line.dashed
                                ? `2px dashed ${line.color}`
                                : `2px solid ${line.color}`,
                              width: "100%",
                            }}
                          />
                          <div
                            style={{
                              position: "absolute",
                              right: 8,
                              top: -10,
                              background: line.color,
                              color: "#fff",
                              fontSize: 10,
                              fontWeight: 700,
                              padding: "2px 6px",
                              borderRadius: 999,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {line.label} {line.value.toFixed(2)}
                          </div>
                        </div>
                      ))}

                      {overlays.markers.map((marker) => (
                        <div
                          key={marker.id}
                          style={{
                            position: "absolute",
                            left: marker.left,
                            top: marker.top,
                            transform: "translate(-50%, -50%)",
                          }}
                          title={`${marker.label} | ${marker.price.toFixed(2)} | ${marker.timeLabel}`}
                        >
                          <div
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: "50%",
                              background: marker.color,
                              border: "2px solid #ffffff",
                              boxShadow: "0 0 0 1px rgba(0,0,0,0.15)",
                              margin: "0 auto",
                            }}
                          />
                          <div
                            style={{
                              marginTop: 4,
                              padding: "2px 6px",
                              borderRadius: 999,
                              background: marker.color,
                              color: "#fff",
                              fontSize: 10,
                              fontWeight: 700,
                              whiteSpace: "nowrap",
                              textAlign: "center",
                              boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                            }}
                          >
                            {marker.label}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {!loadingCandles && !candlesError && chartData.length > 0 && (
                <>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                      gap: 12,
                      marginTop: 18,
                      marginBottom: 18,
                      fontSize: 14,
                      color: "#475569",
                      textAlign: "center",
                    }}
                  >
                    <div>
                      <strong>Total candles:</strong> {candles.length}
                    </div>
                    <div>
                      <strong>Primeiro candle:</strong> {candles[0].open_time}
                    </div>
                    <div>
                      <strong>Último candle:</strong> {candles[candles.length - 1].open_time}
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 12,
                      flexWrap: "wrap",
                      marginTop: 14,
                      fontSize: 12,
                      justifyContent: "center",
                    }}
                  >
                    <span>
                      <strong>Legenda:</strong>
                    </span>
                    <span style={{ color: "#7c3aed" }}>TRG = Trigger</span>
                    <span style={{ color: "#2563eb" }}>ENT = Entry</span>
                    <span style={{ color: legendCloseColor }}>CLS = Close</span>
                    <span style={{ color: "#16a34a" }}>Linha verde = Target</span>
                    <span style={{ color: "#dc2626" }}>Linha vermelha = Invalidation</span>
                  </div>
                </>
              )}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                gap: 18,
              }}
            >
              <div style={mainCardStyle}>
                <h2 style={sectionTitleStyle}>Case selecionado</h2>

                {!selectedCase && <p>Nenhum case selecionado.</p>}

                {selectedCase && (
                  <div style={{ display: "grid", gap: 8, fontSize: 14, color: "#334155" }}>
                    <div>
                      <strong>ID:</strong> {selectedCase.id}
                    </div>
                    <div>
                      <strong>Status:</strong> {selectedCase.status}
                    </div>
                    <div>
                      <strong>Outcome:</strong> {selectedCase.outcome ?? "-"}
                    </div>
                    <div>
                      <strong>Entry Price:</strong> {selectedCase.entry_price}
                    </div>
                    <div>
                      <strong>Target Price:</strong> {selectedCase.target_price}
                    </div>
                    <div>
                      <strong>Invalidation Price:</strong> {selectedCase.invalidation_price}
                    </div>
                    <div>
                      <strong>Close Price:</strong> {selectedCase.close_price ?? "-"}
                    </div>
                    <div>
                      <strong>Trigger Time:</strong> {formatDateTime(selectedCase.trigger_time)}
                    </div>
                    <div>
                      <strong>Entry Time:</strong> {formatDateTime(selectedCase.entry_time)}
                    </div>
                    <div>
                      <strong>Close Time:</strong> {formatDateTime(selectedCase.close_time)}
                    </div>
                    <div>
                      <strong>Bars To Resolution:</strong> {selectedCase.bars_to_resolution}
                    </div>
                    <div>
                      <strong>MFE:</strong> {selectedCase.max_favorable_excursion}
                    </div>
                    <div>
                      <strong>MAE:</strong> {selectedCase.max_adverse_excursion}
                    </div>
                  </div>
                )}
              </div>

              <div style={mainCardStyle}>
                <h2 style={sectionTitleStyle}>Métricas</h2>

                {!runDetails?.metrics && <p>Sem métricas.</p>}

                {runDetails?.metrics && (
                  <div style={{ display: "grid", gap: 8, fontSize: 14, color: "#334155" }}>
                    <div>
                      <strong>Total Cases:</strong> {runDetails.metrics.total_cases}
                    </div>
                    <div>
                      <strong>Total Hits:</strong> {runDetails.metrics.total_hits}
                    </div>
                    <div>
                      <strong>Total Fails:</strong> {runDetails.metrics.total_fails}
                    </div>
                    <div>
                      <strong>Total Timeouts:</strong> {runDetails.metrics.total_timeouts}
                    </div>
                    <div>
                      <strong>Hit Rate:</strong> {runDetails.metrics.hit_rate}
                    </div>
                    <div>
                      <strong>Fail Rate:</strong> {runDetails.metrics.fail_rate}
                    </div>
                    <div>
                      <strong>Timeout Rate:</strong> {runDetails.metrics.timeout_rate}
                    </div>
                    <div>
                      <strong>Avg Bars To Resolution:</strong>{" "}
                      {runDetails.metrics.avg_bars_to_resolution}
                    </div>
                    <div>
                      <strong>Avg Time To Resolution Seconds:</strong>{" "}
                      {runDetails.metrics.avg_time_to_resolution_seconds}
                    </div>
                    <div>
                      <strong>Avg MFE:</strong> {runDetails.metrics.avg_mfe}
                    </div>
                    <div>
                      <strong>Avg MAE:</strong> {runDetails.metrics.avg_mae}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div style={mainCardStyle}>
              <h2 style={sectionTitleStyle}>Cases</h2>

              {!runDetails && <p>Sem dados do run.</p>}

              {runDetails && runDetails.cases.length === 0 && <p>Sem cases neste run.</p>}

              {runDetails && runDetails.cases.length > 0 && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                    gap: 12,
                  }}
                >
                  {runDetails.cases.map((item) => {
                    const isSelected = item.id === selectedCaseId;
                    const accent = getCaseAccentColor(item);

                    return (
                      <button
                        key={item.id}
                        onClick={() => setSelectedCaseId(item.id)}
                        style={{
                          textAlign: "left",
                          border: isSelected ? `2px solid ${accent}` : "1px solid #dbe2ea",
                          borderRadius: 12,
                          padding: 12,
                          background: isSelected ? "#fafafa" : "#fff",
                          cursor: "pointer",
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 700,
                            marginBottom: 8,
                            wordBreak: "break-word",
                            color: "#0f172a",
                          }}
                        >
                          {item.id}
                        </div>
                        <div style={{ fontSize: 13, lineHeight: 1.5, color: "#334155" }}>
                          <div>
                            <strong>Status:</strong> {item.status}
                          </div>
                          <div>
                            <strong>Outcome:</strong> {item.outcome ?? "-"}
                          </div>
                          <div>
                            <strong>Entry:</strong> {item.entry_price}
                          </div>
                          <div>
                            <strong>Target:</strong> {item.target_price}
                          </div>
                          <div>
                            <strong>Invalidation:</strong> {item.invalidation_price}
                          </div>
                          <div>
                            <strong>Trigger:</strong> {formatDateTime(item.trigger_time)}
                          </div>
                          <div>
                            <strong>Entry Time:</strong> {formatDateTime(item.entry_time)}
                          </div>
                          <div>
                            <strong>Close Time:</strong> {formatDateTime(item.close_time)}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={mainCardStyle}>
              <h2 style={sectionTitleStyle}>Estratégias disponíveis</h2>

              {loadingStrategies && <p>A carregar estratégias...</p>}

              {!loadingStrategies && strategiesError && (
                <div>
                  <p style={{ color: "#dc2626", fontWeight: "bold" }}>
                    Erro ao carregar estratégias
                  </p>
                  <p>{strategiesError}</p>
                </div>
              )}

              {!loadingStrategies && !strategiesError && strategies.length === 0 && (
                <p>Nenhuma estratégia encontrada.</p>
              )}

              {!loadingStrategies && !strategiesError && strategies.length > 0 && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                    gap: 12,
                  }}
                >
                  {strategies.map((strategy) => (
                    <div
                      key={strategy.key}
                      style={{
                        border: "1px solid #dbe2ea",
                        borderRadius: 12,
                        padding: 12,
                        background: "#fff",
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 700,
                          marginBottom: 8,
                          color: "#0f172a",
                        }}
                      >
                        {strategy.name}
                      </div>
                      <div style={{ fontSize: 13, lineHeight: 1.5, color: "#334155" }}>
                        <div>
                          <strong>Key:</strong> {strategy.key}
                        </div>
                        <div>
                          <strong>Version:</strong> {strategy.version}
                        </div>
                        <div>
                          <strong>Category:</strong> {strategy.category}
                        </div>
                        <div>
                          <strong>Description:</strong> {strategy.description}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;