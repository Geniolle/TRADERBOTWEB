// src/App.tsx

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

import ApiStatusCard from "./components/api/ApiStatusCard";
import SelectedCaseCard from "./components/cases/SelectedCaseCard";
import CandlesChartCard from "./components/chart/CandlesChartCard";
import ChartDiagnosticsCard from "./components/diagnostics/ChartDiagnosticsCard";
import MarketFiltersCard from "./components/market/MarketFiltersCard";
import RunHistoryCard from "./components/runs/RunHistoryCard";
import RunCasesCard from "./components/runs/RunCasesCard";
import RunMetricsCard from "./components/runs/RunMetricsCard";
import RunSummaryCard from "./components/runs/RunSummaryCard";
import {
  CHART_BAR_SPACING,
  CHART_HEIGHT,
  CHART_MIN_BAR_SPACING,
  CHART_RIGHT_OFFSET,
} from "./constants/chart";
import {
  API_HTTP_BASE_URL,
  API_WS_BASE_URL,
  FORCED_REALTIME_SYMBOL,
  FORCED_REALTIME_TIMEFRAME,
  FORCE_REALTIME_TEST,
} from "./constants/config";
import type {
  CandleItem,
  CandleTickState,
  CatalogInstrument,
  CatalogItemsResponse,
  CatalogProductResponse,
  CatalogProductsResponse,
  CatalogProductSummary,
  ChartCandleMeta,
  FeedDiagnostics,
  HealthResponse,
  OverlayLine,
  OverlayMarker,
  RunDetailsResponse,
  RunHistoryItem,
  StrategyItem,
  WsEnvelope,
} from "./types/trading";
import { applyStableVisibleRange, getCaseAccentColor, toUtcTimestamp } from "./utils/chart";
import {
  buildFallbackStartAt,
  buildRealtimeTestStartAt,
  normalizeCandles,
  upsertRealtimeCandle,
} from "./utils/candles";
import {
  floorToMinuteIso,
  formatBooleanLike,
  formatDateTime,
  formatMaybeNumber,
  formatUtcDateTime,
  parsePrice,
} from "./utils/format";

