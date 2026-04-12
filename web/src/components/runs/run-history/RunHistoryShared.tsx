// C:\TraderBotWeb\web\src\components\runs\run-history\RunHistoryShared.tsx

import type { ReactNode } from "react";
import { getRuleStateStyles } from "./utils";
import type { RuleVisualState } from "./types";

type MetricPillProps = {
  label: string;
  value: string | number;
  accentColor: string;
  backgroundColor: string;
};

type DetailRowProps = {
  label: string;
  value: ReactNode;
};

type AnalysisSectionProps = {
  title: string;
  children: ReactNode;
};

type AnalysisMetricCardProps = {
  label: string;
  value: string;
};

type ScoreBoxProps = {
  label: string;
  value: number;
};

type RulePillProps = {
  label: string;
  state: RuleVisualState;
  value?: string;
};

type CasesFilterButtonProps = {
  active: boolean;
  label: string;
  onClick: () => void;
};

export function MetricPill({
  label,
  value,
  accentColor,
  backgroundColor,
}: MetricPillProps) {
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

export function DetailRow({ label, value }: DetailRowProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "max-content minmax(0, 1fr)",
        columnGap: 8,
        alignItems: "start",
        justifyItems: "start",
        width: "100%",
        textAlign: "left",
      }}
    >
      <span
        style={{
          color: "#64748b",
          fontSize: 12,
          textAlign: "left",
          justifySelf: "start",
          alignSelf: "start",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>

      <div
        style={{
          color: "#0f172a",
          fontSize: 12,
          fontWeight: 600,
          wordBreak: "break-word",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "flex-start",
          textAlign: "left",
          justifySelf: "start",
          alignSelf: "start",
          width: "100%",
          minWidth: 0,
        }}
      >
        {value}
      </div>
    </div>
  );
}

export function AnalysisSection({
  title,
  children,
}: AnalysisSectionProps) {
  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        padding: 12,
        background: "#ffffff",
        display: "grid",
        gap: 10,
      }}
    >
      <div
        style={{
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

export function AnalysisMetricCard({
  label,
  value,
}: AnalysisMetricCardProps) {
  return (
    <div
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
          lineHeight: 1.2,
        }}
      >
        {label}
      </span>

      <strong
        style={{
          fontSize: 13,
          color: "#0f172a",
          lineHeight: 1.3,
          wordBreak: "break-word",
        }}
      >
        {value}
      </strong>
    </div>
  );
}

export function ScoreBox({ label, value }: ScoreBoxProps) {
  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 10,
        padding: 12,
        background: "#ffffff",
        display: "grid",
        gap: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 8,
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: 12, color: "#475569", fontWeight: 600 }}>
          {label}
        </span>
        <strong style={{ fontSize: 13, color: "#0f172a" }}>
          {value.toFixed(1)}/10
        </strong>
      </div>

      <div
        style={{
          height: 8,
          borderRadius: 999,
          background: "#e2e8f0",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${Math.max(0, Math.min(100, value * 10))}%`,
            height: "100%",
            background: "#0f172a",
          }}
        />
      </div>
    </div>
  );
}

export function RulePill({ label, state, value }: RulePillProps) {
  const styles = getRuleStateStyles(state);

  return (
    <div
      style={{
        border: `1px solid ${styles.border}`,
        borderRadius: 10,
        padding: "10px 12px",
        background: styles.background,
        display: "grid",
        gap: 4,
      }}
    >
      <strong
        style={{
          fontSize: 12,
          color: styles.color,
          lineHeight: 1.35,
          wordBreak: "break-word",
        }}
      >
        {label}
      </strong>

      <span
        style={{
          fontSize: 11,
          color: styles.color,
          fontWeight: 700,
        }}
      >
        {styles.label}
      </span>

      {value ? (
        <span
          style={{
            fontSize: 11,
            color: styles.color,
            opacity: 0.9,
            wordBreak: "break-word",
          }}
        >
          {value}
        </span>
      ) : null}
    </div>
  );
}

export function CasesFilterButton({
  active,
  label,
  onClick,
}: CasesFilterButtonProps) {
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