// C:\TraderBotWeb\web\src\components\runs\run-history\status.ts

import type { ExecutionLogStatus } from "../../../hooks/useStageTests";
import type { StageTestSummaryItem } from "../../../types/trading";
import type {
  DirectionArrowVisual,
  RuleVisualState,
} from "./types";
import { normalizeOutcome } from "./normalizers";

export function getDirectionAccent(direction: string): {
  color: string;
  background: string;
  border: string;
} {
  const normalized = direction.trim().toLowerCase();

  if (normalized === "compradora") {
    return {
      color: "#166534",
      background: "#f0fdf4",
      border: "#86efac",
    };
  }

  if (normalized === "vendedora") {
    return {
      color: "#991b1b",
      background: "#fef2f2",
      border: "#fca5a5",
    };
  }

  return {
    color: "#0f172a",
    background: "transparent",
    border: "transparent",
  };
}

export function getArrowVisual(isUp: boolean): DirectionArrowVisual {
  if (isUp) {
    return {
      arrow: "↑",
      color: "#166534",
      border: "#86efac",
      background: "#f0fdf4",
    };
  }

  return {
    arrow: "↓",
    color: "#991b1b",
    border: "#fca5a5",
    background: "#fef2f2",
  };
}

export function compareStageTestsByHitRate(
  left: StageTestSummaryItem,
  right: StageTestSummaryItem
): number {
  const leftHitRate = Number.isFinite(left.hit_rate) ? left.hit_rate : -1;
  const rightHitRate = Number.isFinite(right.hit_rate) ? right.hit_rate : -1;

  if (rightHitRate !== leftHitRate) {
    return rightHitRate - leftHitRate;
  }

  const leftRuns = Number.isFinite(left.total_runs) ? left.total_runs : 0;
  const rightRuns = Number.isFinite(right.total_runs) ? right.total_runs : 0;

  if (rightRuns !== leftRuns) {
    return rightRuns - leftRuns;
  }

  return left.strategy_name.localeCompare(right.strategy_name, "pt-PT", {
    sensitivity: "base",
  });
}

export function getStatusDotColor(status: ExecutionLogStatus): string {
  if (status === "running") return "#2563eb";
  if (status === "success") return "#16a34a";
  if (status === "error") return "#dc2626";
  if (status === "waiting") return "#d97706";
  return "#64748b";
}

export function getStatusBackground(status: ExecutionLogStatus): string {
  if (status === "running") return "#eff6ff";
  if (status === "success") return "#f0fdf4";
  if (status === "error") return "#fef2f2";
  if (status === "waiting") return "#fffbeb";
  return "#f8fafc";
}

export function getStatusBorder(status: ExecutionLogStatus): string {
  if (status === "running") return "#bfdbfe";
  if (status === "success") return "#bbf7d0";
  if (status === "error") return "#fecaca";
  if (status === "waiting") return "#fde68a";
  return "#cbd5e1";
}

export function getAnalysisStatusBadge(status: string | null | undefined) {
  const normalized = (status ?? "").trim().toLowerCase();

  if (normalized === "local_ok") {
    return {
      label: "Entrada validada",
      background: "#dcfce7",
      color: "#166534",
      border: "#86efac",
    };
  }

  if (normalized === "local_error") {
    return {
      label: "Run com erro",
      background: "#fee2e2",
      color: "#991b1b",
      border: "#fca5a5",
    };
  }

  if (normalized === "ready") {
    return {
      label: "Sem sinal",
      background: "#f1f5f9",
      color: "#475569",
      border: "#cbd5e1",
    };
  }

  if (normalized === "hit") {
    return {
      label: "Hit",
      background: "#dcfce7",
      color: "#166534",
      border: "#86efac",
    };
  }

  if (normalized === "fail") {
    return {
      label: "Fail",
      background: "#fee2e2",
      color: "#991b1b",
      border: "#fca5a5",
    };
  }

  if (normalized === "timeout") {
    return {
      label: "Timeout",
      background: "#fffbeb",
      color: "#92400e",
      border: "#fcd34d",
    };
  }

  return {
    label: status || "Sem estado",
    background: "#f8fafc",
    color: "#334155",
    border: "#cbd5e1",
  };
}

export function getOutcomeBadge(outcome: string | null | undefined) {
  const normalized = normalizeOutcome(outcome);

  if (normalized === "hit") {
    return {
      label: "HIT",
      background: "#dcfce7",
      color: "#166534",
      border: "#86efac",
    };
  }

  if (normalized === "fail") {
    return {
      label: "FAIL",
      background: "#fee2e2",
      color: "#991b1b",
      border: "#fca5a5",
    };
  }

  if (normalized === "timeout") {
    return {
      label: "TIMEOUT",
      background: "#fffbeb",
      color: "#92400e",
      border: "#fcd34d",
    };
  }

  return {
    label: outcome || "OUTRO",
    background: "#f8fafc",
    color: "#475569",
    border: "#cbd5e1",
  };
}

export function getRuleVisualState(
  rule: { label?: string | null; passed?: boolean | null },
  direction: string | null | undefined
): RuleVisualState {
  const normalizedDirection = (direction ?? "").trim().toLowerCase();
  const normalizedLabel = (rule?.label ?? "").trim().toLowerCase();
  const passed = rule?.passed;

  if (passed === false) {
    return "inactive";
  }

  if (passed == null) {
    return "contextual";
  }

  const isLongRule =
    normalizedLabel.includes("long") ||
    normalizedLabel.includes("comprador") ||
    normalizedLabel.includes("abaixo da banda inferior");

  const isShortRule =
    normalizedLabel.includes("short") ||
    normalizedLabel.includes("vendedor") ||
    normalizedLabel.includes("acima da banda superior");

  if (normalizedDirection === "buy" || normalizedDirection === "long") {
    if (isLongRule) return "confirmed";
    if (isShortRule) return "contrary";
  }

  if (normalizedDirection === "sell" || normalizedDirection === "short") {
    if (isShortRule) return "confirmed";
    if (isLongRule) return "contrary";
  }

  return "contextual";
}

export function getRuleStateStyles(state: RuleVisualState) {
  if (state === "confirmed") {
    return {
      background: "#ecfdf5",
      border: "#86efac",
      color: "#166534",
      label: "Confirmado",
    };
  }

  if (state === "contrary") {
    return {
      background: "#fff7ed",
      border: "#fdba74",
      color: "#9a3412",
      label: "Contrário",
    };
  }

  if (state === "inactive") {
    return {
      background: "#f8fafc",
      border: "#cbd5e1",
      color: "#64748b",
      label: "Inativo",
    };
  }

  return {
    background: "#eff6ff",
    border: "#93c5fd",
    color: "#1d4ed8",
    label: "Contextual",
  };
}

export function getConflictLevel(conflicts: number): string {
  if (conflicts <= 0) return "Baixo";
  if (conflicts === 1) return "Moderado";
  return "Alto";
}
