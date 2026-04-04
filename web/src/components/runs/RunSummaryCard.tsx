// web/src/components/runs/RunSummaryCard.tsx

import type { CandleTickState, RunDetailsResponse } from "../../types/trading";
import { formatDateTime } from "../../utils/format";

type RunSummaryCardProps = {
  mainCardStyle: React.CSSProperties;
  selectedRunId: string;
  loadingRunDetails: boolean;
  runDetailsError: string;
  runDetails: RunDetailsResponse | null;
  wsStatus: string;
  lastWsEvent: string;
  heartbeatCount: number | null;
  heartbeatMessage: string;
  candlesRefreshCount: number | null;
  candlesRefreshReason: string;
  lastCandleTick: CandleTickState;
};

type OutcomeLikeCase = RunDetailsResponse["cases"][number] & {
  outcome?: string | null;
};

type SimpleIfrContext = {
  formattedValue: string;
  strength: string;
  situation: string;
};

type SimpleMacdContext = {
  direction: string;
  strength: string;
};

type SimpleAtrContext = {
  formattedValue: string;
  volatility: string;
  situation: string;
};

type SimpleTextContext = {
  label: string;
  situation: string;
};

type ConfirmationResult = {
  confirmationPercent: number | null;
  confirmations: number;
  conflicts: number;
};

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string") {
    const normalized = value.replace(",", ".").trim();
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "-";
  return `${value.toFixed(2)}%`;
}

function formatPrice(value: unknown): string {
  const numberValue = toNumber(value);
  if (numberValue === null) return "-";
  return numberValue.toFixed(5);
}

function readMetricNumber(metrics: unknown, key: string): number | null {
  if (!metrics || typeof metrics !== "object") return null;
  const raw = (metrics as Record<string, unknown>)[key];
  return toNumber(raw);
}

function countCasesByOutcome(cases: OutcomeLikeCase[]) {
  let hits = 0;
  let fails = 0;
  let timeouts = 0;

  for (const item of cases) {
    const outcome = String(item.outcome ?? "").trim().toLowerCase();

    if (outcome === "hit") {
      hits += 1;
      continue;
    }

    if (outcome === "fail") {
      fails += 1;
      continue;
    }

    if (outcome === "timeout") {
      timeouts += 1;
    }
  }

  return { hits, fails, timeouts };
}

function buildSummary(runDetails: RunDetailsResponse) {
  const cases = (runDetails.cases ?? []) as OutcomeLikeCase[];
  const metrics = runDetails.metrics;

  const fallbackCounts = countCasesByOutcome(cases);

  const totalCases =
    readMetricNumber(metrics, "total_cases") ??
    readMetricNumber(metrics, "cases_count") ??
    cases.length;

  const totalHits =
    readMetricNumber(metrics, "total_hits") ?? fallbackCounts.hits;

  const totalFails =
    readMetricNumber(metrics, "total_fails") ?? fallbackCounts.fails;

  const totalTimeouts =
    readMetricNumber(metrics, "total_timeouts") ?? fallbackCounts.timeouts;

  const computedHitRate = totalCases > 0 ? (totalHits / totalCases) * 100 : 0;
  const computedFailRate = totalCases > 0 ? (totalFails / totalCases) * 100 : 0;
  const computedTimeoutRate =
    totalCases > 0 ? (totalTimeouts / totalCases) * 100 : 0;

  const hitRate = readMetricNumber(metrics, "hit_rate") ?? computedHitRate;
  const failRate = readMetricNumber(metrics, "fail_rate") ?? computedFailRate;
  const timeoutRate =
    readMetricNumber(metrics, "timeout_rate") ?? computedTimeoutRate;

  return {
    totalCases,
    totalHits,
    totalFails,
    totalTimeouts,
    hitRate,
    failRate,
    timeoutRate,
  };
}

