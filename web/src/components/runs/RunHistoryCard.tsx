// web/src/components/runs/RunHistoryCard.tsx

import { useMemo, useState } from "react";
import type { StageTestSummaryItem } from "../../types/trading";

type RunHistoryCardProps = {
  sidebarCardStyle: React.CSSProperties;
  runSearch: string;
  setRunSearch: (value: string) => void;
  loadingRuns: boolean;
  runsError: string;
  actionError: string;
  filteredStageTests: StageTestSummaryItem[];
  selectedRunId: string;
  setSelectedRunId: (value: string) => void;
  onClearRuns: () => Promise<void>;
  isClearingRuns: boolean;
  isCreatingRuns: boolean;
};

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "0,00%";
  return `${value.toFixed(2).replace(".", ",")}%`;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleString("pt-PT");
}

function metricPill(
  label: string,
  value: string | number,
  accentColor: string,
  backgroundColor: string
) {
  return (
    <div
      style={{
        border: `1px solid ${accentColor}`,
        borderRadius: 10,
        padding: "8px 10px",
        background: backgroundColor,
        display: "grid",
        gap: 4,
        minWidth: 0,
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: "#64748b",
          textTransform: "uppercase",
          letterSpacing: 0.3,
          lineHeight: 1.1,
        }}
      >
        {label}
      </span>

      <span
        style={{
          fontSize: 16,
          fontWeight: 700,
          color: "#0f172a",
          lineHeight: 1.1,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function detailRow(label: string, value: string) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "120px minmax(0, 1fr)",
        gap: 10,
        alignItems: "start",
      }}
    >
      <span style={{ color: "#64748b", fontSize: 12 }}>{label}</span>
      <strong
        style={{
          color: "#0f172a",
          fontSize: 12,
          fontWeight: 600,
          wordBreak: "break-word",
        }}
      >
        {value}
      </strong>
    </div>
  );
}

function compareStageTestsByHitRate(
  left: StageTestSummaryItem,
  right: StageTestSummaryItem
): number {
  const leftHitRate = Number.isFinite(left.hit_rate) ? left.hit_rate : -1;
  const rightHitRate = Number.isFinite(right.hit_rate) ? right.hit_rate : -1;

  if (rightHitRate !== leftHitRate) {
    return rightHitRate - leftHitRate;
  }

  const leftRuns = Number.isFinite(left.total_runs) ? left.total_runs : 0;
  const rightRuns = Number.isFinite(right.total_runs) ? right.total_runs : 0;

  if (rightRuns !== leftRuns) {
    return rightRuns - leftRuns;
  }

  return left.strategy_name.localeCompare(right.strategy_name, "pt-PT", {
    sensitivity: "base",
  });
}

