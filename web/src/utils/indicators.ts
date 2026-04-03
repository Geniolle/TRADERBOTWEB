// web/src/utils/indicators.ts

export type NumericPoint = {
  time: string;
  value: number;
};

export type BollingerPoint = {
  time: string;
  middle: number;
  upper: number;
  lower: number;
};

function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value);
}

export function calculateEMA(
  values: NumericPoint[],
  period: number
): NumericPoint[] {
  if (!Array.isArray(values) || values.length === 0) return [];
  if (!Number.isFinite(period) || period <= 0) return [];

  const multiplier = 2 / (period + 1);
  const result: NumericPoint[] = [];

  let ema: number | null = null;
  let seedSum = 0;

  for (let index = 0; index < values.length; index += 1) {
    const item = values[index];
    const currentValue = Number(item.value);

    if (!isFiniteNumber(currentValue)) continue;

    if (index < period - 1) {
      seedSum += currentValue;
      continue;
    }

    if (index === period - 1) {
      seedSum += currentValue;
      ema = seedSum / period;
      result.push({
        time: item.time,
        value: ema,
      });
      continue;
    }

    if (ema === null) continue;

    ema = currentValue * multiplier + ema * (1 - multiplier);

    result.push({
      time: item.time,
      value: ema,
    });
  }

  return result;
}

export function calculateSMA(
  values: NumericPoint[],
  period: number
): NumericPoint[] {
  if (!Array.isArray(values) || values.length === 0) return [];
  if (!Number.isFinite(period) || period <= 0) return [];

  const result: NumericPoint[] = [];
  let rollingSum = 0;

  for (let index = 0; index < values.length; index += 1) {
    const current = Number(values[index].value);
    if (!isFiniteNumber(current)) continue;

    rollingSum += current;

    if (index >= period) {
      rollingSum -= Number(values[index - period].value);
    }

    if (index >= period - 1) {
      result.push({
        time: values[index].time,
        value: rollingSum / period,
      });
    }
  }

  return result;
}

export function calculateBollingerBands(
  values: NumericPoint[],
  period: number,
  standardDeviationMultiplier: number
): BollingerPoint[] {
  if (!Array.isArray(values) || values.length === 0) return [];
  if (!Number.isFinite(period) || period <= 0) return [];
  if (
    !Number.isFinite(standardDeviationMultiplier) ||
    standardDeviationMultiplier <= 0
  ) {
    return [];
  }

  const result: BollingerPoint[] = [];

  for (let index = period - 1; index < values.length; index += 1) {
    const window = values.slice(index - period + 1, index + 1);
    const rawValues = window.map((item) => Number(item.value));

    if (!rawValues.every((item) => isFiniteNumber(item))) continue;

    const mean =
      rawValues.reduce((accumulator, item) => accumulator + item, 0) / period;

    const variance =
      rawValues.reduce(
        (accumulator, item) => accumulator + (item - mean) ** 2,
        0
      ) / period;

    const stdDev = Math.sqrt(variance);

    result.push({
      time: values[index].time,
      middle: mean,
      upper: mean + stdDev * standardDeviationMultiplier,
      lower: mean - stdDev * standardDeviationMultiplier,
    });
  }

  return result;
}