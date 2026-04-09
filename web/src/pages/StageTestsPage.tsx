// C:\TraderBotWeb\web\src\pages\StageTestsPage.tsx
// Backend:
// - GET  /api/v1/stage-tests/options
// - POST /api/v1/stage-tests/run

import { useState, type CSSProperties } from "react";
import StageTestRunModal from "../components/stage-tests/StageTestRunModal";

export default function StageTestsPage() {
  const [open, setOpen] = useState(false);

  return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <div>
          <h1 style={{ margin: 0 }}>Stage Tests</h1>
          <p style={{ marginTop: 8, color: "#94a3b8" }}>
            Esta página executa Stage Tests manualmente. O dashboard principal
            mantém o catálogo sincronizado e agora pode disparar auto-run local
            quando chega candle novo.
          </p>
        </div>

        <button style={runButtonStyle} onClick={() => setOpen(true)}>
          Run Stage Tests
        </button>
      </div>

      <div style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Como funciona</h2>
        <div style={{ color: "#cbd5e1", lineHeight: 1.6 }}>
          <div>• A lista de estratégias vem do backend.</div>
          <div>• A lista de símbolos e timeframes vem da tabela candles.</div>
          <div>• A lista atualiza automaticamente a cada 15 segundos.</div>
          <div>• Apenas combinações existentes no BD ficam disponíveis.</div>
          <div>• O botão Run chama o backend e executa o processo real.</div>
          <div>
            • O auto-run do dashboard é local/em memória até existir histórico
            persistido no backend.
          </div>
        </div>
      </div>

      <StageTestRunModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

const pageStyle: CSSProperties = {
  padding: 24,
  color: "#e5e7eb",
};

const headerStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  marginBottom: 24,
};

const runButtonStyle: CSSProperties = {
  height: 44,
  padding: "0 18px",
  borderRadius: 12,
  border: "none",
  background: "#2563eb",
  color: "#fff",
  fontWeight: 600,
  cursor: "pointer",
};

const cardStyle: CSSProperties = {
  padding: 16,
  borderRadius: 16,
  background: "#0f172a",
  border: "1px solid #1e293b",
};