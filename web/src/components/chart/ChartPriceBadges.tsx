// web/src/components/chart/ChartPriceBadges.tsx

import type { CandleTickState } from "../../types/trading";

type ChartPriceBadgesProps = {
  symbol: string;
  timeframe: string;
  lastCandleTick: CandleTickState;
  lastClosePrice: number | null;
};

function formatPrice(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "-";
  }

  return value.toFixed(5);
}

function ChartPriceBadges({
  symbol,
  timeframe,
  lastCandleTick,
  lastClosePrice,
}: ChartPriceBadgesProps) {
  const currentPrice =
    lastCandleTick && Number.isFinite(lastCandleTick.close)
      ? lastCandleTick.close
      : lastClosePrice;

  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        left: 12,
        zIndex: 5,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 10px",
          borderRadius: 8,
          background: "rgba(15, 23, 42, 0.88)",
          color: "#ffffff",
          fontSize: 13,
          fontWeight: 700,
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          whiteSpace: "nowrap",
          width: "fit-content",
        }}
      >
        <span>{symbol || "-"}</span>
        <span style={{ opacity: 0.75 }}>|</span>
        <span>{timeframe || "-"}</span>
      </div>

      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          padding: "7px 10px",
          borderRadius: 8,
          background: "#16a34a",
          color: "#ffffff",
          fontSize: 14,
          fontWeight: 800,
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          whiteSpace: "nowrap",
          width: "fit-content",
        }}
      >
        {formatPrice(currentPrice)}
      </div>
    </div>
  );
}

export default ChartPriceBadges;