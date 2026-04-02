// src/components/runs/RunMetricsCard.tsx

import type { RunDetailsResponse } from "../../types/trading";

type RunMetricsCardProps = {
  mainCardStyle: React.CSSProperties;
  sectionTitleStyle: React.CSSProperties;
  runDetails: RunDetailsResponse | null;
};

function RunMetricsCard({
  mainCardStyle,
  sectionTitleStyle,
  runDetails,
}: RunMetricsCardProps) {
  return (
    <div style={mainCardStyle}>
      <h2 style={sectionTitleStyle}>Métricas</h2>

      {!runDetails?.metrics && <p>Sem métricas.</p>}

      {runDetails?.metrics && (
        <div style={{ display: "grid", gap: 8, fontSize: 14, color: "#334155" }}>
          <div>
            <strong>Total Cases:</strong> {runDetails.metrics.total_cases}
          </div>
          <div>
            <strong>Total Hits:</strong> {runDetails.metrics.total_hits}
          </div>
          <div>
            <strong>Total Fails:</strong> {runDetails.metrics.total_fails}
          </div>
          <div>
            <strong>Total Timeouts:</strong> {runDetails.metrics.total_timeouts}
          </div>
          <div>
            <strong>Hit Rate:</strong> {runDetails.metrics.hit_rate}
          </div>
          <div>
            <strong>Fail Rate:</strong> {runDetails.metrics.fail_rate}
          </div>
          <div>
            <strong>Timeout Rate:</strong> {runDetails.metrics.timeout_rate}
          </div>
          <div>
            <strong>Avg Bars To Resolution:</strong>{" "}
            {runDetails.metrics.avg_bars_to_resolution}
          </div>
          <div>
            <strong>Avg Time To Resolution Seconds:</strong>{" "}
            {runDetails.metrics.avg_time_to_resolution_seconds}
          </div>
          <div>
            <strong>Avg MFE:</strong> {runDetails.metrics.avg_mfe}
          </div>
          <div>
            <strong>Avg MAE:</strong> {runDetails.metrics.avg_mae}
          </div>
        </div>
      )}
    </div>
  );
}

export default RunMetricsCard;