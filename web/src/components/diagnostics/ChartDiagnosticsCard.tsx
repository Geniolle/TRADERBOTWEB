// src/components/diagnostics/ChartDiagnosticsCard.tsx

import type { FeedDiagnostics } from "../../types/trading";

type ChartDiagnosticsCardProps = {
  mainCardStyle: React.CSSProperties;
  sectionTitleStyle: React.CSSProperties;
  debugGridStyle: React.CSSProperties;
  debugItemStyle: React.CSSProperties;
  feedDiagnostics: FeedDiagnostics;
};

function ChartDiagnosticsCard({
  mainCardStyle,
  sectionTitleStyle,
  debugGridStyle,
  debugItemStyle,
  feedDiagnostics,
}: ChartDiagnosticsCardProps) {
  return (
    <div style={mainCardStyle}>
      <h2 style={sectionTitleStyle}>Diagnóstico técnico do feed</h2>

      <div
        style={{
          marginBottom: 14,
          fontSize: 14,
          color: "#475569",
          lineHeight: 1.6,
        }}
      >
        Este painel existe para validar se o preço divergente vem de provider,
        sessão, timezone, delayed feed ou mock feed.
      </div>

      <div style={debugGridStyle}>
        <div style={debugItemStyle}>
          <div>
            <strong>Symbol:</strong> {feedDiagnostics.symbol}
          </div>
          <div>
            <strong>Timeframe:</strong> {feedDiagnostics.timeframe}
          </div>
          <div>
            <strong>Total candles:</strong> {feedDiagnostics.totalCandles}
          </div>
          <div>
            <strong>Último close:</strong> {feedDiagnostics.lastClose}
          </div>
          <div>
            <strong>Range OHLC:</strong> {feedDiagnostics.priceRange}
          </div>
        </div>

        <div style={debugItemStyle}>
          <div>
            <strong>Primeiro candle UTC:</strong> {feedDiagnostics.firstCandleUtc}
          </div>
          <div>
            <strong>Primeiro candle local:</strong> {feedDiagnostics.firstCandleLocal}
          </div>
          <div>
            <strong>Último candle UTC:</strong> {feedDiagnostics.lastCandleUtc}
          </div>
          <div>
            <strong>Último candle local:</strong> {feedDiagnostics.lastCandleLocal}
          </div>
          <div>
            <strong>Timezone runtime:</strong> {feedDiagnostics.runtimeTimezone}
          </div>
        </div>

        <div style={debugItemStyle}>
          <div>
            <strong>Candle source:</strong> {feedDiagnostics.candleSource}
          </div>
          <div>
            <strong>Candle provider:</strong> {feedDiagnostics.candleProvider}
          </div>
          <div>
            <strong>Candle session:</strong> {feedDiagnostics.candleSession}
          </div>
          <div>
            <strong>Candle timezone:</strong> {feedDiagnostics.candleTimezone}
          </div>
          <div>
            <strong>Candle delayed:</strong> {feedDiagnostics.candleIsDelayed}
          </div>
          <div>
            <strong>Candle mock:</strong> {feedDiagnostics.candleIsMock}
          </div>
        </div>

        <div style={debugItemStyle}>
          <div>
            <strong>Último tick UTC:</strong> {feedDiagnostics.lastTickUtc}
          </div>
          <div>
            <strong>Último tick local:</strong> {feedDiagnostics.lastTickLocal}
          </div>
          <div>
            <strong>Tick source:</strong> {feedDiagnostics.tickSource}
          </div>
          <div>
            <strong>Tick provider:</strong> {feedDiagnostics.tickProvider}
          </div>
          <div>
            <strong>Tick session:</strong> {feedDiagnostics.tickSession}
          </div>
          <div>
            <strong>Tick timezone:</strong> {feedDiagnostics.tickTimezone}
          </div>
          <div>
            <strong>Tick delayed:</strong> {feedDiagnostics.tickIsDelayed}
          </div>
          <div>
            <strong>Tick mock:</strong> {feedDiagnostics.tickIsMock}
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 14,
          padding: 12,
          borderRadius: 12,
          background: "#fff7ed",
          border: "1px solid #fdba74",
          color: "#9a3412",
          fontSize: 13,
          lineHeight: 1.6,
        }}
      >
        Se <strong>provider</strong>, <strong>session</strong>,{" "}
        <strong>timezone</strong>, <strong>delayed</strong> ou <strong>mock</strong>{" "}
        vierem como “-”, então o backend ainda não está a enviar essa informação.
        Nesse caso, o próximo ajuste tem de ser no endpoint <strong>/candles</strong>{" "}
        e no evento websocket <strong>candle_tick</strong>.
      </div>
    </div>
  );
}

export default ChartDiagnosticsCard;