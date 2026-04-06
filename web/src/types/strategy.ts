// web/src/types/strategy.ts

export type StrategyDirection = "buy" | "sell" | "neutral";

export type StrategyStatus =
  | "active"
  | "waiting_trigger"
  | "watching"
  | "weak"
  | "invalid";

export type StrategySetupType =
  | "pullback"
  | "continuation"
  | "breakout"
  | "reversal"
  | "cloud_rejection";

export type StrategyFactorImpact = "positive" | "neutral" | "negative";

export type StrategyFactor = {
  label: string;
  value: string;
  impact: StrategyFactorImpact;
};

export type StrategyCard = {
  id: string;
  title: string;
  direction: StrategyDirection;
  status: StrategyStatus;
  score: number;
  summary: string;
  setupType: StrategySetupType;
  idealZone?: string;
  trigger?: string;
  entry?: string;
  targets?: string[];
  invalidation?: string;
  rationale?: string;
  factors?: StrategyFactor[];
};

export type StrategySection = {
  title: string;
  subtitle: string;
  biasLabel: string;
  summaryLabel: string;
  topScore: number | null;
  cards: StrategyCard[];
};

export type MarketStrategyInput = {
  trendLabel?: string; // "Baixa" | "Alta" | "Consolidado"
  trendConfidence?: number; // 0-100

  currentPrice?: number;

  adxValue?: number;
  adxDirectionLabel?: string;

  rsiValue?: number;

  macdLine?: number;
  macdSignal?: number;
  macdHistogram?: number;
  macdBiasLabel?: string;

  volumeLabel?: string;

  cloudBiasLabel?: string; // "Preço abaixo da nuvem", etc.
  cloudTop?: number;
  cloudBase?: number;

  ema9?: number;
  ema21?: number;
  sma200?: number;
};