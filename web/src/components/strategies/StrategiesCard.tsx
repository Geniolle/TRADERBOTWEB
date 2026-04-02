// src/components/strategies/StrategiesCard.tsx

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
  return (
    <div style={mainCardStyle}>
      <h2 style={sectionTitleStyle}>Estratégias disponíveis</h2>

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
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 12,
          }}
        >
          {strategies.map((strategy) => (
            <div
              key={strategy.key}
              style={{
                border: "1px solid #dbe2ea",
                borderRadius: 12,
                padding: 12,
                background: "#fff",
              }}
            >
              <div
                style={{
                  fontWeight: 700,
                  marginBottom: 8,
                  color: "#0f172a",
                }}
              >
                {strategy.name}
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.5, color: "#334155" }}>
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
                  <strong>Description:</strong> {strategy.description}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default StrategiesCard;