// src/components/cases/SelectedCaseCard.tsx

import { formatDateTime } from "../../utils/format";
import type { RunDetailsResponse } from "../../types/trading";

type SelectedCaseCardProps = {
  mainCardStyle: React.CSSProperties;
  sectionTitleStyle: React.CSSProperties;
  runDetails: RunDetailsResponse | null;
  selectedCaseId: string;
};

function SelectedCaseCard({
  mainCardStyle,
  sectionTitleStyle,
  runDetails,
  selectedCaseId,
}: SelectedCaseCardProps) {
  const selectedCase =
    runDetails?.cases.find((item) => item.id === selectedCaseId) ?? null;

  return (
    <div style={mainCardStyle}>
      <h2 style={sectionTitleStyle}>Case selecionado</h2>

      {!selectedCase && <p>Nenhum case selecionado.</p>}

      {selectedCase && (
        <div style={{ display: "grid", gap: 8, fontSize: 14, color: "#334155" }}>
          <div>
            <strong>ID:</strong> {selectedCase.id}
          </div>
          <div>
            <strong>Status:</strong> {selectedCase.status}
          </div>
          <div>
            <strong>Outcome:</strong> {selectedCase.outcome ?? "-"}
          </div>
          <div>
            <strong>Entry Price:</strong> {selectedCase.entry_price}
          </div>
          <div>
            <strong>Target Price:</strong> {selectedCase.target_price}
          </div>
          <div>
            <strong>Invalidation Price:</strong> {selectedCase.invalidation_price}
          </div>
          <div>
            <strong>Close Price:</strong> {selectedCase.close_price ?? "-"}
          </div>
          <div>
            <strong>Trigger Time:</strong> {formatDateTime(selectedCase.trigger_time)}
          </div>
          <div>
            <strong>Entry Time:</strong> {formatDateTime(selectedCase.entry_time)}
          </div>
          <div>
            <strong>Close Time:</strong> {formatDateTime(selectedCase.close_time)}
          </div>
          <div>
            <strong>Bars To Resolution:</strong> {selectedCase.bars_to_resolution}
          </div>
          <div>
            <strong>MFE:</strong> {selectedCase.max_favorable_excursion}
          </div>
          <div>
            <strong>MAE:</strong> {selectedCase.max_adverse_excursion}
          </div>
        </div>
      )}
    </div>
  );
}

export default SelectedCaseCard;