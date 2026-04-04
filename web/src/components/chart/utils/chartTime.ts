// web/src/components/chart/utils/chartTime.ts

import { pad2 } from "./chartFormatters";

export function timeframeToMilliseconds(timeframe: string): number | null {
  const match = /^(\d+)([smhdw])$/i.exec(timeframe.trim());

  if (!match) return null;

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();

  if (!Number.isFinite(amount) || amount <= 0) return null;

  switch (unit) {
    case "s":
      return amount * 1000;
    case "m":
      return amount * 60 * 1000;
    case "h":
      return amount * 60 * 60 * 1000;
    case "d":
      return amount * 24 * 60 * 60 * 1000;
    case "w":
      return amount * 7 * 24 * 60 * 60 * 1000;
    default:
      return null;
  }
}

export function getRemainingToNextCandle(
  timeframe: string,
  nowMs: number
): number | null {
  const intervalMs = timeframeToMilliseconds(timeframe);
  if (!intervalMs) return null;

  const remainder = nowMs % intervalMs;
  if (remainder === 0) return intervalMs;

  return intervalMs - remainder;
}

export function formatRemainingTime(remainingMs: number | null): string {
  if (remainingMs === null) return "--m --s";

  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${pad2(hours)}h ${pad2(minutes)}m ${pad2(seconds)}s`;
  }

  return `${pad2(minutes)}m ${pad2(seconds)}s`;
}