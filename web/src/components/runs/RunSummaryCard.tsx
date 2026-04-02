// src/components/runs/RunSummaryCard.tsx

import { formatDateTime } from "../../utils/format";
import type { RunDetailsResponse } from "../../types/trading";

type RunSummaryCardProps = {
  mainCardStyle: React.CSSProperties;
  selectedRunId: string;
  loadingRunDetails: boolean;
  runDetailsError: string;
  runDetails: RunDetailsResponse | null;
};

function RunSummaryCard({
  mainCardStyle,
  selectedRunId,
  loadingRunDetails,
  runDetailsError,
  runDetails,
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
      )}
    </div>
  );
}

export default RunSummaryCard;