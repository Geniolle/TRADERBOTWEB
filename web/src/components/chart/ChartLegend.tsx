// C:\TraderBotWeb\web\src\components\chart\ChartLegend.tsx

type ChartLegendProps = {
  legendCloseColor: string;
  showStrategyOverlays: boolean;
};

function ChartLegend({
  legendCloseColor,
  showStrategyOverlays,
}: ChartLegendProps) {
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

      {showStrategyOverlays ? (
        <>
          <span style={{ color: "#0f172a" }}>Linha escura = Impulso</span>
          <span style={{ color: "#2563eb" }}>Zona azul = M9 / M21</span>
          <span style={{ color: "#2563eb" }}>Círculo azul = Trigger</span>
          <span style={{ color: "#16a34a" }}>Caixa verde = Alvo</span>
          <span style={{ color: "#dc2626" }}>Caixa vermelha = Invalidação</span>
          <span style={{ color: legendCloseColor }}>Overlay real do case = prioridade secundária</span>
        </>
      ) : (
        <span style={{ color: "#475569" }}>
          Sem overlays estratégicos para a estratégia selecionada.
        </span>
      )}
    </div>
  );
}

export default ChartLegend;