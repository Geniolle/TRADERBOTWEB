// src/components/api/ApiStatusCard.tsx

import type { HealthResponse } from "../../types/trading";

type ApiStatusCardProps = {
  sidebarCardStyle: React.CSSProperties;
  loadingHealth: boolean;
  healthError: string;
  health: HealthResponse | null;
};

function ApiStatusCard({
  sidebarCardStyle,
  loadingHealth,
  healthError,
  health,
}: ApiStatusCardProps) {
  return (
    <div style={sidebarCardStyle}>
      <h2
        style={{
          marginTop: 0,
          marginBottom: 12,
          fontSize: 18,
          fontWeight: 700,
        }}
      >
        API
      </h2>

      {loadingHealth && <p style={{ margin: 0 }}>A carregar healthcheck...</p>}

      {!loadingHealth && healthError && (
        <div>
          <p style={{ color: "#dc2626", fontWeight: "bold" }}>
            Erro ao ligar à API
          </p>
          <p>{healthError}</p>
        </div>
      )}

      {!loadingHealth && !healthError && health && (
        <div style={{ fontSize: 14, lineHeight: 1.6, color: "#1e293b" }}>
          <div>
            <strong>Status:</strong> {health.status}
          </div>
          <div>
            <strong>App:</strong> {health.app_name}
          </div>
          <div>
            <strong>Environment:</strong> {health.environment}
          </div>
        </div>
      )}
    </div>
  );
}

export default ApiStatusCard;