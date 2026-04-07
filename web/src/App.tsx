// web/src/App.tsx

import { useEffect, useMemo, useState } from "react";

import ApiStatusCard from "./components/api/ApiStatusCard";
import SelectedCaseCard from "./components/cases/SelectedCaseCard";
import CandlesChartCard from "./components/chart/CandlesChartCard";
import ChartDiagnosticsCard from "./components/diagnostics/ChartDiagnosticsCard";
import MarketFiltersCard from "./components/market/MarketFiltersCard";
import RunCasesCard from "./components/runs/RunCasesCard";
import RunHistoryCard from "./components/runs/RunHistoryCard";
import RunMetricsCard from "./components/runs/RunMetricsCard";
import RunSummaryCard from "./components/runs/RunSummaryCard";
import StrategiesCard from "./components/strategies/StrategiesCard";
import {
  FORCED_REALTIME_SYMBOL,
  FORCED_REALTIME_TIMEFRAME,
  FORCE_REALTIME_TEST,
} from "./constants/config";
import useApiHealth from "./hooks/useApiHealth";
import useCandles from "./hooks/useCandles";
import useCandlestickChart from "./hooks/useCandlestickChart";
import useChartDerivedData from "./hooks/useChartDerivedData";
import useChartIndicators from "./hooks/useChartIndicators";
import useIndicatorSettings from "./hooks/useIndicatorSettings";
import useMarketCatalog from "./hooks/useMarketCatalog";
import useRealtimeFeed from "./hooks/useRealtimeFeed";
import useRunDetails from "./hooks/useRunDetails";
import useStageTests from "./hooks/useStageTests";
import useStrategies from "./hooks/useStrategies";

type TimeframeOption = {
  value: string;
  label: string;
};

const TIMEFRAME_STORAGE_KEY = "traderbot:selectedTimeframe";
const CHART_STRATEGY_STORAGE_KEY = "traderbot:selectedChartStrategyKey";

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

function App() {
  const { health, loadingHealth, healthError } = useApiHealth();

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

  const { strategies, loadingStrategies, strategiesError } = useStrategies();

  const {
    settings,
    setIndicatorEnabled,
    setBollingerPeriod,
    setBollingerStdDev,
  } = useIndicatorSettings();

  const [selectedTimeframe, setSelectedTimeframe] = useState<string>(() =>
    readStoredTimeframe()
  );

  const [storedChartStrategyKey] = useState<string>(() =>
    readStoredChartStrategyKey()
  );

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
      (item) => item.key === storedChartStrategyKey
    );

    return existsInSelectableList ? storedChartStrategyKey : "";
  }, [selectableStrategies, storedChartStrategyKey]);

  const selectedChartStrategy = useMemo(() => {
    return (
      selectableStrategies.find(
        (item) => item.key === effectiveSelectedChartStrategyKey
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
        effectiveSelectedTimeframe
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
  } = useRealtimeFeed({
    effectiveChartMarketType,
    effectiveChartCatalog,
    effectiveChartSymbol,
    effectiveChartTimeframe,
    setCandles,
    reloadCandles,
  });

  const {
    selectedRunId,
    setSelectedRunId,
    runSearch,
    setRunSearch,
    filteredStageTests,
    loadingRuns,
    runsError,
    actionError,
    isClearingRuns,
    isCreatingRuns,
    clearRuns,
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

  const { chartContainerRef, chartSize, chartData } = useCandlestickChart({
    candles,
    indicatorSeries,
  });

  const { feedDiagnostics, overlays, legendCloseColor } = useChartDerivedData({
    candles,
    coverageMeta,
    runDetails,
    selectedCaseId,
    chartSize,
    effectiveChartSymbol,
    effectiveChartTimeframe,
    lastCandleTick,
  });

  const runStrategyKey = runDetails?.run?.strategy_key ?? "";

  const selectedStrategySupportsOverlays = useMemo(() => {
    if (!selectedChartStrategy) return false;
    return selectedChartStrategy.supports_chart_overlays !== false;
  }, [selectedChartStrategy]);

  const showStrategyOverlays = useMemo(() => {
    if (!effectiveSelectedChartStrategyKey) return false;
    if (!runStrategyKey) return false;
    if (!selectedStrategySupportsOverlays) return false;

    return effectiveSelectedChartStrategyKey === runStrategyKey;
  }, [
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
    selectedStrategyNotice && !showStrategyOverlays
  );

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
                  providerErrorMessage={providerErrorMessage}
                  hasLoadedInitialCandles={hasLoadedInitialCandles}
                  candles={candles}
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
              setSelectedRunId={setSelectedRunId}
              onClearRuns={clearRuns}
              isClearingRuns={isClearingRuns}
              isCreatingRuns={isCreatingRuns}
              lastExecutionLog={lastExecutionLog}
              lastExecutionStatus={lastExecutionStatus}
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

export default App;