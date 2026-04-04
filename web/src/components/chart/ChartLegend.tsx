// web/src/components/chart/ChartLegend.tsx

type ChartLegendProps = {
  legendCloseColor: string;
};

function ChartLegend({ legendCloseColor }: ChartLegendProps) {
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        flexWrap: "wrap",
        marginTop: 14,
        fontSize: 12,
        justifyContent: "center",
      }}
    >
      <span>
        <strong>Legenda:</strong>
      </span>
      <span style={{ color: "#7c3aed" }}>TRG = Trigger</span>
      <span style={{ color: "#2563eb" }}>ENT = Entry</span>
      <span style={{ color: legendCloseColor }}>CLS = Close</span>
      <span style={{ color: "#16a34a" }}>Linha verde = Target</span>
      <span style={{ color: "#dc2626" }}>Linha vermelha = Invalidation</span>
    </div>
  );
}

export default ChartLegend;