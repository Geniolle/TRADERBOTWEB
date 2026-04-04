// web/src/components/chart/CandlesChartCard.tsx

import { useMemo, useState } from "react";
import type { CandlestickData, UTCTimestamp } from "lightweight-charts";
import type {
  CandleTickState,
  CatalogInstrument,
  OverlayLine,
  OverlayMarker,
} from "../../types/trading";
import { CHART_HEIGHT } from "../../constants/chart";
import IndicatorMenu from "./IndicatorMenu";
import ChartHeader from "./ChartHeader";
import ChartMarketInfo from "./ChartMarketInfo";
import ChartPriceScale from "./ChartPriceScale";
import ChartCurrentPriceLine from "./ChartCurrentPriceLine";
import ChartCountdownBadge from "./ChartCountdownBadge";
import ChartOverlays from "./ChartOverlays";
import ChartSummary from "./ChartSummary";
import ChartLegend from "./ChartLegend";
import ChartEmptyState from "./ChartEmptyState";
import ChartLoadingState from "./ChartLoadingState";
import ChartErrorState from "./ChartErrorState";
import type { IndicatorSettings } from "../../hooks/useIndicatorSettings";
import { buildPriceScaleData } from "./utils/chartScale";
import { useChartCountdown } from "./hooks/useChartCountdown";
import { getCurrentPrice } from "./hooks/useCurrentPrice";

type CandlesChartCardProps = {
  mainCardStyle: React.CSSProperties;
  chartContainerRef: React.RefObject<HTMLDivElement | null>;
  loadingCandles: boolean;
  candlesError: string;
  chartData: CandlestickData<UTCTimestamp>[];
  candles: Array<{ open_time: string; close?: string }>;
  overlays: {
    markers: OverlayMarker[];
    lines: OverlayLine[];
  };
  selectedMarketTypeLabel: string;
  selectedCatalogLabel: string;
  effectiveChartSymbol: string;
  effectiveChartTimeframe: string;
  selectedSymbolData: CatalogInstrument | null;
  wsStatus: string;
  lastWsEvent: string;
  heartbeatCount: number | null;
  heartbeatMessage: string;
  candlesRefreshCount: number | null;
  candlesRefreshReason: string;
  lastCandleTick: CandleTickState;
  legendCloseColor: string;
  indicatorSettings: IndicatorSettings;
  showStrategyOverlays: boolean;
  onSetIndicatorEnabled: (
    key: "ema9" | "ema21" | "bollinger",
    enabled: boolean
  ) => void;
  onSetBollingerPeriod: (value: number) => void;
  onSetBollingerStdDev: (value: number) => void;
  activeIndicatorLabels: string[];
};

function CandlesChartCard(props: CandlesChartCardProps) {
  const {
    mainCardStyle,
    chartContainerRef,
    loadingCandles,
    candlesError,
    chartData,
    candles,
    overlays,
    selectedMarketTypeLabel,
    selectedCatalogLabel,
    effectiveChartSymbol,
    effectiveChartTimeframe,
    legendCloseColor,
    indicatorSettings,
    showStrategyOverlays,
    onSetIndicatorEnabled,
    onSetBollingerPeriod,
    onSetBollingerStdDev,
    activeIndicatorLabels,
    lastCandleTick,
  } = props;

  const [isIndicatorMenuOpen, setIsIndicatorMenuOpen] = useState<boolean>(false);

  const marketLine = [
    selectedMarketTypeLabel || "-",
    selectedCatalogLabel || "-",
    effectiveChartSymbol || "-",
    effectiveChartTimeframe || "-",
  ].join(" / ");

  const countdownText = useChartCountdown(effectiveChartTimeframe);

  const currentPrice = useMemo(() => {
    return getCurrentPrice(candles, lastCandleTick);
  }, [candles, lastCandleTick]);

  const priceScaleData = useMemo(() => {
    return buildPriceScaleData(chartData, currentPrice, CHART_HEIGHT);
  }, [chartData, currentPrice]);

  const hasOverlayContent =
    overlays.lines.length > 0 || overlays.markers.length > 0;

  const showMarketInfo = !loadingCandles && !candlesError;
  const showPriceScale =
    !loadingCandles && !candlesError && priceScaleData.levels.length > 0;
  const showCurrentPriceLine =
    !loadingCandles &&
    !candlesError &&
    chartData.length > 0 &&
    currentPrice !== null &&
    priceScaleData.currentPriceTop !== null;
  const showCountdown =
    !loadingCandles && !candlesError && Boolean(effectiveChartTimeframe);
  const showEmptyState =
    !loadingCandles && !candlesError && chartData.length === 0;
  const showOverlays =
    !loadingCandles &&
    !candlesError &&
    chartData.length > 0 &&
    showStrategyOverlays &&
    hasOverlayContent;
  const showFooter =
    !loadingCandles && !candlesError && chartData.length > 0;

  return (
    <div style={mainCardStyle}>
      <ChartHeader title="Gráfico de candles" />

      {showMarketInfo && (
        <ChartMarketInfo
          marketLine={marketLine}
          activeIndicatorLabels={activeIndicatorLabels}
        />
      )}

      {loadingCandles && <ChartLoadingState />}

      {!loadingCandles && candlesError && (
        <ChartErrorState candlesError={candlesError} />
      )}

      <div style={{ width: "100%" }}>
        <div
          style={{
            position: "relative",
            width: "100%",
            height: CHART_HEIGHT,
            border: "1px solid #dbe2ea",
            borderRadius: 14,
            background: "#fff",
            overflow: "hidden",
          }}
        >
          <IndicatorMenu
            isOpen={isIndicatorMenuOpen}
            onToggleOpen={() => setIsIndicatorMenuOpen((previous) => !previous)}
            settings={indicatorSettings}
            onSetIndicatorEnabled={onSetIndicatorEnabled}
            onSetBollingerPeriod={onSetBollingerPeriod}
            onSetBollingerStdDev={onSetBollingerStdDev}
          />

          <div
            ref={chartContainerRef}
            style={{
              width: "100%",
              height: "100%",
            }}
          />

          {showPriceScale && <ChartPriceScale levels={priceScaleData.levels} />}

          {showCurrentPriceLine && (
            <ChartCurrentPriceLine
              top={priceScaleData.currentPriceTop as number}
              price={currentPrice as number}
            />
          )}

          {showCountdown && (
            <ChartCountdownBadge countdownText={countdownText} />
          )}

          {showEmptyState && <ChartEmptyState />}

          {showOverlays && <ChartOverlays overlays={overlays} />}
        </div>
      </div>

      {showFooter && (
        <>
          <ChartSummary candles={candles} />
          <ChartLegend legendCloseColor={legendCloseColor} />
        </>
      )}
    </div>
  );
}

export default CandlesChartCard;