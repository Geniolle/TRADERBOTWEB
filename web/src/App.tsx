// src/App.tsx

import { useMemo, useState } from "react";

import ApiStatusCard from "./components/api/ApiStatusCard";
import SelectedCaseCard from "./components/cases/SelectedCaseCard";
import CandlesChartCard from "./components/chart/CandlesChartCard";
import ChartDiagnosticsCard from "./components/diagnostics/ChartDiagnosticsCard";
import MarketFiltersCard from "./components/market/MarketFiltersCard";
import RunHistoryCard from "./components/runs/RunHistoryCard";
import RunCasesCard from "./components/runs/RunCasesCard";
import RunMetricsCard from "./components/runs/RunMetricsCard";
import RunSummaryCard from "./components/runs/RunSummaryCard";
import StrategiesCard from "./components/strategies/StrategiesCard";
import {
  FORCED_REALTIME_SYMBOL,
  FORCED_REALTIME_TIMEFRAME,
  FORCE_REALTIME_TEST,
} from "./constants/config";
import useApiHealth from "./hooks/useApiHealth";
import useCandlestickChart from "./hooks/useCandlestickChart";
import useChartDerivedData from "./hooks/useChartDerivedData";
import useMarketCatalog from "./hooks/useMarketCatalog";
import useRealtimeFeed from "./hooks/useRealtimeFeed";
import useRunDetails from "./hooks/useRunDetails";
import useRunHistory from "./hooks/useRunHistory";
import useStrategies from "./hooks/useStrategies";
import type { CandleItem } from "./types/trading";

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

  const { strategies, loadingStrategies, strategiesError } = useStrategies();

  const [realtimeCandles, setRealtimeCandles] = useState<CandleItem[]>([]);

  const isMarketSelectionComplete = useMemo(() => {
    return Boolean(selectedMarketType && selectedCatalog && selectedSymbol);
  }, [selectedMarketType, selectedCatalog, selectedSymbol]);

  const effectiveChartSymbol = useMemo(() => {
    if (FORCE_REALTIME_TEST) return FORCED_REALTIME_SYMBOL;
    if (isMarketSelectionComplete) return selectedSymbol;
    return "";
  }, [isMarketSelectionComplete, selectedSymbol]);

  const effectiveChartTimeframe = useMemo(() => {
    if (FORCE_REALTIME_TEST) return FORCED_REALTIME_TIMEFRAME;
    if (isMarketSelectionComplete) return "5m";
    return "";
  }, [isMarketSelectionComplete]);

  const candles = useMemo(() => {
    if (!effectiveChartSymbol || !effectiveChartTimeframe) {
      return [];
    }

    return realtimeCandles.filter(
      (item) =>
        item.symbol === effectiveChartSymbol &&
        item.timeframe === effectiveChartTimeframe
    );
  }, [realtimeCandles, effectiveChartSymbol, effectiveChartTimeframe]);

  const loadingCandles = false;
  const candlesError = "";

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
    setCandles: setRealtimeCandles,
    reloadCandles: async () => {},
  });

  const { chartContainerRef, chartSize, chartData } = useCandlestickChart({
    candles,
  });

  const { feedDiagnostics, overlays, legendCloseColor } = useChartDerivedData({
    candles,
    runDetails,
    selectedCaseId,
    chartSize,
    effectiveChartSymbol,
    effectiveChartTimeframe,
    lastCandleTick,
  });

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