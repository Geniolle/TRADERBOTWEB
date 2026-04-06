// web/src/hooks/useStrategies.ts

import { useEffect, useState } from "react";

import { API_HTTP_BASE_URL } from "../constants/config";
import type { StrategyItem, StrategyListResponse } from "../types/trading";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toSafeString(value: unknown, fallback = ""): string {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return fallback;
}

function toOptionalBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }

  return undefined;
}

function normalizeStrategyItem(item: unknown): StrategyItem | null {
  if (!isRecord(item)) {
    return null;
  }

  const key = toSafeString(item.key);
  if (!key) {
    return null;
  }

  const name = toSafeString(item.name, key);
  const version = toSafeString(item.version, "unknown");
  const description = toSafeString(item.description, "");
  const category = toSafeString(item.category, "general");
  const enabled = toOptionalBoolean(item.enabled);
  const supportsChartOverlays = toOptionalBoolean(item.supports_chart_overlays);
  const strategyFamily = toSafeString(item.strategy_family, "") || null;

  return {
    key,
    name,
    version,
    description,
    category,
    enabled,
    supports_chart_overlays: supportsChartOverlays,
    strategy_family: strategyFamily,
  };
}

function extractRawStrategies(payload: StrategyListResponse | unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!isRecord(payload)) {
    return [];
  }

  if (Array.isArray(payload.items)) {
    return payload.items;
  }

  if (Array.isArray(payload.strategies)) {
    return payload.strategies;
  }

  if (Array.isArray(payload.data)) {
    return payload.data;
  }

  return [];
}

function normalizeStrategies(payload: StrategyListResponse | unknown): StrategyItem[] {
  const normalized = extractRawStrategies(payload)
    .map(normalizeStrategyItem)
    .filter((item): item is StrategyItem => item !== null);

  const uniqueByKey = new Map<string, StrategyItem>();

  for (const strategy of normalized) {
    uniqueByKey.set(strategy.key, strategy);
  }

  return Array.from(uniqueByKey.values()).sort((left, right) => {
    const leftEnabled = left.enabled !== false ? 1 : 0;
    const rightEnabled = right.enabled !== false ? 1 : 0;

    if (leftEnabled !== rightEnabled) {
      return rightEnabled - leftEnabled;
    }

    return left.name.localeCompare(right.name, "pt-PT", {
      sensitivity: "base",
    });
  });
}

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

        const data: StrategyListResponse | unknown = await response.json();
        const normalizedStrategies = normalizeStrategies(data);

        if (!cancelled) {
          setStrategies(normalizedStrategies);
        }
      } catch (err) {
        if (!cancelled) {
          setStrategiesError(
            err instanceof Error
              ? err.message
              : "Erro desconhecido ao carregar estratégias"
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