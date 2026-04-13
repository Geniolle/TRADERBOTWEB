// C:\TraderBotWeb\web\src\components\runs\run-history\CasesSection.tsx

import { useMemo, useState } from "react";
import { CaseAnalysisBlock } from "./CaseAnalysisBlock";
import { CasesFilterButton, DetailRow } from "./RunHistoryShared";
import { TrendInlineHeader } from "./TrendPanels";
import {
  buildEmaDirectionSummary,
  formatDateTime,
  formatValue,
  getDirectionAccent,
  getOutcomeBadge,
  normalizeDisplayText,
  normalizeOutcome,
  resolveCaseDirection,
} from "./utils";
import type { CaseFilter, StageTestRunCaseItem } from "./types";

type CasesSectionProps = {
  strategyKey: string;
  cases: StageTestRunCaseItem[];
  expandedCaseAnalysisById: Record<string, boolean>;
  onToggleCaseAnalysis: (caseKey: string) => void;
};

export function CasesSection({
  strategyKey,
  cases,
  expandedCaseAnalysisById,
  onToggleCaseAnalysis,
}: CasesSectionProps) {
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
              O foco aqui é encontrar padrões recorrentes nos fails para afinar a
              regra da estratégia.
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
            const caseId = item.id ?? `case-${index + 1}`;
            const caseNumber = item.case_number ?? index + 1;
            const caseKey = `${strategyKey}::${caseId}`;
            const badge = getOutcomeBadge(item.outcome);
            const isExpanded = Boolean(expandedCaseAnalysisById[caseKey]);
            const resolvedSignal = resolveCaseDirection(item);
            const signalAccent = getDirectionAccent(resolvedSignal);
            const emaDirectionSummary = buildEmaDirectionSummary(
              item.analysis ?? null,
              resolvedSignal,
              item.metadata ?? null
            );

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
                      Case #{caseNumber}
                    </strong>
                    <span
                      style={{
                        fontSize: 12,
                        color: "#0f172a",
                        fontWeight: 700,
                        wordBreak: "break-word",
                      }}
                    >
                      ID: {caseId}
                    </span>
                    <span style={{ fontSize: 12, color: "#64748b" }}>
                      Trigger: {formatDateTime(item.trigger_time)}
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
                    justifyItems: "start",
                    alignItems: "start",
                    textAlign: "left",
                  }}
                >
                  <DetailRow label="Case ID" value={caseId} />

                  <DetailRow
                    label="Sinal"
                    value={
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "flex-start",
                          gap: 6,
                          padding: resolvedSignal === "-" ? 0 : "2px 8px",
                          borderRadius: 999,
                          color: signalAccent.color,
                          background: signalAccent.background,
                          border:
                            resolvedSignal === "-"
                              ? "none"
                              : `1px solid ${signalAccent.border}`,
                          fontWeight: 700,
                          width: "fit-content",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {resolvedSignal}
                      </span>
                    }
                  />

                  <div
                    style={{
                      gridColumn: "span 2",
                      minWidth: 460,
                      maxWidth: "100%",
                      justifySelf: "start",
                    }}
                  >
                    <DetailRow
                      label="Direção"
                      value={
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "flex-start",
                            gap: 8,
                            flexWrap: "nowrap",
                            whiteSpace: "nowrap",
                            lineHeight: 1.5,
                            width: "fit-content",
                            maxWidth: "100%",
                            overflow: "hidden",
                            textAlign: "left",
                          }}
                        >
                          <span style={{ color: "#0f172a", flexShrink: 0 }}>
                            Curta
                          </span>

                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              minWidth: 22,
                              height: 22,
                              padding: "0 6px",
                              borderRadius: 999,
                              color: emaDirectionSummary.m9Arrow.color,
                              background: emaDirectionSummary.m9Arrow.background,
                              border: `1px solid ${emaDirectionSummary.m9Arrow.border}`,
                              fontWeight: 700,
                              flexShrink: 0,
                            }}
                          >
                            {emaDirectionSummary.m9Arrow.arrow}
                          </span>

                          <span style={{ color: "#0f172a", flexShrink: 0 }}>
                            {emaDirectionSummary.m9Value}
                          </span>

                          <span style={{ color: "#94a3b8", flexShrink: 0 }}>/</span>

                          <span style={{ color: "#0f172a", flexShrink: 0 }}>
                            Longa
                          </span>

                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              minWidth: 22,
                              height: 22,
                              padding: "0 6px",
                              borderRadius: 999,
                              color: emaDirectionSummary.m21Arrow.color,
                              background: emaDirectionSummary.m21Arrow.background,
                              border: `1px solid ${emaDirectionSummary.m21Arrow.border}`,
                              fontWeight: 700,
                              flexShrink: 0,
                            }}
                          >
                            {emaDirectionSummary.m21Arrow.arrow}
                          </span>

                          <span style={{ color: "#0f172a", flexShrink: 0 }}>
                            {emaDirectionSummary.m21Value}
                          </span>

                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "flex-start",
                              padding: "2px 8px",
                              borderRadius: 999,
                              color: emaDirectionSummary.crossConfirmedColor,
                              background:
                                emaDirectionSummary.crossConfirmedBackground,
                              border: `1px solid ${emaDirectionSummary.crossConfirmedBorder}`,
                              fontWeight: 700,
                              flexShrink: 0,
                            }}
                          >
                            {emaDirectionSummary.crossConfirmedLabel}
                          </span>
                        </span>
                      }
                    />
                  </div>

                  <DetailRow
                    label="Status"
                    value={normalizeDisplayText(formatValue(item.status))}
                  />
                  <DetailRow
                    label="Outcome"
                    value={normalizeDisplayText(formatValue(item.outcome))}
                  />
                  <DetailRow
                    label="Trigger"
                    value={formatDateTime(item.trigger_time)}
                  />
                  <DetailRow
                    label="Trigger candle"
                    value={formatDateTime(item.trigger_candle_time)}
                  />
                  <DetailRow label="Entrada" value={formatValue(item.entry_price)} />
                  <DetailRow label="Fecho" value={formatValue(item.close_price)} />
                  <DetailRow
                    label="Trigger price"
                    value={formatValue(item.trigger_price)}
                  />
                  <DetailRow label="Target" value={formatValue(item.target_price)} />
                  <DetailRow
                    label="Invalidação"
                    value={formatValue(item.invalidation_price)}
                  />
                  <DetailRow
                    label="Entry time"
                    value={formatDateTime(item.entry_time)}
                  />
                  <DetailRow
                    label="Close time"
                    value={formatDateTime(item.close_time)}
                  />
                  <DetailRow
                    label="Bars resolução"
                    value={formatValue(item.bars_to_resolution)}
                  />
                  <DetailRow
                    label="MFE"
                    value={formatValue(item.max_favorable_excursion)}
                  />
                  <DetailRow
                    label="MAE"
                    value={formatValue(item.max_adverse_excursion)}
                  />
                  <DetailRow
                    label="Close reason"
                    value={formatValue(item.close_reason)}
                  />
                </div>

                <TrendInlineHeader analysis={item.analysis ?? null} />

                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: 8,
                    flexWrap: "wrap",
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
                      ? "Ocultar análise do case"
                      : "Exibir análise do case"}
                  </button>
                </div>

                {isExpanded && (
                  <CaseAnalysisBlock
                    analysis={item.analysis ?? null}
                    runStatus={item.outcome}
                    caseId={caseId}
                    caseNumber={caseNumber}
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