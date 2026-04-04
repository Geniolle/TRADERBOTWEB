// web/src/components/runs/RunHistoryCard.tsx

import type { RunHistoryItem } from "../../types/trading";

type RunHistoryCardProps = {
  sidebarCardStyle: React.CSSProperties;
  runSearch: string;
  setRunSearch: (value: string) => void;
  loadingRuns: boolean;
  runsError: string;
  actionError: string;
  filteredRuns: RunHistoryItem[];
  selectedRunId: string;
  setSelectedRunId: (value: string) => void;
  onClearRuns: () => void;
  onCreateRuns: () => void;
  isClearingRuns: boolean;
  isCreatingRuns: boolean;
  canCreateRuns: boolean;
};

function RunHistoryCard({
  sidebarCardStyle,
  runSearch,
  setRunSearch,
  loadingRuns,
  runsError,
  actionError,
  filteredRuns,
  selectedRunId,
  setSelectedRunId,
  onClearRuns,
  onCreateRuns,
  isClearingRuns,
  isCreatingRuns,
  canCreateRuns,
}: RunHistoryCardProps) {
  return (
    <div style={sidebarCardStyle}>
      <h2
        style={{
          marginTop: 0,
          marginBottom: 12,
          fontSize: 20,
          fontWeight: 700,
        }}
      >
        Histórico de runs
      </h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
          marginBottom: 12,
        }}
      >
        <button
          onClick={onClearRuns}
          disabled={isClearingRuns || isCreatingRuns}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #dc2626",
            background: isClearingRuns ? "#fee2e2" : "#fff",
            color: "#b91c1c",
            fontWeight: 700,
            cursor: isClearingRuns || isCreatingRuns ? "not-allowed" : "pointer",
            opacity: isClearingRuns || isCreatingRuns ? 0.7 : 1,
          }}
        >
          {isClearingRuns ? "A limpar..." : "Limpar runs"}
        </button>

        <button
          onClick={onCreateRuns}
          disabled={!canCreateRuns || isCreatingRuns || isClearingRuns}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #0f172a",
            background: isCreatingRuns ? "#e2e8f0" : "#0f172a",
            color: isCreatingRuns ? "#0f172a" : "#fff",
            fontWeight: 700,
            cursor:
              !canCreateRuns || isCreatingRuns || isClearingRuns
                ? "not-allowed"
                : "pointer",
            opacity: !canCreateRuns || isCreatingRuns || isClearingRuns ? 0.7 : 1,
          }}
        >
          {isCreatingRuns ? "A criar..." : "Criar runs"}
        </button>
      </div>

      <input
        value={runSearch}
        onChange={(e) => setRunSearch(e.target.value)}
        placeholder="Buscar por run, symbol, status..."
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "10px 12px",
          borderRadius: 10,
          border: "1px solid #cbd5e1",
          marginBottom: 12,
          outline: "none",
          fontSize: 14,
        }}
      />

      {actionError && (
        <div style={{ marginBottom: 12 }}>
          <p style={{ color: "#dc2626", fontWeight: "bold", margin: 0 }}>
            Erro de ação
          </p>
          <p style={{ margin: "6px 0 0 0" }}>{actionError}</p>
        </div>
      )}

      {loadingRuns && <p style={{ margin: 0 }}>A carregar histórico...</p>}

      {!loadingRuns && runsError && (
        <div>
          <p style={{ color: "#dc2626", fontWeight: "bold" }}>
            Erro ao carregar histórico
          </p>
          <p>{runsError}</p>
        </div>
      )}

      {!loadingRuns && !runsError && filteredRuns.length === 0 && (
        <p style={{ margin: 0 }}>Nenhum run encontrado.</p>
      )}

      {!loadingRuns && !runsError && filteredRuns.length > 0 && (
        <div style={{ display: "grid", gap: 12 }}>
          {filteredRuns.map((run) => {
            const selected = selectedRunId === run.id;

            return (
              <button
                key={run.id}
                onClick={() => setSelectedRunId(run.id)}
                style={{
                  textAlign: "left",
                  border: selected ? "2px solid #0f172a" : "1px solid #cbd5e1",
                  borderRadius: 12,
                  padding: 12,
                  background: selected ? "#f1f5f9" : "#fff",
                  cursor: "pointer",
                  boxShadow: selected
                    ? "0 1px 3px rgba(15, 23, 42, 0.08)"
                    : "none",
                }}
              >
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    lineHeight: 1.35,
                    wordBreak: "break-word",
                    marginBottom: 8,
                    color: "#0f172a",
                  }}
                >
                  {run.id}
                </div>

                <div
                  style={{
                    fontSize: 13,
                    lineHeight: 1.5,
                    color: "#1e293b",
                  }}
                >
                  <div>
                    <strong>Symbol:</strong> {run.symbol}
                  </div>
                  <div>
                    <strong>Timeframe:</strong> {run.timeframe}
                  </div>
                  <div>
                    <strong>Status:</strong> {run.status}
                  </div>
                  <div>
                    <strong>Strategy:</strong> {run.strategy_key ?? "-"}
                  </div>
                  <div>
                    <strong>Candles:</strong> {run.candles_count}
                  </div>
                  <div>
                    <strong>Cases:</strong> {run.cases_count}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default RunHistoryCard;