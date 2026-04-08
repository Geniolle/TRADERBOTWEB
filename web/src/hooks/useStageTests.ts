// C:\TraderBotWeb\web\src\hooks\useStageTests.ts
// Backend:
// - GET /api/v1/stage-tests/options
//
// Observação:
// Este hook deixa de chamar a rota antiga /stage-tests e passa a consumir
// diretamente o catálogo oficial do backend.

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchStageTestOptions } from "../services/stageTestsApi";
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
  lastExecutionLog: string;
  lastExecutionStatus: ExecutionLogStatus;
  reloadStageTests: () => Promise<void>;
  clearRuns: () => Promise<void>;
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

function createSummaryItem(
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

function buildStageTestSummaryItems(
  strategies: StageTestStrategyOption[],
  items: StageTestOptionItem[],
  selectedSymbol: string,
  selectedTimeframe: string
): StageTestSummaryItem[] {
  return strategies.map((strategy) =>
    createSummaryItem(strategy, items, selectedSymbol, selectedTimeframe)
  );
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
  const [isCreatingRuns] = useState(false);
  const [lastExecutionLog, setLastExecutionLog] = useState(
    "Stage Tests sincronizado com o catálogo oficial do backend."
  );
  const [lastExecutionStatus, setLastExecutionStatus] =
    useState<ExecutionLogStatus>("waiting");

  const loadStageTests = useCallback(async () => {
    try {
      setLoadingRuns(true);
      setRunsError("");

      const data = await fetchStageTestOptions(1);

      const summaryItems = buildStageTestSummaryItems(
        data.strategies,
        data.items,
        selectedSymbol,
        selectedTimeframe
      );

      setStageTests(summaryItems);
      setSelectedRunId("");

      const candleLabel = lastCandleTick?.open_time
        ? ` | Candle=${lastCandleTick.open_time}`
        : "";

      setLastExecutionStatus("success");
      setLastExecutionLog(
        `Stage Tests carregado em ${formatDateTime(new Date())} | Estratégias=${data.strategies.length} | Combinações=${data.items.length} | Símbolo=${selectedSymbol || "-"} | Timeframe=${selectedTimeframe || "-"}${candleLabel}`
      );
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Erro desconhecido ao carregar Stage Testes";

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
  }, [selectedSymbol, selectedTimeframe, lastCandleTick]);

  useEffect(() => {
    void loadStageTests();
  }, [loadStageTests]);

  const clearRuns = useCallback(async () => {
    try {
      setIsClearingRuns(true);
      setActionError("");

      setLastExecutionStatus("waiting");
      setLastExecutionLog(
        "A ação 'Limpar runs' deixou de atuar localmente nesta secção. O catálogo agora vem do backend."
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