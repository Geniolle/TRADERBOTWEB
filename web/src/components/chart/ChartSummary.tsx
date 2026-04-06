// web/src/components/chart/ChartSummary.tsx

import type { CandleItem } from "../../types/trading";

type ChartSummaryProps = {
  candles: CandleItem[];
};

type TrendSummary = {
  label: "Alta" | "Baixa" | "Lateral";
  absoluteChange: number;
  percentChange: number;
  openPrice: number | null;
  currentPrice: number | null;
};

type AverageDirection = "up" | "down" | "flat";

type AverageValue = {
  value: number | null;
  direction: AverageDirection;
};

type MovingAverageSummary = {
  currentPrice: number | null;
  ema9: AverageValue;
  ema21: AverageValue;
  sma200: AverageValue;
  distanceToEma9: number | null;
  distanceToEma21: number | null;
  distanceToSma200: number | null;
  globalState: "Alta" | "Baixa" | "Neutro";
};

type ConfirmationSummary = {
  adx: number | null;
  adxState: string;
  adxHint: string;
  adxRising: boolean | null;

  volumeNow: number | null;
  volumeAverage20: number | null;
  volumeState: string;
  volumeHint: string;

  macdValue: number | null;
  signalValue: number | null;
  histogramValue: number | null;
  macdState: string;
  macdHint: string;

  rsi: number | null;
  rsiState: string;
  rsiHint: string;

  cloudTop: number | null;
  cloudBottom: number | null;
  cloudState: string;
  cloudHint: string;

  robustSignal: string;
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

function formatPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toLocaleString("pt-PT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

function formatVolume(value: number | null): string {
  if (value === null) return "-";
  return value.toLocaleString("pt-PT", {
    minimumFractionDigits: 0,
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

function calculateExponentialAverage(
  values: number[],
  period: number
): number | null {
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

  let label: "Alta" | "Baixa" | "Lateral" = "Lateral";

  if (percentChange > 0.05) {
    label = "Alta";
  } else if (percentChange < -0.05) {
    label = "Baixa";
  }

  return {
    label,
    absoluteChange,
    percentChange,
    openPrice,
    currentPrice,
  };
}

function buildMovingAverageSummary(
  candles: CandleItem[]
): MovingAverageSummary {
  const closeValues = getCloseValues(candles);
  const currentPrice = closeValues.length
    ? closeValues[closeValues.length - 1]
    : null;

  const ema9 = calculateExponentialAverageWithDirection(closeValues, 9);
  const ema21 = calculateExponentialAverageWithDirection(closeValues, 21);
  const sma200 = calculateSimpleAverageWithDirection(closeValues, 200);

  const distanceToEma9 =
    currentPrice !== null && ema9.value !== null
      ? currentPrice - ema9.value
      : null;

  const distanceToEma21 =
    currentPrice !== null && ema21.value !== null
      ? currentPrice - ema21.value
      : null;

  const distanceToSma200 =
    currentPrice !== null && sma200.value !== null
      ? currentPrice - sma200.value
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

  return {
    currentPrice,
    ema9,
    ema21,
    sma200,
    distanceToEma9,
    distanceToEma21,
    distanceToSma200,
    globalState,
  };
}

function calculateRsi(values: number[], period = 14): number | null {
  if (values.length <= period) return null;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i += 1) {
    const change = values[i] - values[i - 1];
    if (change >= 0) gains += change;
    else losses += Math.abs(change);
  }

  let averageGain = gains / period;
  let averageLoss = losses / period;

  for (let i = period + 1; i < values.length; i += 1) {
    const change = values[i] - values[i - 1];
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

  for (let i = 0; i < values.length; i += 1) {
    const slice = values.slice(0, i + 1);
    ema12Series.push(calculateExponentialAverage(slice, 12) ?? NaN);
    ema26Series.push(calculateExponentialAverage(slice, 26) ?? NaN);
  }

  const macdSeries = ema12Series
    .map((value, index) =>
      Number.isFinite(value) && Number.isFinite(ema26Series[index])
        ? value - ema26Series[index]
        : NaN
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
  const histogram =
    signal !== null && macd !== null ? macd - signal : null;

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

  for (let i = 1; i < highs.length; i += 1) {
    const highDiff = highs[i] - highs[i - 1];
    const lowDiff = lows[i - 1] - lows[i];

    const plusDm =
      highDiff > lowDiff && highDiff > 0 ? highDiff : 0;
    const minusDm =
      lowDiff > highDiff && lowDiff > 0 ? lowDiff : 0;

    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );

    trList.push(tr);
    plusDmList.push(plusDm);
    minusDmList.push(minusDm);
  }

  if (trList.length < period) {
    return { adx: null, previousAdx: null };
  }

  let trSmoothed =
    trList.slice(0, period).reduce((sum, value) => sum + value, 0);
  let plusSmoothed =
    plusDmList.slice(0, period).reduce((sum, value) => sum + value, 0);
  let minusSmoothed =
    minusDmList.slice(0, period).reduce((sum, value) => sum + value, 0);

  const dxValues: number[] = [];

  for (let i = period; i < trList.length; i += 1) {
    if (i > period) {
      trSmoothed = trSmoothed - trSmoothed / period + trList[i];
      plusSmoothed = plusSmoothed - plusSmoothed / period + plusDmList[i];
      minusSmoothed = minusSmoothed - minusSmoothed / period + minusDmList[i];
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

  for (let i = period; i < dxValues.length; i += 1) {
    adx = (adx * (period - 1) + dxValues[i]) / period;
    adxSeries.push(adx);
  }

  return {
    adx: adxSeries[adxSeries.length - 1] ?? null,
    previousAdx:
      adxSeries.length > 1 ? adxSeries[adxSeries.length - 2] : null,
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

function buildConfirmationSummary(candles: CandleItem[]): ConfirmationSummary {
  const closes = getCloseValues(candles);
  const highs = getHighValues(candles);
  const lows = getLowValues(candles);
  const volumes = getVolumeValues(candles);

  const { adx, previousAdx } = calculateAdx(highs, lows, closes, 14);
  const adxRising =
    adx !== null && previousAdx !== null ? adx > previousAdx : null;

  let adxState = "Sem leitura";
  let adxHint = "Faltam candles para medir a força do movimento.";

  if (adx !== null) {
    if (adx < 20) {
      adxState = "Mercado lateral";
      adxHint = "Evitar sinais de cruzamento. O mercado está fraco.";
    } else if (adx < 25) {
      adxState = "Força a ganhar";
      adxHint = "Ainda não confirma bem. Melhor esperar mais força.";
    } else if (adx < 40) {
      adxState = "Tendência forte";
      adxHint = "Boa zona para confirmar entradas com as médias.";
    } else {
      adxState = "Tendência muito forte";
      adxHint = "Movimento muito forte. Atenção a esticão e cansaço.";
    }
  }

  const volumeNow = volumes.length ? volumes[volumes.length - 1] : null;
  const volumeAverage20 = calculateSimpleAverage(volumes, 20);

  let volumeState = "Sem leitura";
  let volumeHint = "Faltam candles para avaliar o volume.";

  if (volumeNow !== null && volumeAverage20 !== null) {
    if (volumeNow > volumeAverage20) {
      volumeState = "Volume acima da média";
      volumeHint = "O movimento está com mais combustível que o normal.";
    } else {
      volumeState = "Volume abaixo da média";
      volumeHint =
        "Movimento com pouco combustível. Pode falhar com mais facilidade.";
    }
  }

  const { macd, signal, histogram } = calculateMacd(closes);

  let macdState = "Sem leitura";
  let macdHint = "Faltam candles para medir aceleração.";

  if (histogram !== null) {
    if (histogram > 0) {
      macdState = "Aceleração positiva";
      macdHint = "O movimento está a ganhar força para cima.";
    } else if (histogram < 0) {
      macdState = "Aceleração negativa";
      macdHint = "O movimento está a ganhar força para baixo.";
    } else {
      macdState = "Equilíbrio";
      macdHint = "Sem aceleração clara neste momento.";
    }
  }

  const rsi = calculateRsi(closes, 14);

  let rsiState = "Sem leitura";
  let rsiHint = "Faltam candles para medir o ritmo do preço.";

  if (rsi !== null) {
    if (rsi >= 70) {
      rsiState = "Preço esticado";
      rsiHint =
        "Zona alta. O movimento pode continuar, mas o risco de correção cresce.";
    } else if (rsi > 50) {
      rsiState = "Alta saudável";
      rsiHint = "O preço ainda mostra espaço favorável para continuação.";
    } else if (rsi <= 30) {
      rsiState = "Preço muito pressionado";
      rsiHint =
        "Zona fraca. Pode haver reação, mas o mercado ainda está pesado.";
    } else {
      rsiState = "Abaixo do equilíbrio";
      rsiHint = "O preço está abaixo da zona saudável de alta.";
    }
  }

  const cloud = calculateCloud(highs, lows, closes);

  let cloudState = "Sem leitura";
  let cloudHint = "Faltam candles para a leitura da nuvem.";

  if (
    cloud.price !== null &&
    cloud.top !== null &&
    cloud.bottom !== null
  ) {
    if (cloud.price > cloud.top) {
      cloudState = "Preço acima da nuvem";
      cloudHint = "Confirmação favorável de médio e longo prazo.";
    } else if (cloud.price < cloud.bottom) {
      cloudState = "Preço abaixo da nuvem";
      cloudHint = "Leitura desfavorável de médio e longo prazo.";
    } else {
      cloudState = "Preço dentro da nuvem";
      cloudHint = "Mercado indeciso nesta zona.";
    }
  }

  const robustConditions = [
    adx !== null && adx >= 25 && adxRising === true,
    volumeNow !== null &&
      volumeAverage20 !== null &&
      volumeNow > volumeAverage20,
    histogram !== null && histogram > 0,
  ].filter(Boolean).length;

  let robustSignal = "Sinal fraco";

  if (robustConditions >= 3) {
    robustSignal = "Confirmação robusta";
  } else if (robustConditions === 2) {
    robustSignal = "Confirmação parcial";
  }

  return {
    adx,
    adxState,
    adxHint,
    adxRising,
    volumeNow,
    volumeAverage20,
    volumeState,
    volumeHint,
    macdValue: macd,
    signalValue: signal,
    histogramValue: histogram,
    macdState,
    macdHint,
    rsi,
    rsiState,
    rsiHint,
    cloudTop: cloud.top,
    cloudBottom: cloud.bottom,
    cloudState,
    cloudHint,
    robustSignal,
  };
}

function getTrendBadgeStyles(label: TrendSummary["label"]) {
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
  if (direction === "up") return "#022c22";
  if (direction === "down") return "#3f0a0a";
  return "#0f172a";
}

const cardStyle: React.CSSProperties = {
  border: "1px solid #dbe2ea",
  background: "#ffffff",
  borderRadius: 14,
  padding: 16,
  alignSelf: "start",
  height: "fit-content",
};

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

function AverageInfoLine({
  title,
  description,
  item,
}: {
  title: string;
  description: string;
  item: AverageValue;
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
        alignSelf: "start",
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
        }}
      >
        {description}
      </div>
    </div>
  );
}

function InfoBlock({
  title,
  state,
  hint,
  rows,
}: {
  title: string;
  state: string;
  hint: string;
  rows: Array<{ label: string; value: string }>;
}) {
  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        padding: 12,
        background: "#ffffff",
        alignSelf: "start",
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
          marginBottom: 10,
          fontSize: 12,
          lineHeight: 1.5,
          color: "#64748b",
        }}
      >
        {hint}
      </div>

      <div style={{ display: "grid", gap: 2 }}>
        {rows.map((row) => (
          <SummaryRow key={`${title}-${row.label}`} label={row.label} value={row.value} />
        ))}
      </div>
    </div>
  );
}

function ChartSummary({ candles }: ChartSummaryProps) {
  const trend = buildTrendSummary(candles);
  const trendBadgeStyles = getTrendBadgeStyles(trend.label);

  const movingAverages = buildMovingAverageSummary(candles);
  const averageBadgeStyles = getAverageBadgeStyles(movingAverages.globalState);

  const confirmation = buildConfirmationSummary(candles);
  const confirmationBadgeStyles = getConfirmationBadgeStyles(
    confirmation.robustSignal
  );

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(360px, max-content))",
        gap: 12,
        marginTop: 18,
        marginBottom: 18,
        alignItems: "start",
        justifyContent: "start",
      }}
    >
      <div style={{ display: "grid", gap: 12, alignSelf: "start" }}>
        <div style={cardStyle}>
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
              Tendência
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

          <div style={{ display: "grid", gap: 2, fontSize: 14 }}>
            <SummaryRow label="Variação" value={formatSignedPrice(trend.absoluteChange)} />
            <SummaryRow label="Variação %" value={formatPercent(trend.percentChange)} />
            <SummaryRow label="Abertura do dia" value={formatPrice(trend.openPrice)} />
            <SummaryRow label="Preço atual" value={formatPrice(trend.currentPrice)} />
          </div>
        </div>

        <div style={cardStyle}>
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
              {confirmation.robustSignal}
            </span>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            <InfoBlock
              title="ADX"
              state={confirmation.adxState}
              hint={confirmation.adxHint}
              rows={[
                {
                  label: "Valor",
                  value:
                    confirmation.adx === null
                      ? "-"
                      : confirmation.adx.toLocaleString("pt-PT", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        }),
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
              title="MACD"
              state={confirmation.macdState}
              hint={confirmation.macdHint}
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

            <InfoBlock
              title="RSI"
              state={confirmation.rsiState}
              hint={confirmation.rsiHint}
              rows={[
                {
                  label: "Valor",
                  value:
                    confirmation.rsi === null
                      ? "-"
                      : confirmation.rsi.toLocaleString("pt-PT", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        }),
                },
                {
                  label: "Linha de equilíbrio",
                  value: "50",
                },
              ]}
            />

            <InfoBlock
              title="Nuvem"
              state={confirmation.cloudState}
              hint={confirmation.cloudHint}
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

      <div style={{ display: "grid", gap: 12, alignSelf: "start" }}>
        <div style={cardStyle}>
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
              Médias Móveis
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

          <div style={{ display: "grid", gap: 10, marginBottom: 14 }}>
            <AverageInfoLine
              title="MME 9"
              description="Para ver se o preço está acelerando agora."
              item={movingAverages.ema9}
            />

            <AverageInfoLine
              title="MME 21"
              description="Para saber onde posicionar seu stop ou esperar um repique."
              item={movingAverages.ema21}
            />

            <AverageInfoLine
              title="MMS 200"
              description="Para nunca operar contra a tendência principal do dia ou da semana."
              item={movingAverages.sma200}
            />
          </div>

          <div style={{ display: "grid", gap: 2, fontSize: 14 }}>
            <SummaryRow label="Preço atual" value={formatPrice(movingAverages.currentPrice)} />
            <SummaryRow
              label="Distância para MME 9"
              value={formatSignedPrice(movingAverages.distanceToEma9)}
            />
            <SummaryRow
              label="Distância para MME 21"
              value={formatSignedPrice(movingAverages.distanceToEma21)}
            />
            <SummaryRow
              label="Distância para MMS 200"
              value={formatSignedPrice(movingAverages.distanceToSma200)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChartSummary;