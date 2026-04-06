// web/src/components/chart/ChartSummary.tsx

import { useState } from "react";
import type { CandleItem } from "../../types/trading";

type ChartSummaryProps = {
  candles: CandleItem[];
};

type TrendLabel = "Alta" | "Baixa" | "Lateral";
type CardTrendTone = "Alta" | "Baixa" | "Lateral" | "Neutro";
type HeaderTrendLabel = "Alta" | "Baixa" | "Consolidado";
type AverageDirection = "up" | "down" | "flat";
type NarrativeBias = "Alta" | "Baixa" | "Lateral";
type NarrativeStrength = "Fraca" | "Moderada" | "Forte";

type TrendSummary = {
  label: TrendLabel;
  absoluteChange: number;
  percentChange: number;
  openPrice: number | null;
  currentPrice: number | null;
};

type AverageValue = {
  value: number | null;
  direction: AverageDirection;
};

type AverageNarrative = {
  state: string;
  hint: string;
  interpretation: string;
  bias: NarrativeBias;
  strength: NarrativeStrength;
};

type MovingAverageSummary = {
  currentPrice: number | null;
  ema9: AverageValue;
  ema21: AverageValue;
  sma200: AverageValue;
  distanceToEma9: number | null;
  distanceToEma9Percent: number | null;
  distanceToEma21: number | null;
  distanceToEma21Percent: number | null;
  distanceToSma200: number | null;
  distanceToSma200Percent: number | null;
  globalState: "Alta" | "Baixa" | "Neutro";
  narrative: AverageNarrative;
};

type IndicatorNarrative = {
  state: string;
  hint: string;
  interpretation: string;
  bias: NarrativeBias;
  strength: NarrativeStrength;
};

type ConfirmationSummary = {
  adx: number | null;
  adxState: string;
  adxHint: string;
  adxInterpretation: string;
  adxBias: NarrativeBias;
  adxStrength: NarrativeStrength;
  adxRising: boolean | null;

  volumeNow: number | null;
  volumeAverage20: number | null;
  volumeState: string;
  volumeHint: string;
  volumeInterpretation: string;
  volumeBias: NarrativeBias;
  volumeStrength: NarrativeStrength;

  macdValue: number | null;
  signalValue: number | null;
  histogramValue: number | null;
  macdState: string;
  macdHint: string;
  macdInterpretation: string;
  macdBias: NarrativeBias;
  macdStrength: NarrativeStrength;

  rsi: number | null;
  rsiState: string;
  rsiHint: string;
  rsiInterpretation: string;
  rsiBias: NarrativeBias;
  rsiStrength: NarrativeStrength;

  cloudTop: number | null;
  cloudBottom: number | null;
  cloudState: string;
  cloudHint: string;
  cloudInterpretation: string;
  cloudBias: NarrativeBias;
  cloudStrength: NarrativeStrength;

  robustSignal: string;
};

type HeaderTrendSummary = {
  label: HeaderTrendLabel;
  confidence: number;
  bullScore: number;
  bearScore: number;
  consolidationScore: number;
};

