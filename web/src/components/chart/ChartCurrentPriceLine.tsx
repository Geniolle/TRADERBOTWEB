// web/src/components/chart/ChartCurrentPriceLine.tsx

import { formatPrice } from "./utils/chartFormatters";

type ChartCurrentPriceLineProps = {
  top: number;
  price: number;
};

function ChartCurrentPriceLine({
  top,
  price,
}: ChartCurrentPriceLineProps) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 6,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top,
          transform: "translateY(-50%)",
        }}
      >
        <div
          style={{
            borderTop: "1px dashed #16a34a",
            width: "100%",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: 8,
            top: -12,
            background: "#16a34a",
            color: "#ffffff",
            padding: "3px 8px",
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 800,
            whiteSpace: "nowrap",
            boxShadow: "0 1px 3px rgba(0,0,0,0.18)",
          }}
        >
          {formatPrice(price)}
        </div>
      </div>
    </div>
  );
}

export default ChartCurrentPriceLine;