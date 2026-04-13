import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchStageTestOptions, runStageTest } from "../services/stageTestsApi";
import type { StageTestOptionItem } from "../types/stageTests";
import type {
  AnalysisSnapshot,
  CandleTickState,
  StageTestRunCaseItem,
  StageTestRunRuleItem,
  StageTestRunTechnicalAnalysis,
  StageTestSummaryItem,
} from "../types/trading";

type StageTestStrategyOption = {
  key: string;
  label: string;
  description: string | null;
};

type UseStageTestsParams = {
  selectedSymbol: string;
  selectedTimeframe: string;
  lastCandleTick: CandleTickState;
};

export type ExecutionLogStatus =
  | "idle"
  | "waiting"
  | "running"
  | "success"
  | "error";

type UseStageTestsResult = {
  stageTests: StageTestSummaryItem[];
  selectedRunId: string;
  setSelectedRunId: (value: string) => void;
  runSearch: string;
  setRunSearch: (value: string) => void;
  filteredStageTests: StageTestSummaryItem[];
  loadingRuns: boolean;
  runsError: string;
  actionError: string;
  isClearingRuns: boolean;
  isCreatingRuns: boolean;
  runningStrategyKey: string;
  lastExecutionLog: string;
  lastExecutionStatus: ExecutionLogStatus;
  reloadStageTests: () => Promise<void>;
  clearRuns: () => Promise<void>;
  runStageTestByStrategy: (strategyKey: string) => Promise<void>;
};

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function formatDateTime(value: Date): string {
  return value.toLocaleString("pt-PT");
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function toText(value: unknown): string | null {
  if (value == null) return null;

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().replace(",", ".");
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function toBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  return null;
}

function normalizeStrategyOptions(rawStrategies: unknown): StageTestStrategyOption[] {
  if (!Array.isArray(rawStrategies)) {
    return [];
  }

  return rawStrategies
    .map((item) => {
      if (typeof item === "string") {
        const trimmed = item.trim();
        if (!trimmed) return null;

        return {
          key: trimmed,
          label: trimmed,
          description: null,
        } satisfies StageTestStrategyOption;
      }

      const record = toRecord(item);
      if (!record) return null;

      const key =
        toText(record.key) ??
        toText(record.strategy_key) ??
        toText(record.name);

      if (!key) return null;

      const label =
        toText(record.label) ??
        toText(record.name) ??
        toText(record.title) ??
        key;

      const description =
        toText(record.description) ??
        toText(record.strategy_description) ??
        null;

      return {
        key,
        label,
        description,
      } satisfies StageTestStrategyOption;
    })
    .filter((item): item is StageTestStrategyOption => item !== null);
}

function pushIndicator(
  target: { label: string; value: string }[],
  label: string,
  value: unknown
) {
  const text = toText(value);
  if (!text) return;
  target.push({ label, value: text });
}

function pushRule(
  target: StageTestRunRuleItem[],
  label: string,
  passed: unknown,
  value?: unknown
) {
  const boolValue = toBoolean(passed);
  const text = toText(value) ?? "";

  if (boolValue == null && !text) {
    return;
  }

  target.push({
    label,
    passed: boolValue,
    value: text,
  });
}

function buildAnalysisFromSnapshot(
  snapshot: AnalysisSnapshot | null | undefined
): StageTestRunTechnicalAnalysis | null {
  if (!snapshot) return null;

  const indicators: { label: string; value: string }[] = [];
  const rules: StageTestRunRuleItem[] = [];
  const trendRecord = toRecord(snapshot.trend);
  const ema9 =
    trendRecord?.ema_9 ??
    trendRecord?.ema9 ??
    trendRecord?.m9 ??
    trendRecord?.ema_09 ??
    null;
  const ema21 =
    trendRecord?.ema_21 ??
    trendRecord?.ema21 ??
    trendRecord?.m21 ??
    null;
  const ema9Slope =
    trendRecord?.ema_9_slope ??
    trendRecord?.ema9_slope ??
    trendRecord?.slope_ema_9 ??
    trendRecord?.slope_m9 ??
    null;
  const ema21Slope =
    trendRecord?.ema_21_slope ??
    trendRecord?.ema21_slope ??
    trendRecord?.slope_ema_21 ??
    trendRecord?.slope_m21 ??
    null;

  console.log("[StageTests][snapshot.trend]", snapshot.trend);
  console.log("[StageTests][EMA check]", {
    ema_5: snapshot.trend?.ema_5,
    ema_9: trendRecord?.ema_9,
    ema9: trendRecord?.ema9,
    m9: trendRecord?.m9,
    ema_09: trendRecord?.ema_09,
    ema_10: snapshot.trend?.ema_10,
    ema_20: snapshot.trend?.ema_20,
    ema_21: trendRecord?.ema_21,
    ema21: trendRecord?.ema21,
    m21: trendRecord?.m21,
    ema_30: snapshot.trend?.ema_30,
    ema_40: snapshot.trend?.ema_40,
    ema_9_slope: trendRecord?.ema_9_slope,
    ema9_slope: trendRecord?.ema9_slope,
    slope_ema_9: trendRecord?.slope_ema_9,
    slope_m9: trendRecord?.slope_m9,
    ema_21_slope: trendRecord?.ema_21_slope,
    ema21_slope: trendRecord?.ema21_slope,
    slope_ema_21: trendRecord?.slope_ema_21,
    slope_m21: trendRecord?.slope_m21,
  });

  pushIndicator(
    indicators,
    "Preço de referência",
    snapshot.trigger_context?.reference_price
  );
  pushIndicator(indicators, "Sessão", snapshot.trigger_context?.session);
  pushIndicator(indicators, "EMA 5", snapshot.trend?.ema_5);
  pushIndicator(indicators, "EMA 9", ema9);
  pushIndicator(indicators, "EMA 10", snapshot.trend?.ema_10);
  pushIndicator(indicators, "EMA 20", snapshot.trend?.ema_20);
  pushIndicator(indicators, "EMA 21", ema21);
  pushIndicator(indicators, "EMA 30", snapshot.trend?.ema_30);
  pushIndicator(indicators, "EMA 40", snapshot.trend?.ema_40);
  pushIndicator(indicators, "Inclinação EMA 9", ema9Slope);
  pushIndicator(indicators, "Inclinação EMA 20", snapshot.trend?.ema_20_slope);
  pushIndicator(indicators, "Inclinação EMA 21", ema21Slope);
  pushIndicator(indicators, "Inclinação EMA 40", snapshot.trend?.ema_40_slope);
  pushIndicator(indicators, "Alinhamento EMA", snapshot.trend?.ema_alignment);
  pushIndicator(indicators, "Preço vs EMA 20", snapshot.trend?.price_vs_ema_20);
  pushIndicator(indicators, "Preço vs EMA 40", snapshot.trend?.price_vs_ema_40);
  pushIndicator(indicators, "RSI 14", snapshot.momentum?.rsi_14);
  pushIndicator(indicators, "Zona RSI", snapshot.momentum?.rsi_zone);
  pushIndicator(indicators, "Inclinação RSI", snapshot.momentum?.rsi_slope);
  pushIndicator(indicators, "MACD", snapshot.momentum?.macd_line);
  pushIndicator(indicators, "Signal", snapshot.momentum?.macd_signal);
  pushIndicator(indicators, "Histograma", snapshot.momentum?.macd_histogram);
  pushIndicator(indicators, "Estado MACD", snapshot.momentum?.macd_state);
  pushIndicator(indicators, "ATR 14", snapshot.volatility?.atr_14);
  pushIndicator(indicators, "Regime ATR", snapshot.volatility?.atr_regime);
  pushIndicator(indicators, "Range candle", snapshot.volatility?.candle_range);
  pushIndicator(
    indicators,
    "Range vs ATR",
    snapshot.volatility?.candle_range_vs_atr
  );
  pushIndicator(indicators, "Bollinger superior", snapshot.bollinger?.upper);
  pushIndicator(indicators, "Bollinger média", snapshot.bollinger?.middle);
  pushIndicator(indicators, "Bollinger inferior", snapshot.bollinger?.lower);
  pushIndicator(indicators, "Bandwidth", snapshot.bollinger?.bandwidth);
  pushIndicator(
    indicators,
    "Posição do close na banda",
    snapshot.bollinger?.close_position_in_band
  );
  pushIndicator(
    indicators,
    "Estrutura de mercado",
    snapshot.structure?.market_structure
  );
  pushIndicator(indicators, "Local de entrada", snapshot.structure?.entry_location);
  pushIndicator(
    indicators,
    "Distância ao suporte",
    snapshot.structure?.distance_to_recent_support
  );
  pushIndicator(
    indicators,
    "Distância à resistência",
    snapshot.structure?.distance_to_recent_resistance
  );
  pushIndicator(
    indicators,
    "Distância à EMA 20",
    snapshot.structure?.distance_to_ema_20
  );
  pushIndicator(
    indicators,
    "Distância à EMA 40",
    snapshot.structure?.distance_to_ema_40
  );
  pushIndicator(indicators, "Candle open", snapshot.trigger_candle?.open);
  pushIndicator(indicators, "Candle high", snapshot.trigger_candle?.high);
  pushIndicator(indicators, "Candle low", snapshot.trigger_candle?.low);
  pushIndicator(indicators, "Candle close", snapshot.trigger_candle?.close);
  pushIndicator(indicators, "Body size", snapshot.trigger_candle?.body_size);
  pushIndicator(indicators, "Upper wick", snapshot.trigger_candle?.upper_wick);
  pushIndicator(indicators, "Lower wick", snapshot.trigger_candle?.lower_wick);
  pushIndicator(indicators, "Body ratio", snapshot.trigger_candle?.body_ratio);
  pushIndicator(indicators, "Tipo de candle", snapshot.trigger_candle?.candle_type);

  pushRule(
    rules,
    "Fecho abaixo da banda inferior",
    snapshot.bollinger?.closed_below_lower_band
  );
  pushRule(
    rules,
    "Fecho acima da banda superior",
    snapshot.bollinger?.closed_above_upper_band
  );
  pushRule(
    rules,
    "Reentrada na banda (long)",
    snapshot.bollinger?.reentered_inside_band_long
  );
  pushRule(
    rules,
    "Reentrada na banda (short)",
    snapshot.bollinger?.reentered_inside_band_short
  );
  pushRule(rules, "BB reentry long", snapshot.patterns?.bb_reentry_long);
  pushRule(rules, "BB reentry short", snapshot.patterns?.bb_reentry_short);
  pushRule(
    rules,
    "EMA trend confirmed long",
    snapshot.patterns?.ema_trend_confirmed_long
  );
  pushRule(
    rules,
    "EMA trend confirmed short",
    snapshot.patterns?.ema_trend_confirmed_short
  );
  pushRule(rules, "RSI recovery long", snapshot.patterns?.rsi_recovery_long);
  pushRule(rules, "RSI recovery short", snapshot.patterns?.rsi_recovery_short);
  pushRule(
    rules,
    "MACD confirmation long",
    snapshot.patterns?.macd_confirmation_long
  );
  pushRule(
    rules,
    "MACD confirmation short",
    snapshot.patterns?.macd_confirmation_short
  );
  pushRule(rules, "Countertrend long", snapshot.patterns?.countertrend_long);
  pushRule(rules, "Countertrend short", snapshot.patterns?.countertrend_short);

  return {
    validated_at: snapshot.trigger_context?.reference_time ?? null,
    trigger_label: snapshot.structure?.entry_location ?? null,
    summary: snapshot.structure?.market_structure ?? null,
    indicators,
    rules,
    snapshot,
  };
}
function readRulesFromUnknown(value: unknown): StageTestRunRuleItem[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      const rule = toRecord(item);
      if (!rule) return null;

      const label = toText(rule.label);
      if (!label) return null;

      return {
        label,
        value: toText(rule.value) ?? "",
        passed: toBoolean(rule.passed),
      } as StageTestRunRuleItem;
    })
    .filter((item): item is StageTestRunRuleItem => item !== null);
}

