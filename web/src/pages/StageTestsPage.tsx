import { useState } from "react";
import StageTestRunModal from "../components/stage-tests/StageTestRunModal";

export default function StageTestsPage() {
  const [open, setOpen] = useState(false);

  return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <div>
          <h1 style={{ margin: 0 }}>Stage Testes</h1>
          <p style={{ marginTop: 8, color: "#94a3b8" }}>
            Executa testes de estratégia usando os símbolos disponíveis no BD.
          </p>
        </div>

        <button style={runButtonStyle} onClick={() => setOpen(true)}>
          Run Stage Testes
        </button>
      </div>

      <div style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Como funciona</h2>
        <div style={{ color: "#cbd5e1", lineHeight: 1.6 }}>
          <div>• A lista de símbolos e timeframes vem da tabela candles.</div>
          <div>• A lista atualiza automaticamente a cada 15 segundos.</div>
          <div>• Apenas combinações existentes no BD ficam disponíveis.</div>
          <div>• O botão Run chama o backend e executa o processo real.</div>
        </div>
      </div>

      <StageTestRunModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  padding: 24,
  color: "#e5e7eb",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  marginBottom: 24,
};

const runButtonStyle: React.CSSProperties = {
  height: 44,
  padding: "0 18px",
  borderRadius: 12,
  border: "none",
  background: "#2563eb",
  color: "#fff",
  fontWeight: 600,
  cursor: "pointer",
};

const cardStyle: React.CSSProperties = {
  padding: 16,
  borderRadius: 16,
  background: "#0f172a",
  border: "1px solid #1e293b",
};