function summaryMetricCard(
  label: string,
  value: string | number,
  accent?: React.CSSProperties["borderTop"]
) {
  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        padding: 14,
        background: "#f8fafc",
        borderTop: accent ?? "4px solid #cbd5e1",
      }}
    >
      <div
        style={{
          fontSize: 13,
          color: "#64748b",
          marginBottom: 6,
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 24,
          fontWeight: 700,
          color: "#0f172a",
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function buildOutcomeLists(cases: OutcomeLikeCase[]) {
  const hits = cases.filter(
    (item) => String(item.outcome ?? "").trim().toLowerCase() === "hit"
  );

  const fails = cases.filter(
    (item) => String(item.outcome ?? "").trim().toLowerCase() === "fail"
  );

  const sortByTimeDesc = (a: OutcomeLikeCase, b: OutcomeLikeCase) => {
    const aTime = new Date(
      a.close_time ?? a.entry_time ?? a.trigger_time ?? 0
    ).getTime();
    const bTime = new Date(
      b.close_time ?? b.entry_time ?? b.trigger_time ?? 0
    ).getTime();
    return bTime - aTime;
  };

  return {
    hits: [...hits].sort(sortByTimeDesc),
    fails: [...fails].sort(sortByTimeDesc),
  };
}

function getTradeSideLabel(item: OutcomeLikeCase): string {
  const metadataTradeBias =
    typeof item.metadata === "object" &&
    item.metadata !== null &&
    "trade_bias" in item.metadata
      ? String((item.metadata as Record<string, unknown>).trade_bias ?? "")
          .trim()
          .toLowerCase()
      : "";

  const rawSide = String(item.side ?? "").trim().toLowerCase();
  const resolved = metadataTradeBias || rawSide;

  if (resolved === "long" || resolved === "buy" || resolved === "compra") {
    return "Compra";
  }

  if (resolved === "short" || resolved === "sell" || resolved === "venda") {
    return "Venda";
  }

  return "-";
}

function getAnalysisSnapshot(item: OutcomeLikeCase): Record<string, unknown> | null {
  if (!item.metadata || typeof item.metadata !== "object") return null;

  const metadata = item.metadata as Record<string, unknown>;
  if (!metadata.analysis_snapshot || typeof metadata.analysis_snapshot !== "object") {
    return null;
  }

  return metadata.analysis_snapshot as Record<string, unknown>;
}

function getGroupSnapshot(
  item: OutcomeLikeCase,
  groupName:
    | "trend"
    | "momentum"
    | "volatility"
    | "structure"
    | "trigger_candle"
    | "bollinger"
): Record<string, unknown> | null {
  const snapshot = getAnalysisSnapshot(item);
  if (!snapshot) return null;

  const group = snapshot[groupName];
  if (!group || typeof group !== "object") return null;

  return group as Record<string, unknown>;
}

function getSimpleIfrContext(value: unknown): SimpleIfrContext {
  const numericValue = toNumber(value);

  if (numericValue === null) {
    return {
      formattedValue: "-",
      strength: "Sem leitura",
      situation: "Sem dados",
    };
  }

  const formattedValue = numericValue.toFixed(2).replace(".", ",");

  if (numericValue < 30) {
    return {
      formattedValue,
      strength: "Baixa",
      situation: "Mercado pressionado para baixo",
    };
  }

  if (numericValue < 45) {
    return {
      formattedValue,
      strength: "Fraqueza",
      situation: "Mercado fraco",
    };
  }

  if (numericValue < 55) {
    return {
      formattedValue,
      strength: "Neutro",
      situation: "Mercado equilibrado",
    };
  }

  if (numericValue < 70) {
    return {
      formattedValue,
      strength: "Alta",
      situation: "Mercado esticado",
    };
  }

  return {
    formattedValue,
    strength: "Alta forte",
    situation: "Mercado muito esticado",
  };
}

function getSimpleMacdContext(state: unknown): SimpleMacdContext {
  const raw = String(state ?? "").trim().toLowerCase();

  if (!raw) {
    return {
      direction: "Sem leitura",
      strength: "Sem dados",
    };
  }

  if (
    raw.includes("bearish") ||
    raw.includes("below_signal") ||
    raw.includes("below")
  ) {
    return {
      direction: "Queda",
      strength: "Pressão vendedora",
    };
  }

  if (
    raw.includes("bullish") ||
    raw.includes("above_signal") ||
    raw.includes("above")
  ) {
    return {
      direction: "Alta",
      strength: "Pressão compradora",
    };
  }

  if (raw.includes("neutral")) {
    return {
      direction: "Neutro",
      strength: "Sem força clara",
    };
  }

  return {
    direction: "Indefinida",
    strength: "Sem força clara",
  };
}

function getSimpleAtrContext(value: unknown, regime: unknown): SimpleAtrContext {
  const numericValue = toNumber(value);
  const rawRegime = String(regime ?? "").trim().toLowerCase();

  if (numericValue === null) {
    return {
      formattedValue: "-",
      volatility: "Sem leitura",
      situation: "Sem dados",
    };
  }

  const formattedValue = numericValue.toFixed(5).replace(".", ",");

  if (
    rawRegime.includes("high") ||
    rawRegime.includes("alto") ||
    rawRegime.includes("expanded") ||
    rawRegime.includes("expansion")
  ) {
    return {
      formattedValue,
      volatility: "Alta",
      situation: "Mercado agitado",
    };
  }

  if (
    rawRegime.includes("low") ||
    rawRegime.includes("baixo") ||
    rawRegime.includes("contracted") ||
    rawRegime.includes("contraction")
  ) {
    return {
      formattedValue,
      volatility: "Baixa",
      situation: "Mercado calmo",
    };
  }

  return {
    formattedValue,
    volatility: "Média",
    situation: "Movimento normal",
  };
}

function getSimpleStructureContext(value: unknown): SimpleTextContext {
  const raw = String(value ?? "").trim().toLowerCase();

  if (!raw) {
    return { label: "Sem leitura", situation: "Sem dados" };
  }

  if (
    raw.includes("uptrend") ||
    raw.includes("bullish") ||
    raw.includes("higher high") ||
    raw.includes("higher low") ||
    raw.includes("alta")
  ) {
    return {
      label: "Alta",
      situation: "Estrutura favorável para subida",
    };
  }

  if (
    raw.includes("downtrend") ||
    raw.includes("bearish") ||
    raw.includes("lower high") ||
    raw.includes("lower low") ||
    raw.includes("queda")
  ) {
    return {
      label: "Queda",
      situation: "Estrutura favorável para descida",
    };
  }

  if (raw.includes("range") || raw.includes("lateral") || raw.includes("sideways")) {
    return {
      label: "Lateral",
      situation: "Mercado sem direção clara",
    };
  }

  return {
    label: "Indefinida",
    situation: "Estrutura sem clareza",
  };
}

function getSimpleEmaAlignmentContext(value: unknown): SimpleTextContext {
  const raw = String(value ?? "").trim().toLowerCase();

  if (!raw) {
    return { label: "Sem leitura", situation: "Sem dados" };
  }

  if (
    raw.includes("bullish") ||
    raw.includes("aligned_long") ||
    raw.includes("up") ||
    raw.includes("alta")
  ) {
    return {
      label: "Alta",
      situation: "Médias alinhadas para subida",
    };
  }

  if (
    raw.includes("bearish") ||
    raw.includes("aligned_short") ||
    raw.includes("down") ||
    raw.includes("queda")
  ) {
    return {
      label: "Queda",
      situation: "Médias alinhadas para descida",
    };
  }

  if (raw.includes("mixed") || raw.includes("neutral") || raw.includes("misto")) {
    return {
      label: "Misto",
      situation: "Médias sem alinhamento limpo",
    };
  }

  return {
    label: "Indefinido",
    situation: "Alinhamento sem clareza",
  };
}

function getSimpleSlopeContext(value: unknown): SimpleTextContext {
  const raw = String(value ?? "").trim().toLowerCase();
  const numericValue = toNumber(value);

  if (!raw && numericValue === null) {
    return { label: "Sem leitura", situation: "Sem dados" };
  }

  if (
    raw.includes("up") ||
    raw.includes("rising") ||
    raw.includes("positive") ||
    raw.includes("alta")
  ) {
    return {
      label: "A subir",
      situation: "Tendência a ganhar força",
    };
  }

  if (
    raw.includes("down") ||
    raw.includes("falling") ||
    raw.includes("negative") ||
    raw.includes("queda")
  ) {
    return {
      label: "A descer",
      situation: "Tendência a perder força ou cair",
    };
  }

  if (raw.includes("flat") || raw.includes("neutral") || raw.includes("lateral")) {
    return {
      label: "Lateral",
      situation: "Sem aceleração clara",
    };
  }

  if (numericValue !== null) {
    if (numericValue > 0) {
      return {
        label: "A subir",
        situation: "Tendência a ganhar força",
      };
    }

    if (numericValue < 0) {
      return {
        label: "A descer",
        situation: "Tendência a perder força ou cair",
      };
    }

    return {
      label: "Lateral",
      situation: "Sem aceleração clara",
    };
  }

  return {
    label: "Indefinida",
    situation: "Inclinação sem clareza",
  };
}

function getSimplePriceVsEmaContext(value: unknown): SimpleTextContext {
  const raw = String(value ?? "").trim().toLowerCase();

  if (!raw) {
    return { label: "Sem leitura", situation: "Sem dados" };
  }

  if (raw.includes("above") || raw.includes("acima") || raw.includes("over")) {
    return {
      label: "Acima",
      situation: "Preço do lado comprador",
    };
  }

  if (raw.includes("below") || raw.includes("abaixo") || raw.includes("under")) {
    return {
      label: "Abaixo",
      situation: "Preço do lado vendedor",
    };
  }

  return {
    label: "Neutro",
    situation: "Preço sem posição clara",
  };
}

function getSimpleDistanceContext(
  value: unknown,
  kind: "support" | "resistance"
): SimpleTextContext {
  const numericValue = toNumber(value);

  if (numericValue === null) {
    return { label: "Sem leitura", situation: "Sem dados" };
  }

  if (numericValue <= 0) {
    return {
      label: "Colado",
      situation:
        kind === "support"
          ? "Muito perto do suporte"
          : "Muito perto da resistência",
    };
  }

  if (numericValue < 0.25) {
    return {
      label: "Muito perto",
      situation:
        kind === "support"
          ? "Pouco espaço até ao suporte"
          : "Pouco espaço até à resistência",
    };
  }

  if (numericValue < 0.75) {
    return {
      label: "Perto",
      situation:
        kind === "support"
          ? "Distância curta até ao suporte"
          : "Distância curta até à resistência",
    };
  }

  return {
    label: "Com espaço",
    situation:
      kind === "support"
        ? "Há espaço razoável até ao suporte"
        : "Há espaço razoável até à resistência",
  };
}

function getSimpleCandleVsAtrContext(value: unknown): SimpleTextContext {
  const numericValue = toNumber(value);

  if (numericValue === null) {
    return { label: "Sem leitura", situation: "Sem dados" };
  }

  if (numericValue < 0.6) {
    return {
      label: "Fraco",
      situation: "Candle pequeno para o contexto",
    };
  }

  if (numericValue <= 1.4) {
    return {
      label: "Saudável",
      situation: "Candle com tamanho normal",
    };
  }

  return {
    label: "Forte",
    situation: "Candle forte para o contexto",
  };
}

function getSimpleTriggerCandleContext(
  bodyRatio: unknown,
  candleType: unknown,
  upperWick: unknown,
  lowerWick: unknown
): SimpleTextContext {
  const bodyRatioValue = toNumber(bodyRatio);
  const upperWickValue = toNumber(upperWick);
  const lowerWickValue = toNumber(lowerWick);
  const candleTypeRaw = String(candleType ?? "").trim().toLowerCase();

  if (
    bodyRatioValue === null &&
    upperWickValue === null &&
    lowerWickValue === null &&
    !candleTypeRaw
  ) {
    return { label: "Sem leitura", situation: "Sem dados" };
  }

  if (bodyRatioValue !== null && bodyRatioValue >= 0.6) {
    return {
      label: "Bom",
      situation: "Candle com corpo firme",
    };
  }

  if (
    (upperWickValue !== null && upperWickValue > 0.5) ||
    (lowerWickValue !== null && lowerWickValue > 0.5)
  ) {
    return {
      label: "Fraco",
      situation: "Candle com pavio dominante",
    };
  }

  if (candleTypeRaw.includes("strong") || candleTypeRaw.includes("trend")) {
    return {
      label: "Bom",
      situation: "Candle favorável ao movimento",
    };
  }

  return {
    label: "Normal",
    situation: "Candle sem destaque forte",
  };
}

function getSimpleBollingerContext(
  reentryLong: unknown,
  reentryShort: unknown,
  closePosition: unknown
): SimpleTextContext {
  const isLong = Boolean(reentryLong);
  const isShort = Boolean(reentryShort);
  const closePositionValue = toNumber(closePosition);

  if (isLong) {
    return {
      label: "Confirma compra",
      situation: "Reentrada favorável para alta",
    };
  }

  if (isShort) {
    return {
      label: "Confirma venda",
      situation: "Reentrada favorável para queda",
    };
  }

  if (closePositionValue !== null) {
    if (closePositionValue > 0.8) {
      return {
        label: "Esticado em cima",
        situation: "Preço perto do topo da banda",
      };
    }

    if (closePositionValue < 0.2) {
      return {
        label: "Esticado em baixo",
        situation: "Preço perto da base da banda",
      };
    }

    return {
      label: "Neutro",
      situation: "Preço numa zona equilibrada da banda",
    };
  }

  return {
    label: "Sem leitura",
    situation: "Sem dados",
  };
}

function buildSignalQuality(params: {
  sideLabel: string;
  structureInfo: SimpleTextContext;
  emaAlignmentInfo: SimpleTextContext;
  priceVsEma20Info: SimpleTextContext;
  priceVsEma40Info: SimpleTextContext;
  supportDistanceInfo: SimpleTextContext;
  resistanceDistanceInfo: SimpleTextContext;
  macdInfo: SimpleMacdContext;
  triggerCandleInfo: SimpleTextContext;
  bollingerInfo: SimpleTextContext;
}): string {
  const {
    sideLabel,
    structureInfo,
    emaAlignmentInfo,
    priceVsEma20Info,
    priceVsEma40Info,
    supportDistanceInfo,
    resistanceDistanceInfo,
    macdInfo,
    triggerCandleInfo,
    bollingerInfo,
  } = params;

  let score = 0;

  if (sideLabel === "Compra") {
    if (structureInfo.label === "Alta") score += 2;
    if (emaAlignmentInfo.label === "Alta") score += 2;
    if (priceVsEma20Info.label === "Acima") score += 1;
    if (priceVsEma40Info.label === "Acima") score += 2;
    if (macdInfo.direction === "Alta") score += 1;
    if (bollingerInfo.label === "Confirma compra") score += 1;
    if (
      resistanceDistanceInfo.label === "Colado" ||
      resistanceDistanceInfo.label === "Muito perto"
    ) {
      score -= 2;
    }
    if (
      supportDistanceInfo.label === "Colado" ||
      supportDistanceInfo.label === "Muito perto"
    ) {
      score += 1;
    }
  } else if (sideLabel === "Venda") {
    if (structureInfo.label === "Queda") score += 2;
    if (emaAlignmentInfo.label === "Queda") score += 2;
    if (priceVsEma20Info.label === "Abaixo") score += 1;
    if (priceVsEma40Info.label === "Abaixo") score += 2;
    if (macdInfo.direction === "Queda") score += 1;
    if (bollingerInfo.label === "Confirma venda") score += 1;
    if (
      supportDistanceInfo.label === "Colado" ||
      supportDistanceInfo.label === "Muito perto"
    ) {
      score -= 2;
    }
    if (
      resistanceDistanceInfo.label === "Colado" ||
      resistanceDistanceInfo.label === "Muito perto"
    ) {
      score += 1;
    }
  }

  if (triggerCandleInfo.label === "Bom") score += 1;
  if (triggerCandleInfo.label === "Fraco") score -= 1;
  if (structureInfo.label === "Lateral") score -= 1;
  if (emaAlignmentInfo.label === "Misto") score -= 1;

  if (score >= 6) return "Forte";
  if (score >= 3) return "Moderado";
  return "Fraco";
}

function buildBbReversalConfirmation(params: {
  sideLabel: string;
  structureInfo: SimpleTextContext;
  priceVsEma20Info: SimpleTextContext;
  ema20SlopeInfo: SimpleTextContext;
  supportDistanceInfo: SimpleTextContext;
  resistanceDistanceInfo: SimpleTextContext;
  triggerCandleInfo: SimpleTextContext;
  candleVsAtrInfo: SimpleTextContext;
  macdInfo: SimpleMacdContext;
  bollingerInfo: SimpleTextContext;
  ifrInfo: SimpleIfrContext;
}): ConfirmationResult {
  const {
    sideLabel,
    structureInfo,
    priceVsEma20Info,
    ema20SlopeInfo,
    supportDistanceInfo,
    resistanceDistanceInfo,
    triggerCandleInfo,
    candleVsAtrInfo,
    macdInfo,
    bollingerInfo,
    ifrInfo,
  } = params;

  let confirmations = 0;
  let conflicts = 0;

  const countConfirmation = () => {
    confirmations += 1;
  };

  const countConflict = () => {
    conflicts += 1;
  };

  const isLong = sideLabel === "Compra";
  const isShort = sideLabel === "Venda";

  if (!isLong && !isShort) {
    return {
      confirmationPercent: null,
      confirmations: 0,
      conflicts: 0,
    };
  }

  // 1) Bollinger é central para FF/FD
  if (
    (isLong && bollingerInfo.label === "Confirma compra") ||
    (isShort && bollingerInfo.label === "Confirma venda")
  ) {
    countConfirmation();
  } else if (
    (isLong && bollingerInfo.label === "Confirma venda") ||
    (isShort && bollingerInfo.label === "Confirma compra")
  ) {
    countConflict();
  }

  // 2) Estrutura: lateral ajuda reversão; tendência contra atrapalha
  if (structureInfo.label === "Lateral") {
    countConfirmation();
  } else if (
    (isLong && structureInfo.label === "Queda") ||
    (isShort && structureInfo.label === "Alta")
  ) {
    countConflict();
  }

  // 3) Preço vs EMA 20: ajuda quando já começou a recuperar no lado da operação
  if (
    (isLong && priceVsEma20Info.label === "Acima") ||
    (isShort && priceVsEma20Info.label === "Abaixo")
  ) {
    countConfirmation();
  } else if (
    (isLong && priceVsEma20Info.label === "Abaixo") ||
    (isShort && priceVsEma20Info.label === "Acima")
  ) {
    countConflict();
  }

  // 4) Inclinação da EMA 20: favorável quando começa a inclinar no sentido da reversão
  if (
    (isLong && ema20SlopeInfo.label === "A subir") ||
    (isShort && ema20SlopeInfo.label === "A descer")
  ) {
    countConfirmation();
  } else if (
    (isLong && ema20SlopeInfo.label === "A descer") ||
    (isShort && ema20SlopeInfo.label === "A subir")
  ) {
    countConflict();
  }

  // 5) Suporte/Resistência: localização importa muito numa reversão BB
  if (isLong) {
    if (
      supportDistanceInfo.label === "Colado" ||
      supportDistanceInfo.label === "Muito perto"
    ) {
      countConfirmation();
    }

    if (
      resistanceDistanceInfo.label === "Colado" ||
      resistanceDistanceInfo.label === "Muito perto"
    ) {
      countConflict();
    }
  }

  if (isShort) {
    if (
      resistanceDistanceInfo.label === "Colado" ||
      resistanceDistanceInfo.label === "Muito perto"
    ) {
      countConfirmation();
    }

    if (
      supportDistanceInfo.label === "Colado" ||
      supportDistanceInfo.label === "Muito perto"
    ) {
      countConflict();
    }
  }

  // 6) Candle do gatilho
  if (triggerCandleInfo.label === "Bom") {
    countConfirmation();
  } else if (triggerCandleInfo.label === "Fraco") {
    countConflict();
  }

  // 7) Candle vs ATR: candle saudável/forte ajuda a validar reação
  if (
    candleVsAtrInfo.label === "Saudável" ||
    candleVsAtrInfo.label === "Forte"
  ) {
    countConfirmation();
  } else if (candleVsAtrInfo.label === "Fraco") {
    countConflict();
  }

  // 8) MACD: secundário, mas útil se já acompanha a reversão
  if (
    (isLong && macdInfo.direction === "Alta") ||
    (isShort && macdInfo.direction === "Queda")
  ) {
    countConfirmation();
  } else if (
    (isLong && macdInfo.direction === "Queda") ||
    (isShort && macdInfo.direction === "Alta")
  ) {
    countConflict();
  }

  // 9) IFR: só conta quando realmente apoia ou atrapalha a reversão
  if (isLong) {
    if (ifrInfo.strength === "Baixa" || ifrInfo.strength === "Fraqueza") {
      countConfirmation();
    } else if (ifrInfo.strength === "Alta" || ifrInfo.strength === "Alta forte") {
      countConflict();
    }
  }

  if (isShort) {
    if (ifrInfo.strength === "Alta" || ifrInfo.strength === "Alta forte") {
      countConfirmation();
    } else if (ifrInfo.strength === "Baixa" || ifrInfo.strength === "Fraqueza") {
      countConflict();
    }
  }

  const totalMeaningful = confirmations + conflicts;

  return {
    confirmationPercent:
      totalMeaningful > 0 ? (confirmations / totalMeaningful) * 100 : null,
    confirmations,
    conflicts,
  };
}

function dividerLine() {
  return (
    <div
      style={{
        height: 1,
        background: "#e2e8f0",
        margin: "12px 0",
        width: "100%",
      }}
    />
  );
}

function sectionTitle(title: string, rightText?: string) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        marginBottom: 8,
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: "#475569",
          textTransform: "uppercase",
          letterSpacing: 0.4,
        }}
      >
        {title}
      </div>

      {rightText && (
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "#0f172a",
            whiteSpace: "nowrap",
          }}
        >
          {rightText}
        </div>
      )}
    </div>
  );
}

