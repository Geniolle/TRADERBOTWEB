// C:\TraderBotWeb\web\src\components\chart\ChartOverlays.tsx

import type {
  ChartOverlaySet,
  OverlaySegment,
} from "../../hooks/useChartDerivedData";
import { formatPrice } from "./utils/chartFormatters";

type ChartOverlaysProps = {
  overlays: ChartOverlaySet;
};

function buildSegmentStyle(segment: OverlaySegment): React.CSSProperties {
  const dx = segment.x2 - segment.x1;
  const dy = segment.y2 - segment.y1;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

  return {
    position: "absolute",
    left: segment.x1,
    top: segment.y1,
    width: length,
    borderTop: segment.dashed
      ? `${segment.width ?? 2}px dashed ${segment.color}`
      : `${segment.width ?? 2}px solid ${segment.color}`,
    transform: `rotate(${angle}deg)`,
    transformOrigin: "0 0",
    pointerEvents: "none",
  };
}

function SegmentLabel({ segment }: { segment: OverlaySegment }) {
  if (!segment.label) return null;

  const left = (segment.x1 + segment.x2) / 2;
  const top = (segment.y1 + segment.y2) / 2;

  return (
    <div
      style={{
        position: "absolute",
        left,
        top: top - 14,
        transform: "translate(-50%, -50%)",
        padding: "2px 6px",
        borderRadius: 999,
        fontSize: 10,
        fontWeight: 700,
        whiteSpace: "nowrap",
        color: segment.labelColor ?? "#ffffff",
        background: segment.labelBackground ?? "rgba(15, 23, 42, 0.85)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.18)",
        pointerEvents: "none",
      }}
    >
      {segment.label}
    </div>
  );
}

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
      {overlays.boxes.map((box) => (
        <div
          key={box.id}
          style={{
            position: "absolute",
            left: box.left,
            top: box.top,
            width: box.width,
            height: box.height,
            background: box.fill,
            border: `${box.borderWidth ?? 1}px ${
              box.dashed ? "dashed" : "solid"
            } ${box.borderColor}`,
            borderRadius: 6,
            boxSizing: "border-box",
            zIndex: 8,
          }}
        >
          {box.label ? (
            <div
              style={{
                position: "absolute",
                left: 4,
                top: 4,
                padding: "2px 6px",
                borderRadius: 999,
                fontSize: 10,
                fontWeight: 700,
                whiteSpace: "nowrap",
                color: box.labelColor ?? "#0f172a",
                background: box.labelBackground ?? "rgba(255,255,255,0.88)",
              }}
            >
              {box.label}
            </div>
          ) : null}
        </div>
      ))}

      {overlays.segments.map((segment) => (
        <div key={segment.id}>
          <div style={buildSegmentStyle(segment)} />
          <SegmentLabel segment={segment} />
        </div>
      ))}

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
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
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
            <span>{line.label}</span>
            <span>{formatPrice(Number(line.value))}</span>
          </div>
        </div>
      ))}

      {overlays.circles.map((circle) => (
        <div
          key={circle.id}
          style={{
            position: "absolute",
            left: circle.left - circle.radius,
            top: circle.top - circle.radius,
            width: circle.radius * 2,
            height: circle.radius * 2,
            borderRadius: "50%",
            border: `${circle.borderWidth ?? 3}px ${
              circle.dashed ? "dashed" : "solid"
            } ${circle.borderColor ?? circle.color}`,
            background: "transparent",
            boxSizing: "border-box",
            zIndex: 10,
          }}
        >
          {circle.label ? (
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: -18,
                transform: "translateX(-50%)",
                padding: "2px 6px",
                borderRadius: 999,
                fontSize: 10,
                fontWeight: 700,
                whiteSpace: "nowrap",
                color: circle.labelColor ?? "#ffffff",
                background:
                  circle.labelBackground ?? "rgba(15, 23, 42, 0.85)",
              }}
            >
              {circle.label}
            </div>
          ) : null}
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
            zIndex: 11,
          }}
          title={`${marker.label} | ${Number(marker.price).toFixed(
            5,
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

      {overlays.texts.map((text) => (
        <div
          key={text.id}
          style={{
            position: "absolute",
            left: text.left,
            top: text.top,
            padding: "4px 8px",
            borderRadius: 8,
            fontSize: 11,
            fontWeight: 800,
            whiteSpace: "nowrap",
            color: text.color,
            background: text.background,
            border: text.borderColor
              ? `1px solid ${text.borderColor}`
              : "1px solid transparent",
            boxShadow: "0 1px 3px rgba(0,0,0,0.14)",
            zIndex: 12,
          }}
        >
          {text.text}
        </div>
      ))}
    </div>
  );
}

export default ChartOverlays;