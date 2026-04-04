// web/src/components/chart/ChartEmptyState.tsx

function ChartEmptyState() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(255,255,255,0.82)",
        color: "#475569",
        fontSize: 16,
        fontWeight: 600,
        zIndex: 2,
      }}
    >
      Sem candles para este símbolo no período selecionado.
    </div>
  );
}

export default ChartEmptyState;