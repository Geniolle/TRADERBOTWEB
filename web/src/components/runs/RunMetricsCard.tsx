// C:\TraderBotWeb\web\src\components\runs\RunMetricsCard.tsx

import type { RunDetailsResponse } from "../../types/trading";

type RunMetricsCardProps = {
  mainCardStyle: React.CSSProperties;
  sectionTitleStyle: React.CSSProperties;
  runDetails: RunDetailsResponse | null;
};

type MetricsObject = {
  total_cases?: number;
  total_hits?: number;
  total_fails?: number;
  total_timeouts?: number;
  hit_rate?: number;
  fail_rate?: number;
  timeout_rate?: number;
  avg_bars_to_resolution?: number;
  avg_time_to_resolution_seconds?: number;
  avg_mfe?: number;
  avg_mae?: number;
};

function isMetricsObject(value: unknown): value is MetricsObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && value.trim()) return value;
  return "-";
}

function RunMetricsCard({
  mainCardStyle,
  sectionTitleStyle,
  runDetails,
}: RunMetricsCardProps) {
  const metrics = isMetricsObject(runDetails?.metrics) ? runDetails.metrics : null;

  return (
    <div style={mainCardStyle}>
      <h2 style={sectionTitleStyle}>Run Metrics</h2>

      {!runDetails && <div>Nenhum run selecionado.</div>}

      {runDetails && !metrics && (
        <div>Métricas indisponíveis para este run.</div>
      )}

      {runDetails && metrics && (
        <div
          style={{
            display: "grid",
            gap: 10,
            color: "#334155",
            fontSize: 14,
            lineHeight: 1.55,
          }}
        >
          <div>
            <strong>Total Cases:</strong> {formatValue(metrics.total_cases)}
          </div>
          <div>
            <strong>Total Hits:</strong> {formatValue(metrics.total_hits)}
          </div>
          <div>
            <strong>Total Fails:</strong> {formatValue(metrics.total_fails)}
          </div>
          <div>
            <strong>Total Timeouts:</strong> {formatValue(metrics.total_timeouts)}
          </div>
          <div>
            <strong>Hit Rate:</strong> {formatValue(metrics.hit_rate)}
          </div>
          <div>
            <strong>Fail Rate:</strong> {formatValue(metrics.fail_rate)}
          </div>
          <div>
            <strong>Timeout Rate:</strong> {formatValue(metrics.timeout_rate)}
          </div>
          <div>
            <strong>Avg Bars to Resolution:</strong>{" "}
            {formatValue(metrics.avg_bars_to_resolution)}
          </div>
          <div>
            <strong>Avg Time to Resolution Seconds:</strong>{" "}
            {formatValue(metrics.avg_time_to_resolution_seconds)}
          </div>
          <div>
            <strong>Avg MFE:</strong> {formatValue(metrics.avg_mfe)}
          </div>
          <div>
            <strong>Avg MAE:</strong> {formatValue(metrics.avg_mae)}
          </div>
        </div>
      )}
    </div>
  );
}

export default RunMetricsCard;