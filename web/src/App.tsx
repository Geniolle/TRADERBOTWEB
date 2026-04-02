// src/App.tsx

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  type IChartApi,
  type ISeriesApi,
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
  FORCED_REALTIME_SYMBOL,
  FORCED_REALTIME_TIMEFRAME,
  FORCE_REALTIME_TEST,
} from "./constants/config";
import useApiHealth from "./hooks/useApiHealth";
import useCandles from "./hooks/useCandles";
import useMarketCatalog from "./hooks/useMarketCatalog";
import useRealtimeFeed from "./hooks/useRealtimeFeed";
import useRunDetails from "./hooks/useRunDetails";
import useRunHistory from "./hooks/useRunHistory";
import type { ChartCandleMeta, FeedDiagnostics, StrategyItem, OverlayLine, OverlayMarker } from "./types/trading";
import { applyStableVisibleRange, getCaseAccentColor, toUtcTimestamp } from "./utils/chart";
import { buildFallbackStartAt, buildRealtimeTestStartAt } from "./utils/candles";
import {
  formatBooleanLike,
  formatDateTime,
  formatMaybeNumber,
  formatUtcDateTime,
  parsePrice,
} from "./utils/format";

function App() {
  const { health, loadingHealth, healthError } = useApiHealth();

  const {
    selectedRunId,
    setSelectedRunId,
    runSearch,
    setRunSearch,
    filteredRuns,
    loadingRuns,
    runsError,
  } = useRunHistory();

  const {
    runDetails,
    selectedCaseId,
    setSelectedCaseId,
    loadingRunDetails,
    runDetailsError,
  } = useRunDetails(selectedRunId);

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
  } = useMarketCatalog();

  const [strategies, setStrategies] = useState<StrategyItem[]>([]);
  const [loadingStrategies, setLoadingStrategies] = useState(true);
  const [strategiesError, setStrategiesError] = useState("");

  const [chartSize, setChartSize] = useState({ width: 0, height: CHART_HEIGHT });

  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadStrategies = async () => {
      try {
        setLoadingStrategies(true);
        setStrategiesError("");

        const response = await fetch(`${API_HTTP_BASE_URL}/strategies`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data: StrategyItem[] = await response.json();

        if (!cancelled) {
          setStrategies(data);
        }
      } catch (err) {
        if (!cancelled) {
          setStrategiesError(
            err instanceof Error ? err.message : "Erro desconhecido ao carregar estratégias"
          );
          setStrategies([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingStrategies(false);
        }
      }
    };

    void loadStrategies();

    return () => {
      cancelled = true;
    };
  }, []);

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

  const {
    candles,
    setCandles,
    loadingCandles,
    candlesError,
    reloadCandles,
  } = useCandles({
    symbol: effectiveChartSymbol,
    timeframe: effectiveChartTimeframe,
    startAt: effectiveChartStartAt,
    endAt: effectiveChartEndAt,
  });

  const {
    wsStatus,
    lastWsEvent,
    heartbeatCount,
    heartbeatMessage,
    candlesRefreshCount,
    candlesRefreshReason,
    lastCandleTick,
  } = useRealtimeFeed({
    effectiveChartSymbol,
    effectiveChartTimeframe,
    setCandles,
    reloadCandles,
  });

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

  const chartData = useMemo(() => {
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