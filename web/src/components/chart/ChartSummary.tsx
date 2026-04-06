// web/src/components/chart/ChartSummary.tsx

type CandleSummaryItem = {
  open_time: string;
  open?: string;
  close?: string;
};

type ChartSummaryProps = {
  candles: CandleSummaryItem[];
};

type TrendSummary = {
  label: "Alta" | "Baixa" | "Lateral";
  absoluteChange: number;
  percentChange: number;
  openPrice: number | null;
  currentPrice: number | null;
};

type MovingAverageDirection = "up" | "down" | "flat";
type RelativeColor = "green" | "red" | "neutral";

type MovingAverageValue = {
  value: number | null;
  direction: MovingAverageDirection;
};

type MovingAverageSummary = {
  sma5: MovingAverageValue;
  sma10: MovingAverageValue;
  sma20: MovingAverageValue;
  sma30: MovingAverageValue;
  sma40: MovingAverageValue;
  sma60: MovingAverageValue;
  ema5: MovingAverageValue;
  ema10: MovingAverageValue;
  ema20: MovingAverageValue;
  ema30: MovingAverageValue;
  ema40: MovingAverageValue;
  ema60: MovingAverageValue;
  currentPrice: number | null;
  shortBias:
    | "Forte alta"
    | "Alta"
    | "Forte baixa"
    | "Baixa"
    | "Neutro";
  mediumLongBias:
    | "Forte alta"
    | "Alta"
    | "Forte baixa"
    | "Baixa"
    | "Neutro";
  distanceToEma20: number | null;
  distanceToEma20Percent: number | null;
  distanceToEma60: number | null;
  distanceToEma60Percent: number | null;
};

