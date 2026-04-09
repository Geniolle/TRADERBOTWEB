// C:\TraderBotWeb\web\src\components\runs\RunCasesCard.tsx

import type { CSSProperties } from "react";
import type { RunDetailsResponse } from "../../types/trading";

type RunCasesCardProps = {
  mainCardStyle: CSSProperties;
  sectionTitleStyle: CSSProperties;
  runDetails: RunDetailsResponse | null;
  selectedCaseId: string;
  setSelectedCaseId: (value: string) => void;
};

type RunCaseItem = {
  case_id?: string | number | null;
  status?: string | null;
  direction?: string | null;
  trigger_time?: string | null | undefined;
  entry_time?: string | null | undefined;
  close_time?: string | null | undefined;
  trigger_price?: string | number | null;
  entry_price?: string | number | null;
  close_price?: string | number | null;
  result_label?: string | null;
  result_percent?: string | number | null;
  mfe?: string | number | null;
  mae?: string | number | null;
  bars_to_resolution?: string | number | null;
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

  return runDetails.cases as RunCaseItem[];
}

function getCaseId(item: RunCaseItem, index: number): string {
  if (item.case_id !== null && item.case_id !== undefined && item.case_id !== "") {
    return String(item.case_id);
  }

  return `case-${index + 1}`;
}

function RunCasesCard({
  mainCardStyle,
  sectionTitleStyle,
  runDetails,
  selectedCaseId,
  setSelectedCaseId,
}: RunCasesCardProps) {
  const cases = normalizeCases(runDetails);

  return (
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
              <button
                key={caseId}
                type="button"
                onClick={() => setSelectedCaseId(caseId)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  border: isSelected ? "2px solid #0f172a" : "1px solid #cbd5e1",
                  borderRadius: 12,
                  padding: 14,
                  background: isSelected ? "#f8fafc" : "#ffffff",
                  cursor: "pointer",
                  display: "grid",
                  gap: 10,
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
                  <strong style={{ color: "#0f172a" }}>Case {caseId}</strong>

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
                    <strong>Direction:</strong> {formatValue(item.direction)}
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
                    <strong>Result:</strong> {formatValue(item.result_label)}
                  </div>

                  <div>
                    <strong>Result %:</strong> {formatValue(item.result_percent)}
                  </div>

                  <div>
                    <strong>MFE:</strong> {formatValue(item.mfe)}
                  </div>

                  <div>
                    <strong>MAE:</strong> {formatValue(item.mae)}
                  </div>

                  <div>
                    <strong>Bars to Resolution:</strong> {formatValue(item.bars_to_resolution)}
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

export default RunCasesCard;