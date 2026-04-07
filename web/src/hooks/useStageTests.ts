// web/src/hooks/useStageTests.ts

import { useCallback, useEffect, useMemo, useState } from "react";

import { API_HTTP_BASE_URL } from "../constants/config";
import type { StageTestSummaryItem } from "../types/trading";

type UseStageTestsParams = {
  selectedSymbol: string;
  selectedTimeframe: string;
  selectedStrategyKey: string;
};

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
  reloadStageTests: () => Promise<void>;
  clearRuns: () => Promise<void>;
  createRuns: () => Promise<void>;
};

function toIsoWithoutMilliseconds(date: Date): string {
  return date.toISOString().split(".")[0];
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function useStageTests({
  selectedSymbol,
  selectedTimeframe,
  selectedStrategyKey,
}: UseStageTestsParams): UseStageTestsResult {
  const [stageTests, setStageTests] = useState<StageTestSummaryItem[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string>("");
  const [runSearch, setRunSearch] = useState("");
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [runsError, setRunsError] = useState("");
  const [actionError, setActionError] = useState("");
  const [isClearingRuns, setIsClearingRuns] = useState(false);
  const [isCreatingRuns, setIsCreatingRuns] = useState(false);

  const loadStageTests = useCallback(async () => {
    try {
      setLoadingRuns(true);
      setRunsError("");

      const response = await fetch(`${API_HTTP_BASE_URL}/stage-tests`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data: StageTestSummaryItem[] = await response.json();
      setStageTests(data);

      setSelectedRunId((previousSelectedRunId) => {
        const stillExists = data.some(
          (item) => item.last_run?.run_id === previousSelectedRunId
        );
        if (stillExists) {
          return previousSelectedRunId;
        }

        const firstWithRun = data.find((item) => item.last_run?.run_id);
        return firstWithRun?.last_run?.run_id ?? "";
      });
    } catch (err) {
      setRunsError(
        err instanceof Error ? err.message : "Erro desconhecido ao carregar Stage Testes"
      );
      setStageTests([]);
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
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Erro desconhecido ao limpar runs"
      );
    } finally {
      setIsClearingRuns(false);
    }
  }, [loadStageTests]);

  const createRuns = useCallback(async () => {
    try {
      setIsCreatingRuns(true);
      setActionError("");

      if (!selectedSymbol || !selectedTimeframe) {
        throw new Error("Selecione símbolo e timeframe antes de criar um run.");
      }

      if (!selectedStrategyKey) {
        throw new Error("Selecione a estratégia antes de criar um run.");
      }

      const endAt = new Date();
      const startAt = new Date(endAt.getTime() - 1000 * 60 * 60 * 24 * 2);

      const payload = {
        strategy_key: selectedStrategyKey,
        symbol: selectedSymbol,
        timeframe: selectedTimeframe,
        start_at: toIsoWithoutMilliseconds(startAt),
        end_at: toIsoWithoutMilliseconds(endAt),
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
      };

      const response = await fetch(`${API_HTTP_BASE_URL}/runs/historical`, {
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

      const createdRunId = result?.run?.id;
      if (createdRunId) {
        setSelectedRunId(createdRunId);
      }
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Erro desconhecido ao criar run"
      );
    } finally {
      setIsCreatingRuns(false);
    }
  }, [selectedSymbol, selectedTimeframe, selectedStrategyKey, loadStageTests]);

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
    reloadStageTests: loadStageTests,
    clearRuns,
    createRuns,
  };
}

export default useStageTests;