// src/hooks/useCandles.ts

import { useEffect, useMemo, useRef, useState } from "react";

import { API_HTTP_BASE_URL } from "../constants/config";
import type { CandleItem } from "../types/trading";
import { normalizeCandles } from "../utils/candles";

type UseCandlesParams = {
  symbol: string;
  timeframe: string;
  startAt: string;
  endAt: string;
};

type UseCandlesResult = {
  candles: CandleItem[];
  setCandles: React.Dispatch<React.SetStateAction<CandleItem[]>>;
  loadingCandles: boolean;
  candlesError: string;
  reloadCandles: (showLoader?: boolean) => Promise<void>;
};

function useCandles({
  symbol,
  timeframe,
  startAt,
  endAt,
}: UseCandlesParams): UseCandlesResult {
  const [candles, setCandles] = useState<CandleItem[]>([]);
  const [loadingCandles, setLoadingCandles] = useState(false);
  const [candlesError, setCandlesError] = useState("");

  const loadCandlesRef = useRef<((showLoader?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    let cancelled = false;

    loadCandlesRef.current = async (showLoader = false) => {
      if (!symbol || !timeframe) {
        if (!cancelled) {
          setCandles([]);
          setCandlesError("");
          setLoadingCandles(false);
        }
        return;
      }

      try {
        if (!cancelled && showLoader) {
          setLoadingCandles(true);
          setCandles([]);
        }

        if (!cancelled) {
          setCandlesError("");
        }

        const params = new URLSearchParams({
          symbol,
          timeframe,
          start_at: startAt,
          end_at: endAt,
          limit: "500",
        });

        const response = await fetch(`${API_HTTP_BASE_URL}/candles?${params.toString()}`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data: CandleItem[] = await response.json();

        if (!cancelled) {
          setCandles(normalizeCandles(data));
        }
      } catch (err) {
        if (!cancelled) {
          setCandlesError(
            err instanceof Error ? err.message : "Erro desconhecido ao carregar candles"
          );
          setCandles([]);
        }
      } finally {
        if (!cancelled && showLoader) {
          setLoadingCandles(false);
        }
      }
    };

    void loadCandlesRef.current(true);

    return () => {
      cancelled = true;
      loadCandlesRef.current = null;
    };
  }, [symbol, timeframe, startAt, endAt]);

  const reloadCandles = useMemo(() => {
    return async (showLoader = false) => {
      await loadCandlesRef.current?.(showLoader);
    };
  }, []);

  return {
    candles,
    setCandles,
    loadingCandles,
    candlesError,
    reloadCandles,
  };
}

export default useCandles;