function readIndicatorsFromUnknown(
  value: unknown
): Array<{ label: string; value: string }> {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      const indicator = toRecord(item);
      if (!indicator) return null;

      const label = toText(indicator.label);
      const rawValue = toText(indicator.value);

      if (!label || !rawValue) return null;

      return {
        label,
        value: rawValue,
      };
    })
    .filter(
      (item): item is { label: string; value: string } => item !== null
    );
}

function normalizeTechnicalAnalysis(
  raw: unknown
): StageTestRunTechnicalAnalysis | null {
  const record = toRecord(raw);
  if (!record) return null;

  const rawSnapshot =
    toRecord(record.snapshot) ??
    toRecord(record.analysis_snapshot) ??
    toRecord(record.snapshot_data);

  const snapshot = rawSnapshot as AnalysisSnapshot | null;
  const snapshotAnalysis = buildAnalysisFromSnapshot(snapshot);
  const explicitIndicators = readIndicatorsFromUnknown(record.indicators);
  const explicitRules = readRulesFromUnknown(record.rules);

  const mergedIndicators =
    explicitIndicators.length > 0
      ? explicitIndicators
      : snapshotAnalysis?.indicators ?? [];

  const mergedRules =
    explicitRules.length > 0 ? explicitRules : snapshotAnalysis?.rules ?? [];

  const summary =
    toText(record.summary) ??
    toText(record.interpretation) ??
    toText(record.rationale) ??
    snapshotAnalysis?.summary ??
    null;

  const direction =
    toText(record.direction) ??
    toText(record.side) ??
    toText(record.trade_bias) ??
    null;

  const validatedAt =
    toText(record.validated_at) ??
    toText(record.validation_time) ??
    snapshotAnalysis?.validated_at ??
    null;

  const triggerLabel =
    toText(record.trigger_label) ??
    toText(record.trigger) ??
    snapshotAnalysis?.trigger_label ??
    null;

  if (!summary && !direction && !validatedAt && !triggerLabel) {
    if (mergedIndicators.length === 0 && mergedRules.length === 0 && !snapshot) {
      return null;
    }
  }

  return {
    summary,
    direction,
    validated_at: validatedAt,
    trigger_label: triggerLabel,
    indicators: mergedIndicators,
    rules: mergedRules,
    snapshot,
  };
}

