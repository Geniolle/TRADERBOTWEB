// web/src/components/chart/CandlesChartCard.tsx

import type { CandlestickData, UTCTimestamp } from "lightweight-charts";
import type {
  CandleTickState,
  CatalogInstrument,
  OverlayLine,
  OverlayMarker,
} from "../../types/trading";
import { CHART_HEIGHT } from "../../constants/chart";
import { API_WS_BASE_URL, FORCE_REALTIME_TEST } from "../../constants/config";
import { formatDateTime } from "../../utils/format";

type CandlesChartCardProps = {
  mainCardStyle: React.CSSProperties;
  chartContainerRef: React.RefObject<HTMLDivElement | null>;
  loadingCandles: boolean;
  candlesError: string;
  chartData: CandlestickData<UTCTimestamp>[];
  candles: Array<{ open_time: string }>;
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
    wsStatus,
    lastWsEvent,
    heartbeatCount,
    heartbeatMessage,
    candlesRefreshCount,
    candlesRefreshReason,
    lastCandleTick,
    legendCloseColor,
  } = props;

  const marketLine = [
    selectedMarketTypeLabel || "-",
    selectedCatalogLabel || "-",
    effectiveChartSymbol || "-",
    effectiveChartTimeframe || "-",
  ].join(" / ");

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

          <div style={{ marginTop: 10 }}>
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
            <span style={{ margin: "0 2px" }}>•</span>
            <strong>Tick timeframe:</strong> {lastCandleTick?.timeframe ?? "-"}
          </div>
          <div>
            <strong>Tick OHLC:</strong>{" "}
            {lastCandleTick
              ? `${Number(lastCandleTick.open).toFixed(5)} / ${Number(
                  lastCandleTick.high
                ).toFixed(5)} / ${Number(lastCandleTick.low).toFixed(5)} / ${Number(
                  lastCandleTick.close
                ).toFixed(5)}`
              : "-"}
          </div>
          <div>
            <strong>Tick count:</strong> {lastCandleTick?.count ?? "-"}
          </div>

          {FORCE_REALTIME_TEST && (
            <div style={{ marginTop: 10 }}>
              <strong>Modo teste realtime:</strong> ativo
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
  );
}

export default CandlesChartCard;