function infoRow(label: string, value: string, highlight = false) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        alignItems: "flex-start",
      }}
    >
      <strong
        style={{
          color: highlight ? "#0f172a" : "#1e293b",
          minWidth: 120,
          flexShrink: 0,
        }}
      >
        {label}
      </strong>
      <span
        style={{
          color: highlight ? "#0f172a" : "#334155",
          textAlign: "right",
          fontWeight: highlight ? 700 : 400,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function outcomeListCard(
  title: string,
  items: OutcomeLikeCase[],
  accentColor: string
) {
  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 14,
        padding: 16,
        background: "#ffffff",
      }}
    >
      <div
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: "#0f172a",
          marginBottom: 12,
        }}
      >
        {title}
      </div>

      {items.length === 0 && (
        <p style={{ margin: 0, color: "#64748b", fontSize: 14 }}>
          Nenhum registo nesta categoria.
        </p>
      )}

      {items.length > 0 && (
        <div style={{ display: "grid", gap: 10 }}>
          {items.map((item) => {
            const trend = getGroupSnapshot(item, "trend");
            const momentum = getGroupSnapshot(item, "momentum");
            const volatility = getGroupSnapshot(item, "volatility");
            const structure = getGroupSnapshot(item, "structure");
            const triggerCandle = getGroupSnapshot(item, "trigger_candle");
            const bollinger = getGroupSnapshot(item, "bollinger");

            const sideLabel = getTradeSideLabel(item);
            const structureInfo = getSimpleStructureContext(
              structure?.market_structure ?? null
            );
            const emaAlignmentInfo = getSimpleEmaAlignmentContext(
              trend?.ema_alignment ?? null
            );
            const ema20SlopeInfo = getSimpleSlopeContext(
              trend?.ema_20_slope ?? null
            );
            const macdInfo = getSimpleMacdContext(momentum?.macd_state ?? null);
            const ifrInfo = getSimpleIfrContext(momentum?.rsi_14 ?? null);
            const atrInfo = getSimpleAtrContext(
              volatility?.atr_14 ?? null,
              volatility?.atr_regime ?? null
            );
            const priceVsEma20Info = getSimplePriceVsEmaContext(
              trend?.price_vs_ema_20 ?? null
            );
            const priceVsEma40Info = getSimplePriceVsEmaContext(
              trend?.price_vs_ema_40 ?? null
            );
            const supportDistanceInfo = getSimpleDistanceContext(
              structure?.distance_to_recent_support ?? null,
              "support"
            );
            const resistanceDistanceInfo = getSimpleDistanceContext(
              structure?.distance_to_recent_resistance ?? null,
              "resistance"
            );
            const candleVsAtrInfo = getSimpleCandleVsAtrContext(
              volatility?.candle_range_vs_atr ?? null
            );
            const triggerCandleInfo = getSimpleTriggerCandleContext(
              triggerCandle?.body_ratio ?? null,
              triggerCandle?.candle_type ?? null,
              triggerCandle?.upper_wick ?? null,
              triggerCandle?.lower_wick ?? null
            );
            const bollingerInfo = getSimpleBollingerContext(
              bollinger?.reentered_inside_band_long ?? null,
              bollinger?.reentered_inside_band_short ?? null,
              bollinger?.close_position_in_band ?? null
            );

            const signalQuality = buildSignalQuality({
              sideLabel,
              structureInfo,
              emaAlignmentInfo,
              priceVsEma20Info,
              priceVsEma40Info,
              supportDistanceInfo,
              resistanceDistanceInfo,
              macdInfo,
              triggerCandleInfo,
              bollingerInfo,
            });

            const confirmation = buildBbReversalConfirmation({
              sideLabel,
              structureInfo,
              priceVsEma20Info,
              ema20SlopeInfo,
              supportDistanceInfo,
              resistanceDistanceInfo,
              triggerCandleInfo,
              candleVsAtrInfo,
              macdInfo,
              bollingerInfo,
              ifrInfo,
            });

            const decisionQuickInfo =
              confirmation.confirmationPercent === null
                ? undefined
                : `Confirmação ${formatPercent(confirmation.confirmationPercent)}`;

            return (
              <div
                key={item.id}
                style={{
                  border: "1px solid #e2e8f0",
                  borderLeft: `4px solid ${accentColor}`,
                  borderRadius: 12,
                  padding: 14,
                  background: "#f8fafc",
                  fontSize: 14,
                  color: "#334155",
                  lineHeight: 1.6,
                }}
              >
                <div
                  style={{
                    fontWeight: 700,
                    color: "#0f172a",
                    marginBottom: 10,
                    wordBreak: "break-word",
                    fontSize: 15,
                  }}
                >
                  {item.id}
                </div>

                {sectionTitle("Decisão rápida", decisionQuickInfo)}
                <div style={{ display: "grid", gap: 6 }}>
                  {infoRow("Lado:", sideLabel, true)}
                  {infoRow("Qualidade:", signalQuality, true)}
                  {infoRow("Trigger:", formatDateTime(item.trigger_time ?? null))}
                  {infoRow("Fechamento:", formatDateTime(item.close_time ?? null))}
                  {infoRow("Entrada:", formatPrice(item.entry_price))}
                  {infoRow("Saída:", formatPrice(item.close_price))}
                </div>

                {dividerLine()}

                {sectionTitle("Contexto principal")}
                <div style={{ display: "grid", gap: 6 }}>
                  {infoRow("Estrutura:", structureInfo.label, true)}
                  {infoRow("Leitura Estrutura:", structureInfo.situation)}
                  {infoRow("Preço vs EMA 20:", priceVsEma20Info.label, true)}
                  {infoRow("Leitura EMA 20:", priceVsEma20Info.situation)}
                  {infoRow("Preço vs EMA 40:", priceVsEma40Info.label, true)}
                  {infoRow("Leitura EMA 40:", priceVsEma40Info.situation)}
                  {infoRow("EMAs:", emaAlignmentInfo.label, true)}
                  {infoRow("Leitura EMAs:", emaAlignmentInfo.situation)}
                  {infoRow("EMA 20:", ema20SlopeInfo.label)}
                  {infoRow("Leitura EMA 20:", ema20SlopeInfo.situation)}
                </div>

                {dividerLine()}

                {sectionTitle("Localização do preço")}
                <div style={{ display: "grid", gap: 6 }}>
                  {infoRow("Suporte:", supportDistanceInfo.label, true)}
                  {infoRow("Leitura Suporte:", supportDistanceInfo.situation)}
                  {infoRow("Resistência:", resistanceDistanceInfo.label, true)}
                  {infoRow("Leitura Resistência:", resistanceDistanceInfo.situation)}
                </div>

                {dividerLine()}

                {sectionTitle("Momento e gatilho")}
                <div style={{ display: "grid", gap: 6 }}>
                  {infoRow("Candle do gatilho:", triggerCandleInfo.label, true)}
                  {infoRow("Leitura Gatilho:", triggerCandleInfo.situation)}
                  {infoRow("Candle vs ATR:", candleVsAtrInfo.label)}
                  {infoRow("Leitura Candle:", candleVsAtrInfo.situation)}
                  {infoRow("MACD:", macdInfo.direction, true)}
                  {infoRow("Leitura MACD:", macdInfo.strength)}
                  {infoRow("Bollinger:", bollingerInfo.label, true)}
                  {infoRow("Leitura Bollinger:", bollingerInfo.situation)}
                </div>

                {dividerLine()}

                {sectionTitle("Risco e ambiente")}
                <div style={{ display: "grid", gap: 6 }}>
                  {infoRow("IFR:", ifrInfo.formattedValue)}
                  {infoRow("Leitura IFR:", ifrInfo.strength)}
                  {infoRow("Situação IFR:", ifrInfo.situation)}
                  {infoRow("ATR:", atrInfo.formattedValue)}
                  {infoRow("Volatilidade:", atrInfo.volatility)}
                  {infoRow("Situação ATR:", atrInfo.situation)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RunSummaryCard({
  mainCardStyle,
  selectedRunId,
  loadingRunDetails,
  runDetailsError,
  runDetails,
}: RunSummaryCardProps) {
  const summary = runDetails ? buildSummary(runDetails) : null;
  const outcomeLists = runDetails
    ? buildOutcomeLists((runDetails.cases ?? []) as OutcomeLikeCase[])
    : { hits: [], fails: [] };

  return (
    <div style={mainCardStyle}>
      <h2
        style={{
          marginTop: 0,
          marginBottom: 20,
          textAlign: "center",
          fontSize: 24,
          fontWeight: 700,
          color: "#0f172a",
        }}
      >
        Análise do run selecionado
      </h2>

      {!selectedRunId && <p>Nenhum run selecionado.</p>}

      {selectedRunId && loadingRunDetails && <p>A carregar detalhes do run...</p>}

      {selectedRunId && !loadingRunDetails && runDetailsError && (
        <div>
          <p style={{ color: "#dc2626", fontWeight: "bold" }}>
            Erro ao carregar detalhes do run
          </p>
          <p>{runDetailsError}</p>
        </div>
      )}

      {selectedRunId && !loadingRunDetails && !runDetailsError && runDetails && summary && (
        <div style={{ display: "grid", gap: 20 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 14,
              fontSize: 15,
              color: "#334155",
            }}
          >
            <div>
              <strong>ID:</strong> {runDetails.run.id}
            </div>
            <div>
              <strong>Strategy:</strong> {runDetails.run.strategy_key ?? "(sem strategy_key)"}
            </div>
            <div>
              <strong>Symbol:</strong> {runDetails.run.symbol}
            </div>
            <div>
              <strong>Timeframe:</strong> {runDetails.run.timeframe}
            </div>
            <div>
              <strong>Status:</strong> {runDetails.run.status}
            </div>
            <div>
              <strong>Mode:</strong> {runDetails.run.mode}
            </div>
            <div>
              <strong>Start:</strong> {formatDateTime(runDetails.run.start_at)}
            </div>
            <div>
              <strong>End:</strong> {formatDateTime(runDetails.run.end_at)}
            </div>
          </div>

          <div
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: 14,
              padding: 16,
              background: "#ffffff",
            }}
          >
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: "#0f172a",
                marginBottom: 8,
              }}
            >
              Resumo do intervalo analisado
            </div>

            <div
              style={{
                fontSize: 14,
                color: "#475569",
                lineHeight: 1.7,
                marginBottom: 16,
              }}
            >
              <div>
                <strong>Intervalo:</strong> {formatDateTime(runDetails.run.start_at)} →{" "}
                {formatDateTime(runDetails.run.end_at)}
              </div>
              <div>
                <strong>Candles analisados:</strong> {runDetails.run.candles_count ?? "-"}
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 12,
              }}
            >
              {summaryMetricCard("Total de Cases", summary.totalCases, "4px solid #94a3b8")}
              {summaryMetricCard("Hits", summary.totalHits, "4px solid #16a34a")}
              {summaryMetricCard("Fails", summary.totalFails, "4px solid #dc2626")}
              {summaryMetricCard("Timeouts", summary.totalTimeouts, "4px solid #f59e0b")}
              {summaryMetricCard("Hit Rate", formatPercent(summary.hitRate), "4px solid #16a34a")}
              {summaryMetricCard("Fail Rate", formatPercent(summary.failRate), "4px solid #dc2626")}
              {summaryMetricCard(
                "Timeout Rate",
                formatPercent(summary.timeoutRate),
                "4px solid #f59e0b"
              )}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: 16,
            }}
          >
            {outcomeListCard("Lista de Hits", outcomeLists.hits, "#16a34a")}
            {outcomeListCard("Lista de Fails", outcomeLists.fails, "#dc2626")}
          </div>
        </div>
      )}
    </div>
  );
}

export default RunSummaryCard;