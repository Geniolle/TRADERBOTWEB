import { useCallback, useEffect, useMemo, useState } from "react";

import {
  fetchBinanceSpotOrderHistory,
  type BinanceSpotOrderHistoryItem,
} from "../services/ordersApi";

type UseBinanceTestnetOrderHistoryParams = {
  symbol: string;
  enabled?: boolean;
  limit?: number;
};

type UseBinanceTestnetOrderHistoryResult = {
  loading: boolean;
  error: string;
  items: BinanceSpotOrderHistoryItem[];
  lastUpdatedAt: string | null;
  reload: () => Promise<void>;
};

const DEFAULT_POLL_MS = 20_000;

function normalizeSymbol(value: string): string {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export default function useBinanceTestnetOrderHistory({
  symbol,
  enabled = true,
  limit = 50,
}: UseBinanceTestnetOrderHistoryParams): UseBinanceTestnetOrderHistoryResult {
  const normalizedSymbol = useMemo(() => normalizeSymbol(symbol), [symbol]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState<BinanceSpotOrderHistoryItem[]>([]);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled || !normalizedSymbol) {
      setItems([]);
      setError("");
      setLastUpdatedAt(null);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await fetchBinanceSpotOrderHistory({
        symbol: normalizedSymbol,
        limit,
      });

      const nextItems = Array.isArray(response.items) ? response.items : [];
      setItems(nextItems);
      setLastUpdatedAt(new Date().toISOString());
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : "Erro ao carregar historico da Binance testnet.";

      setError(message);
    } finally {
      setLoading(false);
    }
  }, [enabled, normalizedSymbol, limit]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!enabled || !normalizedSymbol) return;

    const intervalHandle = setInterval(() => {
      void load();
    }, DEFAULT_POLL_MS);

    return () => {
      clearInterval(intervalHandle);
    };
  }, [enabled, normalizedSymbol, load]);

  return {
    loading,
    error,
    items,
    lastUpdatedAt,
    reload: load,
  };
}
