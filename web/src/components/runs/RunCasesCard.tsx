// C:\TraderBotWeb\web\src\components\runs\RunCasesCard.tsx

import { useMemo, useState, type CSSProperties } from "react";
import StageTestCaseChartModal from "../stage-tests/StageTestCaseChartModal";
import type {
  RunCaseItem,
  RunDetailsResponse,
} from "../../types/trading";

type RunCasesCardProps = {
  mainCardStyle: CSSProperties;
  sectionTitleStyle: CSSProperties;
  runDetails: RunDetailsResponse | null;
  selectedCaseId: string;
  setSelectedCaseId: (value: string) => void;
};

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("pt-PT");
}

function formatValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  return String(value);
}

function normalizeCases(runDetails: RunDetailsResponse | null): RunCaseItem[] {
  if (!runDetails || !Array.isArray(runDetails.cases)) {
    return [];
  }

  return runDetails.cases;
}

function getCaseId(item: RunCaseItem, index: number): string {
  if (item.id && String(item.id).trim()) {
    return String(item.id);
  }

  return `case-${index + 1}`;
}

function buildCaseTitle(item: RunCaseItem, index: number): string {
  const caseNumber =
    item.case_number !== null && item.case_number !== undefined
      ? `#${item.case_number}`
      : getCaseId(item, index);

  const side = item.side || "-";
  const outcome = item.outcome || item.status || "-";

  return `${caseNumber} / ${side} / ${outcome}`;
}

function RunCasesCard({
  mainCardStyle,
  sectionTitleStyle,
  runDetails,
  selectedCaseId,
  setSelectedCaseId,
}: RunCasesCardProps) {
  const cases = normalizeCases(runDetails);
  const [chartCaseId, setChartCaseId] = useState<string>("");

  const selectedChartCase = useMemo(() => {
    if (!chartCaseId || !runDetails) return null;

    return (
      runDetails.cases.find((item) => String(item.id) === chartCaseId) ?? null
    );
  }, [chartCaseId, runDetails]);

  const chartSymbol = runDetails?.run?.symbol ?? "";
  const chartTimeframe = runDetails?.run?.timeframe ?? "";
  const chartStrategyLabel =
    runDetails?.run?.strategy_key ?? "strategy-desconhecida";

  return (
    <>
      <div style={mainCardStyle}>
        <h2 style={sectionTitleStyle}>Run Cases</h2>

        {!runDetails && <div>Nenhum run selecionado.</div>}

        {runDetails && cases.length === 0 && (
          <div>Este run não possui casos disponíveis.</div>
        )}

        {cases.length > 0 && (
          <div style={{ display: "grid", gap: 12 }}>
            {cases.map((item, index) => {
              const caseId = getCaseId(item, index);
              const isSelected = selectedCaseId === caseId;

              return (
                <div
                  key={caseId}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    border: isSelected ? "2px solid #0f172a" : "1px solid #cbd5e1",
                    borderRadius: 12,
                    padding: 14,
                    background: isSelected ? "#f8fafc" : "#ffffff",
                    display: "grid",
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      flexWrap: "wrap",
                      alignItems: "center",
                    }}
                  >
                    <strong style={{ color: "#0f172a" }}>
                      Case {buildCaseTitle(item, index)}
                    </strong>

                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#475569",
                        background: "#f1f5f9",
                        border: "1px solid #cbd5e1",
                        borderRadius: 999,
                        padding: "4px 8px",
                      }}
                    >
                      {formatValue(item.status)}
                    </span>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                      gap: 8,
                      fontSize: 14,
                      color: "#334155",
                      lineHeight: 1.55,
                    }}
                  >
                    <div>
                      <strong>Direction:</strong> {formatValue(item.side)}
                    </div>

                    <div>
                      <strong>Trigger:</strong> {formatDateTime(item.trigger_time ?? null)}
                    </div>

                    <div>
                      <strong>Entry Time:</strong> {formatDateTime(item.entry_time ?? null)}
                    </div>

                    <div>
                      <strong>Close Time:</strong> {formatDateTime(item.close_time ?? null)}
                    </div>

                    <div>
                      <strong>Trigger Price:</strong> {formatValue(item.trigger_price)}
                    </div>

                    <div>
                      <strong>Entry Price:</strong> {formatValue(item.entry_price)}
                    </div>

                    <div>
                      <strong>Close Price:</strong> {formatValue(item.close_price)}
                    </div>

                    <div>
                      <strong>Outcome:</strong> {formatValue(item.outcome)}
                    </div>

                    <div>
                      <strong>Bars to Resolution:</strong>{" "}
                      {formatValue(item.bars_to_resolution)}
                    </div>

                    <div>
                      <strong>MFE:</strong> {formatValue(item.max_favorable_excursion)}
                    </div>

                    <div>
                      <strong>MAE:</strong> {formatValue(item.max_adverse_excursion)}
                    </div>

                    <div>
                      <strong>Target Price:</strong> {formatValue(item.target_price)}
                    </div>

                    <div>
                      <strong>Invalidation Price:</strong>{" "}
                      {formatValue(item.invalidation_price)}
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      flexWrap: "wrap",
                      justifyContent: "flex-end",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedCaseId(caseId)}
                      style={{
                        height: 40,
                        padding: "0 14px",
                        borderRadius: 10,
                        border: "1px solid #cbd5e1",
                        background: isSelected ? "#e2e8f0" : "#ffffff",
                        color: "#0f172a",
                        cursor: "pointer",
                        fontWeight: 600,
                      }}
                    >
                      {isSelected ? "Case selecionado" : "Selecionar case"}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCaseId(caseId);
                        setChartCaseId(String(item.id));
                      }}
                      style={{
                        height: 40,
                        padding: "0 14px",
                        borderRadius: 10,
                        border: "1px solid #2563eb",
                        background: "#2563eb",
                        color: "#ffffff",
                        cursor: "pointer",
                        fontWeight: 600,
                      }}
                    >
                      Ver no gráfico
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <StageTestCaseChartModal
        open={Boolean(selectedChartCase)}
        onClose={() => setChartCaseId("")}
        symbol={chartSymbol}
        timeframe={chartTimeframe}
        strategyLabel={chartStrategyLabel}
        selectedCase={selectedChartCase}
      />
    </>
  );
}

export default RunCasesCard;