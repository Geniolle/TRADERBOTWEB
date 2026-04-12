// C:\TraderBotWeb\web\src\components\runs\run-history\types.ts

import type {
  AnalysisSnapshot,
  StageTestRunCaseItem,
  StageTestRunRuleItem,
  StageTestRunTechnicalAnalysis,
  StageTestSummaryItem,
} from "../../../types/trading";
import type { ExecutionLogStatus } from "../../../hooks/useStageTests";

export type RunHistoryCardProps = {
  sidebarCardStyle: React.CSSProperties;
  runSearch: string;
  setRunSearch: (value: string) => void;
  loadingRuns: boolean;
  runsError: string;
  actionError: string;
  filteredStageTests: StageTestSummaryItem[];
  selectedRunId: string;
  onClearRuns: () => Promise<void>;
  isClearingRuns: boolean;
  isCreatingRuns: boolean;
  lastExecutionLog: string;
  lastExecutionStatus: ExecutionLogStatus;
  runningStrategyKey: string;
  selectedSymbol: string;
  selectedTimeframe: string;
  onRunStageTest: (strategyKey: string) => Promise<void>;
};

export type CaseFilter = "all" | "hit" | "fail" | "timeout";
export type RuleVisualState = "confirmed" | "contrary" | "inactive" | "contextual";

export type TrendStrengthResult = {
  pct: number;
  direction: string;
  label: string;
  summary: string;
};

export type StrategicCaseFilters = {
  session: string;
  marketStructure: string;
  emaAlignment: string;
  priceVsEma20: string;
  priceVsEma40: string;
  ema20Slope: string;
  ema40Slope: string;
  entryLocation: string;
  rsiZone: string;
  rsiSlope: string;
  macdState: string;
  trendBias: string;
  signalQuality: string;
  trendStrengthPct: string;
  trendDirection: string;
  trendLabel: string;
};

export type TrendPanelMetric = {
  label: string;
  value: string;
};

export type TrendPanelData = {
  directionBadge: string;
  strengthPct: string;
  summaryTitle: string;
  summaryText: string;
  contextTitle: string;
  contextText: string;
  contextMetrics: TrendPanelMetric[];
  movingAveragesTitle: string;
  movingAveragesText: string;
  movingAveragesMetrics: TrendPanelMetric[];
  confirmationTitle: string;
  confirmationText: string;
  confirmationMetrics: TrendPanelMetric[];
  momentumTitle: string;
  momentumText: string;
  momentumMetrics: TrendPanelMetric[];
};

export type DirectionArrowVisual = {
  arrow: "↑" | "↓";
  color: string;
  border: string;
  background: string;
};

export type EmaDirectionSummary = {
  m9Value: string;
  m21Value: string;
  m9Arrow: DirectionArrowVisual;
  m21Arrow: DirectionArrowVisual;
  crossConfirmedLabel: string;
  crossConfirmedColor: string;
  crossConfirmedBackground: string;
  crossConfirmedBorder: string;
};

export type IndicatorItem = {
  label: string;
  value: string;
};

export type GroupedIndicators = {
  context: IndicatorItem[];
  trend: IndicatorItem[];
  momentum: IndicatorItem[];
  volatility: IndicatorItem[];
  structure: IndicatorItem[];
  candle: IndicatorItem[];
  other: IndicatorItem[];
};

export type AnalysisNarrative = {
  executiveSummary: string;
  positives: string[];
  negatives: string[];
  conflicts: string[];
};

export type TechnicalScore = {
  overall: number;
  trend: number;
  momentum: number;
  structure: number;
  entry: number;
  risk: number;
};

export type StatusBadge = {
  label: string;
  background: string;
  color: string;
  border: string;
};

export type AccentColors = {
  color: string;
  background: string;
  border: string;
};

export type DetailRowValue = React.ReactNode;

export type {
  AnalysisSnapshot,
  ExecutionLogStatus,
  StageTestRunCaseItem,
  StageTestRunRuleItem,
  StageTestRunTechnicalAnalysis,
  StageTestSummaryItem,
};