function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [strategies, setStrategies] = useState<StrategyItem[]>([]);
  const [runs, setRuns] = useState<RunHistoryItem[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string>("");
  const [runDetails, setRunDetails] = useState<RunDetailsResponse | null>(null);
  const [candles, setCandles] = useState<CandleItem[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string>("");
  const [chartSize, setChartSize] = useState({ width: 0, height: CHART_HEIGHT });
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
      if (!effectiveChartSymbol || !effectiveChartTimeframe) {
        if (!cancelled) {
          setCandles([]);
          setCandlesError("");
          setLoadingCandles(false);
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
          setCandles([]);
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
            typeof openTimeValue === "string" ? floorToMinuteIso(openTimeValue) : "-";

          const nextTick: NonNullable<CandleTickState> = {
            symbol: typeof symbolValue === "string" ? symbolValue : "-",
            timeframe: typeof timeframeValue === "string" ? timeframeValue : "-",
            open_time: normalizedOpenTime,
            open: openValue,
            high: highValue,
            low: lowValue,
            close: closeValue,
            count: countValue,
            source: typeof parsed.data?.source === "string" ? parsed.data.source : null,
            provider:
              typeof parsed.data?.provider === "string" ? parsed.data.provider : null,
            market_session:
              typeof parsed.data?.market_session === "string"
                ? parsed.data.market_session
                : null,
            timezone:
              typeof parsed.data?.timezone === "string" ? parsed.data.timezone : null,
            is_delayed:
              typeof parsed.data?.is_delayed === "boolean"
                ? parsed.data.is_delayed
                : null,
            is_mock:
              typeof parsed.data?.is_mock === "boolean" ? parsed.data.is_mock : null,
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

  const feedDiagnostics = useMemo<FeedDiagnostics>(() => {
    const firstCandle = candles[0] ?? null;
    const lastCandle = candles[candles.length - 1] ?? null;
    const runtimeTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "-";

    const minLow =
      candleMeta.length > 0 ? Math.min(...candleMeta.map((item) => item.low)) : null;
    const maxHigh =
      candleMeta.length > 0 ? Math.max(...candleMeta.map((item) => item.high)) : null;

    return {
      symbol: effectiveChartSymbol || "-",
      timeframe: effectiveChartTimeframe || "-",
      totalCandles: candles.length,
      firstCandleUtc: formatUtcDateTime(firstCandle?.open_time ?? null),
      lastCandleUtc: formatUtcDateTime(lastCandle?.open_time ?? null),
      firstCandleLocal: formatDateTime(firstCandle?.open_time ?? null),
      lastCandleLocal: formatDateTime(lastCandle?.open_time ?? null),
      lastClose: lastCandle ? formatMaybeNumber(Number(lastCandle.close), 5) : "-",
      priceRange:
        minLow !== null && maxHigh !== null
          ? `${minLow.toFixed(5)} → ${maxHigh.toFixed(5)}`
          : "-",
      candleSource: lastCandle?.source ?? "-",
      candleProvider: lastCandle?.provider ?? "-",
      candleSession: lastCandle?.market_session ?? "-",
      candleTimezone: lastCandle?.timezone ?? "-",
      candleIsDelayed: formatBooleanLike(lastCandle?.is_delayed),
      candleIsMock: formatBooleanLike(lastCandle?.is_mock),
      lastTickUtc: formatUtcDateTime(lastCandleTick?.open_time ?? null),
      lastTickLocal: formatDateTime(lastCandleTick?.open_time ?? null),
      tickSource: lastCandleTick?.source ?? "-",
      tickProvider: lastCandleTick?.provider ?? "-",
      tickSession: lastCandleTick?.market_session ?? "-",
      tickTimezone: lastCandleTick?.timezone ?? "-",
      tickIsDelayed: formatBooleanLike(lastCandleTick?.is_delayed),
      tickIsMock: formatBooleanLike(lastCandleTick?.is_mock),
      runtimeTimezone,
    };
  }, [
    candles,
    candleMeta,
    effectiveChartSymbol,
    effectiveChartTimeframe,
    lastCandleTick,
  ]);

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
      return leftPadding + (index / Math.max(candleMeta.length - 1, 1)) * plotWidth;
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
    const height = CHART_HEIGHT;

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
          rightOffset: CHART_RIGHT_OFFSET,
          barSpacing: CHART_BAR_SPACING,
          minBarSpacing: CHART_MIN_BAR_SPACING,
          fixLeftEdge: false,
          fixRightEdge: false,
          lockVisibleTimeRangeOnResize: true,
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

    if (candleSeriesRef.current) {
      candleSeriesRef.current.setData(chartData);
    }

    if (chartData.length > 0 && chartRef.current) {
      applyStableVisibleRange(chartRef.current, chartData.length);
      chartRef.current.timeScale().scrollToRealTime();
    }

    const handleResize = () => {
      if (!chartContainerRef.current || !chartRef.current) return;

      const nextWidth = Math.max(chartContainerRef.current.clientWidth, 300);
      chartRef.current.applyOptions({ width: nextWidth, height: CHART_HEIGHT });
      setChartSize({ width: nextWidth, height: CHART_HEIGHT });

      if (chartData.length > 0) {
        applyStableVisibleRange(chartRef.current, chartData.length);
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

  const debugGridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 12,
    fontSize: 14,
    color: "#334155",
  };

  const debugItemStyle: React.CSSProperties = {
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: 12,
    background: "#f8fafc",
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
                <MarketFiltersCard
                  sidebarCardStyle={sidebarCardStyle}
                  loadingMarketTypes={loadingMarketTypes}
                  loadingCatalogs={loadingCatalogs}
                  loadingSymbols={loadingSymbols}
                  marketTypesError={marketTypesError}
                  catalogsError={catalogsError}
                  symbolsError={symbolsError}
                  marketTypes={marketTypes}
                  selectedMarketType={selectedMarketType}
                  setSelectedMarketType={setSelectedMarketType}
                  availableCatalogs={availableCatalogs}
                  selectedCatalog={selectedCatalog}
                  setSelectedCatalog={setSelectedCatalog}
                  catalogSymbols={catalogSymbols}
                  selectedSymbol={selectedSymbol}
                  setSelectedSymbol={setSelectedSymbol}
                  selectedMarketTypeLabel={selectedMarketTypeLabel}
                  selectedCatalogLabel={selectedCatalogLabel}
                  selectedSymbolData={selectedSymbolData}
                />

                <RunHistoryCard
                  sidebarCardStyle={sidebarCardStyle}
                  runSearch={runSearch}
                  setRunSearch={setRunSearch}
                  loadingRuns={loadingRuns}
                  runsError={runsError}
                  filteredRuns={filteredRuns}
                  selectedRunId={selectedRunId}
                  setSelectedRunId={setSelectedRunId}
                />

                <ApiStatusCard
                  sidebarCardStyle={sidebarCardStyle}
                  loadingHealth={loadingHealth}
                  healthError={healthError}
                  health={health}
                />
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
            <RunSummaryCard
              mainCardStyle={mainCardStyle}
              selectedRunId={selectedRunId}
              loadingRunDetails={loadingRunDetails}
              runDetailsError={runDetailsError}
              runDetails={runDetails}
            />

            <CandlesChartCard
              mainCardStyle={mainCardStyle}
              chartContainerRef={chartContainerRef}
              loadingCandles={loadingCandles}
              candlesError={candlesError}
              chartData={chartData}
              candles={candles}
              overlays={overlays}
              selectedMarketTypeLabel={selectedMarketTypeLabel}
              selectedCatalogLabel={selectedCatalogLabel}
              effectiveChartSymbol={effectiveChartSymbol}
              effectiveChartTimeframe={effectiveChartTimeframe}
              selectedSymbolData={selectedSymbolData}
              wsStatus={wsStatus}
              lastWsEvent={lastWsEvent}
              heartbeatCount={heartbeatCount}
              heartbeatMessage={heartbeatMessage}
              candlesRefreshCount={candlesRefreshCount}
              candlesRefreshReason={candlesRefreshReason}
              lastCandleTick={lastCandleTick}
              legendCloseColor={legendCloseColor}
            />

            <ChartDiagnosticsCard
              mainCardStyle={mainCardStyle}
              sectionTitleStyle={sectionTitleStyle}
              debugGridStyle={debugGridStyle}
              debugItemStyle={debugItemStyle}
              feedDiagnostics={feedDiagnostics}
            />

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                gap: 18,
              }}
            >
              <SelectedCaseCard
                mainCardStyle={mainCardStyle}
                sectionTitleStyle={sectionTitleStyle}
                runDetails={runDetails}
                selectedCaseId={selectedCaseId}
              />

              <RunMetricsCard
                mainCardStyle={mainCardStyle}
                sectionTitleStyle={sectionTitleStyle}
                runDetails={runDetails}
              />
            </div>

            <RunCasesCard
              mainCardStyle={mainCardStyle}
              sectionTitleStyle={sectionTitleStyle}
              runDetails={runDetails}
              selectedCaseId={selectedCaseId}
              setSelectedCaseId={setSelectedCaseId}
            />

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