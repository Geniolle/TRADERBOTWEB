// web/src/components/chart/ChartCountdownBadge.tsx

type ChartCountdownBadgeProps = {
  countdownText: string;
};

function ChartCountdownBadge({
  countdownText,
}: ChartCountdownBadgeProps) {
  return (
    <div
      style={{
        position: "absolute",
        right: 12,
        bottom: 12,
        zIndex: 7,
        background: "rgba(15, 23, 42, 0.88)",
        color: "#ffffff",
        padding: "6px 10px",
        borderRadius: 8,
        fontSize: 14,
        fontWeight: 700,
        letterSpacing: 0.2,
        pointerEvents: "none",
        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        whiteSpace: "nowrap",
      }}
    >
      {countdownText}
    </div>
  );
}

export default ChartCountdownBadge;