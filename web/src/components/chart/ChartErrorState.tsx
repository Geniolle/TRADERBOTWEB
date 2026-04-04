// web/src/components/chart/ChartErrorState.tsx

type ChartErrorStateProps = {
  candlesError: string;
};

function ChartErrorState({ candlesError }: ChartErrorStateProps) {
  return (
    <div>
      <p style={{ color: "#dc2626", fontWeight: "bold" }}>
        Erro ao carregar candles
      </p>
      <p>{candlesError}</p>
    </div>
  );
}

export default ChartErrorState;