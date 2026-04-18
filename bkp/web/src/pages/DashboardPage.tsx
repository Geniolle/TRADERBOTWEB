import { useEffect, useMemo, useState } from "react";

import ApiStatusCard from "../components/api/ApiStatusCard";
import SelectedCaseCard from "../components/cases/SelectedCaseCard";
import CandlesChartCard from "../components/chart/CandlesChartCard";
import ChartDiagnosticsCard from "../components/diagnostics/ChartDiagnosticsCard";
import MarketFiltersCard from "../components/market/MarketFiltersCard";
import RunCasesCard from "../components/runs/RunCasesCard";
import RunHistoryCard from "../components/runs/RunHistoryCard";
import RunMetricsCard from "../components/runs/RunMetricsCard";
import RunSummaryCard from "../components/runs/RunSummaryCard";
import StrategiesCard from "../components/strategies/StrategiesCard";
import {
  API_HTTP_BASE_URL,
  CHART_STRATEGY_HIGHLIGHT_MIN_SCORE,
  FORCED_REALTIME_SYMBOL,
  FORCED_REALTIME_TIMEFRAME,
  FORCE_REALTIME_TEST,
} from "../constants/config";
import useApiHealth from "../hooks/useApiHealth";
import useCandles from "../hooks/useCandles";
import useCandlestickChart from "../hooks/useCandlestickChart";
import useChartDerivedData from "../hooks/useChartDerivedData";
import useChartIndicators from "../hooks/useChartIndicators";
import useIndicatorSettings from "../hooks/useIndicatorSettings";
import useMarketCatalog from "../hooks/useMarketCatalog";
import useMarketProviders from "../hooks/useMarketProviders.ts";
import useRealtimeFeed from "../hooks/useRealtimeFeed";
import useRunDetails from "../hooks/useRunDetails";
import useStageTests from "../hooks/useStageTests";
import useStrategies from "../hooks/useStrategies";
import type { CandleItem } from "../types/trading";

type TimeframeOption = {
  value: string;
  label: string;
};

type MarketStrategyCardBridgeItem = {
  id: string;
  title: string;
  score: number;
};

type PersistedLatestCandleDiagnostic = {
  symbol: string;
  timeframe: string;
  open_time: string;
  close_time: string;
  provider: string | null;
  source: string | null;
} | null;

const TIMEFRAME_STORAGE_KEY = "traderbot:selectedTimeframe";
const CHART_STRATEGY_STORAGE_KEY = "traderbot:selectedChartStrategyKey";
const MARKET_STRATEGY_CARDS_EVENT = "traderbot:market-strategy-cards";

const TIMEFRAME_OPTIONS: TimeframeOption[] = [
  { value: "1m", label: "1m" },
  { value: "3m", label: "3m" },
  { value: "5m", label: "5m" },
  { value: "15m", label: "15m" },
  { value: "30m", label: "30m" },
  { value: "1h", label: "1h" },
  { value: "4h", label: "4h" },
  { value: "1d", label: "1d" },
];