function parseNumber(value?: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatPrice(value: number | null): string {
  if (value === null) return "-";
  return value.toLocaleString("pt-PT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
}

function formatSignedPrice(value: number | null): string {
  if (value === null) return "-";
  return `${value >= 0 ? "+" : ""}${value.toLocaleString("pt-PT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  })}`;
}

function formatPercent(value: number | null): string {
  if (value === null) return "-";
  return `${value >= 0 ? "+" : ""}${value.toLocaleString("pt-PT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

function formatIntegerPercent(value: number): string {
  return `${Math.round(value)}%`;
}

function formatVolume(value: number | null): string {
  if (value === null) return "-";
  return value.toLocaleString("pt-PT", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function formatNumber(value: number | null): string {
  if (value === null) return "-";
  return value.toLocaleString("pt-PT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getDayKey(value?: string): string | null {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getCloseValues(candles: CandleItem[]): number[] {
  return candles
    .map((candle) => parseNumber(candle.close))
    .filter((value): value is number => value !== null);
}

function getHighValues(candles: CandleItem[]): number[] {
  return candles
    .map((candle) => parseNumber(candle.high))
    .filter((value): value is number => value !== null);
}

function getLowValues(candles: CandleItem[]): number[] {
  return candles
    .map((candle) => parseNumber(candle.low))
    .filter((value): value is number => value !== null);
}

function getVolumeValues(candles: CandleItem[]): number[] {
  return candles
    .map((candle) => parseNumber(candle.volume))
    .filter((value): value is number => value !== null);
}

function calculateSimpleAverage(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  const sum = slice.reduce((acc, value) => acc + value, 0);
  return sum / period;
}

function calculateExponentialAverage(values: number[], period: number): number | null {
  if (values.length < period) return null;

  const multiplier = 2 / (period + 1);
  let average =
    values.slice(0, period).reduce((acc, value) => acc + value, 0) / period;

  for (let index = period; index < values.length; index += 1) {
    average = (values[index] - average) * multiplier + average;
  }

  return average;
}

function getAverageDirection(
  currentValue: number | null,
  previousValue: number | null
): AverageDirection {
  if (currentValue === null || previousValue === null) return "flat";
  if (currentValue > previousValue) return "up";
  if (currentValue < previousValue) return "down";
  return "flat";
}

function calculateSimpleAverageWithDirection(
  values: number[],
  period: number
): AverageValue {
  const currentValue = calculateSimpleAverage(values, period);
  const previousValue = calculateSimpleAverage(values.slice(0, -1), period);

  return {
    value: currentValue,
    direction: getAverageDirection(currentValue, previousValue),
  };
}

function calculateExponentialAverageWithDirection(
  values: number[],
  period: number
): AverageValue {
  const currentValue = calculateExponentialAverage(values, period);
  const previousValue = calculateExponentialAverage(values.slice(0, -1), period);

  return {
    value: currentValue,
    direction: getAverageDirection(currentValue, previousValue),
  };
}

function buildTrendSummary(candles: CandleItem[]): TrendSummary {
  if (!candles.length) {
    return {
      label: "Lateral",
      absoluteChange: 0,
      percentChange: 0,
      openPrice: null,
      currentPrice: null,
    };
  }

  const lastCandle = candles[candles.length - 1];
  const currentDayKey = getDayKey(lastCandle?.open_time);

  const dayCandles = currentDayKey
    ? candles.filter((candle) => getDayKey(candle.open_time) === currentDayKey)
    : candles;

  const firstDayCandle = dayCandles[0] ?? candles[0];
  const openPrice = parseNumber(firstDayCandle?.open);
  const currentPrice =
    parseNumber(lastCandle?.close) ?? parseNumber(firstDayCandle?.close);

  if (openPrice === null || currentPrice === null || openPrice === 0) {
    return {
      label: "Lateral",
      absoluteChange: 0,
      percentChange: 0,
      openPrice,
      currentPrice,
    };
  }

  const absoluteChange = currentPrice - openPrice;
  const percentChange = (absoluteChange / openPrice) * 100;

  let label: TrendLabel = "Lateral";

  if (percentChange > 0.05) label = "Alta";
  else if (percentChange < -0.05) label = "Baixa";

  return {
    label,
    absoluteChange,
    percentChange,
    openPrice,
    currentPrice,
  };
}

function calculateRsi(values: number[], period = 14): number | null {
  if (values.length <= period) return null;

  let gains = 0;
  let losses = 0;

  for (let index = 1; index <= period; index += 1) {
    const change = values[index] - values[index - 1];
    if (change >= 0) gains += change;
    else losses += Math.abs(change);
  }

  let averageGain = gains / period;
  let averageLoss = losses / period;

  for (let index = period + 1; index < values.length; index += 1) {
    const change = values[index] - values[index - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;

    averageGain = (averageGain * (period - 1) + gain) / period;
    averageLoss = (averageLoss * (period - 1) + loss) / period;
  }

  if (averageLoss === 0) return 100;

  const rs = averageGain / averageLoss;
  return 100 - 100 / (1 + rs);
}

function calculateMacd(values: number[]) {
  if (values.length < 35) {
    return {
      macd: null as number | null,
      signal: null as number | null,
      histogram: null as number | null,
    };
  }

  const ema12Series: number[] = [];
  const ema26Series: number[] = [];

  for (let index = 0; index < values.length; index += 1) {
    const slice = values.slice(0, index + 1);
    ema12Series.push(calculateExponentialAverage(slice, 12) ?? Number.NaN);
    ema26Series.push(calculateExponentialAverage(slice, 26) ?? Number.NaN);
  }

  const macdSeries = ema12Series
    .map((value, index) =>
      Number.isFinite(value) && Number.isFinite(ema26Series[index])
        ? value - ema26Series[index]
        : Number.NaN
    )
    .filter((value) => Number.isFinite(value));

  if (macdSeries.length < 9) {
    return {
      macd: null,
      signal: null,
      histogram: null,
    };
  }

  const macd = macdSeries[macdSeries.length - 1];
  const signal = calculateExponentialAverage(macdSeries, 9);
  const histogram = signal !== null && macd !== null ? macd - signal : null;

  return {
    macd,
    signal,
    histogram,
  };
}

function calculateAdx(
  highs: number[],
  lows: number[],
  closes: number[],
  period = 14
): { adx: number | null; previousAdx: number | null } {
  if (
    highs.length <= period * 2 ||
    lows.length <= period * 2 ||
    closes.length <= period * 2
  ) {
    return { adx: null, previousAdx: null };
  }

  const trList: number[] = [];
  const plusDmList: number[] = [];
  const minusDmList: number[] = [];

  for (let index = 1; index < highs.length; index += 1) {
    const highDiff = highs[index] - highs[index - 1];
    const lowDiff = lows[index - 1] - lows[index];

    const plusDm = highDiff > lowDiff && highDiff > 0 ? highDiff : 0;
    const minusDm = lowDiff > highDiff && lowDiff > 0 ? lowDiff : 0;

    const tr = Math.max(
      highs[index] - lows[index],
      Math.abs(highs[index] - closes[index - 1]),
      Math.abs(lows[index] - closes[index - 1])
    );

    trList.push(tr);
    plusDmList.push(plusDm);
    minusDmList.push(minusDm);
  }

  if (trList.length < period) {
    return { adx: null, previousAdx: null };
  }

  let trSmoothed = trList.slice(0, period).reduce((sum, value) => sum + value, 0);
  let plusSmoothed = plusDmList
    .slice(0, period)
    .reduce((sum, value) => sum + value, 0);
  let minusSmoothed = minusDmList
    .slice(0, period)
    .reduce((sum, value) => sum + value, 0);

  const dxValues: number[] = [];

  for (let index = period; index < trList.length; index += 1) {
    if (index > period) {
      trSmoothed = trSmoothed - trSmoothed / period + trList[index];
      plusSmoothed = plusSmoothed - plusSmoothed / period + plusDmList[index];
      minusSmoothed =
        minusSmoothed - minusSmoothed / period + minusDmList[index];
    }

    const plusDi = trSmoothed === 0 ? 0 : (plusSmoothed / trSmoothed) * 100;
    const minusDi = trSmoothed === 0 ? 0 : (minusSmoothed / trSmoothed) * 100;
    const diSum = plusDi + minusDi;
    const dx = diSum === 0 ? 0 : (Math.abs(plusDi - minusDi) / diSum) * 100;

    dxValues.push(dx);
  }

  if (dxValues.length < period) {
    return { adx: null, previousAdx: null };
  }

  let adx =
    dxValues.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  const adxSeries: number[] = [adx];

  for (let index = period; index < dxValues.length; index += 1) {
    adx = (adx * (period - 1) + dxValues[index]) / period;
    adxSeries.push(adx);
  }

  return {
    adx: adxSeries[adxSeries.length - 1] ?? null,
    previousAdx: adxSeries.length > 1 ? adxSeries[adxSeries.length - 2] : null,
  };
}

function calculateCloud(
  highs: number[],
  lows: number[],
  closes: number[]
): { top: number | null; bottom: number | null; price: number | null } {
  if (highs.length < 52 || lows.length < 52 || closes.length === 0) {
    return { top: null, bottom: null, price: null };
  }

  const conversionHigh = Math.max(...highs.slice(-9));
  const conversionLow = Math.min(...lows.slice(-9));
  const conversion = (conversionHigh + conversionLow) / 2;

  const baseHigh = Math.max(...highs.slice(-26));
  const baseLow = Math.min(...lows.slice(-26));
  const base = (baseHigh + baseLow) / 2;

  const spanA = (conversion + base) / 2;

  const spanBHigh = Math.max(...highs.slice(-52));
  const spanBLow = Math.min(...lows.slice(-52));
  const spanB = (spanBHigh + spanBLow) / 2;

  return {
    top: Math.max(spanA, spanB),
    bottom: Math.min(spanA, spanB),
    price: closes[closes.length - 1] ?? null,
  };
}

function buildRsiNarrative(rsi: number | null): IndicatorNarrative {
  if (rsi === null) {
    return {
      state: "Sem leitura",
      hint: "Faltam candles para medir o ritmo do preço.",
      interpretation:
        "Sem candles suficientes para interpretar o momentum. Ainda não há base para saber se compradores ou vendedores dominam o curto prazo.",
      bias: "Lateral",
      strength: "Fraca",
    };
  }

  if (rsi >= 70) {
    return {
      state: "Preço esticado",
      hint: "Zona alta com risco de exaustão.",
      interpretation: `O RSI em ${formatNumber(
        rsi
      )} indica forte domínio comprador, mas já em zona esticada. A alta pode continuar, porém o risco de correção aumenta.`,
      bias: "Alta",
      strength: "Forte",
    };
  }

  if (rsi >= 60) {
    return {
      state: "Dominância compradora",
      hint: "Alta com boa qualidade.",
      interpretation: `O RSI em ${formatNumber(
        rsi
      )} mostra compradores com controlo claro do momentum. A leitura favorece continuação da alta sem sinais imediatos de exaustão.`,
      bias: "Alta",
      strength: "Forte",
    };
  }

  if (rsi >= 55) {
    return {
      state: "Alta saudável",
      hint: "Compradores mantêm vantagem.",
      interpretation: `O RSI em ${formatNumber(
        rsi
      )} mostra alta saudável, com vantagem compradora ainda organizada. O cenário favorece continuidade, embora sem aceleração extrema.`,
      bias: "Alta",
      strength: "Moderada",
    };
  }

  if (rsi >= 45) {
    return {
      state: "Equilíbrio",
      hint: "Mercado em transição.",
      interpretation: `O RSI em ${formatNumber(
        rsi
      )} está muito próximo da linha de equilíbrio. Não há dominância clara entre compradores e vendedores, o que aumenta a probabilidade de consolidação ou sinais mistos.`,
      bias: "Lateral",
      strength: "Fraca",
    };
  }

  if (rsi >= 40) {
    return {
      state: "Fraqueza compradora",
      hint: "Preço abaixo da zona saudável.",
      interpretation: `O RSI em ${formatNumber(
        rsi
      )} mostra perda de força compradora e inclinação para o lado vendedor. Ainda não é pressão extrema, mas a vantagem já deixou de estar com os compradores.`,
      bias: "Baixa",
      strength: "Moderada",
    };
  }

  if (rsi > 30) {
    return {
      state: "Pressão vendedora",
      hint: "Baixa com espaço para continuar.",
      interpretation: `O RSI em ${formatNumber(
        rsi
      )} confirma domínio vendedor no curto prazo. O mercado está fraco e favorece continuação da baixa, embora ainda sem sobrevenda extrema.`,
      bias: "Baixa",
      strength: "Forte",
    };
  }

  return {
    state: "Preço muito pressionado",
    hint: "Zona de sobrevenda.",
    interpretation: `O RSI em ${formatNumber(
      rsi
    )} mostra mercado muito pressionado. A baixa é forte, mas o risco de reação técnica ou alívio aumenta por já estar numa zona esticada para baixo.`,
    bias: "Baixa",
    strength: "Forte",
  };
}

function buildAdxNarrative(
  adx: number | null,
  adxRising: boolean | null
): IndicatorNarrative {
  if (adx === null) {
    return {
      state: "Sem leitura",
      hint: "Faltam candles para medir a força do movimento.",
      interpretation:
        "Sem candles suficientes para medir força direcional. Ainda não é possível saber se o mercado está a ganhar impulso ou apenas a oscilar sem convicção.",
      bias: "Lateral",
      strength: "Fraca",
    };
  }

  if (adx < 20) {
    return {
      state: "Mercado lateral",
      hint: "Força fraca e pouco deslocamento.",
      interpretation: `O ADX em ${formatNumber(
        adx
      )} indica ausência de força direcional. O mercado está fraco, mais sujeito a ruído e cruzamentos falsos do que a uma tendência limpa.`,
      bias: "Lateral",
      strength: "Fraca",
    };
  }

  if (adx < 25) {
    return {
      state: "Força em formação",
      hint: "Movimento ainda sem convicção total.",
      interpretation: `O ADX em ${formatNumber(
        adx
      )} mostra que o mercado pode estar a sair da lateralização, mas ainda sem força suficiente para validar tendência sólida.`,
      bias: "Lateral",
      strength: "Moderada",
    };
  }

  if (adx < 40 && adxRising === true) {
    return {
      state: "Tendência forte a acelerar",
      hint: "O impulso está a ganhar qualidade.",
      interpretation: `O ADX em ${formatNumber(
        adx
      )} e em subida confirma que o movimento atual está a ganhar consistência. Quando a direção já estiver clara noutros indicadores, este valor funciona como reforço da tendência.`,
      bias: "Lateral",
      strength: "Forte",
    };
  }

  if (adx < 40 && adxRising === false) {
    return {
      state: "Tendência forte em perda de fôlego",
      hint: "A estrutura ainda existe, mas com menos energia.",
      interpretation: `O ADX em ${formatNumber(
        adx
      )} ainda mostra força técnica relevante, mas a direção descendente indica perda de impulso. O mercado pode continuar em tendência, porém com maior risco de consolidação.`,
      bias: "Lateral",
      strength: "Moderada",
    };
  }

  if (adxRising === true) {
    return {
      state: "Tendência muito forte",
      hint: "Movimento intenso e sustentado.",
      interpretation: `O ADX em ${formatNumber(
        adx
      )} com inclinação positiva mostra um mercado com força direcional muito elevada. O movimento está forte, embora o risco de esticão aumente.`,
      bias: "Lateral",
      strength: "Forte",
    };
  }

  return {
    state: "Tendência muito forte com cansaço",
    hint: "Força alta, mas já a perder qualidade.",
    interpretation: `O ADX em ${formatNumber(
      adx
    )} ainda é elevado, porém a inclinação descendente sugere que o impulso está a perder qualidade. A tendência segue forte, mas menos limpa do que antes.`,
    bias: "Lateral",
    strength: "Moderada",
  };
}

function buildVolumeNarrative(
  volumeNow: number | null,
  volumeAverage20: number | null
): IndicatorNarrative {
  if (volumeNow === null || volumeAverage20 === null) {
    return {
      state: "Sem leitura",
      hint: "Faltam dados para avaliar participação.",
      interpretation:
        "Sem dados de volume suficientes. Neste momento, o volume não pode ser usado como critério de confirmação ou invalidação do movimento.",
      bias: "Lateral",
      strength: "Fraca",
    };
  }

  if (volumeAverage20 === 0) {
    return {
      state: "Volume inconclusivo",
      hint: "Fonte atual não oferece volume útil.",
      interpretation:
        "O volume atual e a média estão em zero, o que torna esta leitura tecnicamente inconclusiva. Não é seguro confirmar tendência com base neste campo.",
      bias: "Lateral",
      strength: "Fraca",
    };
  }

  const ratio = volumeNow / volumeAverage20;

  if (ratio >= 1.2) {
    return {
      state: "Volume acima da média",
      hint: "Participação reforça o movimento.",
      interpretation: `O volume atual está acima da média recente, mostrando maior participação do mercado. Quando combinado com direção clara noutros indicadores, isto reforça a validade do movimento.`,
      bias: "Lateral",
      strength: "Moderada",
    };
  }

  if (ratio >= 0.9) {
    return {
      state: "Volume normal",
      hint: "Participação neutra.",
      interpretation:
        "O volume está próximo da média recente. Há participação suficiente para validar alguma atividade, mas sem sinal de expansão relevante que reforce a tendência.",
      bias: "Lateral",
      strength: "Fraca",
    };
  }

  return {
    state: "Volume abaixo da média",
    hint: "Movimento com pouco combustível.",
    interpretation:
      "O volume está abaixo do padrão recente, sugerindo menor participação do mercado. Isso reduz a qualidade de rompimentos e aumenta o risco de movimentos fracos ou falhos.",
    bias: "Lateral",
    strength: "Fraca",
  };
}

function buildMacdNarrative(
  macdValue: number | null,
  signalValue: number | null,
  histogramValue: number | null
): IndicatorNarrative {
  if (
    macdValue === null ||
    signalValue === null ||
    histogramValue === null
  ) {
    return {
      state: "Sem leitura",
      hint: "Faltam candles para medir aceleração.",
      interpretation:
        "Ainda não há candles suficientes para medir aceleração e relação entre impulso principal e sinal. O MACD permanece inconclusivo.",
      bias: "Lateral",
      strength: "Fraca",
    };
  }

  const gap = Math.abs(histogramValue);

  if (histogramValue > 0 && macdValue > signalValue) {
    return {
      state: gap > 0.0001 ? "Aceleração compradora" : "Recuperação compradora",
      hint: "O impulso está inclinado para cima.",
      interpretation:
        gap > 0.0001
          ? "O MACD está positivo e bem acima da linha de sinal, mostrando aceleração compradora relevante. Esta leitura favorece continuação da alta."
          : "O MACD está acima da linha de sinal, mas ainda com separação curta. O mercado ensaia recuperação compradora, embora a confirmação ainda não seja agressiva.",
      bias: "Alta",
      strength: gap > 0.0001 ? "Forte" : "Moderada",
    };
  }

  if (histogramValue < 0 && macdValue < signalValue) {
    return {
      state: gap > 0.0001 ? "Aceleração vendedora" : "Pressão vendedora",
      hint: "O impulso está inclinado para baixo.",
      interpretation:
        gap > 0.0001
          ? "O MACD está abaixo da linha de sinal com histograma negativo mais amplo, sinalizando aceleração vendedora. O cenário favorece continuação da baixa."
          : "O MACD está abaixo da linha de sinal e mantém viés vendedor, mas ainda com separação curta. A baixa existe, embora sem agressividade extrema.",
      bias: "Baixa",
      strength: gap > 0.0001 ? "Forte" : "Moderada",
    };
  }

  return {
    state: "Equilíbrio",
    hint: "Sem aceleração clara.",
    interpretation:
      "O MACD está muito próximo da linha de sinal e sem histograma expressivo. O impulso perdeu nitidez e o mercado parece em transição ou consolidação.",
    bias: "Lateral",
    strength: "Fraca",
  };
}

function buildCloudNarrative(
  price: number | null,
  top: number | null,
  bottom: number | null
): IndicatorNarrative {
  if (price === null || top === null || bottom === null) {
    return {
      state: "Sem leitura",
      hint: "Faltam candles para a leitura da nuvem.",
      interpretation:
        "Ainda não há dados suficientes para construir uma leitura confiável da nuvem. O contexto de médio prazo permanece indefinido.",
      bias: "Lateral",
      strength: "Fraca",
    };
  }

  if (price > top) {
    return {
      state: "Preço acima da nuvem",
      hint: "Contexto favorável de médio prazo.",
      interpretation: `O preço está acima da nuvem, o que favorece uma leitura estrutural mais compradora. Enquanto se mantiver acima desta zona, o contexto técnico tende a apoiar a alta.`,
      bias: "Alta",
      strength: "Forte",
    };
  }

  if (price < bottom) {
    return {
      state: "Preço abaixo da nuvem",
      hint: "Contexto desfavorável de médio prazo.",
      interpretation: `O preço está abaixo da nuvem, mantendo o ativo em estrutura mais fraca. Esta posição favorece continuidade vendedora enquanto a nuvem não for recuperada.`,
      bias: "Baixa",
      strength: "Forte",
    };
  }

  return {
    state: "Preço dentro da nuvem",
    hint: "Zona de ruído e indecisão.",
    interpretation: `O preço está dentro da nuvem, uma área de conflito entre compradores e vendedores. Enquanto não houver saída clara pelo topo ou pela base, a leitura estrutural continua neutra.`,
    bias: "Lateral",
    strength: "Moderada",
  };
}

function buildMovingAverageNarrative(
  currentPrice: number | null,
  ema9: AverageValue,
  ema21: AverageValue,
  distanceToEma9Percent: number | null,
  distanceToEma21Percent: number | null,
  globalState: "Alta" | "Baixa" | "Neutro"
): AverageNarrative {
  if (currentPrice === null || ema9.value === null || ema21.value === null) {
    return {
      state: "Sem leitura",
      hint: "Faltam dados para avaliar alinhamento do preço com as médias.",
      interpretation:
        "Sem dados suficientes para saber se o preço está organizado acima, abaixo ou comprimido junto das médias móveis.",
      bias: "Lateral",
      strength: "Fraca",
    };
  }

  const closeToEma9 = distanceToEma9Percent !== null && Math.abs(distanceToEma9Percent) <= 0.03;
  const closeToEma21 =
    distanceToEma21Percent !== null && Math.abs(distanceToEma21Percent) <= 0.03;

  if (globalState === "Alta") {
    return {
      state: "Preço acima das médias",
      hint: "Estrutura de curto prazo favorável.",
      interpretation:
        "O preço está acima das médias curtas e com alinhamento comprador entre elas. Isto sugere organização de tendência e maior probabilidade de continuação da alta enquanto as médias forem respeitadas como suporte dinâmico.",
      bias: "Alta",
      strength: "Forte",
    };
  }

  if (globalState === "Baixa") {
    return {
      state: "Preço abaixo das médias",
      hint: "Estrutura de curto prazo desfavorável.",
      interpretation:
        "O preço está abaixo das médias curtas e com alinhamento vendedor entre elas. Isto reforça uma leitura de continuação baixista enquanto o preço não recuperar essas zonas.",
      bias: "Baixa",
      strength: "Forte",
    };
  }

  if (closeToEma9 && closeToEma21) {
    return {
      state: "Preço colado às médias",
      hint: "Mercado comprimido no curtíssimo prazo.",
      interpretation:
        "O preço está praticamente abraçado à MME 9 e à MME 21. Esta compressão mostra falta de deslocamento direcional e costuma anteceder consolidação ou um novo rompimento.",
      bias: "Lateral",
      strength: "Moderada",
    };
  }

  if (currentPrice > ema9.value && currentPrice > ema21.value) {
    return {
      state: "Leve vantagem compradora",
      hint: "Preço acima das médias, mas sem estrutura completa.",
      interpretation:
        "O preço está acima das médias curtas, porém ainda sem alinhamento estrutural mais forte. Há viés comprador, mas a confirmação ainda é parcial.",
      bias: "Alta",
      strength: "Moderada",
    };
  }

  if (currentPrice < ema9.value && currentPrice < ema21.value) {
    return {
      state: "Leve vantagem vendedora",
      hint: "Preço abaixo das médias, mas sem estrutura completa.",
      interpretation:
        "O preço está abaixo das médias curtas, porém ainda sem um alinhamento estrutural mais robusto. Há viés vendedor, mas a confirmação ainda é parcial.",
      bias: "Baixa",
      strength: "Moderada",
    };
  }

  return {
    state: "Médias sem acordo",
    hint: "Sinais mistos no curtíssimo prazo.",
    interpretation:
      "O preço e as médias ainda não formam um arranjo claro. O mercado está numa zona de transição, com maior risco de leituras contraditórias e falsa direção.",
    bias: "Lateral",
    strength: "Fraca",
  };
}

function buildMovingAverageSummary(candles: CandleItem[]): MovingAverageSummary {
  const closeValues = getCloseValues(candles);
  const currentPrice = closeValues.length ? closeValues[closeValues.length - 1] : null;

  const ema9 = calculateExponentialAverageWithDirection(closeValues, 9);
  const ema21 = calculateExponentialAverageWithDirection(closeValues, 21);
  const sma200 = calculateSimpleAverageWithDirection(closeValues, 200);

  const distanceToEma9 =
    currentPrice !== null && ema9.value !== null ? currentPrice - ema9.value : null;

  const distanceToEma9Percent =
    currentPrice !== null && ema9.value !== null && ema9.value !== 0
      ? ((currentPrice - ema9.value) / ema9.value) * 100
      : null;

  const distanceToEma21 =
    currentPrice !== null && ema21.value !== null ? currentPrice - ema21.value : null;

  const distanceToEma21Percent =
    currentPrice !== null && ema21.value !== null && ema21.value !== 0
      ? ((currentPrice - ema21.value) / ema21.value) * 100
      : null;

  const distanceToSma200 =
    currentPrice !== null && sma200.value !== null ? currentPrice - sma200.value : null;

  const distanceToSma200Percent =
    currentPrice !== null && sma200.value !== null && sma200.value !== 0
      ? ((currentPrice - sma200.value) / sma200.value) * 100
      : null;

  let globalState: "Alta" | "Baixa" | "Neutro" = "Neutro";

  if (
    currentPrice !== null &&
    ema9.value !== null &&
    ema21.value !== null &&
    sma200.value !== null
  ) {
    if (
      currentPrice > ema9.value &&
      ema9.value > ema21.value &&
      currentPrice > sma200.value
    ) {
      globalState = "Alta";
    } else if (
      currentPrice < ema9.value &&
      ema9.value < ema21.value &&
      currentPrice < sma200.value
    ) {
      globalState = "Baixa";
    }
  }

  const narrative = buildMovingAverageNarrative(
    currentPrice,
    ema9,
    ema21,
    distanceToEma9Percent,
    distanceToEma21Percent,
    globalState
  );

  return {
    currentPrice,
    ema9,
    ema21,
    sma200,
    distanceToEma9,
    distanceToEma9Percent,
    distanceToEma21,
    distanceToEma21Percent,
    distanceToSma200,
    distanceToSma200Percent,
    globalState,
    narrative,
  };
}

function buildConfirmationSummary(candles: CandleItem[]): ConfirmationSummary {
  const closes = getCloseValues(candles);
  const highs = getHighValues(candles);
  const lows = getLowValues(candles);
  const volumes = getVolumeValues(candles);

  const { adx, previousAdx } = calculateAdx(highs, lows, closes, 14);
  const adxRising =
    adx !== null && previousAdx !== null ? adx > previousAdx : null;

  const volumeNow = volumes.length ? volumes[volumes.length - 1] : null;
  const volumeAverage20 = calculateSimpleAverage(volumes, 20);

  const { macd, signal, histogram } = calculateMacd(closes);
  const rsi = calculateRsi(closes, 14);
  const cloud = calculateCloud(highs, lows, closes);

  const adxNarrative = buildAdxNarrative(adx, adxRising);
  const volumeNarrative = buildVolumeNarrative(volumeNow, volumeAverage20);
  const macdNarrative = buildMacdNarrative(macd, signal, histogram);
  const rsiNarrative = buildRsiNarrative(rsi);
  const cloudNarrative = buildCloudNarrative(cloud.price, cloud.top, cloud.bottom);

  const robustConditions = [
    adx !== null && adx >= 25,
    histogram !== null && histogram > 0,
    histogram !== null && histogram < 0,
    rsi !== null && (rsi >= 55 || rsi <= 45),
    cloudNarrative.bias !== "Lateral",
  ];

  const positiveCount = robustConditions.filter(Boolean).length;
  let robustSignal = "Sinal fraco";

  if (positiveCount >= 4) {
    robustSignal = "Confirmação robusta";
  } else if (positiveCount >= 2) {
    robustSignal = "Confirmação parcial";
  }

  return {
    adx,
    adxState: adxNarrative.state,
    adxHint: adxNarrative.hint,
    adxInterpretation: adxNarrative.interpretation,
    adxBias: adxNarrative.bias,
    adxStrength: adxNarrative.strength,
    adxRising,

    volumeNow,
    volumeAverage20,
    volumeState: volumeNarrative.state,
    volumeHint: volumeNarrative.hint,
    volumeInterpretation: volumeNarrative.interpretation,
    volumeBias: volumeNarrative.bias,
    volumeStrength: volumeNarrative.strength,

    macdValue: macd,
    signalValue: signal,
    histogramValue: histogram,
    macdState: macdNarrative.state,
    macdHint: macdNarrative.hint,
    macdInterpretation: macdNarrative.interpretation,
    macdBias: macdNarrative.bias,
    macdStrength: macdNarrative.strength,

    rsi,
    rsiState: rsiNarrative.state,
    rsiHint: rsiNarrative.hint,
    rsiInterpretation: rsiNarrative.interpretation,
    rsiBias: rsiNarrative.bias,
    rsiStrength: rsiNarrative.strength,

    cloudTop: cloud.top,
    cloudBottom: cloud.bottom,
    cloudState: cloudNarrative.state,
    cloudHint: cloudNarrative.hint,
    cloudInterpretation: cloudNarrative.interpretation,
    cloudBias: cloudNarrative.bias,
    cloudStrength: cloudNarrative.strength,

    robustSignal,
  };
}

function buildHeaderTrendSummary(
  trend: TrendSummary,
  movingAverages: MovingAverageSummary,
  confirmation: ConfirmationSummary
): HeaderTrendSummary {
  let bullScore = 0;
  let bearScore = 0;
  let consolidationScore = 0;

  const addBull = (value: number) => {
    bullScore += value;
  };

  const addBear = (value: number) => {
    bearScore += value;
  };

  const addConsolidation = (value: number) => {
    consolidationScore += value;
  };

  if (trend.label === "Alta") addBull(18);
  else if (trend.label === "Baixa") addBear(18);
  else addConsolidation(18);

  if (movingAverages.narrative.bias === "Alta") addBull(18);
  else if (movingAverages.narrative.bias === "Baixa") addBear(18);
  else addConsolidation(18);

  if (confirmation.rsiBias === "Alta") addBull(14);
  else if (confirmation.rsiBias === "Baixa") addBear(14);
  else addConsolidation(14);

  if (confirmation.macdBias === "Alta") addBull(14);
  else if (confirmation.macdBias === "Baixa") addBear(14);
  else addConsolidation(14);

  if (confirmation.cloudBias === "Alta") addBull(16);
  else if (confirmation.cloudBias === "Baixa") addBear(16);
  else addConsolidation(16);

  if (confirmation.adx !== null) {
    if (confirmation.adx < 20) {
      addConsolidation(10);
    } else if (confirmation.adx < 25) {
      addConsolidation(6);
    } else if (bullScore > bearScore) {
      addBull(10);
    } else if (bearScore > bullScore) {
      addBear(10);
    } else {
      addConsolidation(10);
    }
  }

  if (
    confirmation.volumeNow !== null &&
    confirmation.volumeAverage20 !== null &&
    confirmation.volumeAverage20 > 0
  ) {
    if (confirmation.volumeNow > confirmation.volumeAverage20) {
      if (bullScore > bearScore) addBull(4);
      else if (bearScore > bullScore) addBear(4);
      else addConsolidation(4);
    } else {
      addConsolidation(4);
    }
  }

  const totalScore = bullScore + bearScore + consolidationScore;
  const maxScore = Math.max(bullScore, bearScore, consolidationScore);
  const scoreGap = Math.abs(bullScore - bearScore);

  let label: HeaderTrendLabel = "Consolidado";

  if (consolidationScore >= bullScore && consolidationScore >= bearScore) {
    label = "Consolidado";
  } else if (scoreGap <= 10 && consolidationScore >= maxScore * 0.75) {
    label = "Consolidado";
  } else if (bullScore > bearScore) {
    label = "Alta";
  } else if (bearScore > bullScore) {
    label = "Baixa";
  }

  const winningScore =
    label === "Alta"
      ? bullScore
      : label === "Baixa"
      ? bearScore
      : consolidationScore;

  const confidence =
    totalScore > 0
      ? Math.max(1, Math.min(100, Math.round((winningScore / totalScore) * 100)))
      : 0;

  return {
    label,
    confidence,
    bullScore,
    bearScore,
    consolidationScore,
  };
}

function getTrendBadgeStyles(label: TrendLabel) {
  if (label === "Alta") {
    return {
      background: "#ecfdf5",
      color: "#166534",
      border: "#86efac",
    };
  }

  if (label === "Baixa") {
    return {
      background: "#fff7ed",
      color: "#9a3412",
      border: "#fdba74",
    };
  }

  return {
    background: "#f8fafc",
    color: "#334155",
    border: "#cbd5e1",
  };
}

function getAverageBadgeStyles(label: MovingAverageSummary["globalState"]) {
  if (label === "Alta") {
    return {
      background: "#ecfdf5",
      color: "#166534",
      border: "#86efac",
    };
  }

  if (label === "Baixa") {
    return {
      background: "#fff7ed",
      color: "#9a3412",
      border: "#fdba74",
    };
  }

  return {
    background: "#f8fafc",
    color: "#334155",
    border: "#cbd5e1",
  };
}

function getConfirmationBadgeStyles(label: string) {
  if (label === "Confirmação robusta") {
    return {
      background: "#ecfdf5",
      color: "#166534",
      border: "#86efac",
    };
  }

  if (label === "Confirmação parcial") {
    return {
      background: "#fffbeb",
      color: "#92400e",
      border: "#fcd34d",
    };
  }

  return {
    background: "#f8fafc",
    color: "#334155",
    border: "#cbd5e1",
  };
}

function getArrowSymbol(direction: AverageDirection) {
  if (direction === "up") return "▲";
  if (direction === "down") return "▼";
  return "▶";
}

function getArrowColor(direction: AverageDirection) {
  if (direction === "up") return "#166534";
  if (direction === "down") return "#9a3412";
  return "#334155";
}

function getCardTrendToneAccent(tone: CardTrendTone) {
  if (tone === "Alta") {
    return {
      borderColor: "#bbf7d0",
      sideColor: "34, 197, 94",
      glowColor: "22, 163, 74",
    };
  }

  if (tone === "Baixa") {
    return {
      borderColor: "#fdba74",
      sideColor: "239, 68, 68",
      glowColor: "220, 38, 38",
    };
  }

  return {
    borderColor: "#dbe2ea",
    sideColor: "148, 163, 184",
    glowColor: "100, 116, 139",
  };
}

function getCardStyleByTone(tone: CardTrendTone): React.CSSProperties {
  const accent = getCardTrendToneAccent(tone);

  return {
    border: `1px solid ${accent.borderColor}`,
    background: "#ffffff",
    borderRadius: 14,
    padding: 16,
    borderLeft: `3px solid rgba(${accent.sideColor}, 0.95)`,
    boxShadow: `
      inset 3px 0 0 rgba(${accent.sideColor}, 0.95),
      inset 16px 0 22px rgba(${accent.sideColor}, 0.08),
      0 0 0 1px rgba(${accent.glowColor}, 0.03),
      0 8px 20px rgba(${accent.glowColor}, 0.08)
    `,
  };
}

function getHeaderStyles(label: HeaderTrendLabel) {
  if (label === "Alta") {
    return {
      background: "linear-gradient(90deg, #dcfce7 0%, #f0fdf4 100%)",
      borderBottom: "#bbf7d0",
      titleColor: "#14532d",
      subtitleColor: "#166534",
      badgeBackground: "#ffffff",
      badgeColor: "#166534",
      badgeBorder: "#86efac",
    };
  }

  if (label === "Baixa") {
    return {
      background: "linear-gradient(90deg, #fee2e2 0%, #fff7ed 100%)",
      borderBottom: "#fdba74",
      titleColor: "#7f1d1d",
      subtitleColor: "#9a3412",
      badgeBackground: "#ffffff",
      badgeColor: "#9a3412",
      badgeBorder: "#fdba74",
    };
  }

  return {
    background: "linear-gradient(90deg, #fef3c7 0%, #fffbeb 100%)",
    borderBottom: "#fcd34d",
    titleColor: "#78350f",
    subtitleColor: "#92400e",
    badgeBackground: "#ffffff",
    badgeColor: "#92400e",
    badgeBorder: "#fcd34d",
  };
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        padding: "6px 0",
        borderBottom: "1px solid rgba(148, 163, 184, 0.18)",
      }}
    >
      <span style={{ color: "#64748b" }}>{label}</span>
      <strong style={{ color: "#0f172a", textAlign: "right" }}>{value}</strong>
    </div>
  );
}

function NarrativeParagraph({
  text,
}: {
  text: string;
}) {
  return (
    <div
      style={{
        marginBottom: 10,
        fontSize: 12,
        lineHeight: 1.55,
        color: "#475569",
      }}
    >
      {text}
    </div>
  );
}

function AverageInfoLine({
  title,
  description,
  item,
  distanceValue,
  distancePercent,
}: {
  title: string;
  description: string;
  item: AverageValue;
  distanceValue: number | null;
  distancePercent: number | null;
}) {
  const arrowSymbol = getArrowSymbol(item.direction);
  const arrowColor = getArrowColor(item.direction);

  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        padding: 12,
        background: "#ffffff",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 8,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: 28,
              width: 28,
              height: 28,
              fontSize: 19,
              lineHeight: 1,
              fontWeight: 900,
              color: arrowColor,
              letterSpacing: "-0.02em",
            }}
          >
            {arrowSymbol}
          </span>

          <strong style={{ fontSize: 14, color: "#0f172a" }}>{title}</strong>
        </div>

        <strong style={{ color: "#0f172a" }}>{formatPrice(item.value)}</strong>
      </div>

      <div
        style={{
          fontSize: 12,
          lineHeight: 1.5,
          color: "#64748b",
          marginBottom: 10,
        }}
      >
        {description}
      </div>

      <div style={{ display: "grid", gap: 2 }}>
        <SummaryRow label="Distância" value={formatSignedPrice(distanceValue)} />
        <SummaryRow label="Distância %" value={formatPercent(distancePercent)} />
      </div>
    </div>
  );
}

function InfoBlock({
  title,
  state,
  hint,
  interpretation,
  rows,
}: {
  title: string;
  state: string;
  hint: string;
  interpretation: string;
  rows: Array<{ label: string; value: string }>;
}) {
  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        padding: 12,
        background: "#ffffff",
      }}
    >
      <div
        style={{
          marginBottom: 8,
          fontSize: 13,
          fontWeight: 700,
          color: "#0f172a",
        }}
      >
        {title}
      </div>

      <div
        style={{
          marginBottom: 8,
          fontSize: 13,
          color: "#334155",
          fontWeight: 600,
        }}
      >
        {state}
      </div>

      <div
        style={{
          marginBottom: 8,
          fontSize: 12,
          lineHeight: 1.5,
          color: "#64748b",
        }}
      >
        {hint}
      </div>

      <NarrativeParagraph text={interpretation} />

      <div style={{ display: "grid", gap: 2 }}>
        {rows.map((row) => (
          <SummaryRow key={`${title}-${row.label}`} label={row.label} value={row.value} />
        ))}
      </div>
    </div>
  );
}

function ChartSummary({ candles }: ChartSummaryProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const trend = buildTrendSummary(candles);
  const movingAverages = buildMovingAverageSummary(candles);
  const confirmation = buildConfirmationSummary(candles);
  const headerTrend = buildHeaderTrendSummary(trend, movingAverages, confirmation);

  const trendBadgeStyles = getTrendBadgeStyles(trend.label);
  const averageBadgeStyles = getAverageBadgeStyles(movingAverages.globalState);
  const confirmationBadgeStyles = getConfirmationBadgeStyles(
    confirmation.robustSignal
  );
  const headerStyles = getHeaderStyles(headerTrend.label);

  const confirmationTone: CardTrendTone =
    confirmation.cloudBias === "Alta"
      ? "Alta"
      : confirmation.cloudBias === "Baixa"
      ? "Baixa"
      : confirmation.adx !== null && confirmation.adx >= 25
      ? "Alta"
      : "Neutro";

  const momentumTone: CardTrendTone =
    confirmation.rsiBias === "Alta" || confirmation.macdBias === "Alta"
      ? "Alta"
      : confirmation.rsiBias === "Baixa" || confirmation.macdBias === "Baixa"
      ? "Baixa"
      : "Lateral";

  return (
    <section
      style={{
        marginTop: 18,
        marginBottom: 18,
        border: "1px solid #dbe2ea",
        borderRadius: 16,
        background: "#ffffff",
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => setIsExpanded((previous) => !previous)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "14px 16px",
          background: headerStyles.background,
          border: "none",
          borderBottom: isExpanded ? `1px solid ${headerStyles.borderBottom}` : "none",
          cursor: "pointer",
          textAlign: "left",
        }}
        aria-expanded={isExpanded}
        aria-label={isExpanded ? "Retrair Tendência" : "Expandir Tendência"}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
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
            <strong style={{ fontSize: 16, color: headerStyles.titleColor }}>
              Tendência
            </strong>

            <span
              style={{
                padding: "4px 10px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 700,
                background: headerStyles.badgeBackground,
                color: headerStyles.badgeColor,
                border: `1px solid ${headerStyles.badgeBorder}`,
              }}
            >
              {headerTrend.label}
            </span>

            <span
              style={{
                padding: "4px 10px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 700,
                background: headerStyles.badgeBackground,
                color: headerStyles.badgeColor,
                border: `1px solid ${headerStyles.badgeBorder}`,
              }}
            >
              {formatIntegerPercent(headerTrend.confidence)}
            </span>
          </div>

          <span style={{ fontSize: 12, color: headerStyles.subtitleColor }}>
            Resumo consolidado dos cards de leitura do mercado
          </span>
        </div>

        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: 34,
            width: 34,
            height: 34,
            borderRadius: 999,
            border: `1px solid ${headerStyles.badgeBorder}`,
            background: "#ffffff",
            color: headerStyles.badgeColor,
            fontSize: 16,
            fontWeight: 700,
            lineHeight: 1,
          }}
        >
          {isExpanded ? "−" : "+"}
        </span>
      </button>

      {isExpanded && (
        <div
          style={{
            padding: 8,
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(320px, 1fr))",
            gap: 8,
            alignItems: "start",
          }}
        >
          <div style={{ display: "grid", gap: 8 }}>
            <div style={getCardStyleByTone(trend.label)}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  marginBottom: 12,
                }}
              >
                <strong style={{ fontSize: 15, color: "#0f172a" }}>
                  Contexto Geral
                </strong>

                <span
                  style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 700,
                    background: trendBadgeStyles.background,
                    color: trendBadgeStyles.color,
                    border: `1px solid ${trendBadgeStyles.border}`,
                  }}
                >
                  {trend.label}
                </span>
              </div>

              <NarrativeParagraph
                text={
                  trend.label === "Alta"
                    ? "O mercado está acima da abertura do dia e mantém vantagem compradora no intradiário. Esta leitura favorece continuidade de alta, desde que os outros indicadores confirmem força."
                    : trend.label === "Baixa"
                    ? "O mercado está abaixo da abertura do dia e mantém vantagem vendedora no intradiário. Esta leitura favorece continuidade de baixa, desde que não falte força nos demais indicadores."
                    : "A variação do dia está demasiado curta para caracterizar uma direção limpa. O contexto intradiário continua mais compatível com equilíbrio ou consolidação."
                }
              />

              <div style={{ display: "grid", gap: 2, fontSize: 14 }}>
                <SummaryRow label="Tendência" value={trend.label} />
                <SummaryRow label="Variação %" value={formatPercent(trend.percentChange)} />
                <SummaryRow label="Preço atual" value={formatPrice(trend.currentPrice)} />
              </div>
            </div>

            <div style={getCardStyleByTone(confirmationTone)}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  marginBottom: 12,
                }}
              >
                <strong style={{ fontSize: 15, color: "#0f172a" }}>
                  Força e Confirmação
                </strong>

                <span
                  style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 700,
                    background: confirmationBadgeStyles.background,
                    color: confirmationBadgeStyles.color,
                    border: `1px solid ${confirmationBadgeStyles.border}`,
                  }}
                >
                  Validação
                </span>
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                <InfoBlock
                  title="ADX"
                  state={confirmation.adxState}
                  hint={confirmation.adxHint}
                  interpretation={confirmation.adxInterpretation}
                  rows={[
                    {
                      label: "Valor",
                      value: formatNumber(confirmation.adx),
                    },
                    {
                      label: "Direção",
                      value:
                        confirmation.adxRising === null
                          ? "-"
                          : confirmation.adxRising
                          ? "A subir"
                          : "A descer",
                    },
                  ]}
                />

                <InfoBlock
                  title="Volume"
                  state={confirmation.volumeState}
                  hint={confirmation.volumeHint}
                  interpretation={confirmation.volumeInterpretation}
                  rows={[
                    {
                      label: "Volume atual",
                      value: formatVolume(confirmation.volumeNow),
                    },
                    {
                      label: "Média de 20",
                      value: formatVolume(confirmation.volumeAverage20),
                    },
                  ]}
                />

                <InfoBlock
                  title="Nuvem"
                  state={confirmation.cloudState}
                  hint={confirmation.cloudHint}
                  interpretation={confirmation.cloudInterpretation}
                  rows={[
                    {
                      label: "Topo",
                      value: formatPrice(confirmation.cloudTop),
                    },
                    {
                      label: "Base",
                      value: formatPrice(confirmation.cloudBottom),
                    },
                  ]}
                />
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <div style={getCardStyleByTone(movingAverages.globalState)}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  marginBottom: 12,
                }}
              >
                <strong style={{ fontSize: 15, color: "#0f172a" }}>
                  O Mapa de Médias
                </strong>

                <span
                  style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 700,
                    background: averageBadgeStyles.background,
                    color: averageBadgeStyles.color,
                    border: `1px solid ${averageBadgeStyles.border}`,
                  }}
                >
                  {movingAverages.globalState}
                </span>
              </div>

              <NarrativeParagraph text={movingAverages.narrative.interpretation} />

              <div style={{ display: "grid", gap: 10 }}>
                <AverageInfoLine
                  title="MME 9"
                  description="Gatilho de curto prazo."
                  item={movingAverages.ema9}
                  distanceValue={movingAverages.distanceToEma9}
                  distancePercent={movingAverages.distanceToEma9Percent}
                />

                <AverageInfoLine
                  title="MME 21"
                  description="O equilíbrio do preço."
                  item={movingAverages.ema21}
                  distanceValue={movingAverages.distanceToEma21}
                  distancePercent={movingAverages.distanceToEma21Percent}
                />

                <AverageInfoLine
                  title="MMS 200"
                  description="O divisor de águas entre Bull e Bear Market."
                  item={movingAverages.sma200}
                  distanceValue={movingAverages.distanceToSma200}
                  distancePercent={movingAverages.distanceToSma200Percent}
                />
              </div>
            </div>

            <div style={getCardStyleByTone(momentumTone)}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  marginBottom: 12,
                }}
              >
                <strong style={{ fontSize: 15, color: "#0f172a" }}>
                  Momentum e Exaustão
                </strong>

                <span
                  style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 700,
                    background: "#f8fafc",
                    color: "#334155",
                    border: "1px solid #cbd5e1",
                  }}
                >
                  Timing
                </span>
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                <InfoBlock
                  title="RSI"
                  state={confirmation.rsiState}
                  hint={confirmation.rsiHint}
                  interpretation={confirmation.rsiInterpretation}
                  rows={[
                    {
                      label: "Valor",
                      value: formatNumber(confirmation.rsi),
                    },
                    {
                      label: "Linha de equilíbrio",
                      value: "50",
                    },
                  ]}
                />

                <InfoBlock
                  title="MACD"
                  state={confirmation.macdState}
                  hint={confirmation.macdHint}
                  interpretation={confirmation.macdInterpretation}
                  rows={[
                    {
                      label: "Linha principal",
                      value: formatPrice(confirmation.macdValue),
                    },
                    {
                      label: "Linha de sinal",
                      value: formatPrice(confirmation.signalValue),
                    },
                    {
                      label: "Histograma",
                      value: formatSignedPrice(confirmation.histogramValue),
                    },
                  ]}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default ChartSummary;