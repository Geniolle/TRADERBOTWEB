import { useMemo, useState } from "react";
import type {
  StageTestRunCaseItem,
  StageTestRunTechnicalAnalysis,
  StageTestSummaryItem,
} from "../../types/trading";
import type { ExecutionLogStatus } from "../../hooks/useStageTests";

type RunHistoryCardProps = {
  sidebarCardStyle: React.CSSProperties;
  runSearch: string;
  setRunSearch: (value: string) => void;
  loadingRuns: boolean;
  runsError: string;
  actionError: string;
  filteredStageTests: StageTestSummaryItem[];
  selectedRunId: string;
  onClearRuns: () => Promise<void>;
  isClearingRuns: boolean;
  isCreatingRuns: boolean;
  lastExecutionLog: string;
  lastExecutionStatus: ExecutionLogStatus;
  runningStrategyKey: string;
  selectedSymbol: string;
  selectedTimeframe: string;
  onRunStageTest: (strategyKey: string) => Promise<void>;
};

type CaseFilter = "all" | "hit" | "fail" | "timeout";

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

function formatBooleanLabel(value: boolean | null | undefined): string {
  if (value === true) return "✅ Sim";
  if (value === false) return "❌ Não";
  return "-";
}

function formatValue(value: string | number | null | undefined): string {
  if (value == null) return "-";
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  const text = String(value).trim();
  return text || "-";
}

function normalizeOutcome(value: string | null | undefined): string {
  const raw = (value ?? "").trim().toLowerCase();

  if (["hit", "win", "target", "target_hit", "tp", "profit"].includes(raw)) {
    return "hit";
  }

  if (["fail", "loss", "stop", "stop_loss", "sl"].includes(raw)) {
    return "fail";
  }

  if (["timeout", "expired", "time_out"].includes(raw)) {
    return "timeout";
  }

  return raw || "other";
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

function getStatusDotColor(status: ExecutionLogStatus): string {
  if (status === "running") return "#2563eb";
  if (status === "success") return "#16a34a";
  if (status === "error") return "#dc2626";
  if (status === "waiting") return "#d97706";
  return "#64748b";
}

function getStatusBackground(status: ExecutionLogStatus): string {
  if (status === "running") return "#eff6ff";
  if (status === "success") return "#f0fdf4";
  if (status === "error") return "#fef2f2";
  if (status === "waiting") return "#fffbeb";
  return "#f8fafc";
}

function getStatusBorder(status: ExecutionLogStatus): string {
  if (status === "running") return "#bfdbfe";
  if (status === "success") return "#bbf7d0";
  if (status === "error") return "#fecaca";
  if (status === "waiting") return "#fde68a";
  return "#cbd5e1";
}

function getAnalysisStatusBadge(status: string | null | undefined) {
  const normalized = (status ?? "").trim().toLowerCase();

  if (normalized === "local_ok") {
    return {
      label: "Entrada validada",
      background: "#dcfce7",
      color: "#166534",
      border: "#86efac",
    };
  }

  if (normalized === "local_error") {
    return {
      label: "Run com erro",
      background: "#fee2e2",
      color: "#991b1b",
      border: "#fca5a5",
    };
  }

  if (normalized === "ready") {
    return {
      label: "Sem sinal",
      background: "#f1f5f9",
      color: "#475569",
      border: "#cbd5e1",
    };
  }

  return {
    label: status || "Sem estado",
    background: "#f8fafc",
    color: "#334155",
    border: "#cbd5e1",
  };
}

function getOutcomeBadge(outcome: string | null | undefined) {
  const normalized = normalizeOutcome(outcome);

  if (normalized === "hit") {
    return {
      label: "HIT",
      background: "#dcfce7",
      color: "#166534",
      border: "#86efac",
    };
  }

  if (normalized === "fail") {
    return {
      label: "FAIL",
      background: "#fee2e2",
      color: "#991b1b",
      border: "#fca5a5",
    };
  }

  if (normalized === "timeout") {
    return {
      label: "TIMEOUT",
      background: "#fffbeb",
      color: "#92400e",
      border: "#fcd34d",
    };
  }

  return {
    label: outcome || "OUTRO",
    background: "#f8fafc",
    color: "#475569",
    border: "#cbd5e1",
  };
}

function AnalysisSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 10,
        padding: 12,
        background: "#ffffff",
      }}
    >
      <div
        style={{
          marginBottom: 10,
          fontSize: 12,
          fontWeight: 700,
          color: "#0f172a",
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function AnalysisListRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(120px, 180px) minmax(0, 1fr)",
        gap: 10,
        alignItems: "start",
        padding: "7px 0",
        borderBottom: "1px solid rgba(148, 163, 184, 0.14)",
      }}
    >
      <span
        style={{
          fontSize: 12,
          color: "#64748b",
          lineHeight: 1.45,
        }}
      >
        {label}
      </span>

      <strong
        style={{
          fontSize: 12,
          color: "#0f172a",
          lineHeight: 1.45,
          wordBreak: "break-word",
        }}
      >
        {value}
      </strong>
    </div>
  );
}

