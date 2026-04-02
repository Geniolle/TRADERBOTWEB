// src/hooks/useRunHistory.ts

import { useEffect, useMemo, useState } from "react";

import { API_HTTP_BASE_URL } from "../constants/config";
import type { RunHistoryItem } from "../types/trading";

function useRunHistory() {
  const [runs, setRuns] = useState<RunHistoryItem[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string>("");
  const [runSearch, setRunSearch] = useState("");
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [runsError, setRunsError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadRuns = async () => {
      try {
        setLoadingRuns(true);
        setRunsError("");

        const response = await fetch(`${API_HTTP_BASE_URL}/run-history?limit=10`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data: RunHistoryItem[] = await response.json();

        if (cancelled) return;

        setRuns(data);

        if (data.length > 0) {
          const preferredRun =
            data.find((item) => item.strategy_key && item.strategy_key.trim() !== "") ??
            data[0];
          setSelectedRunId(preferredRun.id);
        } else {
          setSelectedRunId("");
        }
      } catch (err) {
        if (!cancelled) {
          setRunsError(
            err instanceof Error ? err.message : "Erro desconhecido ao carregar histórico"
          );
          setRuns([]);
          setSelectedRunId("");
        }
      } finally {
        if (!cancelled) {
          setLoadingRuns(false);
        }
      }
    };

    void loadRuns();

    return () => {
      cancelled = true;
    };
  }, []);

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
  };
}

export default useRunHistory;