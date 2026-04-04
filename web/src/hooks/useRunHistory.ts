// web/src/hooks/useRunHistory.ts

import { useCallback, useEffect, useMemo, useState } from "react";

import { API_HTTP_BASE_URL } from "../constants/config";
import type { RunHistoryItem, StrategyItem } from "../types/trading";

type UseRunHistoryParams = {
  selectedSymbol: string;
  selectedTimeframe: string;
  strategies: StrategyItem[];
};

type UseRunHistoryResult = {
  runs: RunHistoryItem[];
  selectedRunId: string;
  setSelectedRunId: (value: string) => void;
  runSearch: string;
  setRunSearch: (value: string) => void;
  filteredRuns: RunHistoryItem[];
  loadingRuns: boolean;
  runsError: string;
  actionError: string;
  isClearingRuns: boolean;
  isCreatingRuns: boolean;
  reloadRuns: () => Promise<void>;
  clearRuns: () => Promise<void>;
  createRuns: () => Promise<void>;
};

function toIsoWithoutMilliseconds(date: Date): string {
  return date.toISOString().split(".")[0];
}

function buildDefaultStrategies(strategies: StrategyItem[]) {
  const availableKeys = new Set(strategies.map((item) => item.key));

  const defaults = [
    {
      strategy_key: "bollinger_reversal",
      parameters: {
        bollinger_period: 20,
        bollinger_stddev: 2,
        atr_period: 14,
      },
      timeout_bars: 12,
    },
    {
      strategy_key: "ema_cross",
      parameters: {
        ema_short_period: 9,
        ema_long_period: 21,
        atr_period: 14,
        target_percent: 0.15,
        stop_percent: 0.1,
      },
      timeout_bars: 12,
    },
    {
      strategy_key: "rsi_reversal",
      parameters: {
        rsi_period: 14,
        bollinger_period: 20,
        bollinger_stddev: 2,
        atr_period: 14,
        target_percent: 0.15,
        stop_percent: 0.1,
      },
      timeout_bars: 12,
    },
  ];

  return defaults.filter((item) => availableKeys.has(item.strategy_key));
}

function useRunHistory({
  selectedSymbol,
  selectedTimeframe,
  strategies,
}: UseRunHistoryParams): UseRunHistoryResult {
  const [runs, setRuns] = useState<RunHistoryItem[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string>("");
  const [runSearch, setRunSearch] = useState("");
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [runsError, setRunsError] = useState("");
  const [actionError, setActionError] = useState("");
  const [isClearingRuns, setIsClearingRuns] = useState(false);
  const [isCreatingRuns, setIsCreatingRuns] = useState(false);

  const loadRuns = useCallback(async () => {
    try {
      setLoadingRuns(true);
      setRunsError("");

      const response = await fetch(`${API_HTTP_BASE_URL}/run-history?limit=20`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data: RunHistoryItem[] = await response.json();
      setRuns(data);

      if (data.length > 0) {
        setSelectedRunId((previousSelectedRunId) => {
          const stillExists = data.some((item) => item.id === previousSelectedRunId);
          if (stillExists) return previousSelectedRunId;

          const preferredRun =
            data.find((item) => item.strategy_key && item.strategy_key.trim() !== "") ??
            data[0];

          return preferredRun.id;
        });
      } else {
        setSelectedRunId("");
      }
    } catch (err) {
      setRunsError(
        err instanceof Error ? err.message : "Erro desconhecido ao carregar histórico"
      );
      setRuns([]);
      setSelectedRunId("");
    } finally {
      setLoadingRuns(false);
    }
  }, []);

  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

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

      await loadRuns();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Erro desconhecido ao limpar runs"
      );
    } finally {
      setIsClearingRuns(false);
    }
  }, [loadRuns]);

  const createRuns = useCallback(async () => {
    try {
      setIsCreatingRuns(true);
      setActionError("");

      if (!selectedSymbol || !selectedTimeframe) {
        throw new Error("Selecione símbolo e timeframe antes de criar novos runs.");
      }

      const defaultStrategies = buildDefaultStrategies(strategies);
      if (defaultStrategies.length === 0) {
        throw new Error("Nenhuma estratégia disponível para criar runs.");
      }

      const endAt = new Date();
      const startAt = new Date(endAt.getTime() - 1000 * 60 * 60 * 24 * 2);

      const payload = {
        symbol: selectedSymbol,
        timeframe: selectedTimeframe,
        start_at: toIsoWithoutMilliseconds(startAt),
        end_at: toIsoWithoutMilliseconds(endAt),
        strategies: defaultStrategies,
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

      await response.json();
      await loadRuns();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Erro desconhecido ao criar runs"
      );
    } finally {
      setIsCreatingRuns(false);
    }
  }, [selectedSymbol, selectedTimeframe, strategies, loadRuns]);

  const filteredRuns = useMemo(() => {
    const term = runSearch.trim().toLowerCase();
    if (!term) return runs;

    return runs.filter((run) => {
      return (
        run.id.toLowerCase().includes(term) ||
        (run.strategy_key ?? "").toLowerCase().includes(term) ||
        run.symbol.toLowerCase().includes(term) ||
        run.timeframe.toLowerCase().includes(term) ||
        run.status.toLowerCase().includes(term)
      );
    });
  }, [runs, runSearch]);

  return {
    runs,
    selectedRunId,
    setSelectedRunId,
    runSearch,
    setRunSearch,
    filteredRuns,
    loadingRuns,
    runsError,
    actionError,
    isClearingRuns,
    isCreatingRuns,
    reloadRuns: loadRuns,
    clearRuns,
    createRuns,
  };
}

export default useRunHistory;