// web/src/components/strategies/StrategiesCard.tsx

import type { StrategyItem } from "../../types/trading";

type StrategiesCardProps = {
  mainCardStyle: React.CSSProperties;
  sectionTitleStyle: React.CSSProperties;
  strategies: StrategyItem[];
  loadingStrategies: boolean;
  strategiesError: string;
};

function StrategiesCard({
  mainCardStyle,
  sectionTitleStyle,
  strategies,
  loadingStrategies,
  strategiesError,
}: StrategiesCardProps) {
  const enabledStrategies = strategies.filter(
    (strategy) => strategy.enabled !== false
  );
  const disabledStrategies = strategies.filter(
    (strategy) => strategy.enabled === false
  );

  return (
    <div style={mainCardStyle}>
      <h2 style={sectionTitleStyle}>Estratégias técnicas do backend</h2>

      <p
        style={{
          marginTop: -4,
          marginBottom: 16,
          fontSize: 13,
          lineHeight: 1.55,
          color: "#64748b",
        }}
      >
        Esta secção mostra as estratégias registadas no motor de execução. Não
        representa os setups e oportunidades do contexto atual apresentados nos
        cards do gráfico.
      </p>

      {loadingStrategies && <p>A carregar estratégias...</p>}

      {!loadingStrategies && strategiesError && (
        <div>
          <p style={{ color: "#dc2626", fontWeight: "bold" }}>
            Erro ao carregar estratégias
          </p>
          <p>{strategiesError}</p>
        </div>
      )}

      {!loadingStrategies && !strategiesError && strategies.length === 0 && (
        <p>Nenhuma estratégia encontrada.</p>
      )}

      {!loadingStrategies && !strategiesError && strategies.length > 0 && (
        <>
          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              marginBottom: 16,
              fontSize: 13,
              color: "#475569",
            }}
          >
            <span>
              <strong>Total:</strong> {strategies.length}
            </span>
            <span>
              <strong>Ativas:</strong> {enabledStrategies.length}
            </span>
            <span>
              <strong>Inativas:</strong> {disabledStrategies.length}
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 12,
            }}
          >
            {strategies.map((strategy) => {
              const isEnabled = strategy.enabled !== false;
              const supportsOverlays =
                strategy.supports_chart_overlays !== false;

              return (
                <div
                  key={strategy.key}
                  style={{
                    border: "1px solid #dbe2ea",
                    borderRadius: 12,
                    padding: 12,
                    background: "#fff",
                    opacity: isEnabled ? 1 : 0.72,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 8,
                      marginBottom: 8,
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 700,
                        color: "#0f172a",
                      }}
                    >
                      {strategy.name}
                    </div>

                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "4px 8px",
                        borderRadius: 999,
                        background: isEnabled ? "#dcfce7" : "#fee2e2",
                        color: isEnabled ? "#166534" : "#991b1b",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {isEnabled ? "ATIVA" : "INATIVA"}
                    </span>
                  </div>

                  <div style={{ fontSize: 13, lineHeight: 1.6, color: "#334155" }}>
                    <div>
                      <strong>Key:</strong> {strategy.key}
                    </div>
                    <div>
                      <strong>Version:</strong> {strategy.version}
                    </div>
                    <div>
                      <strong>Category:</strong> {strategy.category}
                    </div>
                    <div>
                      <strong>Overlays:</strong>{" "}
                      {supportsOverlays ? "suportados" : "não suportados"}
                    </div>
                    <div>
                      <strong>Description:</strong>{" "}
                      {strategy.description || "-"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default StrategiesCard;