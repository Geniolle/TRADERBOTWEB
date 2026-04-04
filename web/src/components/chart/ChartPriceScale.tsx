// web/src/components/chart/ChartPriceScale.tsx

import { formatPrice } from "./utils/chartFormatters";

type PriceLevel = {
  value: number;
  top: number;
};

type ChartPriceScaleProps = {
  levels: PriceLevel[];
};

function ChartPriceScale({ levels }: ChartPriceScaleProps) {
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        width: 74,
        height: "100%",
        pointerEvents: "none",
        zIndex: 3,
        background:
          "linear-gradient(to left, rgba(255,255,255,0.98), rgba(255,255,255,0.88), rgba(255,255,255,0))",
      }}
    >
      {levels.map((item, index) => (
        <div
          key={`${index}-${item.value.toFixed(5)}`}
          style={{
            position: "absolute",
            right: 8,
            top: item.top,
            transform: "translateY(-50%)",
            fontSize: 12,
            fontWeight: 600,
            color: "#334155",
            whiteSpace: "nowrap",
          }}
        >
          {formatPrice(item.value)}
        </div>
      ))}
    </div>
  );
}

export default ChartPriceScale;