function RunHistoryCard({
  sidebarCardStyle,
  runSearch,
  setRunSearch,
  loadingRuns,
  runsError,
  actionError,
  filteredStageTests,
  selectedRunId,
  setSelectedRunId,
  onClearRuns,
  isClearingRuns,
  isCreatingRuns,
}: RunHistoryCardProps) {
  const [expanded, setExpanded] = useState(true);

  const orderedStageTests = useMemo(() => {
    return [...filteredStageTests].sort(compareStageTestsByHitRate);
  }, [filteredStageTests]);

  const automationStatusLabel = isCreatingRuns
    ? "A executar automaticamente..."
    : "Execução automática ativa";

  const automationStatusDescription = isCreatingRuns
    ? "Novo candle detetado. O sistema está a correr todas as estratégias da lista."
    : "Sempre que entra um novo candle, o sistema executa automaticamente todas as estratégias visíveis nesta secção.";

  return (
    <div
      style={{
        ...sidebarCardStyle,
        padding: 0,
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((previous) => !previous)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "14px 16px",
          background: "#f8fafc",
          border: "none",
          borderBottom: expanded ? "1px solid #e2e8f0" : "none",
          cursor: "pointer",
          textAlign: "left",
        }}
        aria-expanded={expanded}
        aria-label={expanded ? "Ocultar Stage Testes" : "Expandir Stage Testes"}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            minWidth: 0,
          }}
        >
          <strong
            style={{
              fontSize: 18,
              color: "#0f172a",
              lineHeight: 1.2,
            }}
          >
            Stage Testes
          </strong>

          <span
            style={{
              fontSize: 12,
              color: "#64748b",
              lineHeight: 1.4,
            }}
          >
            Estratégias com resumo acumulado dos testes executados
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
            border: "1px solid #cbd5e1",
            background: "#ffffff",
            color: "#0f172a",
            fontSize: 16,
            fontWeight: 700,
            lineHeight: 1,
            flexShrink: 0,
          }}
        >
          {expanded ? "−" : "+"}
        </span>
      </button>

      {expanded ? (
        <div style={{ padding: 16 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: 8,
              alignItems: "stretch",
              marginBottom: 12,
            }}
          >
            <div
              style={{
                border: "1px solid #bfdbfe",
                borderRadius: 10,
                padding: "10px 12px",
                background: isCreatingRuns ? "#eff6ff" : "#f8fafc",
                display: "grid",
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
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 999,
                    background: isCreatingRuns ? "#2563eb" : "#16a34a",
                    flexShrink: 0,
                  }}
                />

                <strong
                  style={{
                    fontSize: 13,
                    color: "#0f172a",
                  }}
                >
                  {automationStatusLabel}
                </strong>
              </div>

              <span
                style={{
                  fontSize: 12,
                  color: "#475569",
                  lineHeight: 1.45,
                }}
              >
                {automationStatusDescription}
              </span>
            </div>

            <button
              onClick={() => void onClearRuns()}
              disabled={isClearingRuns || isCreatingRuns}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid #dc2626",
                background: isClearingRuns ? "#fee2e2" : "#fff",
                color: "#b91c1c",
                fontWeight: 700,
                cursor:
                  isClearingRuns || isCreatingRuns ? "not-allowed" : "pointer",
                opacity: isClearingRuns || isCreatingRuns ? 0.7 : 1,
                whiteSpace: "nowrap",
              }}
            >
              {isClearingRuns ? "A limpar..." : "Limpar runs"}
            </button>
          </div>

          <input
            value={runSearch}
            onChange={(e) => setRunSearch(e.target.value)}
            placeholder="Buscar por estratégia, símbolo..."
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

          {loadingRuns && <p style={{ margin: 0 }}>A carregar Stage Testes...</p>}

          {!loadingRuns && runsError && (
            <div>
              <p style={{ color: "#dc2626", fontWeight: "bold" }}>
                Erro ao carregar Stage Testes
              </p>
              <p>{runsError}</p>
            </div>
          )}

          {!loadingRuns && !runsError && orderedStageTests.length === 0 && (
            <p style={{ margin: 0 }}>Nenhuma estratégia encontrada.</p>
          )}

          {!loadingRuns && !runsError && orderedStageTests.length > 0 && (
            <div style={{ display: "grid", gap: 12 }}>
              {orderedStageTests.map((item, index) => {
                const latestRunId = item.last_run?.run_id ?? "";
                const isSelected =
                  latestRunId !== "" && selectedRunId === latestRunId;
                const hasRun = Boolean(latestRunId);

                return (
                  <button
                    key={item.strategy_key}
                    onClick={() => {
                      if (latestRunId) {
                        setSelectedRunId(latestRunId);
                      }
                    }}
                    disabled={!hasRun}
                    style={{
                      textAlign: "left",
                      border: isSelected
                        ? "2px solid #0f172a"
                        : "1px solid #cbd5e1",
                      borderRadius: 12,
                      padding: 12,
                      background: isSelected ? "#f1f5f9" : "#fff",
                      cursor: hasRun ? "pointer" : "default",
                      boxShadow: isSelected
                        ? "0 1px 3px rgba(15, 23, 42, 0.08)"
                        : "none",
                      opacity: hasRun ? 1 : 0.82,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: 8,
                        marginBottom: 8,
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            flexWrap: "wrap",
                            marginBottom: 4,
                          }}
                        >
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              minWidth: 28,
                              height: 22,
                              padding: "0 8px",
                              borderRadius: 999,
                              border: "1px solid #cbd5e1",
                              background: "#f8fafc",
                              color: "#475569",
                              fontSize: 11,
                              fontWeight: 700,
                            }}
                          >
                            #{index + 1}
                          </span>

                          <div
                            style={{
                              fontSize: 15,
                              fontWeight: 700,
                              lineHeight: 1.35,
                              wordBreak: "break-word",
                              color: "#0f172a",
                            }}
                          >
                            {item.strategy_name}
                          </div>
                        </div>

                        <div
                          style={{
                            fontSize: 12,
                            color: "#64748b",
                            wordBreak: "break-word",
                          }}
                        >
                          {item.strategy_key}
                        </div>
                      </div>

                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "4px 8px",
                          borderRadius: 999,
                          background: hasRun ? "#dbeafe" : "#f1f5f9",
                          color: hasRun ? "#1d4ed8" : "#64748b",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {hasRun ? "COM RUN" : "SEM RUN"}
                      </span>
                    </div>

                    {item.strategy_description && (
                      <div
                        style={{
                          fontSize: 12,
                          color: "#475569",
                          lineHeight: 1.5,
                          marginBottom: 10,
                        }}
                      >
                        {item.strategy_description}
                      </div>
                    )}

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
                        gap: 8,
                        marginBottom: 12,
                      }}
                    >
                      {metricPill("Runs", item.total_runs, "#cbd5e1", "#f8fafc")}
                      {metricPill("Cases", item.total_cases, "#cbd5e1", "#f8fafc")}
                      {metricPill("Hits", item.total_hits, "#16a34a", "#f0fdf4")}
                      {metricPill("Fails", item.total_fails, "#dc2626", "#fef2f2")}
                      {metricPill(
                        "Timeout",
                        item.total_timeouts,
                        "#f59e0b",
                        "#fffbeb"
                      )}
                      {metricPill(
                        "Hit Rate",
                        formatPercent(item.hit_rate),
                        "#16a34a",
                        "#f0fdf4"
                      )}
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                        gap: 8,
                        fontSize: 12,
                        lineHeight: 1.55,
                        color: "#334155",
                      }}
                    >
                      {detailRow("Categoria", item.strategy_category ?? "-")}
                      {detailRow("Fail Rate", formatPercent(item.fail_rate))}
                      {detailRow("Timeout Rate", formatPercent(item.timeout_rate))}
                      {detailRow("Último run", latestRunId || "-")}
                      {detailRow("Último símbolo", item.last_run?.symbol ?? "-")}
                      {detailRow("Último timeframe", item.last_run?.timeframe ?? "-")}
                      {detailRow("Último status", item.last_run?.status ?? "-")}
                      {detailRow(
                        "Último início",
                        formatDateTime(item.last_run?.started_at)
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default RunHistoryCard;