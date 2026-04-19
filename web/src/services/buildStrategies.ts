// web/src/services/buildStrategies.ts

import type {
  MarketStrategyInput,
  StrategyCard,
  StrategySection,
  StrategyStatus,
} from "../types/strategy";
import {
  calcDistancePercent,
  isAbove,
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

function formatMaybeNumber(value?: number): string {
  if (value == null || Number.isNaN(value)) return "--";
  return value.toLocaleString("pt-PT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPercentValue(value: number | null): string {
  if (value == null || Number.isNaN(value)) return "--";
  return `${value.toLocaleString("pt-PT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

function buildPullbackStrategy(input: MarketStrategyInput): StrategyCard {
  const trend = (input.trendLabel || "").toLowerCase();
  const cloud = (input.cloudBiasLabel || "").toLowerCase();
  const macdBias = (input.macdBiasLabel || "").toLowerCase();
  const volume = (input.volumeLabel || "").toLowerCase();

  const currentPrice = input.currentPrice;
  const ema9 = input.ema9;
  const ema21 = input.ema21;
  const rsi = input.rsiValue;
  const adx = input.adxValue;
  const macdHistogram = input.macdHistogram;

  const bullishTrend = trend.includes("alta");
  const bearishTrend = trend.includes("baixa");
  const neutralTrend = !bullishTrend && !bearishTrend;

  const aboveCloud = cloud.includes("acima");
  const belowCloud = cloud.includes("abaixo");

  const aboveEma9 = isAbove(currentPrice, ema9);
  const aboveEma21 = isAbove(currentPrice, ema21);
  const belowEma9 = isBelow(currentPrice, ema9);
  const belowEma21 = isBelow(currentPrice, ema21);

  const distToEma9 = calcDistancePercent(currentPrice, ema9);
  const distToEma21 = calcDistancePercent(currentPrice, ema21);

  let score = 0;
  let direction: StrategyCard["direction"] = "neutral";
  let summary =
    "O mercado ainda não oferece contexto direcional suficientemente limpo para um pullback forte.";
  let trigger =
    "Esperar aproximação às médias e rejeição clara antes de considerar entrada.";
  let entry =
    "Sem entrada imediata. Aguardar formação do repique e reação na zona das médias.";
  let targets = ["Estrutura recente", "Continuação do movimento"];
  let invalidation = "Perda do contexto direcional.";
  let rationale =
    "O card permanece visível para mostrar quando o contexto começar a aproximar-se de um pullback operacional.";

  if (bullishTrend) {
    direction = "buy";
    score += 22;
    if (aboveCloud) score += 14;
    if (aboveEma9) score += 10;
    if (aboveEma21) score += 10;

    if (rsi != null && rsi >= 50 && rsi <= 62) score += 15;
    else if (rsi != null && rsi >= 46 && rsi < 50) score += 7;
    else if (rsi != null && rsi > 68) score -= 10;

    if (adx != null && adx >= 18 && adx <= 30) score += 10;
    else if (adx != null && adx < 15) score -= 8;
    else if (adx != null && adx > 35) score -= 5;

    if (macdBias.includes("compr")) score += 10;
    if (macdHistogram != null && macdHistogram > 0) score += 5;
    if (macdBias.includes("vend")) score -= 12;

    if (distToEma9 != null && Math.abs(distToEma9) <= 0.08) score += 7;
    if (distToEma21 != null && Math.abs(distToEma21) <= 0.12) score += 7;
    if (distToEma21 != null && Math.abs(distToEma21) > 0.25) score -= 10;

    if (volume.includes("inconclusivo")) score -= 6;

    summary =
      "Compra em recuo até as médias, aproveitando o retorno técnico dentro de um contexto comprador.";
    trigger =
      "Preço recua até MME 9 ou MME 21 e mostra rejeição compradora, com pavio inferior ou fecho de reação.";
    entry =
      "Entrada após confirmação da reação compradora na zona da MME 9 ou, preferencialmente, MME 21.";
    targets = ["Máxima anterior", "Extensão do impulso comprador"];
    invalidation =
      "Fecho abaixo da MME 21 com aceitação e quebra da estrutura compradora.";
    rationale =
      "O preço mantém-se acima das médias e o pullback tende a funcionar melhor quando o mercado respira sem perder o contexto de alta.";
  } else if (bearishTrend) {
    direction = "sell";
    score += 22;
    if (belowCloud) score += 14;
    if (belowEma9) score += 10;
    if (belowEma21) score += 10;

    if (rsi != null && rsi >= 38 && rsi <= 50) score += 15;
    else if (rsi != null && rsi > 50 && rsi <= 56) score += 7;
    else if (rsi != null && rsi < 35) score -= 10;

    if (adx != null && adx >= 18 && adx <= 30) score += 10;
    else if (adx != null && adx < 15) score -= 8;
    else if (adx != null && adx > 35) score -= 5;

    if (macdBias.includes("vend")) score += 10;
    if (macdHistogram != null && macdHistogram < 0) score += 5;
    if (macdBias.includes("compr")) score -= 12;

    if (distToEma9 != null && Math.abs(distToEma9) <= 0.08) score += 7;
    if (distToEma21 != null && Math.abs(distToEma21) <= 0.12) score += 7;
    if (distToEma21 != null && Math.abs(distToEma21) > 0.25) score -= 10;

    if (volume.includes("inconclusivo")) score -= 6;

    summary =
      "Venda em repique até as médias, aproveitando o retorno técnico dentro de um contexto vendedor.";
    trigger =
      "Preço sobe até MME 9 ou MME 21 e mostra rejeição vendedora, com pavio superior ou falha em fechar acima.";
    entry =
      "Entrada após confirmação da rejeição vendedora na zona da MME 9 ou, preferencialmente, MME 21.";
    targets = ["Mínima anterior", "Extensão do impulso vendedor"];
    invalidation =
      "Fecho acima da MME 21 com aceitação e quebra da estrutura vendedora.";
    rationale =
      "O preço mantém-se abaixo das médias e o pullback tende a funcionar melhor quando o mercado respira sem recuperar a estrutura.";
  } else if (neutralTrend) {
    if (adx != null && adx < 20) score += 12;
    if (distToEma9 != null && Math.abs(distToEma9) <= 0.08) score += 8;
    if (distToEma21 != null && Math.abs(distToEma21) <= 0.12) score += 8;
    if (rsi != null && rsi >= 45 && rsi <= 55) score += 8;

    summary =
      "O mercado está neutro. O pullback ainda não está validado, mas o card acompanha a aproximação das condições.";
    trigger =
      "Aguardar definição de direção e reação limpa na zona das médias.";
    entry =
      "Sem entrada recomendada enquanto a tendência continuar neutra ou consolidada.";
    targets = ["Aguardar direção", "Confirmação estrutural"];
    invalidation = "Continuação da lateralização sem direção dominante.";
    rationale =
      "Neste estado, o card serve mais como radar de preparação do que como sinal operacional.";
  }

  score = roundScore(score);
  const status = resolveStatus(score);

  return {
    id: "strategy-pullback",
    title: "Pullback",
    direction,
    status,
    score,
    summary,
    setupType: "pullback",
    idealZone: "MME 9 / MME 21",
    trigger,
    entry,
    targets,
    invalidation,
    rationale,
    factors: [
      {
        label: "Tendência alinhada",
        value: bullishTrend
          ? "Sim, alta"
          : bearishTrend
            ? "Sim, baixa"
            : "Não, neutra",
        impact: bullishTrend || bearishTrend ? "positive" : "neutral",
      },
      {
        label: "Preço em relação à MME 9",
        value:
          bullishTrend && aboveEma9
            ? "Acima"
            : bearishTrend && belowEma9
              ? "Abaixo"
              : "Sem alinhamento",
        impact:
          (bullishTrend && aboveEma9) || (bearishTrend && belowEma9)
            ? "positive"
            : "neutral",
      },
      {
        label: "Preço em relação à MME 21",
        value:
          bullishTrend && aboveEma21
            ? "Acima"
            : bearishTrend && belowEma21
              ? "Abaixo"
              : "Sem alinhamento",
        impact:
          (bullishTrend && aboveEma21) || (bearishTrend && belowEma21)
            ? "positive"
            : "neutral",
      },
      {
        label: "RSI em zona útil",
        value:
          rsi == null
            ? "--"
            : bullishTrend
              ? rsi >= 50 && rsi <= 62
                ? `Sim (${formatMaybeNumber(rsi)})`
                : `Não (${formatMaybeNumber(rsi)})`
              : bearishTrend
                ? rsi >= 38 && rsi <= 50
                  ? `Sim (${formatMaybeNumber(rsi)})`
                  : `Não (${formatMaybeNumber(rsi)})`
                : formatMaybeNumber(rsi),
        impact:
          rsi != null &&
          ((bullishTrend && rsi >= 50 && rsi <= 62) ||
            (bearishTrend && rsi >= 38 && rsi <= 50))
            ? "positive"
            : "neutral",
      },
      {
        label: "ADX favorece respiração",
        value:
          adx == null
            ? "--"
            : adx >= 18 && adx <= 30
              ? `Sim (${formatMaybeNumber(adx)})`
              : `Não (${formatMaybeNumber(adx)})`,
        impact:
          adx != null && adx >= 18 && adx <= 30 ? "positive" : "neutral",
      },
      {
        label: "Distância para MME 21",
        value: formatPercentValue(distToEma21),
        impact:
          distToEma21 != null && Math.abs(distToEma21) <= 0.12
            ? "positive"
            : "neutral",
      },
      {
        label: "Volume",
        value: input.volumeLabel || "--",
        impact: volume.includes("inconclusivo") ? "neutral" : "positive",
      },
    ],
  };
}

function buildRangeBreakoutStrategy(input: MarketStrategyInput): StrategyCard {
  const trend = (input.trendLabel || "").toLowerCase();
  const macdBias = (input.macdBiasLabel || "").toLowerCase();

  const adx = input.adxValue;
  const rsi = input.rsiValue;
  const currentPrice = input.currentPrice;
  const ema9 = input.ema9;
  const ema21 = input.ema21;
  const macdHistogram = input.macdHistogram;

  const bearishTrend = trend.includes("baixa");
  const neutralTrend =
    trend.includes("consolid") ||
    trend.includes("lateral") ||
    trend.includes("neutro");

  const belowEma9 = isBelow(currentPrice, ema9);
  const belowEma21 = isBelow(currentPrice, ema21);

  let score = 0;
  let rationale =
    "Quando o ADX está baixo, o mercado tende a comprimir energia. O rompimento com ADX a subir e MACD a acelerar para baixo ajuda a confirmar libertação dessa energia do lado vendedor.";

  const direction: StrategyCard["direction"] = "sell";
  const summary =
    "Estratégia de rompimento de range para venda, aguardando libertação de energia após lateralização.";
  const trigger =
    "Só considerar a entrada quando a mínima recente for rompida com ADX a sair da lateralização e MACD a aumentar a aceleração negativa.";
  const entry =
    "Venda apenas após rompimento confirmado da mínima do range, com ADX a ganhar força acima de 25.";
  const targets = ["Expansão do range", "Nova mínima intradiária"];
  const invalidation =
    "Falha no rompimento, retorno para dentro do range ou perda da aceleração negativa no MACD.";

  if (neutralTrend || bearishTrend) score += 18;
  if (adx != null && adx >= 18 && adx <= 24.99) score += 20;
  else if (adx != null && adx >= 25 && adx <= 32) score += 12;
  else if (adx != null && adx < 15) score -= 8;
  else if (adx != null && adx > 35) score -= 6;

  if (macdBias.includes("vend")) score += 12;
  if (macdHistogram != null && macdHistogram < 0) score += 12;
  if (macdHistogram != null && macdHistogram < -0.00005) score += 8;
  if (macdBias.includes("compr")) score -= 14;

  if (belowEma9) score += 8;
  if (belowEma21) score += 8;

  if (rsi != null && rsi >= 38 && rsi <= 52) score += 8;
  else if (rsi != null && rsi < 32) score -= 8;

  if (!bearishTrend && !neutralTrend) {
    score -= 14;
    rationale =
      "A ideia continua válida como setup de breakout, mas o contexto atual não favorece venda com a mesma qualidade.";
  }

  score = roundScore(score);
  const status = resolveStatus(score);

  return {
    id: "strategy-range-breakout",
    title: "Rompimento de Range",
    direction,
    status,
    score,
    summary,
    setupType: "breakout",
    idealZone: "Mínima dos últimos candles / base do pequeno caixote",
    trigger,
    entry,
    targets,
    invalidation,
    rationale,
    factors: [
      {
        label: "Mercado em range",
        value: neutralTrend
          ? "Sim, lateral/consolidado"
          : bearishTrend
            ? "Parcial, com viés de baixa"
            : "Não claro",
        impact: neutralTrend || bearishTrend ? "positive" : "neutral",
      },
      {
        label: "ADX em zona de compressão",
        value:
          adx == null
            ? "--"
            : adx >= 18 && adx <= 24.99
              ? `Sim (${formatMaybeNumber(adx)})`
              : `Não (${formatMaybeNumber(adx)})`,
        impact:
          adx != null && adx >= 18 && adx <= 24.99 ? "positive" : "neutral",
      },
      {
        label: "ADX preparado para subir > 25",
        value:
          adx == null
            ? "--"
            : adx >= 22
              ? `Próximo (${formatMaybeNumber(adx)})`
              : `Ainda baixo (${formatMaybeNumber(adx)})`,
        impact: adx != null && adx >= 22 ? "positive" : "neutral",
      },
      {
        label: "MACD em aceleração negativa",
        value:
          macdHistogram == null
            ? "--"
            : macdHistogram < 0
              ? `Sim (${formatMaybeNumber(macdHistogram)})`
              : `Não (${formatMaybeNumber(macdHistogram)})`,
        impact:
          macdHistogram != null && macdHistogram < 0 ? "positive" : "neutral",
      },
      {
        label: "Preço abaixo da MME 9",
        value: belowEma9 ? "Sim" : "Não",
        impact: belowEma9 ? "positive" : "neutral",
      },
      {
        label: "Preço abaixo da MME 21",
        value: belowEma21 ? "Sim" : "Não",
        impact: belowEma21 ? "positive" : "neutral",
      },
      {
        label: "RSI sem sobrevenda extrema",
        value:
          rsi == null
            ? "--"
            : rsi >= 38 && rsi <= 52
              ? `Sim (${formatMaybeNumber(rsi)})`
              : `Não (${formatMaybeNumber(rsi)})`,
        impact:
          rsi != null && rsi >= 38 && rsi <= 52 ? "positive" : "neutral",
      },
    ],
  };
}

function buildFadeStrategy(input: MarketStrategyInput): StrategyCard {
  const trend = (input.trendLabel || "").toLowerCase();
  const macdBias = (input.macdBiasLabel || "").toLowerCase();
  const volume = (input.volumeLabel || "").toLowerCase();

  const adx = input.adxValue;
  const rsi = input.rsiValue;
  const currentPrice = input.currentPrice;
  const ema9 = input.ema9;
  const macdHistogram = input.macdHistogram;

  const bearishTrend = trend.includes("baixa");
  const weakAdx = adx != null && adx >= 18 && adx <= 23;

  const belowEma9 = isBelow(currentPrice, ema9);
  const distToEma9 = calcDistancePercent(currentPrice, ema9);
  const farFromEma9 = distToEma9 != null && distToEma9 <= -0.08;

  let score = 0;
  let rationale =
    "É uma operação agressiva de scalp e contra o fluxo principal. Só faz sentido quando a tendência segue de baixa, mas a força da queda é curta e o preço já está demasiado esticado.";

  const direction: StrategyCard["direction"] = "buy";
  const summary =
    "Scalp de contra-tendência para capturar apenas o retorno do preço até a MME 9 quando a baixa perde força no curtíssimo prazo.";
  const trigger =
    "RSI próximo de 30 com preço esticado para baixo e sem força suficiente no ADX para sustentar nova queda limpa.";
  const entry =
    "Compra curta apenas quando o RSI estiver perto de 30 e o preço estiver claramente afastado da MME 9.";
  const targets = ["Retorno até a MME 9", "Alívio técnico curto"];
  const invalidation =
    "Continuação da queda com ADX a acelerar, perda de fundo sem reação ou MACD a expandir fortemente a aceleração negativa.";

  if (bearishTrend) score += 18;
  if (weakAdx) score += 18;
  if (rsi != null && rsi <= 33) score += 24;
  else if (rsi != null && rsi <= 36) score += 12;
  else if (rsi != null && rsi > 40) score -= 10;

  if (belowEma9) score += 8;
  if (farFromEma9) score += 18;
  else if (distToEma9 != null && distToEma9 > -0.03) score -= 8;

  if (adx != null && adx >= 25) score -= 18;
  if (macdBias.includes("vend")) score -= 6;
  if (macdHistogram != null && macdHistogram < -0.00008) score -= 10;
  if (volume.includes("inconclusivo")) score -= 4;

  if (!bearishTrend) {
    score -= 12;
    rationale =
      "Sem tendência de baixa dominante, a lógica do fade perde qualidade porque deixa de ser uma reação contra um fluxo principal identificado.";
  }

  score = roundScore(score);
  const status = resolveStatus(score);

  return {
    id: "strategy-fade",
    title: "Fade",
    direction,
    status,
    score,
    summary,
    setupType: "reversal",
    idealZone: "Região de exaustão abaixo da MME 9",
    trigger,
    entry,
    targets,
    invalidation,
    rationale,
    factors: [
      {
        label: "Tendência principal é baixa",
        value: bearishTrend ? "Sim" : "Não",
        impact: bearishTrend ? "positive" : "negative",
      },
      {
        label: "ADX fraco / lateral",
        value:
          adx == null
            ? "--"
            : weakAdx
              ? `Sim (${formatMaybeNumber(adx)})`
              : `Não (${formatMaybeNumber(adx)})`,
        impact: weakAdx ? "positive" : "neutral",
      },
      {
        label: "RSI perto de 30",
        value:
          rsi == null
            ? "--"
            : rsi <= 33
              ? `Sim (${formatMaybeNumber(rsi)})`
              : `Não (${formatMaybeNumber(rsi)})`,
        impact: rsi != null && rsi <= 33 ? "positive" : "neutral",
      },
      {
        label: "Preço longe da MME 9",
        value:
          distToEma9 == null
            ? "--"
            : farFromEma9
              ? `Sim (${formatPercentValue(distToEma9)})`
              : `Não (${formatPercentValue(distToEma9)})`,
        impact: farFromEma9 ? "positive" : "neutral",
      },
      {
        label: "Preço abaixo da MME 9",
        value: belowEma9 ? "Sim" : "Não",
        impact: belowEma9 ? "positive" : "neutral",
      },
      {
        label: "Risco operacional",
        value: "Alto, contra a tendência principal",
        impact: "negative",
      },
    ],
  };
}

function buildMeanReversionStrategy(input: MarketStrategyInput): StrategyCard {
  const trend = (input.trendLabel || "").toLowerCase();
  const macdBias = (input.macdBiasLabel || "").toLowerCase();

  const currentPrice = input.currentPrice;
  const ema21 = input.ema21;
  const sma200 = input.sma200;
  const rsi = input.rsiValue;
  const adx = input.adxValue;

  const distToEma21 = calcDistancePercent(currentPrice, ema21);
  const distToSma200 = calcDistancePercent(currentPrice, sma200);

  const farAboveMean =
    (distToEma21 != null && distToEma21 >= 0.5) ||
    (distToSma200 != null && distToSma200 >= 0.5);
  const farBelowMean =
    (distToEma21 != null && distToEma21 <= -0.5) ||
    (distToSma200 != null && distToSma200 <= -0.5);

  const overbought = rsi != null && rsi >= 70;
  const oversold = rsi != null && rsi <= 30;

  let score = 0;
  let direction: StrategyCard["direction"] = "neutral";
  let summary =
    "O preço ainda não está suficientemente esticado para uma reversão clara à média.";
  let trigger =
    "Esperar esticão extremo do preço com RSI em sobrecompra ou sobrevenda.";
  let entry =
    "Entrada curta contra o movimento só quando o preço estiver demasiado afastado da média.";
  let targets = ["Toque na MME 21", "Fecho parcial antes da média seguinte"];
  let invalidation =
    "Continuação do esticão com nova aceleração a favor da tendência dominante.";
  let rationale =
    "A reversão à média é uma operação de alta precisão e alto risco, usada apenas quando o preço parece demasiado caro ou barato no curto prazo.";

  if (farAboveMean && overbought) {
    direction = "sell";
    score += 30;
    if (distToEma21 != null && distToEma21 >= 0.5) score += 20;
    if (distToSma200 != null && distToSma200 >= 0.5) score += 18;
    if (rsi != null && rsi >= 75) score += 18;
    else score += 12;
    if (adx != null && adx < 30) score += 8;
    if (macdBias.includes("compr")) score += 4;

    summary =
      "Venda curta contra o esticão, buscando apenas o retorno do preço até à média.";
    trigger =
      "RSI em sobrecompra e distância extrema para a MME 21 ou MMS 200.";
    entry =
      "Venda contra tendência apenas quando o preço estiver claramente esticado acima da média.";
    targets = ["Retorno até a MME 21", "Alívio técnico até a média"];
    invalidation =
      "Continuação da alta com novo esticão e manutenção forte acima da média.";
    rationale =
      "O preço está caro demais para o contexto de curto prazo. A ideia é capturar apenas o retorno ao eixo, não prever uma reversão estrutural completa.";
  } else if (farBelowMean && oversold) {
    direction = "buy";
    score += 30;
    if (distToEma21 != null && distToEma21 <= -0.5) score += 20;
    if (distToSma200 != null && distToSma200 <= -0.5) score += 18;
    if (rsi != null && rsi <= 25) score += 18;
    else score += 12;
    if (adx != null && adx < 30) score += 8;
    if (macdBias.includes("vend")) score += 4;

    summary =
      "Compra curta contra o esticão, buscando apenas o retorno do preço até à média.";
    trigger =
      "RSI em sobrevenda e distância extrema para a MME 21 ou MMS 200.";
    entry =
      "Compra contra tendência apenas quando o preço estiver claramente esticado abaixo da média.";
    targets = ["Retorno até a MME 21", "Alívio técnico até a média"];
    invalidation =
      "Continuação da queda com novo esticão e manutenção forte abaixo da média.";
    rationale =
      "O preço está barato demais para o contexto de curto prazo. A ideia é capturar apenas o retorno ao eixo, não adivinhar um fundo estrutural.";
  } else {
    if (trend.includes("baixa") || trend.includes("alta")) score += 8;
    if (rsi != null && (rsi >= 60 || rsi <= 40)) score += 8;
    if (
      (distToEma21 != null && Math.abs(distToEma21) >= 0.25) ||
      (distToSma200 != null && Math.abs(distToSma200) >= 0.25)
    ) {
      score += 8;
    }
  }

  score = roundScore(score);
  const status = resolveStatus(score);

  return {
    id: "strategy-mean-reversion",
    title: "Reversão à Média",
    direction,
    status,
    score,
    summary,
    setupType: "reversal",
    idealZone: "Extremos afastados da MME 21 ou MMS 200",
    trigger,
    entry,
    targets,
    invalidation,
    rationale,
    factors: [
      {
        label: "RSI extremo",
        value:
          rsi == null
            ? "--"
            : overbought
              ? `Sobrecomprado (${formatMaybeNumber(rsi)})`
              : oversold
                ? `Sobrevendido (${formatMaybeNumber(rsi)})`
                : `Normal (${formatMaybeNumber(rsi)})`,
        impact: overbought || oversold ? "positive" : "neutral",
      },
      {
        label: "Distância para MME 21",
        value: formatPercentValue(distToEma21),
        impact:
          distToEma21 != null && Math.abs(distToEma21) >= 0.5
            ? "positive"
            : "neutral",
      },
      {
        label: "Distância para MMS 200",
        value: formatPercentValue(distToSma200),
        impact:
          distToSma200 != null && Math.abs(distToSma200) >= 0.5
            ? "positive"
            : "neutral",
      },
      {
        label: "Direção operacional",
        value:
          direction === "sell"
            ? "Venda curta"
            : direction === "buy"
              ? "Compra curta"
              : "Sem direção extrema",
        impact: direction === "neutral" ? "neutral" : "positive",
      },
      {
        label: "Risco operacional",
        value: "Alto, contra o esticão dominante",
        impact: "negative",
      },
    ],
  };
}

function buildVolatilityBreakoutStrategy(input: MarketStrategyInput): StrategyCard {
  const trend = (input.trendLabel || "").toLowerCase();
  const cloud = (input.cloudBiasLabel || "").toLowerCase();
  const volume = (input.volumeLabel || "").toLowerCase();

  const adx = input.adxValue;
  const currentPrice = input.currentPrice;
  const cloudTop = input.cloudTop;
  const cloudBase = input.cloudBase;
  const ema9 = input.ema9;
  const ema21 = input.ema21;

  const insideCloud =
    currentPrice != null &&
    cloudTop != null &&
    cloudBase != null &&
    currentPrice <= cloudTop &&
    currentPrice >= cloudBase;

  const sleepingAdx = adx != null && adx < 20;

  const compressedAverages =
    currentPrice != null &&
    ema9 != null &&
    ema21 != null &&
    Math.abs(((ema9 - ema21) / ema21) * 100) <= 0.05;

  let score = 0;
  let rationale =
    "Quanto mais o mercado fica comprimido dentro da nuvem e com ADX baixo, maior a hipótese de explosão direcional futura.";

  const direction: StrategyCard["direction"] = "neutral";
  const summary =
    "Estratégia de breakout de consolidação para quando o mercado fica espremido e sem força aparente.";
  const trigger =
    "Só ativar se o volume subir e o ADX começar a apontar para cima, saindo da região abaixo de 20.";
  const entry =
    "Preparar compra acima do topo da nuvem e venda abaixo da base da nuvem.";
  const targets = ["Expansão do range", "Movimento de libertação da compressão"];
  const invalidation =
    "Falso rompimento e retorno para dentro da nuvem sem expansão de força.";

  if (insideCloud) score += 24;
  if (sleepingAdx) score += 24;
  if (compressedAverages) score += 18;
  if (volume.includes("inconclusivo")) score -= 4;
  else if (volume.includes("normal") || volume.includes("acima")) score += 8;

  if (cloud.includes("dentro")) score += 10;
  if (trend.includes("consolid") || trend.includes("neutro")) score += 10;

  if (!insideCloud && !sleepingAdx) {
    rationale =
      "Sem compressão clara dentro da nuvem e com ADX mais desperto, o breakout de volatilidade perde qualidade neste momento.";
  }

  score = roundScore(score);
  const status = resolveStatus(score);

  return {
    id: "strategy-volatility-breakout",
    title: "Rompimento de Volatilidade",
    direction,
    status,
    score,
    summary,
    setupType: "breakout",
    idealZone: "Topo e base da nuvem / squeeze de consolidação",
    trigger,
    entry,
    targets,
    invalidation,
    rationale,
    factors: [
      {
        label: "Preço dentro da nuvem",
        value: insideCloud ? "Sim" : "Não",
        impact: insideCloud ? "positive" : "neutral",
      },
      {
        label: "ADX abaixo de 20",
        value:
          adx == null
            ? "--"
            : sleepingAdx
              ? `Sim (${formatMaybeNumber(adx)})`
              : `Não (${formatMaybeNumber(adx)})`,
        impact: sleepingAdx ? "positive" : "neutral",
      },
      {
        label: "Médias comprimidas",
        value: compressedAverages ? "Sim" : "Não",
        impact: compressedAverages ? "positive" : "neutral",
      },
      {
        label: "Topo da nuvem",
        value: formatMaybeNumber(cloudTop),
        impact: "neutral",
      },
      {
        label: "Base da nuvem",
        value: formatMaybeNumber(cloudBase),
        impact: "neutral",
      },
      {
        label: "Volume",
        value: input.volumeLabel || "--",
        impact: volume.includes("acima") ? "positive" : "neutral",
      },
    ],
  };
}

function buildMovingAverageCrossoverStrategy(
  input: MarketStrategyInput,
): StrategyCard {
  const trend = (input.trendLabel || "").toLowerCase();
  const cloud = (input.cloudBiasLabel || "").toLowerCase();
  const macdBias = (input.macdBiasLabel || "").toLowerCase();

  const currentPrice = input.currentPrice;
  const ema9 = input.ema9;
  const ema21 = input.ema21;
  const sma200 = input.sma200;
  const macdHistogram = input.macdHistogram;

  const bullishCross = ema9 != null && ema21 != null && ema9 > ema21;
  const bearishCross = ema9 != null && ema21 != null && ema9 < ema21;

  const above200 = isAbove(currentPrice, sma200);
  const below200 = isBelow(currentPrice, sma200);

  let score = 0;
  let direction: StrategyCard["direction"] = "neutral";
  let summary =
    "Estratégia clássica de seguimento de tendência baseada no cruzamento entre MME 9 e MME 21.";
  let trigger =
    "Aguardar cruzamento entre as médias com confirmação por preço, nuvem ou MMS 200.";
  let entry =
    "Entrar no sentido do cruzamento e manter enquanto a estrutura continuar a favor.";
  let targets = ["Corpo da tendência", "Manutenção até cruzamento contrário"];
  let invalidation =
    "Cruzamento contrário ou perda da confirmação estrutural.";
  const rationale =
    "A estratégia evita tentar adivinhar o início exato do movimento e procura apanhar o corpo da tendência depois da confirmação.";

  if (bullishCross) {
    direction = "buy";
    score += 26;
    if (above200) score += 18;
    if (cloud.includes("acima") || cloud.includes("saída")) score += 10;
    if (macdBias.includes("compr")) score += 16;
    if (macdHistogram != null && macdHistogram > 0) score += 10;
    if (trend.includes("alta")) score += 10;

    summary =
      "Cruzamento comprador da MME 9 sobre a MME 21, procurando seguir o corpo da tendência.";
    trigger =
      "MME 9 acima da MME 21 com preço acima da MMS 200 ou a sair da nuvem.";
    entry =
      "Compra no alinhamento do cruzamento com confirmação do preço e do MACD.";
    targets = ["Corpo da tendência", "Continuação até cruzamento contrário"];
    invalidation =
      "Perda da MMS 200, retorno para dentro da nuvem ou cruzamento contrário das médias.";
  } else if (bearishCross) {
    direction = "sell";
    score += 26;
    if (below200) score += 18;
    if (cloud.includes("abaixo") || cloud.includes("saída")) score += 10;
    if (macdBias.includes("vend")) score += 16;
    if (macdHistogram != null && macdHistogram < 0) score += 10;
    if (trend.includes("baixa")) score += 10;

    summary =
      "Cruzamento vendedor da MME 9 abaixo da MME 21, procurando seguir o corpo da tendência.";
    trigger =
      "MME 9 abaixo da MME 21 com preço abaixo da MMS 200 ou a sair da nuvem para baixo.";
    entry =
      "Venda no alinhamento do cruzamento com confirmação do preço e do MACD.";
    targets = ["Corpo da tendência", "Continuação até cruzamento contrário"];
    invalidation =
      "Recuperação da MMS 200, retorno para dentro da nuvem ou cruzamento contrário das médias.";
  } else {
    if (
      ema9 != null &&
      ema21 != null &&
      Math.abs(((ema9 - ema21) / ema21) * 100) <= 0.03
    ) {
      score += 14;
    }
    if (macdHistogram != null && Math.abs(macdHistogram) <= 0.00003) {
      score += 8;
    }
  }

  score = roundScore(score);
  const status = resolveStatus(score);

  return {
    id: "strategy-moving-average-crossover",
    title: "Cruzamento de Médias",
    direction,
    status,
    score,
    summary,
    setupType: "continuation",
    idealZone: "Região do cruzamento entre MME 9 e MME 21",
    trigger,
    entry,
    targets,
    invalidation,
    rationale,
    factors: [
      {
        label: "MME 9 vs MME 21",
        value: bullishCross
          ? "Cruzamento comprador"
          : bearishCross
            ? "Cruzamento vendedor"
            : "Ainda sem cruzamento limpo",
        impact: bullishCross || bearishCross ? "positive" : "neutral",
      },
      {
        label: "Medias no grafico",
        value: `EMA 9: ${formatMaybeNumber(ema9)} | EMA 21: ${formatMaybeNumber(ema21)}`,
        impact: ema9 != null && ema21 != null ? "positive" : "neutral",
      },
      {
        label: "Preço vs MMS 200",
        value: above200 ? "Acima" : below200 ? "Abaixo" : "Próximo / indefinido",
        impact:
          (bullishCross && above200) || (bearishCross && below200)
            ? "positive"
            : "neutral",
      },
      {
        label: "Contexto da nuvem",
        value: input.cloudBiasLabel || "--",
        impact:
          (bullishCross && cloud.includes("acima")) ||
          (bearishCross && cloud.includes("abaixo"))
            ? "positive"
            : "neutral",
      },
      {
        label: "MACD / histograma",
        value: input.macdBiasLabel || "--",
        impact:
          (bullishCross && macdBias.includes("compr")) ||
          (bearishCross && macdBias.includes("vend"))
            ? "positive"
            : "neutral",
      },
    ],
  };
}

export function buildStrategySection(
  input: MarketStrategyInput,
): StrategySection {
  const cards = [
    buildPullbackStrategy(input),
    buildRangeBreakoutStrategy(input),
    buildFadeStrategy(input),
    buildMeanReversionStrategy(input),
    buildVolatilityBreakoutStrategy(input),
    buildMovingAverageCrossoverStrategy(input),
  ].sort((a, b) => b.score - a.score);

  const bestCard = cards[0] ?? null;

  let summaryLabel = "Radar operacional das estratégias principais.";

  if (bestCard) {
    if (bestCard.status === "active") {
      summaryLabel = `${bestCard.title} ativo com bom contexto de entrada.`;
    } else if (bestCard.status === "waiting_trigger") {
      summaryLabel = `${bestCard.title} bem alinhado, mas ainda a aguardar gatilho.`;
    } else if (bestCard.status === "watching") {
      summaryLabel = `${bestCard.title} em observação.`;
    } else if (bestCard.status === "weak") {
      summaryLabel = `${bestCard.title} ainda fraco no contexto atual.`;
    } else {
      summaryLabel = `${bestCard.title} ainda sem confirmação suficiente.`;
    }
  }

  return {
    title: "Estratégias",
    subtitle: "Setups compatíveis com o contexto atual",
    biasLabel: resolveBiasLabel(input),
    summaryLabel,
    topScore: bestCard ? bestCard.score : null,
    cards,
  };
}
