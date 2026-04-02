// src/components/runs/RunCasesCard.tsx

import { getCaseAccentColor } from "../../utils/chart";
import { formatDateTime } from "../../utils/format";
import type { RunDetailsResponse } from "../../types/trading";

type RunCasesCardProps = {
  mainCardStyle: React.CSSProperties;
  sectionTitleStyle: React.CSSProperties;
  runDetails: RunDetailsResponse | null;
  selectedCaseId: string;
  setSelectedCaseId: (value: string) => void;
};

function RunCasesCard({
  mainCardStyle,
  sectionTitleStyle,
  runDetails,
  selectedCaseId,
  setSelectedCaseId,
}: RunCasesCardProps) {
  return (
    <div style={mainCardStyle}>
      <h2 style={sectionTitleStyle}>Cases</h2>

      {!runDetails && <p>Sem dados do run.</p>}

      {runDetails && runDetails.cases.length === 0 && <p>Sem cases neste run.</p>}

      {runDetails && runDetails.cases.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 12,
          }}
        >
          {runDetails.cases.map((item) => {
            const isSelected = item.id === selectedCaseId;
            const accent = getCaseAccentColor(item);

            return (
              <button
                key={item.id}
                onClick={() => setSelectedCaseId(item.id)}
                style={{
                  textAlign: "left",
                  border: isSelected ? `2px solid ${accent}` : "1px solid #dbe2ea",
                  borderRadius: 12,
                  padding: 12,
                  background: isSelected ? "#fafafa" : "#fff",
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    fontWeight: 700,
                    marginBottom: 8,
                    wordBreak: "break-word",
                    color: "#0f172a",
                  }}
                >
                  {item.id}
                </div>

                <div style={{ fontSize: 13, lineHeight: 1.5, color: "#334155" }}>
                  <div>
                    <strong>Status:</strong> {item.status}
                  </div>
                  <div>
                    <strong>Outcome:</strong> {item.outcome ?? "-"}
                  </div>
                  <div>
                    <strong>Entry:</strong> {item.entry_price}
                  </div>
                  <div>
                    <strong>Target:</strong> {item.target_price}
                  </div>
                  <div>
                    <strong>Invalidation:</strong> {item.invalidation_price}
                  </div>
                  <div>
                    <strong>Trigger:</strong> {formatDateTime(item.trigger_time)}
                  </div>
                  <div>
                    <strong>Entry Time:</strong> {formatDateTime(item.entry_time)}
                  </div>
                  <div>
                    <strong>Close Time:</strong> {formatDateTime(item.close_time)}
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