// C:\TraderBotWeb\web\src\components\runs\run-history\TrendPanels.tsx

import { AnalysisMetricCard, AnalysisSection } from "./RunHistoryShared";
import { buildTrendPanelData, calculateTrendStrength, formatCompactPercent } from "./utils";
import type { StageTestRunTechnicalAnalysis } from "./types";

export function TrendInlineHeader({
  analysis,
}: {
  analysis: StageTestRunTechnicalAnalysis | null;
}) {
  const trend = calculateTrendStrength(analysis);

  return (
    <div
      style={{
        border: "1px solid #bbf7d0",
        borderRadius: 12,
        padding: "10px 12px",
        background: "#f0fdf4",
        display: "grid",
        gap: 4,
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
        <strong style={{ fontSize: 15, color: "#166534" }}>Tendência</strong>

        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            padding: "2px 8px",
            borderRadius: 999,
            border: "1px solid #86efac",
            background: "#ffffff",
            color: "#166534",
          }}
        >
          {trend.label}
        </span>

        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            padding: "2px 8px",
            borderRadius: 999,
            border: "1px solid #86efac",
            background: "#ffffff",
            color: "#166534",
          }}
        >
          {formatCompactPercent(trend.pct)}
        </span>
      </div>

      <span
        style={{
          fontSize: 12,
          color: "#166534",
          lineHeight: 1.45,
        }}
      >
        {trend.summary}
      </span>
    </div>
  );
}

export function TrendSummaryPanel({
  analysis,
}: {
  analysis: StageTestRunTechnicalAnalysis | null;
}) {
  const panel = buildTrendPanelData(analysis);

  return (
    <div
      style={{
        border: "1px solid #bbf7d0",
        borderRadius: 14,
        padding: 12,
        background: "#f0fdf4",
        display: "grid",
        gap: 12,
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
        <div style={{ display: "grid", gap: 4 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <strong style={{ fontSize: 16, color: "#166534" }}>
              {panel.summaryTitle}
            </strong>

            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: 999,
                border: "1px solid #86efac",
                background: "#ffffff",
                color: "#166534",
              }}
            >
              {panel.directionBadge}
            </span>

            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: 999,
                border: "1px solid #86efac",
                background: "#ffffff",
                color: "#166534",
              }}
            >
              {panel.strengthPct}
            </span>
          </div>

          <span
            style={{
              fontSize: 12,
              color: "#166534",
              lineHeight: 1.45,
            }}
          >
            {panel.summaryText}
          </span>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.1fr 1.1fr",
          gap: 12,
          alignItems: "start",
        }}
      >
        <div style={{ display: "grid", gap: 12 }}>
          <AnalysisSection title={panel.contextTitle}>
            <div
              style={{
                fontSize: 12,
                color: "#475569",
                lineHeight: 1.5,
              }}
            >
              {panel.contextText}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: 8,
              }}
            >
              {panel.contextMetrics.map((item) => (
                <AnalysisMetricCard
                  key={`context-${item.label}`}
                  label={item.label}
                  value={item.value}
                />
              ))}
            </div>
          </AnalysisSection>

          <AnalysisSection title={panel.confirmationTitle}>
            <div
              style={{
                fontSize: 12,
                color: "#475569",
                lineHeight: 1.5,
              }}
            >
              {panel.confirmationText}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: 8,
              }}
            >
              {panel.confirmationMetrics.map((item) => (
                <AnalysisMetricCard
                  key={`confirmation-${item.label}`}
                  label={item.label}
                  value={item.value}
                />
              ))}
            </div>
          </AnalysisSection>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          <AnalysisSection title={panel.movingAveragesTitle}>
            <div
              style={{
                fontSize: 12,
                color: "#475569",
                lineHeight: 1.5,
              }}
            >
              {panel.movingAveragesText}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: 8,
              }}
            >
              {panel.movingAveragesMetrics.map((item) => (
                <AnalysisMetricCard
                  key={`moving-avg-${item.label}`}
                  label={item.label}
                  value={item.value}
                />
              ))}
            </div>
          </AnalysisSection>

          <AnalysisSection title={panel.momentumTitle}>
            <div
              style={{
                fontSize: 12,
                color: "#475569",
                lineHeight: 1.5,
              }}
            >
              {panel.momentumText}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: 8,
              }}
            >
              {panel.momentumMetrics.map((item) => (
                <AnalysisMetricCard
                  key={`momentum-${item.label}`}
                  label={item.label}
                  value={item.value}
                />
              ))}
            </div>
          </AnalysisSection>
        </div>
      </div>
    </div>
  );
}