function readStoredTimeframe(): string {
  try {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(TIMEFRAME_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function readStoredChartStrategyKey(): string {
  try {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(CHART_STRATEGY_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function normalizeText(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeSymbol(value: string | null | undefined): string {
  return String(value ?? "").trim().toUpperCase();
}

function normalizeTimeframe(value: string | null | undefined): string {
  const normalized = String(value ?? "").trim().toLowerCase();

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

function normalizeProvider(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeIsoString(value: string | null | undefined): string {
  if (!value) return "";

  const parsed = new Date(value).getTime();
  if (!Number.isFinite(parsed)) {
    return String(value).trim();
  }

  return new Date(parsed).toISOString();
}

function timestampFromIso(value: string | null | undefined): number | null {
  if (!value) return null;

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function formatMinutesDiff(
  leftValue: string | null | undefined,
  rightValue: string | null | undefined,
): string {
  const left = timestampFromIso(leftValue);
  const right = timestampFromIso(rightValue);

  if (left === null || right === null) {
    return "-";
  }

  const diffMinutes = (left - right) / 60000;
  return diffMinutes.toFixed(2);
}

function formatIsoForConsole(value: string | null | undefined): string {
  return value ? normalizeIsoString(value) : "-";
}

function buildLatestPersistedCandleUrl(
  symbol: string,
  timeframe: string,
  provider?: string,
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

async function fetchLatestPersistedCandleDiagnostic(params: {
  symbol: string;
  timeframe: string;
  provider: string;
}): Promise<PersistedLatestCandleDiagnostic> {
  const { symbol, timeframe, provider } = params;

  if (!symbol || !timeframe) {
    return null;
  }

  const response = await fetch(
    buildLatestPersistedCandleUrl(symbol, timeframe, provider),
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    },
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const payloadText = await response.text();
    throw new Error(payloadText || `HTTP ${response.status}`);
  }

  const payload = (await response.json()) as Partial<CandleItem> | null;

  if (!payload || typeof payload !== "object") {
    return null;
  }

  if (
    typeof payload.symbol !== "string" ||
    typeof payload.timeframe !== "string" ||
    typeof payload.open_time !== "string"
  ) {
    return null;
  }

  return {
    symbol: normalizeSymbol(payload.symbol),
    timeframe: normalizeTimeframe(payload.timeframe),
    open_time: normalizeIsoString(payload.open_time),
    close_time: normalizeIsoString(
      typeof payload.close_time === "string"
        ? payload.close_time
        : payload.open_time,
    ),
    provider:
      typeof payload.provider === "string"
        ? payload.provider
        : typeof payload.source === "string"
          ? payload.source
          : null,
    source: typeof payload.source === "string" ? payload.source : null,
  };
}

function normalizeMarketStrategyCards(
  value: unknown,
): MarketStrategyCardBridgeItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as Record<string, unknown>;
      const id = String(record.id ?? "").trim();
      const title = String(record.title ?? "").trim();
      const score = Number(record.score ?? Number.NaN);

      if (!id || !title || !Number.isFinite(score)) {
        return null;
      }

      return { id, title, score };
    })
    .filter((item): item is MarketStrategyCardBridgeItem => item !== null);
}

function NavLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <a
      href={href}
      style={{
        display: "block",
        padding: "10px 12px",
        borderRadius: 10,
        textDecoration: "none",
        fontSize: 14,
        fontWeight: 600,
        color: active ? "#0f172a" : "#475569",
        background: active ? "#eef2ff" : "transparent",
        border: active ? "1px solid #c7d2fe" : "1px solid transparent",
      }}
    >
      {label}
    </a>
  );
}

function DashboardPage() {
  const { health, loadingHealth, healthError } = useApiHealth();

  const {
    providers,
    selectedProvider,
    setSelectedProvider,
    backendSelectedProvider,
    loadingProviders,
    providersError,
  } = useMarketProviders();

  const {
    marketTypes,
    selectedMarketType,
    setSelectedMarketType,
    selectedCatalog,
    setSelectedCatalog,
    catalogSymbols,
    selectedSymbol,
    setSelectedSymbol,
    availableCatalogs,
    selectedMarketTypeLabel,
    selectedCatalogLabel,
    selectedSymbolData,
    loadingMarketTypes,
    loadingCatalogs,
    loadingSymbols,
    marketTypesError,
    catalogsError,
    symbolsError,
  } = useMarketCatalog({
    selectedProvider,
  });

  const { strategies, loadingStrategies, strategiesError } = useStrategies();

  const {
    settings,
    setIndicatorEnabled,
    setBollingerPeriod,
    setBollingerStdDev,
  } = useIndicatorSettings();

  const [selectedTimeframe, setSelectedTimeframe] = useState<string>(() =>
    readStoredTimeframe(),
  );

  const [storedChartStrategyKey] = useState<string>(() =>
    readStoredChartStrategyKey(),
  );

  const [marketStrategyCards, setMarketStrategyCards] = useState<
    MarketStrategyCardBridgeItem[]
  >([]);

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;

      if (selectedTimeframe) {
        window.localStorage.setItem(TIMEFRAME_STORAGE_KEY, selectedTimeframe);
      } else {
        window.localStorage.removeItem(TIMEFRAME_STORAGE_KEY);
      }
    } catch {
      // Ignora erros de localStorage
    }
  }, [selectedTimeframe]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleStrategyCardsEvent = (event: Event) => {
      const customEvent = event as CustomEvent<unknown>;
      setMarketStrategyCards(normalizeMarketStrategyCards(customEvent.detail));
    };

    window.addEventListener(
      MARKET_STRATEGY_CARDS_EVENT,
      handleStrategyCardsEvent as EventListener,
    );

    return () => {
      window.removeEventListener(
        MARKET_STRATEGY_CARDS_EVENT,
        handleStrategyCardsEvent as EventListener,
      );
    };
  }, []);

  const isSelectedTimeframeValid = useMemo(() => {
    return TIMEFRAME_OPTIONS.some((item) => item.value === selectedTimeframe);
  }, [selectedTimeframe]);

  const effectiveSelectedTimeframe = useMemo(() => {
    return isSelectedTimeframeValid ? selectedTimeframe : "";
  }, [isSelectedTimeframeValid, selectedTimeframe]);

  const selectableStrategies = useMemo(() => {
    return strategies.filter((item) => item.enabled !== false);
  }, [strategies]);

  const effectiveSelectedChartStrategyKey = useMemo(() => {
    if (!storedChartStrategyKey) {
      return "";
    }

    const existsInSelectableList = selectableStrategies.some(
      (item) => item.key === storedChartStrategyKey,
    );

    return existsInSelectableList ? storedChartStrategyKey : "";
  }, [selectableStrategies, storedChartStrategyKey]);

  const selectedChartStrategy = useMemo(() => {
    return (
      selectableStrategies.find(
        (item) => item.key === effectiveSelectedChartStrategyKey,
      ) ?? null
    );
  }, [selectableStrategies, effectiveSelectedChartStrategyKey]);

  const isMarketSelectionComplete = useMemo(() => {
    if (FORCE_REALTIME_TEST) {
      return Boolean(FORCED_REALTIME_SYMBOL && FORCED_REALTIME_TIMEFRAME);
    }

    return Boolean(
      selectedMarketType &&
        selectedCatalog &&
        selectedSymbol &&
        effectiveSelectedTimeframe,
    );
  }, [
    selectedMarketType,
    selectedCatalog,
    selectedSymbol,
    effectiveSelectedTimeframe,
  ]);

  const effectiveChartMarketType = useMemo(() => {
    if (FORCE_REALTIME_TEST) return selectedMarketType;
    if (!isMarketSelectionComplete) return "";
    return selectedMarketType;
  }, [isMarketSelectionComplete, selectedMarketType]);

  const effectiveChartCatalog = useMemo(() => {
    if (FORCE_REALTIME_TEST) return selectedCatalog;
    if (!isMarketSelectionComplete) return "";
    return selectedCatalog;
  }, [isMarketSelectionComplete, selectedCatalog]);

  const effectiveChartSymbol = useMemo(() => {
    if (FORCE_REALTIME_TEST) return FORCED_REALTIME_SYMBOL;
    if (!isMarketSelectionComplete) return "";
    return selectedSymbol;
  }, [isMarketSelectionComplete, selectedSymbol]);

  const effectiveChartTimeframe = useMemo(() => {
    if (FORCE_REALTIME_TEST) return FORCED_REALTIME_TIMEFRAME;
    if (!isMarketSelectionComplete) return "";
    return effectiveSelectedTimeframe;
  }, [isMarketSelectionComplete, effectiveSelectedTimeframe]);

  const {
    candles,
    coverageMeta,
    setCandles,
    loadingCandles: loadingCandlesFromHttp,
    candlesError: candlesErrorFromHttp,
    reloadCandles,
  } = useCandles({
    effectiveChartSymbol,
    effectiveChartTimeframe,
    selectedProvider,
  });

  const {
    wsStatus,
    lastWsEvent,
    heartbeatCount,
    heartbeatMessage,
    candlesRefreshCount,
    candlesRefreshReason,
    lastCandleTick,
    providerErrorMessage,
    hasLoadedInitialCandles,
    lastProviderUpdateLog,
    lastProviderUpdateAt,
    lastProviderReceivedAt,
    lastProviderUpdateEvent,
    lastProviderUpdateStatus,
  } = useRealtimeFeed({
    effectiveChartMarketType,
    effectiveChartCatalog,
    effectiveChartSymbol,
    effectiveChartTimeframe,
    selectedProvider,
    setCandles,
    reloadCandles,
  });

  const {
    stageTests,
    selectedRunId,
    runSearch,
    setRunSearch,
    filteredStageTests,
    loadingRuns,
    runsError,
    actionError,
    isClearingRuns,
    isCreatingRuns,
    runningStrategyKey,
    clearRuns,
    runStageTestByStrategy,
    lastExecutionLog,
    lastExecutionStatus,
  } = useStageTests({
    selectedSymbol: effectiveChartSymbol,
    selectedTimeframe: effectiveChartTimeframe,
    lastCandleTick,
  });

  const {
    runDetails,
    selectedCaseId,
    setSelectedCaseId,
    loadingRunDetails,
    runDetailsError,
  } = useRunDetails(selectedRunId);

  const currentRunStrategyScores = useMemo(() => {
    const normalizedSymbol = normalizeText(effectiveChartSymbol);
    const normalizedTimeframe = normalizeText(effectiveChartTimeframe);

    return stageTests
      .filter((item) => {
        const itemSymbol = normalizeText(item.last_run?.symbol);
        const itemTimeframe = normalizeText(item.last_run?.timeframe);

        return (
          itemSymbol === normalizedSymbol &&
          itemTimeframe === normalizedTimeframe
        );
      })
      .map((item) => ({
        id: item.strategy_key,
        label: item.strategy_name || item.strategy_key,
        score: Number(item.hit_rate ?? 0),
      }))
      .filter((item) => Number.isFinite(item.score))
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }

        return a.label.localeCompare(b.label, "pt-PT");
      });
  }, [stageTests, effectiveChartSymbol, effectiveChartTimeframe]);

  const strategyHighlights = useMemo(() => {
    const runItems = currentRunStrategyScores;

    const contextualItems = marketStrategyCards.map((item) => ({
      id: item.id,
      label: item.title,
      score: Number(item.score ?? 0),
    }));

    const mergedMap = new Map<
      string,
      {
        id: string;
        label: string;
        score: number;
      }
    >();

    [...runItems, ...contextualItems].forEach((item) => {
      if (!Number.isFinite(item.score)) return;
      if (item.score < CHART_STRATEGY_HIGHLIGHT_MIN_SCORE) return;

      const existing = mergedMap.get(item.id);

      if (!existing || item.score > existing.score) {
        mergedMap.set(item.id, item);
      }
    });

    return Array.from(mergedMap.values())
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }

        return a.label.localeCompare(b.label, "pt-PT");
      })
      .slice(0, 5);
  }, [currentRunStrategyScores, marketStrategyCards]);

  const hasContextualOverlayCandidate = useMemo(() => {
    return marketStrategyCards.some(
      (item) =>
        Number.isFinite(item.score) &&
        item.score >= CHART_STRATEGY_HIGHLIGHT_MIN_SCORE,
    );
  }, [marketStrategyCards]);

  const loadingCandles = useMemo(() => {
    if (!isMarketSelectionComplete) return false;
    if (candles.length > 0) return false;

    return (
      loadingCandlesFromHttp ||
      wsStatus === "connecting" ||
      wsStatus === "connected" ||
      wsStatus === "subscribed"
    );
  }, [
    isMarketSelectionComplete,
    candles.length,
    loadingCandlesFromHttp,
    wsStatus,
  ]);

  const candlesError = useMemo(() => {
    if (!isMarketSelectionComplete) return "";

    if (candlesErrorFromHttp) {
      return candlesErrorFromHttp;
    }

    if (providerErrorMessage) {
      return providerErrorMessage;
    }

    if (
      !loadingCandles &&
      hasLoadedInitialCandles &&
      candles.length === 0 &&
      lastWsEvent === "initial_candles"
    ) {
      return "Nenhum candle foi devolvido para esta seleção.";
    }

    if (wsStatus === "error") {
      return "Erro na ligação websocket do gráfico.";
    }

    return "";
  }, [
    isMarketSelectionComplete,
    candlesErrorFromHttp,
    providerErrorMessage,
    loadingCandles,
    hasLoadedInitialCandles,
    candles.length,
    lastWsEvent,
    wsStatus,
  ]);

  const { series: indicatorSeries, activeLabels: activeIndicatorLabels } =
    useChartIndicators({
      candles,
      settings,
    });

  const { chartContainerRef, chartSize, chartData, chartProjector } =
    useCandlestickChart({
    candles,
    indicatorSeries,
  });

  const { feedDiagnostics, overlays, legendCloseColor } = useChartDerivedData({
    candles,
    coverageMeta,
    runDetails,
    selectedCaseId,
    chartSize,
    chartProjector,
    effectiveChartSymbol,
    effectiveChartTimeframe,
    lastCandleTick,
    marketStrategyCards,
  });

  const runStrategyKey = runDetails?.run?.strategy_key ?? "";

  const selectedStrategySupportsOverlays = useMemo(() => {
    if (!selectedChartStrategy) return false;
    return selectedChartStrategy.supports_chart_overlays !== false;
  }, [selectedChartStrategy]);

  const showStrategyOverlays = useMemo(() => {
    if (hasContextualOverlayCandidate) {
      return true;
    }

    if (!effectiveSelectedChartStrategyKey) return false;
    if (!runStrategyKey) return false;
    if (!selectedStrategySupportsOverlays) return false;

    return effectiveSelectedChartStrategyKey === runStrategyKey;
  }, [
    hasContextualOverlayCandidate,
    effectiveSelectedChartStrategyKey,
    runStrategyKey,
    selectedStrategySupportsOverlays,
  ]);

  const selectedStrategyNotice = useMemo(() => {
    if (!selectedChartStrategy) {
      return null;
    }

    return {
      name: selectedChartStrategy.name,
      key: selectedChartStrategy.key,
      supportsOverlays: selectedChartStrategy.supports_chart_overlays !== false,
    };
  }, [selectedChartStrategy]);

  const showSelectedStrategyNotice = Boolean(
    selectedStrategyNotice && !showStrategyOverlays,
  );

  const lastChartCandle = useMemo(() => {
    return candles.length > 0 ? candles[candles.length - 1] : null;
  }, [candles]);

  useEffect(() => {
    console.groupCollapsed(
      `[TB][DASHBOARD] threshold=${CHART_STRATEGY_HIGHLIGHT_MIN_SCORE} | ${effectiveChartSymbol || "-"} / ${effectiveChartTimeframe || "-"}`,
    );
    console.log(
      "effectiveSelectedChartStrategyKey:",
      effectiveSelectedChartStrategyKey,
    );
    console.log("runStrategyKey:", runStrategyKey);
    console.log(
      "hasContextualOverlayCandidate:",
      hasContextualOverlayCandidate,
    );
    console.log("showStrategyOverlays:", showStrategyOverlays);
    console.log("overlayMarkers:", overlays.markers.length);
    console.log("overlayLines:", overlays.lines.length);

    console.table(
      marketStrategyCards.map((item) => ({
        origem: "contexto",
        id: item.id,
        title: item.title,
        score: item.score,
        elegivel_overlay: item.score >= CHART_STRATEGY_HIGHLIGHT_MIN_SCORE,
      })),
    );

    console.table(
      currentRunStrategyScores.map((item) => ({
        origem: "stage_test",
        id: item.id,
        title: item.label,
        score: item.score,
        elegivel_overlay: item.score >= CHART_STRATEGY_HIGHLIGHT_MIN_SCORE,
      })),
    );

    console.table(
      strategyHighlights.map((item) => ({
        id: item.id,
        title: item.label,
        score: item.score,
      })),
    );

    console.groupEnd();
  }, [
    effectiveChartSymbol,
    effectiveChartTimeframe,
    effectiveSelectedChartStrategyKey,
    runStrategyKey,
    hasContextualOverlayCandidate,
    showStrategyOverlays,
    overlays.markers.length,
    overlays.lines.length,
    marketStrategyCards,
    currentRunStrategyScores,
    strategyHighlights,
  ]);

  useEffect(() => {
    const symbol = normalizeSymbol(effectiveChartSymbol);
    const timeframe = normalizeTimeframe(effectiveChartTimeframe);
    const provider = normalizeProvider(selectedProvider);

    if (!symbol || !timeframe) {
      return;
    }

    let isCancelled = false;

    void (async () => {
      try {
        const persistedLatest = await fetchLatestPersistedCandleDiagnostic({
          symbol,
          timeframe,
          provider,
        });

        if (isCancelled) return;

        const chartOpenTime = lastChartCandle?.open_time ?? null;
        const chartCloseTime = lastChartCandle?.close_time ?? null;
        const tickOpenTime = lastCandleTick?.open_time ?? null;
        const apiOpenTime = persistedLatest?.open_time ?? null;

        const diffChartVsTickMinutes = formatMinutesDiff(
          tickOpenTime,
          chartOpenTime,
        );
        const diffApiVsChartMinutes = formatMinutesDiff(
          apiOpenTime,
          chartOpenTime,
        );
        const diffApiVsTickMinutes = formatMinutesDiff(
          apiOpenTime,
          tickOpenTime,
        );

        console.groupCollapsed(
          `[TB][CANDLES_SYNC] ${symbol} / ${timeframe} | candles=${candles.length} | ws=${wsStatus}`,
        );

        console.log("selectedProvider:", provider || "backend-default");
        console.log("lastWsEvent:", lastWsEvent);
        console.log("lastProviderUpdateEvent:", lastProviderUpdateEvent);
        console.log("lastProviderUpdateStatus:", lastProviderUpdateStatus);
        console.log("lastProviderUpdateAt:", lastProviderUpdateAt);
        console.log("lastProviderReceivedAt:", lastProviderReceivedAt);
        console.log("candlesRefreshReason:", candlesRefreshReason || "-");

        console.table([
          {
            origem: "grafico",
            symbol,
            timeframe,
            open_time: formatIsoForConsole(chartOpenTime),
            close_time: formatIsoForConsole(chartCloseTime),
            provider: lastChartCandle?.provider ?? lastChartCandle?.source ?? "-",
            source: lastChartCandle?.source ?? "-",
            total_candles: candles.length,
          },
          {
            origem: "tick_ws",
            symbol,
            timeframe,
            open_time: formatIsoForConsole(tickOpenTime),
            close_time: "-",
            provider: lastCandleTick?.provider ?? lastCandleTick?.source ?? "-",
            source: lastCandleTick?.source ?? "-",
            total_candles: "-",
          },
          {
            origem: "api_latest",
            symbol,
            timeframe,
            open_time: formatIsoForConsole(apiOpenTime),
            close_time: formatIsoForConsole(persistedLatest?.close_time ?? null),
            provider: persistedLatest?.provider ?? "-",
            source: persistedLatest?.source ?? "-",
            total_candles: "-",
          },
        ]);

        console.table([
          {
            comparacao: "tick_vs_grafico_min",
            valor: diffChartVsTickMinutes,
          },
          {
            comparacao: "api_vs_grafico_min",
            valor: diffApiVsChartMinutes,
          },
          {
            comparacao: "api_vs_tick_min",
            valor: diffApiVsTickMinutes,
          },
        ]);

        console.log("coverageMeta:", coverageMeta);

        const chartOpenMs = timestampFromIso(chartOpenTime);
        const tickOpenMs = timestampFromIso(tickOpenTime);
        const apiOpenMs = timestampFromIso(apiOpenTime);

        if (
          chartOpenMs !== null &&
          tickOpenMs !== null &&
          tickOpenMs > chartOpenMs
        ) {
          console.warn("[TB][CANDLES_SYNC] O gráfico está atrasado face ao tick.", {
            chart_open_time: chartOpenTime,
            tick_open_time: tickOpenTime,
            diff_minutes: diffChartVsTickMinutes,
          });
        }

        if (
          chartOpenMs !== null &&
          apiOpenMs !== null &&
          apiOpenMs > chartOpenMs
        ) {
          console.warn(
            "[TB][CANDLES_SYNC] O gráfico está atrasado face ao último candle persistido na API.",
            {
              chart_open_time: chartOpenTime,
              api_open_time: apiOpenTime,
              diff_minutes: diffApiVsChartMinutes,
            },
          );
        }

        if (
          tickOpenMs !== null &&
          apiOpenMs !== null &&
          apiOpenMs < tickOpenMs
        ) {
          console.warn(
            "[TB][CANDLES_SYNC] O tick recebido ainda não coincide com o último candle persistido na API.",
            {
              tick_open_time: tickOpenTime,
              api_open_time: apiOpenTime,
              diff_minutes: diffApiVsTickMinutes,
              received_at: lastProviderReceivedAt,
            },
          );
        }

        console.groupEnd();
      } catch (error) {
        if (isCancelled) return;

        console.groupCollapsed(
          `[TB][CANDLES_SYNC] ${symbol} / ${timeframe} | erro`,
        );
        console.error(error);
        console.log("lastProviderUpdateLog:", lastProviderUpdateLog);
        console.groupEnd();
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [
    effectiveChartSymbol,
    effectiveChartTimeframe,
    selectedProvider,
    candles,
    lastChartCandle?.open_time,
    lastChartCandle?.close_time,
    lastChartCandle?.provider,
    lastChartCandle?.source,
    lastCandleTick?.open_time,
    lastCandleTick?.provider,
    lastCandleTick?.source,
    wsStatus,
    lastWsEvent,
    lastProviderUpdateEvent,
    lastProviderUpdateStatus,
    lastProviderUpdateAt,
    lastProviderReceivedAt,
    lastProviderUpdateLog,
    candlesRefreshReason,
    coverageMeta,
  ]);

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
                padding: "12px 16px 0 16px",
                display: "grid",
                gap: 8,
              }}
            >
              <NavLink href="/" label="Dashboard" active />
              <NavLink href="/stage-tests" label="Stage Tests" active={false} />
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
                  loadingProviders={loadingProviders}
                  providersError={providersError}
                  providers={providers}
                  selectedProvider={selectedProvider}
                  setSelectedProvider={setSelectedProvider}
                  backendSelectedProvider={backendSelectedProvider}
                  loadingMarketTypes={loadingMarketTypes}
                  loadingCatalogs={loadingCatalogs}
                  loadingSymbols={loadingSymbols}
                  loadingStrategies={loadingStrategies}
                  marketTypesError={marketTypesError}
                  catalogsError={catalogsError}
                  symbolsError={symbolsError}
                  strategiesError={strategiesError}
                  marketTypes={marketTypes}
                  selectedMarketType={selectedMarketType}
                  setSelectedMarketType={setSelectedMarketType}
                  availableCatalogs={availableCatalogs}
                  selectedCatalog={selectedCatalog}
                  setSelectedCatalog={setSelectedCatalog}
                  catalogSymbols={catalogSymbols}
                  selectedSymbol={selectedSymbol}
                  setSelectedSymbol={setSelectedSymbol}
                  selectedTimeframe={effectiveSelectedTimeframe}
                  setSelectedTimeframe={setSelectedTimeframe}
                  timeframeOptions={TIMEFRAME_OPTIONS}
                  selectedMarketTypeLabel={selectedMarketTypeLabel}
                  selectedCatalogLabel={selectedCatalogLabel}
                  selectedSymbolData={selectedSymbolData}
                />

                <ApiStatusCard
                  sidebarCardStyle={sidebarCardStyle}
                  loadingHealth={loadingHealth}
                  healthError={healthError}
                  health={health}
                  wsStatus={wsStatus}
                  lastWsEvent={lastWsEvent}
                  providerErrorMessage={providerErrorMessage || candlesErrorFromHttp}
                  hasLoadedInitialCandles={hasLoadedInitialCandles}
                  candles={candles}
                  lastProviderUpdateLog={lastProviderUpdateLog}
                  lastProviderUpdateAt={lastProviderUpdateAt}
                  lastProviderReceivedAt={lastProviderReceivedAt}
                  lastProviderUpdateEvent={lastProviderUpdateEvent}
                  lastProviderUpdateStatus={lastProviderUpdateStatus}
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
            <CandlesChartCard
              mainCardStyle={mainCardStyle}
              chartContainerRef={chartContainerRef}
              loadingCandles={loadingCandles}
              candlesError={candlesError}
              chartData={chartData}
              candles={candles}
              overlays={overlays}
              strategyHighlights={strategyHighlights}
              strategyHighlightMinScore={CHART_STRATEGY_HIGHLIGHT_MIN_SCORE}
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
              indicatorSettings={settings}
              showStrategyOverlays={showStrategyOverlays}
              onSetIndicatorEnabled={setIndicatorEnabled}
              onSetBollingerPeriod={setBollingerPeriod}
              onSetBollingerStdDev={setBollingerStdDev}
              activeIndicatorLabels={activeIndicatorLabels}
              feedDiagnostics={feedDiagnostics}
            />

            <RunHistoryCard
              sidebarCardStyle={mainCardStyle}
              runSearch={runSearch}
              setRunSearch={setRunSearch}
              loadingRuns={loadingRuns}
              runsError={runsError}
              actionError={actionError}
              filteredStageTests={filteredStageTests}
              selectedRunId={selectedRunId}
              onClearRuns={clearRuns}
              isClearingRuns={isClearingRuns}
              isCreatingRuns={isCreatingRuns}
              lastExecutionLog={lastExecutionLog}
              lastExecutionStatus={lastExecutionStatus}
              runningStrategyKey={runningStrategyKey}
              selectedSymbol={effectiveChartSymbol}
              selectedTimeframe={effectiveChartTimeframe}
              onRunStageTest={runStageTestByStrategy}
            />

            {showSelectedStrategyNotice && selectedStrategyNotice && (
              <div
                style={{
                  ...mainCardStyle,
                  paddingTop: 14,
                  paddingBottom: 14,
                  color: "#475569",
                  fontSize: 14,
                  lineHeight: 1.6,
                }}
              >
                <strong>Estratégia selecionada para o gráfico:</strong>{" "}
                {selectedStrategyNotice.name} ({selectedStrategyNotice.key})
                <br />
                <strong>Run selecionado:</strong>{" "}
                {runStrategyKey ? runStrategyKey : "sem strategy_key"}
                <br />
                <strong>Overlays desta estratégia:</strong>{" "}
                {selectedStrategyNotice.supportsOverlays
                  ? "suportados"
                  : "não suportados"}
                <br />
                {selectedStrategyNotice.supportsOverlays
                  ? "Os overlays estratégicos só aparecem quando a estratégia escolhida no storage coincide com a estratégia do run selecionado."
                  : "Esta estratégia continua referenciada apenas para visualização de overlays, mas o contrato devolvido pelo backend indica que não há overlays estratégicos para desenhar no gráfico."}
              </div>
            )}

            <RunSummaryCard
              mainCardStyle={mainCardStyle}
              selectedRunId={selectedRunId}
              loadingRunDetails={loadingRunDetails}
              runDetailsError={runDetailsError}
              runDetails={runDetails}
              wsStatus={wsStatus}
              lastWsEvent={lastWsEvent}
              heartbeatCount={heartbeatCount}
              heartbeatMessage={heartbeatMessage}
              candlesRefreshCount={candlesRefreshCount}
              candlesRefreshReason={candlesRefreshReason}
              lastCandleTick={lastCandleTick}
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

            <StrategiesCard
              mainCardStyle={mainCardStyle}
              sectionTitleStyle={sectionTitleStyle}
              strategies={strategies}
              loadingStrategies={loadingStrategies}
              strategiesError={strategiesError}
            />
          </div>
        </main>
      </div>
    </div>
  );
}

export default DashboardPage;
