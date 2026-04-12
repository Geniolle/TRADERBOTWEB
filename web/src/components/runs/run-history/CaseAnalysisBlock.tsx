// C:\TraderBotWeb\web\src\components\runs\run-history\CaseAnalysisBlock.tsx

import {
  AnalysisMetricCard,
  AnalysisSection,
  RulePill,
  ScoreBox,
} from "./RunHistoryShared";
import { TrendSummaryPanel } from "./TrendPanels";
import {
  buildAnalysisNarrative,
  formatIndicatorValueByLabel,
  getAnalysisStatusBadge,
  getConflictLevel,
  getRuleVisualState,
  groupIndicators,
  normalizeDisplayText,
  normalizeRuleLabel,
  scoreTechnicalAnalysis,
} from "./utils";
import type { StageTestRunTechnicalAnalysis } from "./types";

type CaseAnalysisBlockProps = {
  analysis: StageTestRunTechnicalAnalysis | null;
  runStatus: string | null | undefined;
  caseId: string;
  caseNumber: number | string;
};

export function CaseAnalysisBlock({
  analysis,
  runStatus,
  caseId,
  caseNumber,
}: CaseAnalysisBlockProps) {
  const statusBadge = getAnalysisStatusBadge(runStatus);

  if (!analysis) {
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
            <strong style={{ fontSize: 14, color: "#0f172a" }}>
              Análise técnica do case #{caseNumber}
            </strong>

            <span
              style={{
                fontSize: 12,
                color: "#475569",
                lineHeight: 1.45,
              }}
            >
              Snapshot técnico do momento exato do gatilho de confirmação.
            </span>

            <span
              style={{
                fontSize: 12,
                color: "#334155",
                lineHeight: 1.45,
                wordBreak: "break-word",
              }}
            >
              <strong>Case ID:</strong> {caseId}
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
            border: "1px solid #e2e8f0",
            borderRadius: 10,
            padding: 12,
            background: "#ffffff",
            fontSize: 12,
            color: "#64748b",
            lineHeight: 1.5,
          }}
        >
          Este case não devolveu análise técnica individual no backend.
        </div>
      </div>
    );
  }

  const rules = analysis.rules ?? [];
  const grouped = groupIndicators(analysis);
  const scores = scoreTechnicalAnalysis(analysis);
  const narrative = buildAnalysisNarrative(analysis);

  const conflictsCount = narrative.conflicts.length;

  const confirmedRules = rules.filter(
    (rule) =>
      rule.passed === true &&
      getRuleVisualState(rule, analysis.direction) === "confirmed"
  );

  const contraryRules = rules.filter(
    (rule) =>
      rule.passed === true &&
      getRuleVisualState(rule, analysis.direction) === "contrary"
  );

  const contextualRules = rules.filter(
    (rule) =>
      rule.passed == null ||
      getRuleVisualState(rule, analysis.direction) === "contextual"
  );

  const inactiveRules = rules.filter((rule) => rule.passed === false);

  const qualityLabel =
    scores.overall >= 8 ? "Alta" : scores.overall >= 6 ? "Média" : "Baixa";

  const renderIndicatorGroup = (
    groupTitle: string,
    items: Array<{ label: string; value: string }>
  ) => {
    if (items.length === 0) return null;

    return (
      <AnalysisSection title={groupTitle}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 8,
          }}
        >
          {items.map((indicator, index) => (
            <AnalysisMetricCard
              key={`${caseId}-${groupTitle}-${indicator.label}-${index}`}
              label={indicator.label}
              value={formatIndicatorValueByLabel(indicator.label, indicator.value)}
            />
          ))}
        </div>
      </AnalysisSection>
    );
  };

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
          <strong style={{ fontSize: 14, color: "#0f172a" }}>
            Análise técnica do case #{caseNumber}
          </strong>

          <span
            style={{
              fontSize: 12,
              color: "#475569",
              lineHeight: 1.45,
            }}
          >
            Snapshot técnico do momento exato do gatilho de confirmação.
          </span>

          <span
            style={{
              fontSize: 12,
              color: "#334155",
              lineHeight: 1.45,
              wordBreak: "break-word",
            }}
          >
            <strong>Case ID:</strong> {caseId}
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

      <TrendSummaryPanel analysis={analysis} />

      <AnalysisSection title="Resumo executivo do case">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 8,
          }}
        >
          <AnalysisMetricCard
            label="Gatilho"
            value={normalizeDisplayText(analysis.trigger_label)}
          />
          <AnalysisMetricCard
            label="Estrutura"
            value={normalizeDisplayText(analysis.summary)}
          />
          <AnalysisMetricCard
            label="Qualidade do setup"
            value={qualityLabel}
          />
          <AnalysisMetricCard
            label="Nível de conflito"
            value={getConflictLevel(conflictsCount)}
          />
        </div>
      </AnalysisSection>

      <AnalysisSection title="Diagnóstico do case">
        <div style={{ display: "grid", gap: 12 }}>
          <div
            style={{
              fontSize: 13,
              color: "#334155",
              lineHeight: 1.6,
            }}
          >
            {narrative.executiveSummary}
          </div>

          <div
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              padding: 12,
              background: "#ffffff",
              fontSize: 12,
              color: "#334155",
              lineHeight: 1.65,
            }}
          >
            O objetivo deste bloco é facilitar a comparação entre fails e hits. A
            percentagem da tendência ajuda a descobrir filtros como “abortar gatilho
            quando a força da tendência estiver abaixo de 60%”.
          </div>
        </div>
      </AnalysisSection>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 8,
        }}
      >
        <AnalysisSection title="Fatores a favor">
          {narrative.positives.length === 0 ? (
            <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.45 }}>
              Nenhum fator positivo detalhado foi identificado a partir do snapshot.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {narrative.positives.map((item, index) => (
                <div
                  key={`positive-${caseId}-${index}`}
                  style={{
                    border: "1px solid #86efac",
                    borderRadius: 10,
                    padding: "10px 12px",
                    background: "#ecfdf5",
                    color: "#166534",
                    fontSize: 12,
                    lineHeight: 1.5,
                    fontWeight: 600,
                  }}
                >
                  {item}
                </div>
              ))}
            </div>
          )}
        </AnalysisSection>

        <AnalysisSection title="Fatores contra">
          {narrative.negatives.length === 0 ? (
            <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.45 }}>
              Nenhum fator negativo detalhado foi identificado a partir do snapshot.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {narrative.negatives.map((item, index) => (
                <div
                  key={`negative-${caseId}-${index}`}
                  style={{
                    border: "1px solid #fca5a5",
                    borderRadius: 10,
                    padding: "10px 12px",
                    background: "#fef2f2",
                    color: "#991b1b",
                    fontSize: 12,
                    lineHeight: 1.5,
                    fontWeight: 600,
                  }}
                >
                  {item}
                </div>
              ))}
            </div>
          )}
        </AnalysisSection>
      </div>

      {narrative.conflicts.length > 0 && (
        <AnalysisSection title="Conflitos detectados">
          <div style={{ display: "grid", gap: 8 }}>
            {narrative.conflicts.map((item, index) => (
              <div
                key={`conflict-${caseId}-${index}`}
                style={{
                  border: "1px solid #fdba74",
                  borderRadius: 10,
                  padding: "10px 12px",
                  background: "#fff7ed",
                  color: "#9a3412",
                  fontSize: 12,
                  lineHeight: 1.5,
                  fontWeight: 600,
                }}
              >
                {item}
              </div>
            ))}
          </div>
        </AnalysisSection>
      )}

      <AnalysisSection title="Score do case">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 8,
          }}
        >
          <ScoreBox label="Geral" value={scores.overall} />
          <ScoreBox label="Tendência" value={scores.trend} />
          <ScoreBox label="Momentum" value={scores.momentum} />
          <ScoreBox label="Estrutura" value={scores.structure} />
          <ScoreBox label="Entrada" value={scores.entry} />
          <ScoreBox label="Risco contextual" value={scores.risk} />
        </div>
      </AnalysisSection>

      {renderIndicatorGroup("Contexto", grouped.context)}
      {renderIndicatorGroup("Tendência", grouped.trend)}
      {renderIndicatorGroup("Momentum", grouped.momentum)}
      {renderIndicatorGroup("Volatilidade", grouped.volatility)}
      {renderIndicatorGroup("Estrutura e localização", grouped.structure)}
      {renderIndicatorGroup("Candle", grouped.candle)}
      {renderIndicatorGroup("Outros indicadores", grouped.other)}

      <AnalysisSection title="Regras de validação do case">
        {rules.length === 0 ? (
          <div
            style={{
              fontSize: 12,
              color: "#64748b",
              lineHeight: 1.45,
            }}
          >
            Nenhuma regra detalhada foi devolvida pelo backend para este case.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 8,
            }}
          >
            {confirmedRules.map((rule, index) => (
              <RulePill
                key={`confirmed-${caseId}-${rule.label}-${index}`}
                label={normalizeRuleLabel(rule.label)}
                state="confirmed"
                value={rule.value}
              />
            ))}

            {contraryRules.map((rule, index) => (
              <RulePill
                key={`contrary-${caseId}-${rule.label}-${index}`}
                label={normalizeRuleLabel(rule.label)}
                state="contrary"
                value={rule.value}
              />
            ))}

            {contextualRules.map((rule, index) => (
              <RulePill
                key={`contextual-${caseId}-${rule.label}-${index}`}
                label={normalizeRuleLabel(rule.label)}
                state="contextual"
                value={rule.value}
              />
            ))}

            {inactiveRules.map((rule, index) => (
              <RulePill
                key={`inactive-${caseId}-${rule.label}-${index}`}
                label={normalizeRuleLabel(rule.label)}
                state="inactive"
                value={rule.value}
              />
            ))}
          </div>
        )}
      </AnalysisSection>
    </div>
  );
}
