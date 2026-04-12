// C:\TraderBotWeb\web\src\components\runs\run-history\data.ts

import type {
  AnalysisSnapshot,
  StageTestRunCaseItem,
  StageTestRunTechnicalAnalysis,
} from "../../../types/trading";
import { normalizeDisplayText } from "./normalizers";

export function toNumeric(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;

  const normalized = String(value).trim().replace(",", ".");
  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object") {
    return value as Record<string, unknown>;
  }

  return {};
}

export function getSnapshotCandle(
  snapshot: AnalysisSnapshot | null | undefined
): Record<string, unknown> {
  const record = asRecord(snapshot);
  return asRecord(record.candle);
}

export function getSnapshotMomentum(
  snapshot: AnalysisSnapshot | null | undefined
): Record<string, unknown> {
  const record = asRecord(snapshot);
  return asRecord(record.momentum);
}

export function getMomentumNumeric(
  snapshot: AnalysisSnapshot | null | undefined,
  ...keys: string[]
): number | null {
  const momentum = getSnapshotMomentum(snapshot);

  for (const key of keys) {
    const value = momentum[key];
    const numeric = toNumeric(
      typeof value === "string" || typeof value === "number" ? value : null
    );
    if (numeric != null) return numeric;
  }

  return null;
}

export function getCandleNumeric(
  snapshot: AnalysisSnapshot | null | undefined,
  ...keys: string[]
): number | null {
  const candle = getSnapshotCandle(snapshot);

  for (const key of keys) {
    const value = candle[key];
    const numeric = toNumeric(
      typeof value === "string" || typeof value === "number" ? value : null
    );
    if (numeric != null) return numeric;
  }

  return null;
}

export function findIndicatorValue(
  analysis: StageTestRunTechnicalAnalysis | null | undefined,
  candidateLabels: string[]
): string | null {
  const indicators = analysis?.indicators ?? [];
  if (indicators.length === 0) return null;

  const normalizedCandidates = candidateLabels.map((label) =>
    label.trim().toLowerCase()
  );

  for (const indicator of indicators) {
    const normalizedLabel = indicator.label.trim().toLowerCase();
    if (normalizedCandidates.includes(normalizedLabel)) {
      return indicator.value;
    }
  }

  return null;
}

export function findIndicatorNumeric(
  analysis: StageTestRunTechnicalAnalysis | null | undefined,
  candidateLabels: string[]
): number | null {
  const value = findIndicatorValue(analysis, candidateLabels);
  return toNumeric(value);
}

export function resolveCaseDirection(item: StageTestRunCaseItem): string {
  const rawSide = normalizeDisplayText(
    typeof item.side === "string" ? item.side : null
  );

  if (rawSide !== "-") {
    return rawSide;
  }

  const analysisDirection = normalizeDisplayText(item.analysis?.direction);

  if (analysisDirection !== "-") {
    return analysisDirection;
  }

  return "-";
}
