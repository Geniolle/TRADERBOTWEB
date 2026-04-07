// web/src/hooks/useStageTests.ts

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { API_HTTP_BASE_URL } from "../constants/config";
import type { CandleTickState, StageTestSummaryItem } from "../types/trading";

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
  lastExecutionLog: string;
  lastExecutionStatus: ExecutionLogStatus;
  reloadStageTests: () => Promise<void>;
  clearRuns: () => Promise<void>;
};

type VisualStageStrategyDefinition = {
  id: string;
  title: string;
  category: string | null;
  description: string | null;
  aliases: string[];
};

const VISUAL_STAGE_STRATEGIES: VisualStageStrategyDefinition[] = [
  {
    id: "pullback",
    title: "Pullback",
    category: "trend_following",
    description:
      "Compra ou venda em recuo até as médias, respeitando o contexto direcional principal.",
    aliases: ["pullback"],
  },
  {
    id: "moving_average_crossover",
    title: "Cruzamento de Médias",
    category: "trend_following",
    description:
      "Seguimento de tendência com base no cruzamento entre médias rápidas e confirmação estrutural.",
    aliases: [
      "moving_average_crossover",
      "ema_crossover",
      "ma_crossover",
      "cross_moving_averages",
    ],
  },
  {
    id: "range_breakout",
    title: "Rompimento de Range",
    category: "breakout",
    description:
      "Entrada após libertação de energia de uma lateralização ou pequeno caixote.",
    aliases: ["range_breakout", "breakout_range"],
  },
  {
    id: "volatility_breakout",
    title: "Rompimento de Volatilidade",
    category: "breakout",
    description:
      "Breakout após compressão de volatilidade, normalmente em contexto de squeeze.",
    aliases: [
      "volatility_breakout",
      "breakout_volatility",
      "bollinger_walk_the_band",
      "bollinger_band_walk",
    ],
  },
  {
    id: "mean_reversion",
    title: "Reversão à Média",
    category: "mean_reversion",
    description:
      "Operação contra esticão, procurando apenas o retorno técnico do preço à média.",
    aliases: [
      "mean_reversion",
      "bollinger_reversal",
      "bollinger_reversion",
    ],
  },
  {
    id: "fade",
    title: "Fade",
    category: "countertrend",
    description:
      "Scalp contra esticão de curtíssimo prazo, normalmente procurando apenas alívio técnico.",
    aliases: ["fade"],
  },
];