function extractTechnicalAnalysis(
  result: unknown
): StageTestRunTechnicalAnalysis | null {
  const root = toRecord(result);
  if (!root) return null;

  const metrics = toRecord(root.metrics);

  const candidates: unknown[] = [
    root.analysis,
    root.technical_analysis,
    root.validation_analysis,
    root.analysis_snapshot,
    metrics?.analysis,
    metrics?.technical_analysis,
    metrics?.validation_analysis,
    metrics?.analysis_snapshot,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeTechnicalAnalysis(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function normalizeCaseItem(raw: unknown, index: number): StageTestRunCaseItem | null {
  const record = toRecord(raw);
  if (!record) return null;

  const id =
    toText(record.id) ??
    toText(record.case_id) ??
    toText(record.case_number) ??
    `case-${index + 1}`;

  const metadata = toRecord(record.metadata);
  const directAnalysis = normalizeTechnicalAnalysis(record.analysis);
  const snapshotAnalysis = normalizeTechnicalAnalysis({
    analysis_snapshot: metadata?.analysis_snapshot,
    trade_bias: metadata?.trade_bias,
    trigger_label: metadata?.setup_type,
    summary: metadata?.close_reason,
  });

  return {
    id,
    case_number: toNumber(record.case_number),
    side: toText(record.side),
    status: toText(record.status),
    outcome: toText(record.outcome),
    trigger_price: toNumber(record.trigger_price) ?? toText(record.trigger_price),
    entry_price: toNumber(record.entry_price) ?? toText(record.entry_price),
    close_price: toNumber(record.close_price) ?? toText(record.close_price),
    target_price: toNumber(record.target_price) ?? toText(record.target_price),
    invalidation_price:
      toNumber(record.invalidation_price) ?? toText(record.invalidation_price),
    trigger_time: toText(record.trigger_time),
    trigger_candle_time: toText(record.trigger_candle_time),
    entry_time: toText(record.entry_time),
    close_time: toText(record.close_time),
    bars_to_resolution: toNumber(record.bars_to_resolution),
    max_favorable_excursion:
      toNumber(record.max_favorable_excursion) ??
      toText(record.max_favorable_excursion),
    max_adverse_excursion:
      toNumber(record.max_adverse_excursion) ??
      toText(record.max_adverse_excursion),
    close_reason: toText(record.close_reason),
    analysis: directAnalysis ?? snapshotAnalysis,
    metadata: metadata ?? null,
  };
}

function extractCasesFromResult(result: unknown): StageTestRunCaseItem[] {
  const root = toRecord(result);
  if (!root) return [];

  const metrics = toRecord(root.metrics);
  const rawCases =
    (Array.isArray(root.cases) ? root.cases : null) ??
    (Array.isArray(metrics?.cases) ? metrics?.cases : null) ??
    [];

  return rawCases
    .map((item, index) => normalizeCaseItem(item, index))
    .filter((item): item is StageTestRunCaseItem => item !== null);
}

function findMatchingItems(
  items: StageTestOptionItem[],
  selectedSymbol: string,
  selectedTimeframe: string
): StageTestOptionItem[] {
  const normalizedSymbol = normalizeText(selectedSymbol);
  const normalizedTimeframe = normalizeText(selectedTimeframe);

  if (!normalizedSymbol && !normalizedTimeframe) {
    return items;
  }

  return items.filter((item) => {
    const itemSymbol = normalizeText(item.symbol);
    const itemTimeframe = normalizeText(item.timeframe);

    const matchesSymbol = !normalizedSymbol || itemSymbol === normalizedSymbol;
    const matchesTimeframe =
      !normalizedTimeframe || itemTimeframe === normalizedTimeframe;

    return matchesSymbol && matchesTimeframe;
  });
}

function buildBaseSummaryItem(
  strategy: StageTestStrategyOption,
  items: StageTestOptionItem[],
  selectedSymbol: string,
  selectedTimeframe: string
): StageTestSummaryItem {
  const matchedItems = findMatchingItems(items, selectedSymbol, selectedTimeframe);
  const firstMatch = matchedItems[0] ?? null;
  const totalCandles = matchedItems.reduce(
    (sum, item) => sum + Number(item.candles_count || 0),
    0
  );

  return {
    strategy_key: strategy.key,
    strategy_name: strategy.label,
    strategy_description: strategy.description,
    strategy_category: null,
    total_runs: 0,
    total_cases: totalCandles,
    total_hits: 0,
    total_fails: 0,
    total_timeouts: 0,
    hit_rate: 0,
    fail_rate: 0,
    timeout_rate: 0,
    last_run: firstMatch
      ? {
          run_id: "",
          symbol: firstMatch.symbol,
          timeframe: firstMatch.timeframe,
          status: "ready",
          started_at: null,
          finished_at: null,
          total_candles: firstMatch.candles_count ?? totalCandles,
          first_candle: firstMatch.first_candle ?? null,
          last_candle: firstMatch.last_candle ?? null,
          analysis: null,
          cases: null,
        }
      : null,
  } as StageTestSummaryItem;
}

function mergeSummaryWithPrevious(
  nextItem: StageTestSummaryItem,
  previousItem: StageTestSummaryItem | undefined
): StageTestSummaryItem {
  if (!previousItem) {
    return nextItem;
  }

  const previousLastRun = previousItem.last_run;
  const fallbackLastRun = nextItem.last_run;

  return {
    ...nextItem,
    total_runs: previousItem.total_runs ?? 0,
    total_cases:
      previousItem.total_runs && previousItem.total_runs > 0
        ? previousItem.total_cases
        : nextItem.total_cases,
    total_hits: previousItem.total_hits ?? 0,
    total_fails: previousItem.total_fails ?? 0,
    total_timeouts: previousItem.total_timeouts ?? 0,
    hit_rate: previousItem.hit_rate ?? 0,
    fail_rate: previousItem.fail_rate ?? 0,
    timeout_rate: previousItem.timeout_rate ?? 0,
    last_run: previousLastRun
      ? {
          ...previousLastRun,
          symbol: previousLastRun.symbol || fallbackLastRun?.symbol || "",
          timeframe:
            previousLastRun.timeframe || fallbackLastRun?.timeframe || "",
          total_candles:
            previousLastRun.total_candles ?? fallbackLastRun?.total_candles ?? null,
          first_candle:
            previousLastRun.first_candle ?? fallbackLastRun?.first_candle ?? null,
          last_candle:
            previousLastRun.last_candle ?? fallbackLastRun?.last_candle ?? null,
        }
      : fallbackLastRun,
  } as StageTestSummaryItem;
}

function buildStageTestSummaryItems(
  strategies: StageTestStrategyOption[],
  items: StageTestOptionItem[],
  selectedSymbol: string,
  selectedTimeframe: string,
  previousStageTests: StageTestSummaryItem[]
): StageTestSummaryItem[] {
  const previousMap = new Map(
    previousStageTests.map((item) => [item.strategy_key, item])
  );

  return strategies.map((strategy) => {
    const nextItem = buildBaseSummaryItem(
      strategy,
      items,
      selectedSymbol,
      selectedTimeframe
    );

    return mergeSummaryWithPrevious(nextItem, previousMap.get(strategy.key));
  });
}

function useStageTests({
  selectedSymbol,
  selectedTimeframe,
  lastCandleTick,
}: UseStageTestsParams): UseStageTestsResult {
  const [stageTests, setStageTests] = useState<StageTestSummaryItem[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string>("");
  const [runSearch, setRunSearch] = useState("");
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [runsError, setRunsError] = useState("");
  const [actionError, setActionError] = useState("");
  const [isClearingRuns, setIsClearingRuns] = useState(false);
  const [isCreatingRuns, setIsCreatingRuns] = useState(false);
  const [runningStrategyKey, setRunningStrategyKey] = useState("");
  const [lastExecutionLog, setLastExecutionLog] = useState(
    "Stage Tests em modo manual. Selecione símbolo, timeframe e clique em Run na estratégia desejada."
  );
  const [lastExecutionStatus, setLastExecutionStatus] =
    useState<ExecutionLogStatus>("waiting");

  const hasValidSelection = useMemo(() => {
    return Boolean(selectedSymbol && selectedTimeframe);
  }, [selectedSymbol, selectedTimeframe]);

  const loadStageTests = useCallback(async () => {
    try {
      setLoadingRuns(true);
      setRunsError("");

      const data = await fetchStageTestOptions(1);
      const normalizedStrategies = normalizeStrategyOptions(
        (data as { strategies?: unknown }).strategies
      );
      const items = Array.isArray((data as { items?: unknown }).items)
        ? ((data as { items?: unknown }).items as StageTestOptionItem[])
        : [];

      setStageTests((previousStageTests) =>
        buildStageTestSummaryItems(
          normalizedStrategies,
          items,
          selectedSymbol,
          selectedTimeframe,
          previousStageTests
        )
      );

      const candleLabel = lastCandleTick?.open_time
        ? ` | Último candle observado=${lastCandleTick.open_time}`
        : "";

      setLastExecutionStatus(hasValidSelection ? "waiting" : "idle");
      setLastExecutionLog(
        `Catálogo Stage Tests sincronizado em ${formatDateTime(
          new Date()
        )} | Estratégias=${normalizedStrategies.length} | Combinações=${items.length} | Símbolo=${
          selectedSymbol || "-"
        } | Timeframe=${
          selectedTimeframe || "-"
        }${candleLabel} | Execução=manual`
      );
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Erro desconhecido ao carregar Stage Tests";

      setRunsError(message);
      setStageTests([]);
      setSelectedRunId("");
      setLastExecutionStatus("error");
      setLastExecutionLog(
        `Falha ao carregar Stage Tests em ${formatDateTime(new Date())}: ${message}`
      );
    } finally {
      setLoadingRuns(false);
    }
  }, [selectedSymbol, selectedTimeframe, lastCandleTick, hasValidSelection]);

  useEffect(() => {
    void loadStageTests();
  }, [loadStageTests]);

  useEffect(() => {
    setSelectedRunId("");

    if (!hasValidSelection) {
      setLastExecutionStatus("idle");
      setLastExecutionLog(
        "Stage Tests em modo manual. O botão Run ficará disponível quando símbolo e timeframe estiverem selecionados."
      );
      return;
    }

    setLastExecutionStatus("waiting");
    setLastExecutionLog(
      `Stage Tests preparado para execução manual | Símbolo=${selectedSymbol} | Timeframe=${selectedTimeframe}`
    );
  }, [hasValidSelection, selectedSymbol, selectedTimeframe]);

  const clearRuns = useCallback(async () => {
    try {
      setIsClearingRuns(true);
      setActionError("");
      setSelectedRunId("");
      setRunningStrategyKey("");

      setStageTests((previous) =>
        previous.map((item) => ({
          ...item,
          total_runs: 0,
          total_hits: 0,
          total_fails: 0,
          total_timeouts: 0,
          hit_rate: 0,
          fail_rate: 0,
          timeout_rate: 0,
          last_run: item.last_run
            ? {
                ...item.last_run,
                run_id: "",
                status: "ready",
                started_at: null,
                finished_at: null,
                analysis: null,
                cases: null,
              }
            : null,
        }))
      );

      setLastExecutionStatus("waiting");
      setLastExecutionLog(
        `Runs locais limpos em ${formatDateTime(
          new Date()
        )}. O catálogo continua sincronizado e a execução permanece manual.`
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erro desconhecido ao limpar runs";

      setActionError(message);
      setLastExecutionStatus("error");
      setLastExecutionLog(
        `Falha ao limpar runs em ${formatDateTime(new Date())}: ${message}`
      );
    } finally {
      setIsClearingRuns(false);
    }
  }, []);

  const runStageTestByStrategy = useCallback(
    async (strategyKey: string) => {
      if (!hasValidSelection) {
        setActionError("Selecione símbolo e timeframe antes de executar.");
        setLastExecutionStatus("error");
        setLastExecutionLog(
          `Execução manual bloqueada em ${formatDateTime(
            new Date()
          )}: falta símbolo ou timeframe.`
        );
        return;
      }

      if (!strategyKey.trim()) {
        setActionError("Strategy inválida para execução manual.");
        setLastExecutionStatus("error");
        setLastExecutionLog(
          `Execução manual bloqueada em ${formatDateTime(
            new Date()
          )}: strategy vazia.`
        );
        return;
      }

      const startedAtIso = new Date().toISOString();

      try {
        setIsCreatingRuns(true);
        setRunningStrategyKey(strategyKey);
        setActionError("");
        setLastExecutionStatus("running");
        setLastExecutionLog(
          `Run manual iniciado em ${formatDateTime(
            new Date()
          )} | Strategy=${strategyKey} | Símbolo=${selectedSymbol} | Timeframe=${selectedTimeframe}`
        );

        const result = await runStageTest({
          symbol: selectedSymbol,
          timeframe: selectedTimeframe,
          strategy: strategyKey,
          min_candles: 1,
          extra_args: [],
        });

        const finishedAtIso = new Date().toISOString();
        const metrics = result.metrics;
        const analysis = extractTechnicalAnalysis(result);
        const cases = extractCasesFromResult(result);
        const nextStatus =
          result.ok && result.return_code === 0 ? "local_ok" : "local_error";

        setStageTests((previous) =>
          previous.map((current) => {
            if (current.strategy_key !== strategyKey) {
              return current;
            }

            return {
              ...current,
              total_runs: (current.total_runs ?? 0) + 1,
              total_cases:
                metrics?.closed_cases ??
                metrics?.total_candles ??
                current.total_cases,
              total_hits: metrics?.hits ?? current.total_hits ?? 0,
              total_fails: metrics?.fails ?? current.total_fails ?? 0,
              total_timeouts: metrics?.timeouts ?? current.total_timeouts ?? 0,
              hit_rate: metrics?.hit_rate ?? current.hit_rate ?? 0,
              fail_rate: metrics?.fail_rate ?? current.fail_rate ?? 0,
              timeout_rate: metrics?.timeout_rate ?? current.timeout_rate ?? 0,
              last_run: {
                run_id: "",
                symbol: selectedSymbol,
                timeframe: selectedTimeframe,
                status: nextStatus,
                started_at: startedAtIso,
                finished_at: finishedAtIso,
                total_candles: metrics?.total_candles ?? null,
                first_candle: metrics?.first_candle ?? null,
                last_candle: metrics?.last_candle ?? null,
                analysis,
                cases,
              },
            } as StageTestSummaryItem;
          })
        );

        if (result.ok && result.return_code === 0) {
          setLastExecutionStatus("success");
          setLastExecutionLog(
            `Run manual concluído em ${formatDateTime(
              new Date()
            )} | Strategy=${strategyKey} | Símbolo=${selectedSymbol} | Timeframe=${selectedTimeframe} | Return code=${result.return_code}`
          );
          return;
        }

        const errorMessage = `Strategy=${strategyKey} | return_code=${result.return_code}`;
        setActionError(errorMessage);
        setLastExecutionStatus("error");
        setLastExecutionLog(
          `Run manual concluído com erro em ${formatDateTime(
            new Date()
          )} | ${errorMessage}`
        );
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Erro desconhecido no run manual";

        const finishedAtIso = new Date().toISOString();

        setActionError(`${strategyKey}: ${message}`);
        setLastExecutionStatus("error");
        setLastExecutionLog(
          `Falha no run manual em ${formatDateTime(
            new Date()
          )} | Strategy=${strategyKey} | ${message}`
        );

        setStageTests((previous) =>
          previous.map((current) => {
            if (current.strategy_key !== strategyKey) {
              return current;
            }

            return {
              ...current,
              last_run: current.last_run
                ? {
                    ...current.last_run,
                    symbol: selectedSymbol,
                    timeframe: selectedTimeframe,
                    status: "local_error",
                    started_at: startedAtIso,
                    finished_at: finishedAtIso,
                    analysis: null,
                    cases: null,
                  }
                : {
                    run_id: "",
                    symbol: selectedSymbol,
                    timeframe: selectedTimeframe,
                    status: "local_error",
                    started_at: startedAtIso,
                    finished_at: finishedAtIso,
                    total_candles: null,
                    first_candle: null,
                    last_candle: null,
                    analysis: null,
                    cases: null,
                  },
            } as StageTestSummaryItem;
          })
        );
      } finally {
        setIsCreatingRuns(false);
        setRunningStrategyKey("");
      }
    },
    [hasValidSelection, selectedSymbol, selectedTimeframe]
  );

  const filteredStageTests = useMemo(() => {
    const term = runSearch.trim().toLowerCase();
    if (!term) return stageTests;

    return stageTests.filter((item) => {
      return (
        normalizeText(item.strategy_name).includes(term) ||
        normalizeText(item.strategy_key).includes(term) ||
        normalizeText(item.strategy_description).includes(term) ||
        normalizeText(item.strategy_category).includes(term) ||
        normalizeText(item.last_run?.symbol).includes(term) ||
        normalizeText(item.last_run?.timeframe).includes(term) ||
        normalizeText(item.last_run?.status).includes(term)
      );
    });
  }, [runSearch, stageTests]);

  return {
    stageTests,
    selectedRunId,
    setSelectedRunId,
    runSearch,
    setRunSearch,
    filteredStageTests,
    loadingRuns,
    runsError,
    actionError,
    isClearingRuns,
    isCreatingRuns,
    runningStrategyKey,
    lastExecutionLog,
    lastExecutionStatus,
    reloadStageTests: loadStageTests,
    clearRuns,
    runStageTestByStrategy,
  };
}

export default useStageTests;