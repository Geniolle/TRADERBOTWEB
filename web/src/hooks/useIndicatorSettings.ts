// web/src/hooks/useIndicatorSettings.ts

import { useEffect, useState } from "react";

export type IndicatorSettings = {
  ema9: boolean;
  ema21: boolean;
  bollinger: boolean;
  bollingerPeriod: number;
  bollingerStdDev: number;
};

const STORAGE_KEY = "traderbot:indicatorSettings";

const DEFAULT_SETTINGS: IndicatorSettings = {
  ema9: true,
  ema21: true,
  bollinger: true,
  bollingerPeriod: 20,
  bollingerStdDev: 2,
};

function normalizeNumber(
  value: unknown,
  fallback: number,
  min: number,
  max: number
): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) return fallback;
  if (parsed < min) return min;
  if (parsed > max) return max;

  return parsed;
}

function loadStoredSettings(): IndicatorSettings {
  try {
    if (typeof window === "undefined") return DEFAULT_SETTINGS;

    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;

    const parsed = JSON.parse(raw) as Partial<IndicatorSettings>;

    return {
      ema9: Boolean(parsed.ema9 ?? DEFAULT_SETTINGS.ema9),
      ema21: Boolean(parsed.ema21 ?? DEFAULT_SETTINGS.ema21),
      bollinger: Boolean(parsed.bollinger ?? DEFAULT_SETTINGS.bollinger),
      bollingerPeriod: normalizeNumber(
        parsed.bollingerPeriod,
        DEFAULT_SETTINGS.bollingerPeriod,
        2,
        200
      ),
      bollingerStdDev: normalizeNumber(
        parsed.bollingerStdDev,
        DEFAULT_SETTINGS.bollingerStdDev,
        0.1,
        10
      ),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function useIndicatorSettings() {
  const [settings, setSettings] = useState<IndicatorSettings>(() =>
    loadStoredSettings()
  );

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Ignora erros de persistência
    }
  }, [settings]);

  const setIndicatorEnabled = (
    key: "ema9" | "ema21" | "bollinger",
    enabled: boolean
  ) => {
    setSettings((previous) => ({
      ...previous,
      [key]: enabled,
    }));
  };

  const setBollingerPeriod = (value: number) => {
    setSettings((previous) => ({
      ...previous,
      bollingerPeriod: normalizeNumber(value, previous.bollingerPeriod, 2, 200),
    }));
  };

  const setBollingerStdDev = (value: number) => {
    setSettings((previous) => ({
      ...previous,
      bollingerStdDev: normalizeNumber(value, previous.bollingerStdDev, 0.1, 10),
    }));
  };

  return {
    settings,
    setIndicatorEnabled,
    setBollingerPeriod,
    setBollingerStdDev,
  };
}

export default useIndicatorSettings;