function toIsoWithoutMilliseconds(date: Date): string {
  return date.toISOString().split(".")[0];
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function formatDateTime(value: Date): string {
  return value.toLocaleString("pt-PT");
}

function createEmptyStageTestItem(
  definition: VisualStageStrategyDefinition
): StageTestSummaryItem {
  return {
    strategy_key: definition.id,
    strategy_name: definition.title,
    strategy_description: definition.description,
    strategy_category: definition.category,
    total_runs: 0,
    total_cases: 0,
    total_hits: 0,
    total_fails: 0,
    total_timeouts: 0,
    hit_rate: 0,
    fail_rate: 0,
    timeout_rate: 0,
    last_run: null,
  };
}

function findMatchingBackendStageTest(
  backendItems: StageTestSummaryItem[],
  definition: VisualStageStrategyDefinition
): StageTestSummaryItem | null {
  const aliasSet = new Set(
    definition.aliases.map((alias) => normalizeText(alias))
  );

  for (const item of backendItems) {
    const normalizedKey = normalizeText(item.strategy_key);
    const normalizedName = normalizeText(item.strategy_name);

    if (aliasSet.has(normalizedKey) || aliasSet.has(normalizedName)) {
      return item;
    }
  }

  return null;
}

function mergeVisualStrategiesWithBackendStageTests(
  backendItems: StageTestSummaryItem[]
): StageTestSummaryItem[] {
  return VISUAL_STAGE_STRATEGIES.map((definition) => {
    const backendMatch = findMatchingBackendStageTest(backendItems, definition);

    if (!backendMatch) {
      return createEmptyStageTestItem(definition);
    }

    return {
      ...backendMatch,
      strategy_key: definition.id,
      strategy_name: definition.title,
      strategy_description:
        backendMatch.strategy_description || definition.description,
      strategy_category:
        backendMatch.strategy_category || definition.category,
    };
  });
}

function buildBatchStrategiesPayload() {
  return VISUAL_STAGE_STRATEGIES.map((strategy) => ({
    strategy_key: strategy.id,
    parameters: {
      rsi_period: 14,
      bollinger_period: 20,
      bollinger_stddev: 2,
      atr_period: 14,
      ema_short_period: 9,
      ema_long_period: 21,
      target_percent: 0.15,
      stop_percent: 0.1,
    },
    timeout_bars: 12,
  }));
}

function buildAutoExecutionKey(
  selectedSymbol: string,
  selectedTimeframe: string,
  lastCandleTick: CandleTickState
): string {
  if (!selectedSymbol || !selectedTimeframe || !lastCandleTick?.open_time) {
    return "";
  }

  return [
    normalizeText(selectedSymbol),
    normalizeText(selectedTimeframe),
    normalizeText(lastCandleTick.open_time),
  ].join("::");
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
  const [lastExecutionLog, setLastExecutionLog] = useState(
    "A aguardar seleção de símbolo e timeframe."
  );
  const [lastExecutionStatus, setLastExecutionStatus] =
    useState<ExecutionLogStatus>("idle");

  const lastAutoExecutionKeyRef = useRef<string>("");

  const loadStageTests = useCallback(async () => {
    try {
      setLoadingRuns(true);
      setRunsError("");

      const response = await fetch(`${API_HTTP_BASE_URL}/stage-tests`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data: StageTestSummaryItem[] = await response.json();
      const mergedStageTests = mergeVisualStrategiesWithBackendStageTests(data);

      setStageTests(mergedStageTests);

      setSelectedRunId((previousSelectedRunId) => {
        const stillExists = mergedStageTests.some(
          (item) => item.last_run?.run_id === previousSelectedRunId
        );
        if (stillExists) {
          return previousSelectedRunId;
        }

        const firstWithRun = mergedStageTests.find((item) => item.last_run?.run_id);
        return firstWithRun?.last_run?.run_id ?? "";
      });
    } catch (err) {
      setRunsError(
        err instanceof Error
          ? err.message
          : "Erro desconhecido ao carregar Stage Testes"
      );
      setStageTests(
        VISUAL_STAGE_STRATEGIES.map((definition) =>
          createEmptyStageTestItem(definition)
        )
      );
      setSelectedRunId("");
    } finally {
      setLoadingRuns(false);
    }
  }, []);

  useEffect(() => {
    void loadStageTests();
  }, [loadStageTests]);

  const clearRuns = useCallback(async () => {
    try {
      setIsClearingRuns(true);
      setActionError("");

      const response = await fetch(`${API_HTTP_BASE_URL}/run-history`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      await loadStageTests();
      setLastExecutionStatus("idle");
      setLastExecutionLog(
        `Runs limpos manualmente em ${formatDateTime(new Date())}.`
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
  }, [loadStageTests]);

  const createRuns = useCallback(async () => {
    try {
      setIsCreatingRuns(true);
      setActionError("");
      setLastExecutionStatus("running");

      if (!selectedSymbol || !selectedTimeframe) {
        throw new Error("Selecione símbolo e timeframe antes de criar os runs.");
      }

      const executionStartedAt = new Date();

      setLastExecutionLog(
        `Execução automática iniciada em ${formatDateTime(
          executionStartedAt
        )} | Símbolo=${selectedSymbol} | Timeframe=${selectedTimeframe} | Candle=${
          lastCandleTick?.open_time ?? "-"
        }`
      );

      const endAt = new Date();
      const startAt = new Date(endAt.getTime() - 1000 * 60 * 60 * 24 * 2);

      const payload = {
        symbol: selectedSymbol,
        timeframe: selectedTimeframe,
        start_at: toIsoWithoutMilliseconds(startAt),
        end_at: toIsoWithoutMilliseconds(endAt),
        strategies: buildBatchStrategiesPayload(),
      };

      const response = await fetch(`${API_HTTP_BASE_URL}/batch-runs/historical`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      await loadStageTests();

      const firstCreatedRunId =
        Array.isArray(result?.results) && result.results.length > 0
          ? result.results[0]?.run?.id ?? ""
          : "";

      const createdCount = Array.isArray(result?.results)
        ? result.results.length
        : 0;

      if (firstCreatedRunId) {
        setSelectedRunId(firstCreatedRunId);
      }

      setLastExecutionStatus("success");
      setLastExecutionLog(
        `Última execução automática concluída em ${formatDateTime(
          new Date()
        )} | Símbolo=${selectedSymbol} | Timeframe=${selectedTimeframe} | Candle=${
          lastCandleTick?.open_time ?? "-"
        } | Estratégias enviadas=${createdCount}`
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erro desconhecido ao criar runs";
      setActionError(message);
      setLastExecutionStatus("error");
      setLastExecutionLog(
        `Falha na execução automática em ${formatDateTime(
          new Date()
        )} | Símbolo=${selectedSymbol || "-"} | Timeframe=${
          selectedTimeframe || "-"
        } | Candle=${lastCandleTick?.open_time ?? "-"} | Erro=${message}`
      );
    } finally {
      setIsCreatingRuns(false);
    }
  }, [selectedSymbol, selectedTimeframe, lastCandleTick, loadStageTests]);

  useEffect(() => {
    if (!selectedSymbol || !selectedTimeframe) {
      setLastExecutionStatus("idle");
      setLastExecutionLog("A aguardar seleção de símbolo e timeframe.");
      return;
    }

    if (!lastCandleTick?.open_time) {
      setLastExecutionStatus("waiting");
      setLastExecutionLog(
        `A aguardar novo candle para ${selectedSymbol} em ${selectedTimeframe}.`
      );
      return;
    }

    const autoExecutionKey = buildAutoExecutionKey(
      selectedSymbol,
      selectedTimeframe,
      lastCandleTick
    );

    if (!autoExecutionKey) {
      return;
    }

    if (lastAutoExecutionKeyRef.current === autoExecutionKey) {
      setLastExecutionStatus(isCreatingRuns ? "running" : "waiting");
      setLastExecutionLog(
        `Último candle já processado: ${lastCandleTick.open_time} | Símbolo=${selectedSymbol} | Timeframe=${selectedTimeframe}`
      );
      return;
    }

    if (isCreatingRuns || isClearingRuns) {
      return;
    }

    lastAutoExecutionKeyRef.current = autoExecutionKey;
    void createRuns();
  }, [
    selectedSymbol,
    selectedTimeframe,
    lastCandleTick,
    isCreatingRuns,
    isClearingRuns,
    createRuns,
  ]);

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
    lastExecutionLog,
    lastExecutionStatus,
    reloadStageTests: loadStageTests,
    clearRuns,
  };
}

export default useStageTests;