function RunTechnicalAnalysisBlock({
  analysis,
  runStatus,
  title = "Análise técnica do último run",
  subtitle = "Snapshot técnico capturado no momento da validação.",
}: {
  analysis: StageTestRunTechnicalAnalysis | null;
  runStatus: string | null | undefined;
  title?: string;
  subtitle?: string;
}) {
  if (!analysis) {
    return null;
  }

  const statusBadge = getAnalysisStatusBadge(runStatus);
  const indicators = analysis.indicators ?? [];
  const rules = analysis.rules ?? [];

  return (
    <div
      style={{
        marginTop: 12,
        border: "1px solid #dbe2ea",
        borderRadius: 12,
        padding: 12,
        background: "#f8fafc",
        display: "grid",
        gap: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "grid", gap: 6 }}>
          <strong
            style={{
              fontSize: 14,
              color: "#0f172a",
            }}
          >
            {title}
          </strong>

          <span
            style={{
              fontSize: 12,
              color: "#475569",
              lineHeight: 1.45,
            }}
          >
            {subtitle}
          </span>
        </div>

        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            padding: "4px 8px",
            borderRadius: 999,
            background: statusBadge.background,
            color: statusBadge.color,
            border: `1px solid ${statusBadge.border}`,
            whiteSpace: "nowrap",
          }}
        >
          {statusBadge.label}
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 8,
        }}
      >
        <AnalysisSection title="Contexto">
          <div style={{ display: "grid" }}>
            <AnalysisListRow label="Direção" value={analysis.direction || "-"} />
            <AnalysisListRow
              label="Validação"
              value={formatDateTime(analysis.validated_at)}
            />
            <AnalysisListRow
              label="Gatilho"
              value={analysis.trigger_label || "-"}
            />
            <AnalysisListRow label="Resumo" value={analysis.summary || "-"} />
          </div>
        </AnalysisSection>

        <AnalysisSection title="Regras da validação">
          {rules.length === 0 ? (
            <div
              style={{
                fontSize: 12,
                color: "#64748b",
                lineHeight: 1.45,
              }}
            >
              Nenhuma regra detalhada foi devolvida pelo backend.
            </div>
          ) : (
            <div style={{ display: "grid" }}>
              {rules.map((rule, index) => (
                <AnalysisListRow
                  key={`${rule.label}-${index}`}
                  label={rule.label}
                  value={
                    rule.passed == null
                      ? rule.value
                      : `${formatBooleanLabel(rule.passed)}${
                          rule.value ? ` • ${rule.value}` : ""
                        }`
                  }
                />
              ))}
            </div>
          )}
        </AnalysisSection>
      </div>

      <AnalysisSection title="Indicadores no momento da validação">
        {indicators.length === 0 ? (
          <div
            style={{
              fontSize: 12,
              color: "#64748b",
              lineHeight: 1.45,
            }}
          >
            Os indicadores ainda não foram devolvidos pelo backend para este run.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 8,
            }}
          >
            {indicators.map((indicator, index) => (
              <div
                key={`${indicator.label}-${index}`}
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 10,
                  padding: "10px 12px",
                  background: "#ffffff",
                  display: "grid",
                  gap: 4,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#64748b",
                    textTransform: "uppercase",
                    letterSpacing: 0.3,
                  }}
                >
                  {indicator.label}
                </span>

                <strong
                  style={{
                    fontSize: 13,
                    color: "#0f172a",
                    wordBreak: "break-word",
                  }}
                >
                  {indicator.value}
                </strong>
              </div>
            ))}
          </div>
        )}
      </AnalysisSection>
    </div>
  );
}

function CasesFilterButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        height: 32,
        padding: "0 12px",
        borderRadius: 999,
        border: active ? "1px solid #2563eb" : "1px solid #cbd5e1",
        background: active ? "#eff6ff" : "#ffffff",
        color: active ? "#1d4ed8" : "#334155",
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function CasesSection({
  strategyKey,
  cases,
  expandedCaseAnalysisById,
  onToggleCaseAnalysis,
}: {
  strategyKey: string;
  cases: StageTestRunCaseItem[];
  expandedCaseAnalysisById: Record<string, boolean>;
  onToggleCaseAnalysis: (caseKey: string) => void;
}) {
  const [filter, setFilter] = useState<CaseFilter>("all");

  const filteredCases = useMemo(() => {
    if (filter === "all") return cases;
    return cases.filter((item) => normalizeOutcome(item.outcome) === filter);
  }, [cases, filter]);

  const totalHits = useMemo(
    () => cases.filter((item) => normalizeOutcome(item.outcome) === "hit").length,
    [cases]
  );
  const totalFails = useMemo(
    () => cases.filter((item) => normalizeOutcome(item.outcome) === "fail").length,
    [cases]
  );
  const totalTimeouts = useMemo(
    () => cases.filter((item) => normalizeOutcome(item.outcome) === "timeout").length,
    [cases]
  );

  return (
    <div
      style={{
        marginTop: 12,
        border: "1px solid #dbe2ea",
        borderRadius: 12,
        padding: 12,
        background: "#f8fafc",
        display: "grid",
        gap: 12,
      }}
    >
      <div
        style={{
          display: "grid",
          gap: 8,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "grid", gap: 6 }}>
            <strong style={{ fontSize: 14, color: "#0f172a" }}>
              Casos do último run
            </strong>

            <span
              style={{
                fontSize: 12,
                color: "#475569",
                lineHeight: 1.45,
              }}
            >
              Hits e fails detalhados para análise individual.
            </span>
          </div>

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
                fontSize: 11,
                fontWeight: 700,
                padding: "4px 8px",
                borderRadius: 999,
                background: "#dcfce7",
                color: "#166534",
                border: "1px solid #86efac",
              }}
            >
              Hits {totalHits}
            </span>

            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: "4px 8px",
                borderRadius: 999,
                background: "#fee2e2",
                color: "#991b1b",
                border: "1px solid #fca5a5",
              }}
            >
              Fails {totalFails}
            </span>

            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: "4px 8px",
                borderRadius: 999,
                background: "#fffbeb",
                color: "#92400e",
                border: "1px solid #fcd34d",
              }}
            >
              Timeouts {totalTimeouts}
            </span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <CasesFilterButton
            active={filter === "all"}
            label={`Todos (${cases.length})`}
            onClick={() => setFilter("all")}
          />
          <CasesFilterButton
            active={filter === "hit"}
            label={`Hits (${totalHits})`}
            onClick={() => setFilter("hit")}
          />
          <CasesFilterButton
            active={filter === "fail"}
            label={`Fails (${totalFails})`}
            onClick={() => setFilter("fail")}
          />
          <CasesFilterButton
            active={filter === "timeout"}
            label={`Timeouts (${totalTimeouts})`}
            onClick={() => setFilter("timeout")}
          />
        </div>
      </div>

      {filteredCases.length === 0 ? (
        <div
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: 10,
            padding: 12,
            background: "#ffffff",
            fontSize: 12,
            color: "#64748b",
          }}
        >
          Nenhum caso encontrado para este filtro.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {filteredCases.map((item, index) => {
            const caseKey = `${strategyKey}::${item.id ?? `case-${index}`}`;
            const badge = getOutcomeBadge(item.outcome);
            const isExpanded = Boolean(expandedCaseAnalysisById[caseKey]);

            return (
              <div
                key={caseKey}
                style={{
                  border: "1px solid #dbe2ea",
                  borderRadius: 10,
                  padding: 12,
                  background: "#ffffff",
                  display: "grid",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ display: "grid", gap: 4 }}>
                    <strong style={{ fontSize: 13, color: "#0f172a" }}>
                      Caso #{item.case_number ?? index + 1}
                    </strong>
                    <span style={{ fontSize: 12, color: "#64748b" }}>
                      ID: {item.id ?? "-"}
                    </span>
                  </div>

                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "4px 8px",
                      borderRadius: 999,
                      background: badge.background,
                      color: badge.color,
                      border: `1px solid ${badge.border}`,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {badge.label}
                  </span>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 8,
                  }}
                >
                  {detailRow("Direção", formatValue(item.side))}
                  {detailRow("Status", formatValue(item.status))}
                  {detailRow("Outcome", formatValue(item.outcome))}
                  {detailRow("Trigger", formatDateTime(item.trigger_time))}
                  {detailRow("Trigger candle", formatDateTime(item.trigger_candle_time))}
                  {detailRow("Entrada", formatValue(item.entry_price))}
                  {detailRow("Fecho", formatValue(item.close_price))}
                  {detailRow("Trigger price", formatValue(item.trigger_price))}
                  {detailRow("Target", formatValue(item.target_price))}
                  {detailRow("Invalidação", formatValue(item.invalidation_price))}
                  {detailRow("Entry time", formatDateTime(item.entry_time))}
                  {detailRow("Close time", formatDateTime(item.close_time))}
                  {detailRow("Bars resolução", formatValue(item.bars_to_resolution))}
                  {detailRow("MFE", formatValue(item.max_favorable_excursion))}
                  {detailRow("MAE", formatValue(item.max_adverse_excursion))}
                  {detailRow("Close reason", formatValue(item.close_reason))}
                </div>

                {item.analysis && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => onToggleCaseAnalysis(caseKey)}
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
                      {isExpanded
                        ? "Ocultar análise do caso"
                        : "Exibir análise do caso"}
                    </button>
                  </div>
                )}

                {item.analysis && isExpanded && (
                  <RunTechnicalAnalysisBlock
                    analysis={item.analysis}
                    runStatus={item.outcome}
                    title={`Análise do caso #${item.case_number ?? index + 1}`}
                    subtitle="Snapshot técnico associado a este caso."
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
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
  const [expandedAnalysisByStrategy, setExpandedAnalysisByStrategy] = useState<
    Record<string, boolean>
  >({});
  const [expandedCasesByStrategy, setExpandedCasesByStrategy] = useState<
    Record<string, boolean>
  >({});
  const [expandedCaseAnalysisById, setExpandedCaseAnalysisById] = useState<
    Record<string, boolean>
  >({});

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

  const toggleAnalysis = (strategyKey: string) => {
    setExpandedAnalysisByStrategy((previous) => ({
      ...previous,
      [strategyKey]: !previous[strategyKey],
    }));
  };

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
                const analysis = item.last_run?.analysis ?? null;
                const cases = item.last_run?.cases ?? [];
                const hasAnalysis = Boolean(analysis);
                const hasCases = cases.length > 0;
                const isAnalysisExpanded = Boolean(
                  expandedAnalysisByStrategy[item.strategy_key]
                );
                const isCasesExpanded = Boolean(
                  expandedCasesByStrategy[item.strategy_key]
                );

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

                    {(hasAnalysis || hasCases) && (
                      <div
                        style={{
                          marginTop: 12,
                          display: "flex",
                          justifyContent: "flex-end",
                          gap: 8,
                          flexWrap: "wrap",
                        }}
                      >
                        {hasAnalysis && (
                          <button
                            type="button"
                            onClick={() => toggleAnalysis(item.strategy_key)}
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
                            {isAnalysisExpanded
                              ? "Ocultar análise"
                              : "Exibir análise"}
                          </button>
                        )}

                        {hasCases && (
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
                            {isCasesExpanded ? "Ocultar casos" : "Exibir casos"}
                          </button>
                        )}
                      </div>
                    )}

                    {hasAnalysis && isAnalysisExpanded && (
                      <RunTechnicalAnalysisBlock
                        analysis={analysis}
                        runStatus={item.last_run?.status}
                      />
                    )}

                    {hasCases && isCasesExpanded && (
                      <CasesSection
                        strategyKey={item.strategy_key}
                        cases={cases}
                        expandedCaseAnalysisById={expandedCaseAnalysisById}
                        onToggleCaseAnalysis={toggleCaseAnalysis}
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
  );
}

export default RunHistoryCard;