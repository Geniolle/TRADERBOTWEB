// web/src/components/chart/CandlesChartCard.tsx

import { useMemo, useState } from "react";
import type { CSSProperties, RefObject } from "react";
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
import ChartStrategyHighlights from "./ChartStrategyHighlights";
import type { IndicatorSettings } from "../../hooks/useIndicatorSettings";
import { buildPriceScaleData } from "./utils/chartScale";
import { useChartCountdown } from "./hooks/useChartCountdown";
import { getCurrentPrice } from "./hooks/useCurrentPrice";

type CandlesChartCardProps = {
  mainCardStyle: CSSProperties;
  chartContainerRef: RefObject<HTMLDivElement | null>;
  loadingCandles: boolean;
  candlesError: string;
  chartData: CandlestickData<UTCTimestamp>[];
  candles: CandleItem[];
  overlays: {
    markers: OverlayMarker[];
    lines: OverlayLine[];
  };
  strategyHighlights: Array<{
    id: string;
    label: string;
    score: number;
  }>;
  strategyHighlightMinScore: number;
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

function parseDateValue(value: string | null | undefined): number | null {
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

function normalizeTimeframe(value: string): string {
  return String(value ?? "").trim().toLowerCase();
}

function timeframeToMinutes(timeframe: string): number {
  const normalized = normalizeTimeframe(timeframe);

  if (normalized === "1m") return 1;
  if (normalized === "3m") return 3;
  if (normalized === "5m") return 5;
  if (normalized === "15m") return 15;
  if (normalized === "30m") return 30;
  if (normalized === "1h") return 60;
  if (normalized === "4h") return 240;
  if (normalized === "1d") return 1440;

  return 5;
}

function buildCoverageStatus(params: {
  candles: CandleItem[];
  feedDiagnostics: FeedDiagnostics;
  lastCandleTick: CandleTickState;
  wsStatus: string;
}): CoverageStatus {
  const { candles, feedDiagnostics, lastCandleTick, wsStatus } = params;

  const count = candles.length;
  const timeframeMinutes = timeframeToMinutes(feedDiagnostics.timeframe || "5m");
  const now = Date.now();

  const firstCandleOpenMs =
    parseDateValue(candles[0]?.open_time) ??
    parseDateValue(feedDiagnostics.coverageFirstOpenUtc);

  const lastCandleOpenMs =
    parseDateValue(candles[candles.length - 1]?.open_time) ??
    parseDateValue(feedDiagnostics.lastCandleUtc) ??
    parseDateValue(feedDiagnostics.coverageLastCloseUtc);

  const lastTickOpenMs = parseDateValue(lastCandleTick?.open_time);
  const effectiveLastDataMs = lastTickOpenMs ?? lastCandleOpenMs;

  const staleThresholdWarningMs = Math.max(
    timeframeMinutes * 3 * 60 * 1000,
    45 * 60 * 1000
  );
  const staleThresholdDangerMs = Math.max(
    timeframeMinutes * 10 * 60 * 1000,
    3 * 60 * 60 * 1000
  );

  const dataAgeMs =
    effectiveLastDataMs !== null ? Math.max(now - effectiveLastDataMs, 0) : null;

  const hasEnoughCandlesForChart = count >= 30;
  const hasMinimumCandles = count >= 10;
  const hasVeryFewCandles = count > 0 && count < 10;
  const hasNoCandles = count === 0;

  if (hasNoCandles) {
    return {
      level: "danger",
      title: "Cobertura insuficiente",
      message:
        "A base local não devolveu candles suficientes para esta seleção.",
      background: "#fef2f2",
      border: "#fca5a5",
      color: "#991b1b",
    };
  }

  if (hasVeryFewCandles) {
    return {
      level: "danger",
      title: "Cobertura muito curta",
      message: `Foram carregados apenas ${count} candles. Isso é pouco para leitura confiável do gráfico.`,
      background: "#fef2f2",
      border: "#fca5a5",
      color: "#991b1b",
    };
  }

  if (
    dataAgeMs !== null &&
    dataAgeMs > staleThresholdDangerMs &&
    wsStatus !== "subscribed"
  ) {
    return {
      level: "warning",
      title: "Cobertura antiga",
      message:
        "Os candles existem e o gráfico está utilizável, mas a ponta recente parece desatualizada.",
      background: "#fffbeb",
      border: "#fcd34d",
      color: "#92400e",
    };
  }

  if (
    dataAgeMs !== null &&
    dataAgeMs > staleThresholdWarningMs &&
    hasMinimumCandles
  ) {
    return {
      level: "warning",
      title: "Cobertura aceitável com atenção",
      message:
        "Há candles suficientes para leitura, mas a atualização recente merece atenção.",
      background: "#fffbeb",
      border: "#fcd34d",
      color: "#92400e",
    };
  }

  if (!firstCandleOpenMs || !effectiveLastDataMs) {
    return {
      level: "warning",
      title: "Cobertura sem metadata completa",
      message:
        "Os candles foram carregados, mas parte do metadata de cobertura não veio completa. O gráfico continua utilizável.",
      background: "#fffbeb",
      border: "#fcd34d",
      color: "#92400e",
    };
  }

  if (hasEnoughCandlesForChart) {
    return {
      level: "good",
      title: "Cobertura saudável",
      message: "A cobertura local parece suficiente para esta seleção.",
      background: "#ecfdf5",
      border: "#86efac",
      color: "#166534",
    };
  }

  return {
    level: "warning",
    title: "Cobertura moderada",
    message: `Foram carregados ${count} candles. O gráfico está utilizável, mas com histórico reduzido.`,
    background: "#fffbeb",
    border: "#fcd34d",
    color: "#92400e",
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
    chartData,
    candles,
    overlays,
    strategyHighlights,
    strategyHighlightMinScore,
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
    wsStatus,
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
    return buildCoverageStatus({
      candles,
      feedDiagnostics,
      lastCandleTick,
      wsStatus,
    });
  }, [candles, feedDiagnostics, lastCandleTick, wsStatus]);

  const headerTone = useMemo(() => {
    return getHeaderToneByCoverage(coverageStatus);
  }, [coverageStatus]);

  const hasOverlayContent =
    overlays.lines.length > 0 || overlays.markers.length > 0;

  const hasChartSnapshot = chartData.length > 0;

  const showMarketInfo = !loadingCandles;
  const showPriceScale = !loadingCandles && priceScaleData.levels.length > 0;
  const showCurrentPriceLine =
    !loadingCandles &&
    hasChartSnapshot &&
    currentPrice !== null &&
    priceScaleData.currentPriceTop !== null;
  const showCountdown = !loadingCandles && Boolean(effectiveChartTimeframe);
  const showEmptyState = !loadingCandles && !hasChartSnapshot;
  const showOverlays =
    !loadingCandles &&
    hasChartSnapshot &&
    showStrategyOverlays &&
    hasOverlayContent;
  const showFooter = !loadingCandles && hasChartSnapshot;
  const showStrategyHighlights =
    !loadingCandles && hasChartSnapshot && strategyHighlights.length > 0;

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

                  {showStrategyHighlights && (
                    <ChartStrategyHighlights
                      items={strategyHighlights}
                      minScore={strategyHighlightMinScore}
                    />
                  )}

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