// web/src/components/chart/hooks/useChartCountdown.ts

import { useEffect, useMemo, useState } from "react";
import {
  formatRemainingTime,
  getRemainingToNextCandle,
} from "../utils/chartTime";

export function useChartCountdown(timeframe: string): string {
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  return useMemo(() => {
    const remainingMs = getRemainingToNextCandle(timeframe, nowMs);
    return formatRemainingTime(remainingMs);
  }, [timeframe, nowMs]);
}