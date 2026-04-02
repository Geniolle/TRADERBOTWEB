// src/hooks/useStrategies.ts

import { useEffect, useState } from "react";

import { API_HTTP_BASE_URL } from "../constants/config";
import type { StrategyItem } from "../types/trading";

function useStrategies() {
  const [strategies, setStrategies] = useState<StrategyItem[]>([]);
  const [loadingStrategies, setLoadingStrategies] = useState(true);
  const [strategiesError, setStrategiesError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadStrategies = async () => {
      try {
        setLoadingStrategies(true);
        setStrategiesError("");

        const response = await fetch(`${API_HTTP_BASE_URL}/strategies`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data: StrategyItem[] = await response.json();

        if (!cancelled) {
          setStrategies(data);
        }
      } catch (err) {
        if (!cancelled) {
          setStrategiesError(
            err instanceof Error ? err.message : "Erro desconhecido ao carregar estratégias"
          );
          setStrategies([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingStrategies(false);
        }
      }
    };

    void loadStrategies();

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    strategies,
    loadingStrategies,
    strategiesError,
  };
}

export default useStrategies;