// web/src/services/buildStrategies.ts

import type {
  MarketStrategyInput,
  StrategyCard,
  StrategySection,
  StrategyStatus,
} from "../types/strategy";
import {
  calcDistancePercent,
  isBelow,
  roundScore,
} from "../utils/strategyHelpers";

function resolveBiasLabel(input: MarketStrategyInput): string {
  const trend = (input.trendLabel || "").toLowerCase();

  if (trend.includes("baixa")) return "Venda";
  if (trend.includes("alta")) return "Compra";
  return "Neutro";
}

function resolveStatus(score: number): StrategyStatus {
  if (score >= 85) return "active";
  if (score >= 70) return "waiting_trigger";
  if (score >= 55) return "watching";
  if (score >= 40) return "weak";
  return "invalid";
}

function buildPullbackStrategy(input: MarketStrategyInput): StrategyCard | null {
  const trend = (input.trendLabel || "").toLowerCase();
  const cloud = (input.cloudBiasLabel || "").toLowerCase();
  const macdBias = (input.macdBiasLabel || "").toLowerCase();
  const volume = (input.volumeLabel || "").toLowerCase();

  const currentPrice = input.currentPrice;
  const ema9 = input.ema9;
  const ema21 = input.ema21;

  const bearishTrend = trend.includes("baixa");
  const bullishTrend = trend.includes("alta");
  const belowCloud = cloud.includes("abaixo");
  const belowEma9 = isBelow(currentPrice, ema9);
  const belowEma21 = isBelow(currentPrice, ema21);

  const rsi = input.rsiValue ?? null;
  const adx = input.adxValue ?? null;
  const macdHistogram = input.macdHistogram ?? null;

  const distToEma9 = calcDistancePercent(currentPrice, ema9);
  const distToEma21 = calcDistancePercent(currentPrice, ema21);

  let score = 0;

  if (bearishTrend) score += 20;
  if (belowCloud) score += 15;
  if (belowEma9) score += 10;
  if (belowEma21) score += 10;

  if (rsi != null && rsi >= 38 && rsi <= 50) {
    score += 15;
  } else if (rsi != null && rsi > 50 && rsi <= 56) {
    score += 5;
  } else if (rsi != null && rsi < 35) {
    score -= 10;
  }

  if (adx != null && adx >= 18 && adx <= 28) {
    score += 10;
  } else if (adx != null && adx < 15) {
    score -= 10;
  } else if (adx != null && adx > 35) {
    score -= 5;
  }

  if (macdBias.includes("vendedor")) score += 10;
  if (macdHistogram != null && macdHistogram < 0) score += 5;
  if (macdBias.includes("comprador")) score -= 12;

  if (distToEma9 != null && Math.abs(distToEma9) <= 0.05) score += 5;
  if (distToEma21 != null && Math.abs(distToEma21) <= 0.1) score += 5;

  if (volume.includes("inconclusivo")) score -= 8;
  if (distToEma21 != null && Math.abs(distToEma21) > 0.2) score -= 10;
  if (bullishTrend) score -= 30;

  score = roundScore(score);

  if (score < 45) return null;

  const status = resolveStatus(score);

  return {
    id: "strategy-pullback",
    title: "Pullback",
    direction: bearishTrend ? "sell" : "neutral",
    status,
    score,
    summary: bearishTrend
      ? "Venda em repique até as médias, a favor da estrutura vendedora."
      : "Retorno técnico à média, mas sem alinhamento forte com o contexto.",
    setupType: "pullback",
    idealZone: "MME 9 / MME 21",
    trigger:
      "Toque ou aproximação da média com rejeição, pavio superior ou falha em fechar acima.",
    entry:
      "Entrada após confirmação da rejeição, preferencialmente na região da MME 21.",
    targets: ["Mínima anterior", "Base da nuvem"],
    invalidation:
      "Fecho acima da MME 21 com aceitação e perda da estrutura vendedora.",
    rationale: bearishTrend
      ? "O preço mantém-se abaixo das médias e abaixo da nuvem. O ADX sugere espaço para respiração do mercado antes de nova continuação, e o RSI ainda não indica esgotamento vendedor."
      : "Há alguns sinais de retorno à média, mas o contexto geral não favorece tanto a execução.",
    factors: [
      {
        label: "Tendência",
        value: input.trendLabel || "--",
        impact: bearishTrend ? "positive" : "negative",
      },
      {
        label: "Preço vs MME 9",
        value: belowEma9 ? "Abaixo" : "Acima",
        impact: belowEma9 ? "positive" : "negative",
      },
      {
        label: "Preço vs MME 21",
        value: belowEma21 ? "Abaixo" : "Acima",
        impact: belowEma21 ? "positive" : "negative",
      },
      {
        label: "RSI",
        value: rsi != null ? String(rsi).replace(".", ",") : "--",
        impact:
          rsi != null && rsi >= 38 && rsi <= 50 ? "positive" : "neutral",
      },
      {
        label: "ADX",
        value: adx != null ? String(adx).replace(".", ",") : "--",
        impact:
          adx != null && adx >= 18 && adx <= 28 ? "positive" : "neutral",
      },
      {
        label: "Volume",
        value: input.volumeLabel || "--",
        impact: volume.includes("inconclusivo") ? "neutral" : "positive",
      },
    ],
  };
}

