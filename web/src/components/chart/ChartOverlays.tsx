// web/src/components/chart/ChartOverlays.tsx

import type { OverlayLine, OverlayMarker } from "../../types/trading";
import { formatPrice } from "./utils/chartFormatters";

type ChartOverlaysProps = {
  overlays: {
    markers: OverlayMarker[];
    lines: OverlayLine[];
  };
};

function ChartOverlays({ overlays }: ChartOverlaysProps) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 8,
      }}
    >
      {overlays.lines.map((line) => (
        <div
          key={line.id}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: line.top,
            transform: "translateY(-50%)",
            zIndex: 9,
          }}
        >
          <div
            style={{
              borderTop: line.dashed
                ? `1px dashed ${line.color}`
                : `1px solid ${line.color}`,
              width: "100%",
            }}
          />

          <div
            style={{
              position: "absolute",
              right: 8,
              top: -12,
              background: line.color,
              color: "#ffffff",
              padding: "3px 8px",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 800,
              whiteSpace: "nowrap",
              boxShadow: "0 1px 3px rgba(0,0,0,0.18)",
              zIndex: 10,
            }}
          >
            {formatPrice(Number(line.value))}
          </div>
        </div>
      ))}

      {overlays.markers.map((marker) => (
        <div
          key={marker.id}
          style={{
            position: "absolute",
            left: marker.left,
            top: marker.top,
            transform: "translate(-50%, -50%)",
            zIndex: 10,
          }}
          title={`${marker.label} | ${Number(marker.price).toFixed(
            5
          )} | ${marker.timeLabel}`}
        >
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: marker.color,
              border: "2px solid #ffffff",
              boxShadow: "0 0 0 1px rgba(0,0,0,0.15)",
              margin: "0 auto",
            }}
          />
          <div
            style={{
              marginTop: 4,
              padding: "2px 6px",
              borderRadius: 999,
              background: marker.color,
              color: "#fff",
              fontSize: 10,
              fontWeight: 700,
              whiteSpace: "nowrap",
              textAlign: "center",
              boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
            }}
          >
            {marker.label}
          </div>
        </div>
      ))}
    </div>
  );
}

export default ChartOverlays;