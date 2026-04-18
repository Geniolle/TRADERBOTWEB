import { useState, type CSSProperties } from "react";

import AppShell from "../components/layout/AppShell";
import StageTestRunModal from "../components/stage-tests/StageTestRunModal";

const cardStyle: CSSProperties = {
  border: "1px solid #dbe2ea",
  borderRadius: 16,
  padding: 20,
  background: "#ffffff",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
};

const buttonStyle: CSSProperties = {
  border: "1px solid #0f172a",
  borderRadius: 10,
  background: "#0f172a",
  color: "#ffffff",
  fontWeight: 600,
  fontSize: 14,
  padding: "12px 16px",
  cursor: "pointer",
};

export default function StageTestsPage() {
  const [runModalOpen, setRunModalOpen] = useState(false);

  return (
    <AppShell sectionLabel="Stage Tests" activePath="/stage-tests">
      <div
        style={{
          display: "grid",
          gap: 18,
          width: "100%",
          maxWidth: 960,
        }}
      >
        <section style={cardStyle}>
          <h2
            style={{
              margin: "0 0 12px 0",
              fontSize: 22,
              color: "#0f172a",
            }}
          >
            Execução manual de Stage Tests
          </h2>

          <p
            style={{
              margin: 0,
              color: "#475569",
              lineHeight: 1.7,
            }}
          >
            Esta rota foi reorganizada para usar o executor manual já existente
            no projeto. O fluxo principal de análise e histórico continua
            disponível no dashboard.
          </p>
        </section>

        <section
          style={{
            ...cardStyle,
            display: "grid",
            gap: 16,
          }}
        >
          <div>
            <h3
              style={{
                margin: "0 0 8px 0",
                fontSize: 18,
                color: "#0f172a",
              }}
            >
              Ações disponíveis
            </h3>
            <p
              style={{
                margin: 0,
                color: "#475569",
                lineHeight: 1.7,
              }}
            >
              Abra o executor para carregar símbolos, timeframes e estratégias
              expostos pelo backend, correr um teste manual e inspecionar o
              resultado sem depender do dashboard principal.
            </p>
          </div>

          <div>
            <button
              type="button"
              style={buttonStyle}
              onClick={() => setRunModalOpen(true)}
            >
              Abrir executor manual
            </button>
          </div>
        </section>
      </div>

      <StageTestRunModal
        open={runModalOpen}
        onClose={() => setRunModalOpen(false)}
      />
    </AppShell>
  );
}