function parseNumber(value?: string): number | null {
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

function formatPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toLocaleString("pt-PT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

function formatSignedPrice(value: number | null): string {
  if (value === null) return "-";
  return `${value >= 0 ? "+" : ""}${value.toLocaleString("pt-PT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  })}`;
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

function getCloseValues(candles: CandleSummaryItem[]): number[] {
  return candles
    .map((candle) => parseNumber(candle.close))
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
): MovingAverageDirection {
  if (currentValue === null || previousValue === null) return "flat";
  if (currentValue > previousValue) return "up";
  if (currentValue < previousValue) return "down";
  return "flat";
}

function calculateSimpleAverageWithDirection(
  values: number[],
  period: number
): MovingAverageValue {
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
): MovingAverageValue {
  const currentValue = calculateExponentialAverage(values, period);
  const previousValue = calculateExponentialAverage(values.slice(0, -1), period);

  return {
    value: currentValue,
    direction: getAverageDirection(currentValue, previousValue),
  };
}

function classifyBias(
  firstFast: MovingAverageValue,
  secondFast: MovingAverageValue,
  thirdFast: MovingAverageValue,
  firstSlow: MovingAverageValue,
  secondSlow: MovingAverageValue,
  thirdSlow: MovingAverageValue
): "Forte alta" | "Alta" | "Forte baixa" | "Baixa" | "Neutro" {
  const fastUp =
    firstFast.value !== null &&
    secondFast.value !== null &&
    thirdFast.value !== null &&
    firstFast.value > secondFast.value &&
    secondFast.value > thirdFast.value;

  const fastDown =
    firstFast.value !== null &&
    secondFast.value !== null &&
    thirdFast.value !== null &&
    firstFast.value < secondFast.value &&
    secondFast.value < thirdFast.value;

  const slowUp =
    firstSlow.value !== null &&
    secondSlow.value !== null &&
    thirdSlow.value !== null &&
    firstSlow.value > secondSlow.value &&
    secondSlow.value > thirdSlow.value;

  const slowDown =
    firstSlow.value !== null &&
    secondSlow.value !== null &&
    thirdSlow.value !== null &&
    firstSlow.value < secondSlow.value &&
    secondSlow.value < thirdSlow.value;

  if (fastUp && slowUp) return "Forte alta";
  if (fastUp) return "Alta";
  if (fastDown && slowDown) return "Forte baixa";
  if (fastDown) return "Baixa";
  return "Neutro";
}

function buildTrendSummary(candles: CandleSummaryItem[]): TrendSummary {
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
  candles: CandleSummaryItem[]
): MovingAverageSummary {
  const closeValues = getCloseValues(candles);
  const currentPrice = closeValues.length ? closeValues[closeValues.length - 1] : null;

  const sma5 = calculateSimpleAverageWithDirection(closeValues, 5);
  const sma10 = calculateSimpleAverageWithDirection(closeValues, 10);
  const sma20 = calculateSimpleAverageWithDirection(closeValues, 20);
  const sma30 = calculateSimpleAverageWithDirection(closeValues, 30);
  const sma40 = calculateSimpleAverageWithDirection(closeValues, 40);
  const sma60 = calculateSimpleAverageWithDirection(closeValues, 60);

  const ema5 = calculateExponentialAverageWithDirection(closeValues, 5);
  const ema10 = calculateExponentialAverageWithDirection(closeValues, 10);
  const ema20 = calculateExponentialAverageWithDirection(closeValues, 20);
  const ema30 = calculateExponentialAverageWithDirection(closeValues, 30);
  const ema40 = calculateExponentialAverageWithDirection(closeValues, 40);
  const ema60 = calculateExponentialAverageWithDirection(closeValues, 60);

  const shortBias = classifyBias(ema5, ema10, ema20, sma5, sma10, sma20);
  const mediumLongBias = classifyBias(ema30, ema40, ema60, sma30, sma40, sma60);

  const distanceToEma20 =
    currentPrice !== null && ema20.value !== null
      ? currentPrice - ema20.value
      : null;

  const distanceToEma20Percent =
    currentPrice !== null &&
    ema20.value !== null &&
    ema20.value !== 0
      ? ((currentPrice - ema20.value) / ema20.value) * 100
      : null;

  const distanceToEma60 =
    currentPrice !== null && ema60.value !== null
      ? currentPrice - ema60.value
      : null;

  const distanceToEma60Percent =
    currentPrice !== null &&
    ema60.value !== null &&
    ema60.value !== 0
      ? ((currentPrice - ema60.value) / ema60.value) * 100
      : null;

  return {
    sma5,
    sma10,
    sma20,
    sma30,
    sma40,
    sma60,
    ema5,
    ema10,
    ema20,
    ema30,
    ema40,
    ema60,
    currentPrice,
    shortBias,
    mediumLongBias,
    distanceToEma20,
    distanceToEma20Percent,
    distanceToEma60,
    distanceToEma60Percent,
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

function getBiasBadgeStyles(
  bias: "Forte alta" | "Alta" | "Forte baixa" | "Baixa" | "Neutro"
) {
  if (bias === "Forte alta" || bias === "Alta") {
    return {
      background: "#ecfdf5",
      color: "#166534",
      border: "#86efac",
    };
  }

  if (bias === "Forte baixa" || bias === "Baixa") {
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

function getRelativeColor(
  currentValue: number | null,
  comparisonValue: number | null
): RelativeColor {
  if (currentValue === null || comparisonValue === null) return "neutral";
  if (currentValue > comparisonValue) return "green";
  if (currentValue < comparisonValue) return "red";
  return "neutral";
}

function getArrowVisual(
  direction: MovingAverageDirection,
  relativeColor: RelativeColor
) {
  const color =
    relativeColor === "green"
      ? "#022c22"
      : relativeColor === "red"
      ? "#3f0a0a"
      : "#0f172a";

  const symbol =
    direction === "up" ? "▲" : direction === "down" ? "▼" : "▶";

  return { color, symbol };
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

function AverageLine({
  label,
  item,
  relativeColor,
}: {
  label: string;
  item: MovingAverageValue;
  relativeColor: RelativeColor;
}) {
  const arrowVisual = getArrowVisual(item.direction, relativeColor);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          color: "#475569",
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
            color: arrowVisual.color,
            letterSpacing: "-0.02em",
          }}
        >
          {arrowVisual.symbol}
        </span>

        <span>{label}</span>
      </div>

      <strong style={{ color: "#0f172a", textAlign: "right" }}>
        {formatPrice(item.value)}
      </strong>
    </div>
  );
}

function PeriodBlock({
  period,
  fasterAverage,
  slowerAverage,
}: {
  period: string;
  fasterAverage: MovingAverageValue;
  slowerAverage: MovingAverageValue;
}) {
  const fasterAverageColor = getRelativeColor(
    fasterAverage.value,
    slowerAverage.value
  );
  const slowerAverageColor = getRelativeColor(
    slowerAverage.value,
    fasterAverage.value
  );

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
          marginBottom: 10,
          fontSize: 13,
          fontWeight: 700,
          color: "#334155",
        }}
      >
        Período {period}
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        <AverageLine
          label={`Média rápida ${period}`}
          item={fasterAverage}
          relativeColor={fasterAverageColor}
        />
        <AverageLine
          label={`Média simples ${period}`}
          item={slowerAverage}
          relativeColor={slowerAverageColor}
        />
      </div>
    </div>
  );
}

function ChartSummary({ candles }: ChartSummaryProps) {
  const trend = buildTrendSummary(candles);
  const trendBadgeStyles = getTrendBadgeStyles(trend.label);

  const movingAverages = buildMovingAverageSummary(candles);
  const shortBiasBadgeStyles = getBiasBadgeStyles(movingAverages.shortBias);
  const mediumLongBiasBadgeStyles = getBiasBadgeStyles(
    movingAverages.mediumLongBias
  );

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        gap: 12,
        marginTop: 18,
        marginBottom: 18,
      }}
    >
      <div
        style={{
          border: "1px solid #dbe2ea",
          background: "#ffffff",
          borderRadius: 14,
          padding: 16,
        }}
      >
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

        <div
          style={{
            display: "grid",
            gap: 2,
            fontSize: 14,
          }}
        >
          <SummaryRow label="Variação" value={formatSignedPrice(trend.absoluteChange)} />
          <SummaryRow label="Variação %" value={formatPercent(trend.percentChange)} />
          <SummaryRow label="Abertura do dia" value={formatPrice(trend.openPrice)} />
          <SummaryRow label="Preço atual" value={formatPrice(trend.currentPrice)} />
        </div>
      </div>

      <div
        style={{
          border: "1px solid #dbe2ea",
          background: "#ffffff",
          borderRadius: 14,
          padding: 16,
        }}
      >
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
            Médias Móveis de Curto Prazo
          </strong>

          <span
            style={{
              padding: "6px 10px",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 700,
              background: shortBiasBadgeStyles.background,
              color: shortBiasBadgeStyles.color,
              border: `1px solid ${shortBiasBadgeStyles.border}`,
            }}
          >
            {movingAverages.shortBias}
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gap: 10,
            marginBottom: 14,
          }}
        >
          <PeriodBlock
            period="5"
            fasterAverage={movingAverages.ema5}
            slowerAverage={movingAverages.sma5}
          />
          <PeriodBlock
            period="10"
            fasterAverage={movingAverages.ema10}
            slowerAverage={movingAverages.sma10}
          />
          <PeriodBlock
            period="20"
            fasterAverage={movingAverages.ema20}
            slowerAverage={movingAverages.sma20}
          />
        </div>

        <div
          style={{
            display: "grid",
            gap: 2,
            fontSize: 14,
          }}
        >
          <SummaryRow label="Preço atual" value={formatPrice(movingAverages.currentPrice)} />
          <SummaryRow
            label="Distância para a média 20"
            value={formatSignedPrice(movingAverages.distanceToEma20)}
          />
          <SummaryRow
            label="Distância % para a média 20"
            value={
              movingAverages.distanceToEma20Percent === null
                ? "-"
                : formatPercent(movingAverages.distanceToEma20Percent)
            }
          />
        </div>
      </div>

      <div
        style={{
          border: "1px solid #dbe2ea",
          background: "#ffffff",
          borderRadius: 14,
          padding: 16,
        }}
      >
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
            Médias Móveis de Médio e Longo Prazo
          </strong>

          <span
            style={{
              padding: "6px 10px",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 700,
              background: mediumLongBiasBadgeStyles.background,
              color: mediumLongBiasBadgeStyles.color,
              border: `1px solid ${mediumLongBiasBadgeStyles.border}`,
            }}
          >
            {movingAverages.mediumLongBias}
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gap: 10,
            marginBottom: 14,
          }}
        >
          <PeriodBlock
            period="30"
            fasterAverage={movingAverages.ema30}
            slowerAverage={movingAverages.sma30}
          />
          <PeriodBlock
            period="40"
            fasterAverage={movingAverages.ema40}
            slowerAverage={movingAverages.sma40}
          />
          <PeriodBlock
            period="60"
            fasterAverage={movingAverages.ema60}
            slowerAverage={movingAverages.sma60}
          />
        </div>

        <div
          style={{
            display: "grid",
            gap: 2,
            fontSize: 14,
          }}
        >
          <SummaryRow label="Preço atual" value={formatPrice(movingAverages.currentPrice)} />
          <SummaryRow
            label="Distância para a média 60"
            value={formatSignedPrice(movingAverages.distanceToEma60)}
          />
          <SummaryRow
            label="Distância % para a média 60"
            value={
              movingAverages.distanceToEma60Percent === null
                ? "-"
                : formatPercent(movingAverages.distanceToEma60Percent)
            }
          />
        </div>
      </div>

      <div
        style={{
          border: "1px solid #dbe2ea",
          background: "#ffffff",
          borderRadius: 14,
          padding: 16,
          fontSize: 14,
        }}
      >
        <div style={{ display: "grid", gap: 2 }}>
          <SummaryRow label="Total candles" value={`${candles.length}`} />
          <SummaryRow label="Primeiro candle" value={candles[0]?.open_time ?? "-"} />
          <SummaryRow
            label="Último candle"
            value={candles[candles.length - 1]?.open_time ?? "-"}
          />
        </div>
      </div>
    </div>
  );
}

export default ChartSummary;