function buildContinuationStrategy(
  input: MarketStrategyInput,
): StrategyCard | null {
  const trend = (input.trendLabel || "").toLowerCase();
  const macdBias = (input.macdBiasLabel || "").toLowerCase();
  const cloud = (input.cloudBiasLabel || "").toLowerCase();

  const bearishTrend = trend.includes("baixa");
  const belowCloud = cloud.includes("abaixo");
  const rsi = input.rsiValue ?? null;
  const adx = input.adxValue ?? null;

  let score = 0;

  if (bearishTrend) score += 20;
  if (belowCloud) score += 15;
  if (macdBias.includes("vendedor")) score += 15;
  if (adx != null && adx >= 20 && adx <= 35) score += 15;
  if (rsi != null && rsi >= 35 && rsi <= 48) score += 12;
  if (
    input.currentPrice != null &&
    input.ema9 != null &&
    input.currentPrice < input.ema9
  ) {
    score += 10;
  }

  if (adx != null && adx < 18) score -= 10;
  if (rsi != null && rsi < 32) score -= 10;

  score = roundScore(score);

  if (score < 45) return null;

  const status = resolveStatus(score);

  return {
    id: "strategy-continuation",
    title: "Continuação",
    direction: bearishTrend ? "sell" : "neutral",
    status,
    score,
    summary:
      "Continuação do movimento principal após confirmação de pressão vendedora.",
    setupType: "continuation",
    idealZone: "Perda da mínima recente / reteste falhado",
    trigger: "Rompimento da mínima com continuidade e sem recuperação imediata.",
    entry: "Venda após perda da estrutura curta ou falha de recuperação.",
    targets: ["Nova mínima intradiária", "Extensão do impulso"],
    invalidation:
      "Recuperação da MME 9 com aceitação e enfraquecimento do momentum.",
    rationale:
      "A estratégia de continuação depende de o mercado voltar a acelerar a favor da tendência atual, sem necessidade de repique profundo.",
    factors: [
      {
        label: "Tendência",
        value: input.trendLabel || "--",
        impact: bearishTrend ? "positive" : "negative",
      },
      {
        label: "MACD",
        value: input.macdBiasLabel || "--",
        impact: macdBias.includes("vendedor") ? "positive" : "neutral",
      },
      {
        label: "ADX",
        value:
          input.adxValue != null
            ? String(input.adxValue).replace(".", ",")
            : "--",
        impact: adx != null && adx >= 20 ? "positive" : "neutral",
      },
    ],
  };
}

function buildBreakoutStrategy(input: MarketStrategyInput): StrategyCard | null {
  const trend = (input.trendLabel || "").toLowerCase();
  const bearishTrend = trend.includes("baixa");
  const adx = input.adxValue ?? null;
  const macdBias = (input.macdBiasLabel || "").toLowerCase();

  let score = 0;

  if (bearishTrend) score += 20;
  if (macdBias.includes("vendedor")) score += 15;
  if (adx != null && adx >= 22) score += 18;
  if (
    input.currentPrice != null &&
    input.ema9 != null &&
    input.currentPrice < input.ema9
  ) {
    score += 10;
  }

  if (adx != null && adx < 18) score -= 10;
  if ((input.volumeLabel || "").toLowerCase().includes("inconclusivo")) {
    score -= 10;
  }

  score = roundScore(score);

  if (score < 45) return null;

  const status = resolveStatus(score);

  return {
    id: "strategy-breakout",
    title: "Rompimento",
    direction: bearishTrend ? "sell" : "neutral",
    status,
    score,
    summary:
      "Entrada em quebra de estrutura, desde que haja continuação real e não falso rompimento.",
    setupType: "breakout",
    idealZone: "Mínima relevante do intraday",
    trigger: "Quebra da mínima com continuidade logo a seguir.",
    entry: "Venda na perda da estrutura ou no reteste falhado do rompimento.",
    targets: ["Expansão do movimento", "Nova mínima do dia"],
    invalidation: "Retorno rápido para dentro da estrutura rompida.",
    rationale:
      "Funciona melhor quando o mercado deixa de apenas corrigir e volta a acelerar a favor da tendência principal.",
    factors: [
      {
        label: "ADX",
        value:
          input.adxValue != null
            ? String(input.adxValue).replace(".", ",")
            : "--",
        impact: adx != null && adx >= 22 ? "positive" : "neutral",
      },
      {
        label: "MACD",
        value: input.macdBiasLabel || "--",
        impact: macdBias.includes("vendedor") ? "positive" : "neutral",
      },
    ],
  };
}

export function buildStrategySection(
  input: MarketStrategyInput,
): StrategySection {
  const cards = [
    buildPullbackStrategy(input),
    buildContinuationStrategy(input),
    buildBreakoutStrategy(input),
  ]
    .filter((card): card is StrategyCard => Boolean(card))
    .sort((a, b) => b.score - a.score);

  const validCards = cards.filter((card) => card.status !== "invalid");
  const activeCount = cards.filter((card) => card.status === "active").length;
  const waitingCount = cards.filter(
    (card) => card.status === "waiting_trigger",
  ).length;

  let summaryLabel = "Sem setup limpo neste momento.";

  if (activeCount > 0) {
    summaryLabel = `${activeCount} estratégia ativa no contexto atual`;
  } else if (waitingCount > 0) {
    summaryLabel = `${waitingCount} estratégia em aguardando gatilho`;
  } else if (validCards.length > 0) {
    summaryLabel = `${validCards.length} estratégia(s) em observação`;
  }

  return {
    title: "Estratégias",
    subtitle: "Setups compatíveis com o contexto atual",
    biasLabel: resolveBiasLabel(input),
    summaryLabel,
    topScore: cards.length > 0 ? cards[0].score : null,
    cards,
  };
}