// C:\TraderBotWeb\web\src\hooks\useStageTests.ts
// Backend:
// - GET  /api/v1/stage-tests/options
// - POST /api/v1/stage-tests/run
//
// Esta versão:
// - remove completamente o auto-run
// - mantém catálogo oficial do backend
// - permite execução apenas manual
// - preserva métricas locais em memória por estratégia
// - não depende de histórico persistido no backend

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchStageTestOptions, runStageTest } from "../services/stageTestsApi";
import type {
  StageTestOptionItem,
  StageTestStrategyOption,
} from "../types/stageTests";
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

      setStageTests((previousStageTests) =>
        buildStageTestSummaryItems(
          data.strategies,
          data.items,
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
        )} | Estratégias=${data.strategies.length} | Combinações=${data.items.length} | Símbolo=${
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

        const metrics = result.metrics;
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
                  }
                : {
                    run_id: "",
                    symbol: selectedSymbol,
                    timeframe: selectedTimeframe,
                    status: "local_error",
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