// web/src/components/chart/ChartSummary.tsx

type ChartSummaryProps = {
  candles: Array<{ open_time: string; close?: string }>;
};

function ChartSummary({ candles }: ChartSummaryProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
        gap: 12,
        marginTop: 18,
        marginBottom: 18,
        fontSize: 14,
        color: "#475569",
        textAlign: "center",
      }}
    >
      <div>
        <strong>Total candles:</strong> {candles.length}
      </div>
      <div>
        <strong>Primeiro candle:</strong> {candles[0]?.open_time ?? "-"}
      </div>
      <div>
        <strong>Último candle:</strong>{" "}
        {candles[candles.length - 1]?.open_time ?? "-"}
      </div>
    </div>
  );
}

export default ChartSummary;