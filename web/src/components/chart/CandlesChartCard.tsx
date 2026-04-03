// web/src/components/chart/CandlesChartCard.tsx

import { useEffect, useMemo, useState } from "react";
import type { CandlestickData, UTCTimestamp } from "lightweight-charts";
import type {
  CandleTickState,
  CatalogInstrument,
  OverlayLine,
  OverlayMarker,
} from "../../types/trading";
import { CHART_HEIGHT } from "../../constants/chart";
import IndicatorMenu from "./IndicatorMenu";
import type { IndicatorSettings } from "../../hooks/useIndicatorSettings";

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
  onSetIndicatorEnabled: (
    key: "ema9" | "ema21" | "bollinger",
    enabled: boolean
  ) => void;
  onSetBollingerPeriod: (value: number) => void;
  onSetBollingerStdDev: (value: number) => void;
  activeIndicatorLabels: string[];
};

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function timeframeToMilliseconds(timeframe: string): number | null {
  const match = /^(\d+)([smhdw])$/i.exec(timeframe.trim());

  if (!match) return null;

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();

  if (!Number.isFinite(amount) || amount <= 0) return null;

  switch (unit) {
    case "s":
      return amount * 1000;
    case "m":
      return amount * 60 * 1000;
    case "h":
      return amount * 60 * 60 * 1000;
    case "d":
      return amount * 24 * 60 * 60 * 1000;
    case "w":
      return amount * 7 * 24 * 60 * 60 * 1000;
    default:
      return null;
  }
}

function getRemainingToNextCandle(
  timeframe: string,
  nowMs: number
): number | null {
  const intervalMs = timeframeToMilliseconds(timeframe);
  if (!intervalMs) return null;

  const remainder = nowMs % intervalMs;
  if (remainder === 0) return intervalMs;

  return intervalMs - remainder;
}

function formatRemainingTime(remainingMs: number | null): string {
  if (remainingMs === null) return "--m --s";

  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${pad2(hours)}h ${pad2(minutes)}m ${pad2(seconds)}s`;
  }

  return `${pad2(minutes)}m ${pad2(seconds)}s`;
}

function formatPrice(value: number): string {
  return value.toFixed(5);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
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
    onSetIndicatorEnabled,
    onSetBollingerPeriod,
    onSetBollingerStdDev,
    activeIndicatorLabels,
    lastCandleTick,
  } = props;

  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [isIndicatorMenuOpen, setIsIndicatorMenuOpen] = useState<boolean>(false);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const marketLine = [
    selectedMarketTypeLabel || "-",
    selectedCatalogLabel || "-",
    effectiveChartSymbol || "-",
    effectiveChartTimeframe || "-",
  ].join(" / ");

  const countdownText = useMemo(() => {
    const remainingMs = getRemainingToNextCandle(effectiveChartTimeframe, nowMs);
    return formatRemainingTime(remainingMs);
  }, [effectiveChartTimeframe, nowMs]);

  const lastClosePrice = useMemo(() => {
    const lastCandle = candles[candles.length - 1];
    if (!lastCandle) return null;

    const parsed = Number(lastCandle.close);
    return Number.isFinite(parsed) ? parsed : null;
  }, [candles]);

  const currentPrice = useMemo(() => {
    if (lastCandleTick && Number.isFinite(lastCandleTick.close)) {
      return lastCandleTick.close;
    }

    return lastClosePrice;
  }, [lastCandleTick, lastClosePrice]);

  const priceScaleData = useMemo(() => {
    if (chartData.length === 0) {
      return {
        levels: [] as Array<{ value: number; top: number }>,
        currentPriceTop: null as number | null,
      };
    }

    const minPrice = Math.min(...chartData.map((item) => item.low));
    const maxPrice = Math.max(...chartData.map((item) => item.high));

    const range = Math.max(maxPrice - minPrice, 0.00001);
    const padding = range * 0.08;
    const visualMin = minPrice - padding;
    const visualMax = maxPrice + padding;
    const visualRange = Math.max(visualMax - visualMin, 0.00001);

    const topPadding = 10;
    const bottomPadding = 10;
    const usableHeight = CHART_HEIGHT - topPadding - bottomPadding;
    const totalSteps = 12;

    const levels = Array.from({ length: totalSteps + 1 }, (_, index) => {
      const ratio = index / totalSteps;
      const value = visualMax - visualRange * ratio;
      const top = topPadding + usableHeight * ratio;

      return { value, top };
    });

    let currentPriceTop: number | null = null;

    if (currentPrice !== null && Number.isFinite(currentPrice)) {
      const ratio = (visualMax - currentPrice) / visualRange;
      currentPriceTop = topPadding + usableHeight * clamp(ratio, 0, 1);
    }

    return {
      levels,
      currentPriceTop,
    };
  }, [chartData, currentPrice]);

  return (
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
            <strong>Mercado:</strong> {marketLine}
          </div>

          {activeIndicatorLabels.length > 0 && (
            <div>
              <strong>Indicadores:</strong> {activeIndicatorLabels.join(" • ")}
            </div>
          )}
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

          {!loadingCandles &&
            !candlesError &&
            priceScaleData.levels.length > 0 && (
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  right: 0,
                  width: 74,
                  height: "100%",
                  pointerEvents: "none",
                  zIndex: 3,
                  background:
                    "linear-gradient(to left, rgba(255,255,255,0.98), rgba(255,255,255,0.88), rgba(255,255,255,0))",
                }}
              >
                {priceScaleData.levels.map((item, index) => (
                  <div
                    key={`${index}-${item.value.toFixed(5)}`}
                    style={{
                      position: "absolute",
                      right: 8,
                      top: item.top,
                      transform: "translateY(-50%)",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#334155",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {formatPrice(item.value)}
                  </div>
                ))}
              </div>
            )}

          {!loadingCandles &&
            !candlesError &&
            chartData.length > 0 &&
            currentPrice !== null &&
            priceScaleData.currentPriceTop !== null && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  pointerEvents: "none",
                  zIndex: 6,
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: priceScaleData.currentPriceTop,
                    transform: "translateY(-50%)",
                  }}
                >
                  <div
                    style={{
                      borderTop: "1px dashed #16a34a",
                      width: "100%",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      right: 8,
                      top: -12,
                      background: "#16a34a",
                      color: "#ffffff",
                      padding: "3px 8px",
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 800,
                      whiteSpace: "nowrap",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.18)",
                    }}
                  >
                    {formatPrice(currentPrice)}
                  </div>
                </div>
              </div>
            )}

          {!loadingCandles && !candlesError && effectiveChartTimeframe && (
            <div
              style={{
                position: "absolute",
                right: 12,
                bottom: 12,
                zIndex: 7,
                background: "rgba(15, 23, 42, 0.88)",
                color: "#ffffff",
                padding: "6px 10px",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: 0.2,
                pointerEvents: "none",
                boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                whiteSpace: "nowrap",
              }}
            >
              {countdownText}
            </div>
          )}

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
                zIndex: 4,
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
                      right: 84,
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
                    {line.label} {Number(line.value).toFixed(5)}
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
                  title={`${marker.label} | ${Number(marker.price).toFixed(
                    5
                  )} | ${marker.timeLabel}`}
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
              <strong>Último candle:</strong>{" "}
              {candles[candles.length - 1].open_time}
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
  );
}

export default CandlesChartCard;