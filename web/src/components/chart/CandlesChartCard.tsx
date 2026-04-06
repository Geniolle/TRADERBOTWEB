// web/src/components/chart/CandlesChartCard.tsx

import { useMemo, useState } from "react";
import type { CandlestickData, UTCTimestamp } from "lightweight-charts";
import type {
  CandleItem,
  CandleTickState,
  CatalogInstrument,
  FeedDiagnostics,
  OverlayLine,
  OverlayMarker,
} from "../../types/trading";
import { CHART_HEIGHT } from "../../constants/chart";
import IndicatorMenu from "./IndicatorMenu";
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
  candles: CandleItem[];
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
  feedDiagnostics: FeedDiagnostics;
};

type CoverageStatus = {
  level: "good" | "warning" | "danger";
  title: string;
  message: string;
  background: string;
  border: string;
  color: string;
};

function parseDateValue(value: string): number | null {
  if (!value || value === "-") return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function formatHeaderPrice(value: number | null): string {
  if (value === null) return "-";
  return value.toLocaleString("pt-PT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
}

function getCoverageStatus(feedDiagnostics: FeedDiagnostics): CoverageStatus {
  const now = Date.now();
  const lastCloseMs = parseDateValue(feedDiagnostics.coverageLastCloseUtc);
  const startMs = parseDateValue(feedDiagnostics.coverageStartUtc);
  const endMs = parseDateValue(feedDiagnostics.coverageEndUtc);
  const count = Number(feedDiagnostics.coverageCount || 0);
  const mode = feedDiagnostics.coverageMode;

  if (!count || !lastCloseMs || !startMs || !endMs) {
    return {
      level: "danger",
      title: "Cobertura insuficiente",
      message: "A base local não devolveu candles suficientes para esta seleção.",
      background: "#fef2f2",
      border: "#fca5a5",
      color: "#991b1b",
    };
  }

  const ageMinutes = (now - lastCloseMs) / 60000;
  const requestedWindowMinutes = Math.max((endMs - startMs) / 60000, 1);
  const averageSpacingMinutes = requestedWindowMinutes / Math.max(count, 1);

  const isClearlyStale = ageMinutes > Math.max(averageSpacingMinutes * 6, 180);
  const isSlightlyStale = ageMinutes > Math.max(averageSpacingMinutes * 3, 45);
  const isCoverageThin =
    (mode === "full" && count < 30) || (mode === "incremental" && count < 5);

  if (isClearlyStale || isCoverageThin) {
    return {
      level: "danger",
      title: "Cobertura crítica",
      message: "A cobertura local está curta ou antiga demais para confiar na ponta recente.",
      background: "#fef2f2",
      border: "#fca5a5",
      color: "#991b1b",
    };
  }

  if (isSlightlyStale) {
    return {
      level: "warning",
      title: "Cobertura aceitável com atenção",
      message: "A base local ainda está utilizável, mas a ponta parece um pouco antiga.",
      background: "#fffbeb",
      border: "#fcd34d",
      color: "#92400e",
    };
  }

  return {
    level: "good",
    title: "Cobertura saudável",
    message: "A cobertura local parece consistente com a janela pedida.",
    background: "#ecfdf5",
    border: "#86efac",
    color: "#166534",
  };
}

function getHeaderToneByCoverage(
  coverageStatus: CoverageStatus
): {
  background: string;
  borderBottom: string;
  titleColor: string;
  subtitleColor: string;
  badgeBackground: string;
  badgeColor: string;
  badgeBorder: string;
} {
  if (coverageStatus.level === "danger") {
    return {
      background: "linear-gradient(90deg, #fee2e2 0%, #fff7ed 100%)",
      borderBottom: "#fdba74",
      titleColor: "#7f1d1d",
      subtitleColor: "#9a3412",
      badgeBackground: "#ffffff",
      badgeColor: "#9a3412",
      badgeBorder: "#fdba74",
    };
  }

  if (coverageStatus.level === "warning") {
    return {
      background: "linear-gradient(90deg, #fef3c7 0%, #fffbeb 100%)",
      borderBottom: "#fcd34d",
      titleColor: "#78350f",
      subtitleColor: "#92400e",
      badgeBackground: "#ffffff",
      badgeColor: "#92400e",
      badgeBorder: "#fcd34d",
    };
  }

  return {
    background: "linear-gradient(90deg, #dcfce7 0%, #f0fdf4 100%)",
    borderBottom: "#86efac",
    titleColor: "#14532d",
    subtitleColor: "#166534",
    badgeBackground: "#ffffff",
    badgeColor: "#166534",
    badgeBorder: "#86efac",
  };
}

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
    feedDiagnostics,
  } = props;

  const [isIndicatorMenuOpen, setIsIndicatorMenuOpen] = useState<boolean>(false);
  const [isChartExpanded, setIsChartExpanded] = useState<boolean>(true);

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

  const coverageStatus = useMemo(() => {
    return getCoverageStatus(feedDiagnostics);
  }, [feedDiagnostics]);

  const headerTone = useMemo(() => {
    return getHeaderToneByCoverage(coverageStatus);
  }, [coverageStatus]);

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
    <section style={mainCardStyle}>
      <div style={{ display: "grid", gap: 12 }}>
        <section
          style={{
            border: "1px solid #dbe2ea",
            borderRadius: 16,
            background: "#ffffff",
            overflow: "hidden",
          }}
        >
          <button
            type="button"
            onClick={() => setIsChartExpanded((previous) => !previous)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "14px 16px",
              background: headerTone.background,
              border: "none",
              borderBottom: isChartExpanded
                ? `1px solid ${headerTone.borderBottom}`
                : "none",
              cursor: "pointer",
              textAlign: "left",
            }}
            aria-expanded={isChartExpanded}
            aria-label={isChartExpanded ? "Retrair gráfico" : "Expandir gráfico"}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <strong style={{ fontSize: 16, color: headerTone.titleColor }}>
                  Gráfico de candles
                </strong>

                <span
                  style={{
                    padding: "4px 10px",
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 700,
                    background: headerTone.badgeBackground,
                    color: headerTone.badgeColor,
                    border: `1px solid ${headerTone.badgeBorder}`,
                  }}
                >
                  {effectiveChartSymbol || "-"}
                </span>

                <span
                  style={{
                    padding: "4px 10px",
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 700,
                    background: headerTone.badgeBackground,
                    color: headerTone.badgeColor,
                    border: `1px solid ${headerTone.badgeBorder}`,
                  }}
                >
                  Preço atual: {formatHeaderPrice(currentPrice)}
                </span>
              </div>

              <span style={{ fontSize: 12, color: headerTone.subtitleColor }}>
                {marketLine}
              </span>
            </div>

            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: 34,
                width: 34,
                height: 34,
                borderRadius: 999,
                border: `1px solid ${headerTone.badgeBorder}`,
                background: "#ffffff",
                color: headerTone.badgeColor,
                fontSize: 16,
                fontWeight: 700,
                lineHeight: 1,
              }}
            >
              {isChartExpanded ? "−" : "+"}
            </span>
          </button>

          {isChartExpanded && (
            <div style={{ padding: 16 }}>
              <div
                style={{
                  marginBottom: 14,
                  padding: 12,
                  borderRadius: 12,
                  background: coverageStatus.background,
                  border: `1px solid ${coverageStatus.border}`,
                  color: coverageStatus.color,
                  fontSize: 13,
                  lineHeight: 1.6,
                }}
              >
                <strong>{coverageStatus.title}</strong>
                <div>{coverageStatus.message}</div>
              </div>

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
                    onToggleOpen={() =>
                      setIsIndicatorMenuOpen((previous) => !previous)
                    }
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

                  {showPriceScale && (
                    <ChartPriceScale levels={priceScaleData.levels} />
                  )}

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
                <ChartLegend
                  legendCloseColor={legendCloseColor}
                  showStrategyOverlays={showStrategyOverlays}
                />
              )}
            </div>
          )}
        </section>

        {showFooter && <ChartSummary candles={candles} />}
      </div>
    </section>
  );
}

export default CandlesChartCard;