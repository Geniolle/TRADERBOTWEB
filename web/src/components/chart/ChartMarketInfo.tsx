// web/src/components/chart/ChartMarketInfo.tsx

type ChartMarketInfoProps = {
  marketLine: string;
  activeIndicatorLabels: string[];
};

function ChartMarketInfo({
  marketLine,
  activeIndicatorLabels,
}: ChartMarketInfoProps) {
  return (
    <div
      style={{
        marginBottom: 16,
        textAlign: "center",
        fontSize: 14,
        color: "#475569",
        lineHeight: 1.7,
      }}
    >
      <div>
        <strong>Mercado:</strong> {marketLine}
      </div>

      {activeIndicatorLabels.length > 0 && (
        <div>
          <strong>Indicadores:</strong> {activeIndicatorLabels.join(" • ")}
        </div>
      )}
    </div>
  );
}

export default ChartMarketInfo;