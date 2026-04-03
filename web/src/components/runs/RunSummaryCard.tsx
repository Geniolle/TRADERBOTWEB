// web/src/components/runs/RunSummaryCard.tsx

import { API_WS_BASE_URL } from "../../constants/config";
import type { CandleTickState, RunDetailsResponse } from "../../types/trading";
import { formatDateTime } from "../../utils/format";

type RunSummaryCardProps = {
  mainCardStyle: React.CSSProperties;
  selectedRunId: string;
  loadingRunDetails: boolean;
  runDetailsError: string;
  runDetails: RunDetailsResponse | null;
  wsStatus: string;
  lastWsEvent: string;
  heartbeatCount: number | null;
  heartbeatMessage: string;
  candlesRefreshCount: number | null;
  candlesRefreshReason: string;
  lastCandleTick: CandleTickState;
};

function RunSummaryCard({
  mainCardStyle,
  selectedRunId,
  loadingRunDetails,
  runDetailsError,
  runDetails,
  wsStatus,
  lastWsEvent,
  heartbeatCount,
  heartbeatMessage,
  candlesRefreshCount,
  candlesRefreshReason,
  lastCandleTick,
}: RunSummaryCardProps) {
  return (
    <div style={mainCardStyle}>
      <h2
        style={{
          marginTop: 0,
          marginBottom: 20,
          textAlign: "center",
          fontSize: 24,
          fontWeight: 700,
          color: "#0f172a",
        }}
      >
        Análise do run selecionado
      </h2>

      {!selectedRunId && <p>Nenhum run selecionado.</p>}

      {selectedRunId && loadingRunDetails && <p>A carregar detalhes do run...</p>}

      {selectedRunId && !loadingRunDetails && runDetailsError && (
        <div>
          <p style={{ color: "#dc2626", fontWeight: "bold" }}>
            Erro ao carregar detalhes do run
          </p>
          <p>{runDetailsError}</p>
        </div>
      )}

      {selectedRunId && !loadingRunDetails && !runDetailsError && runDetails && (
        <div style={{ display: "grid", gap: 20 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 14,
              fontSize: 15,
              color: "#334155",
            }}
          >
            <div>
              <strong>ID:</strong> {runDetails.run.id}
            </div>
            <div>
              <strong>Strategy:</strong>{" "}
              {runDetails.run.strategy_key ?? "(sem strategy_key)"}
            </div>
            <div>
              <strong>Symbol:</strong> {runDetails.run.symbol}
            </div>
            <div>
              <strong>Timeframe:</strong> {runDetails.run.timeframe}
            </div>
            <div>
              <strong>Status:</strong> {runDetails.run.status}
            </div>
            <div>
              <strong>Mode:</strong> {runDetails.run.mode}
            </div>
            <div>
              <strong>Start:</strong> {formatDateTime(runDetails.run.start_at)}
            </div>
            <div>
              <strong>End:</strong> {formatDateTime(runDetails.run.end_at)}
            </div>
          </div>

          <div
            style={{
              textAlign: "center",
              fontSize: 14,
              color: "#475569",
              lineHeight: 1.7,
              paddingTop: 4,
              borderTop: "1px solid #e2e8f0",
            }}
          >
            <div>
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
          </div>
        </div>
      )}
    </div>
  );
}

export default RunSummaryCard;