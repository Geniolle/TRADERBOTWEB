// C:\TraderBotWeb\web\src\components\runs\RunHistoryCard.tsx

import { useMemo, useState } from "react";
import StageTestCaseChartModal from "../stage-tests/StageTestCaseChartModal";
import { CasesSection } from "./run-history/CasesSection";
import { DetailRow, MetricPill } from "./run-history/RunHistoryShared";
import type { RunHistoryCardProps, StageTestRunCaseItem } from "./run-history/types";
import {
  compareStageTestsByHitRate,
  formatDateTime,
  formatPercent,
  getStatusBackground,
  getStatusBorder,
  getStatusDotColor,
} from "./run-history/utils";

type SelectedCaseChartState = {
  caseItem: StageTestRunCaseItem;
  chartSymbol: string;
  chartTimeframe: string;
  strategyLabel: string;
};

function RunHistoryCard({
  sidebarCardStyle,
  runSearch,
  setRunSearch,
  loadingRuns,
  runsError,
  actionError,
  filteredStageTests,
  selectedRunId,
  onClearRuns,
  isClearingRuns,
  isCreatingRuns,
  lastExecutionLog,
  lastExecutionStatus,
  runningStrategyKey,
  selectedSymbol,
  selectedTimeframe,
  onRunStageTest,
}: RunHistoryCardProps) {
  const [expanded, setExpanded] = useState(true);
  const [expandedCasesByStrategy, setExpandedCasesByStrategy] = useState<
    Record<string, boolean>
  >({});
  const [expandedCaseAnalysisById, setExpandedCaseAnalysisById] = useState<
    Record<string, boolean>
  >({});
  const [selectedCaseChart, setSelectedCaseChart] =
    useState<SelectedCaseChartState | null>(null);

  const orderedStageTests = useMemo(() => {
    return [...filteredStageTests].sort(compareStageTestsByHitRate);
  }, [filteredStageTests]);

  const hasManualContext = Boolean(selectedSymbol && selectedTimeframe);

  const executionStatusLabel = isCreatingRuns
    ? "Run manual em execução..."
    : "Execução manual disponível";

  const executionStatusDescription = isCreatingRuns
    ? "Uma estratégia está a ser executada manualmente neste momento."
    : hasManualContext
      ? "Escolha uma estratégia da lista e clique em Run para executar manualmente no símbolo e timeframe selecionados."
      : "Selecione símbolo e timeframe no painel do mercado para liberar a execução manual.";

  const toggleCases = (strategyKey: string) => {
    setExpandedCasesByStrategy((previous) => ({
      ...previous,
      [strategyKey]: !previous[strategyKey],
    }));
  };

  const toggleCaseAnalysis = (caseKey: string) => {
    setExpandedCaseAnalysisById((previous) => ({
      ...previous,
      [caseKey]: !previous[caseKey],
    }));
  };

  const openCaseChart = (
    caseItem: StageTestRunCaseItem,
    chartSymbol: string,
    chartTimeframe: string,
    strategyLabel: string
  ) => {
    setSelectedCaseChart({
      caseItem,
      chartSymbol,
      chartTimeframe,
      strategyLabel,
    });
  };

  const closeCaseChart = () => {
    setSelectedCaseChart(null);
  };

  return (
    <>
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
              Catálogo do backend com execução manual
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
                  border: `1px solid ${getStatusBorder(lastExecutionStatus)}`,
                  borderRadius: 10,
                  padding: "10px 12px",
                  background: getStatusBackground(lastExecutionStatus),
                  display: "grid",
                  gap: 6,
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
                      background: getStatusDotColor(lastExecutionStatus),
                      flexShrink: 0,
                    }}
                  />

                  <strong
                    style={{
                      fontSize: 13,
                      color: "#0f172a",
                    }}
                  >
                    {executionStatusLabel}
                  </strong>
                </div>

                <span
                  style={{
                    fontSize: 12,
                    color: "#475569",
                    lineHeight: 1.45,
                  }}
                >
                  {executionStatusDescription}
                </span>

                <span
                  style={{
                    fontSize: 12,
                    color: "#334155",
                    lineHeight: 1.45,
                    wordBreak: "break-word",
                  }}
                >
                  <strong>Último log:</strong> {lastExecutionLog}
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
                {isClearingRuns ? "A limpar..." : "Limpar runs locais"}
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
                  const isRunning = runningStrategyKey === item.strategy_key;
                  const cases = item.last_run?.cases ?? [];
                  const hasCases = cases.length > 0;
                  const isCasesExpanded = Boolean(
                    expandedCasesByStrategy[item.strategy_key]
                  );

                  const latestRunSymbol = item.last_run?.symbol ?? selectedSymbol ?? "";
                  const latestRunTimeframe =
                    item.last_run?.timeframe ?? selectedTimeframe ?? "";

                  return (
                    <div
                      key={item.strategy_key}
                      style={{
                        textAlign: "left",
                        border: isSelected
                          ? "2px solid #0f172a"
                          : "1px solid #cbd5e1",
                        borderRadius: 12,
                        padding: 12,
                        background: isSelected ? "#f1f5f9" : "#fff",
                        boxShadow: isSelected
                          ? "0 1px 3px rgba(15, 23, 42, 0.08)"
                          : "none",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          gap: 8,
                          marginBottom: 8,
                          flexWrap: "wrap",
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

                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            flexWrap: "wrap",
                            justifyContent: "flex-end",
                          }}
                        >
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              padding: "4px 8px",
                              borderRadius: 999,
                              background: latestRunId ? "#dbeafe" : "#f1f5f9",
                              color: latestRunId ? "#1d4ed8" : "#64748b",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {latestRunId ? "COM RUN" : "SEM RUN"}
                          </span>

                          <button
                            type="button"
                            onClick={() => void onRunStageTest(item.strategy_key)}
                            disabled={!hasManualContext || isCreatingRuns}
                            style={{
                              height: 32,
                              padding: "0 12px",
                              borderRadius: 8,
                              border: "none",
                              background:
                                !hasManualContext || isCreatingRuns
                                  ? "#cbd5e1"
                                  : "#2563eb",
                              color: "#ffffff",
                              fontWeight: 700,
                              cursor:
                                !hasManualContext || isCreatingRuns
                                  ? "not-allowed"
                                  : "pointer",
                            }}
                          >
                            {isRunning ? "A executar..." : "Run"}
                          </button>
                        </div>
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
                        <MetricPill
                          label="Runs"
                          value={item.total_runs}
                          accentColor="#cbd5e1"
                          backgroundColor="#f8fafc"
                        />
                        <MetricPill
                          label="Cases"
                          value={item.total_cases}
                          accentColor="#cbd5e1"
                          backgroundColor="#f8fafc"
                        />
                        <MetricPill
                          label="Hits"
                          value={item.total_hits}
                          accentColor="#16a34a"
                          backgroundColor="#f0fdf4"
                        />
                        <MetricPill
                          label="Fails"
                          value={item.total_fails}
                          accentColor="#dc2626"
                          backgroundColor="#fef2f2"
                        />
                        <MetricPill
                          label="Timeout"
                          value={item.total_timeouts}
                          accentColor="#f59e0b"
                          backgroundColor="#fffbeb"
                        />
                        <MetricPill
                          label="Hit Rate"
                          value={formatPercent(item.hit_rate)}
                          accentColor="#16a34a"
                          backgroundColor="#f0fdf4"
                        />
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
                        <DetailRow
                          label="Categoria"
                          value={item.strategy_category ?? "-"}
                        />
                        <DetailRow
                          label="Fail Rate"
                          value={formatPercent(item.fail_rate)}
                        />
                        <DetailRow
                          label="Timeout Rate"
                          value={formatPercent(item.timeout_rate)}
                        />
                        <DetailRow label="Último run" value={latestRunId || "-"} />
                        <DetailRow
                          label="Último símbolo"
                          value={item.last_run?.symbol ?? "-"}
                        />
                        <DetailRow
                          label="Último timeframe"
                          value={item.last_run?.timeframe ?? "-"}
                        />
                        <DetailRow
                          label="Último status"
                          value={item.last_run?.status ?? "-"}
                        />
                        <DetailRow
                          label="Último início"
                          value={formatDateTime(item.last_run?.started_at)}
                        />
                      </div>

                      {hasCases && (
                        <div
                          style={{
                            marginTop: 12,
                            display: "flex",
                            justifyContent: "flex-end",
                            gap: 8,
                            flexWrap: "wrap",
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => toggleCases(item.strategy_key)}
                            style={{
                              height: 34,
                              padding: "0 12px",
                              borderRadius: 8,
                              border: "1px solid #cbd5e1",
                              background: "#ffffff",
                              color: "#0f172a",
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            {isCasesExpanded ? "Ocultar cases" : "Exibir cases"}
                          </button>
                        </div>
                      )}

                      {hasCases && isCasesExpanded && (
                        <CasesSection
                          strategyKey={item.strategy_key}
                          cases={cases}
                          expandedCaseAnalysisById={expandedCaseAnalysisById}
                          onToggleCaseAnalysis={toggleCaseAnalysis}
                          chartSymbol={latestRunSymbol}
                          chartTimeframe={latestRunTimeframe}
                          marketSymbol={selectedSymbol}
                          marketTimeframe={selectedTimeframe}
                          strategyLabel={item.strategy_name}
                          onOpenCaseChart={openCaseChart}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}
      </div>

      <StageTestCaseChartModal
        open={Boolean(selectedCaseChart)}
        onClose={closeCaseChart}
        symbol={selectedCaseChart?.chartSymbol ?? ""}
        timeframe={selectedCaseChart?.chartTimeframe ?? ""}
        strategyLabel={selectedCaseChart?.strategyLabel ?? ""}
        selectedCase={selectedCaseChart?.caseItem ?? null}
      />
    </>
  );
}

export default RunHistoryCard;