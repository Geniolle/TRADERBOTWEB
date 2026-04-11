// src/components/diagnostics/ChartDiagnosticsCard.tsx

import type { CSSProperties } from "react";
import type { FeedDiagnostics } from "../../types/trading";

type ChartDiagnosticsCardProps = {
  mainCardStyle: CSSProperties;
  sectionTitleStyle: CSSProperties;
  debugGridStyle: CSSProperties;
  debugItemStyle: CSSProperties;
  feedDiagnostics: FeedDiagnostics;
};

type CoverageStatus = {
  level: "good" | "warning" | "danger";
  title: string;
  message: string;
  expectedChartBehavior: string;
  background: string;
  border: string;
  color: string;
};

function parseDateValue(value: string): number | null {
  if (!value || value === "-") return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function getCoverageStatus(feedDiagnostics: FeedDiagnostics): CoverageStatus {
  const now = Date.now();
  const lastCloseMs = parseDateValue(feedDiagnostics.coverageLastCloseUtc);
  const startMs = parseDateValue(feedDiagnostics.coverageStartUtc);
  const endMs = parseDateValue(feedDiagnostics.coverageEndUtc);
  const count = Number(feedDiagnostics.coverageCount || 0);
  const mode = feedDiagnostics.coverageMode;
  const totalCandles = Number(feedDiagnostics.totalCandles || 0);
  const hasVisibleSnapshot = totalCandles > 0;

  if (!count || !lastCloseMs || !startMs || !endMs) {
    return {
      level: "danger",
      title: "Cobertura insuficiente",
      message:
        "A base local não devolveu candles suficientes para validar a janela pedida com confiança.",
      expectedChartBehavior: hasVisibleSnapshot
        ? "O gráfico deve continuar visível com o último snapshot válido já carregado, acompanhado de aviso técnico."
        : "Ainda não existe snapshot válido suficiente para mostrar com confiança.",
      background: "#fef2f2",
      border: "#fca5a5",
      color: "#991b1b",
    };
  }

  const ageMinutes = (now - lastCloseMs) / 60000;
  const requestedWindowMinutes = Math.max((endMs - startMs) / 60000, 1);
  const averageSpacingMinutes = requestedWindowMinutes / Math.max(count, 1);

  const isClearlyStale = ageMinutes > Math.max(averageSpacingMinutes * 6, 180);
  const isSlightlyStale = ageMinutes > Math.max(averageSpacingMinutes * 3, 45);
  const isCoverageThin =
    (mode === "full" && count < 30) || (mode === "incremental" && count < 5);

  if (isClearlyStale || isCoverageThin) {
    return {
      level: "danger",
      title: "Cobertura crítica",
      message:
        "A cobertura local está curta ou antiga demais para esta seleção. A ponta mais recente pode não refletir o estado atual com confiança.",
      expectedChartBehavior: hasVisibleSnapshot
        ? "O gráfico deve manter o último snapshot válido e sinalizar que a cobertura atual não é suficiente para substituir o que já estava visível."
        : "Sem snapshot válido anterior, o sistema depende de nova carga consistente para preencher o gráfico.",
      background: "#fef2f2",
      border: "#fca5a5",
      color: "#991b1b",
    };
  }

  if (isSlightlyStale) {
    return {
      level: "warning",
      title: "Cobertura aceitável com atenção",
      message:
        "A base local ainda está utilizável, mas a ponta parece um pouco antiga. Convém observar se o sync incremental está a atualizar normalmente.",
      expectedChartBehavior:
        "O gráfico pode continuar a usar o snapshot atual enquanto o sistema tenta recuperar atualização mais recente.",
      background: "#fffbeb",
      border: "#fcd34d",
      color: "#92400e",
    };
  }

  return {
    level: "good",
    title: "Cobertura saudável",
    message:
      "A cobertura local parece consistente com a janela pedida e a ponta recente não indica atraso relevante.",
    expectedChartBehavior:
      "O gráfico pode atualizar normalmente com os candles mais recentes disponíveis.",
    background: "#ecfdf5",
    border: "#86efac",
    color: "#166534",
  };
}

function ChartDiagnosticsCard({
  mainCardStyle,
  sectionTitleStyle,
  debugGridStyle,
  debugItemStyle,
  feedDiagnostics,
}: ChartDiagnosticsCardProps) {
  const coverageStatus = getCoverageStatus(feedDiagnostics);

  return (
    <div style={mainCardStyle}>
      <h2 style={sectionTitleStyle}>Diagnóstico técnico do feed</h2>

      <div
        style={{
          marginBottom: 14,
          fontSize: 14,
          color: "#475569",
          lineHeight: 1.6,
        }}
      >
        Este painel existe para validar se o preço divergente vem de provider,
        sessão, timezone, delayed feed, mock feed ou cobertura insuficiente da
        base local.
      </div>

      <div
        style={{
          marginBottom: 16,
          padding: 12,
          borderRadius: 12,
          background: coverageStatus.background,
          border: `1px solid ${coverageStatus.border}`,
          color: coverageStatus.color,
          fontSize: 13,
          lineHeight: 1.6,
        }}
      >
        <strong>{coverageStatus.title}</strong>
        <div style={{ marginTop: 4 }}>{coverageStatus.message}</div>

        <div
          style={{
            marginTop: 10,
            padding: 10,
            borderRadius: 10,
            background: "rgba(255,255,255,0.45)",
            border: `1px solid ${coverageStatus.border}`,
          }}
        >
          <strong>Comportamento esperado do gráfico:</strong>
          <div>{coverageStatus.expectedChartBehavior}</div>
        </div>
      </div>

      <div style={debugGridStyle}>
        <div style={debugItemStyle}>
          <div>
            <strong>Symbol:</strong> {feedDiagnostics.symbol}
          </div>
          <div>
            <strong>Timeframe:</strong> {feedDiagnostics.timeframe}
          </div>
          <div>
            <strong>Total candles:</strong> {feedDiagnostics.totalCandles}
          </div>
          <div>
            <strong>Último close:</strong> {feedDiagnostics.lastClose}
          </div>
          <div>
            <strong>Range OHLC:</strong> {feedDiagnostics.priceRange}
          </div>
        </div>

        <div style={debugItemStyle}>
          <div>
            <strong>Primeiro candle UTC:</strong> {feedDiagnostics.firstCandleUtc}
          </div>
          <div>
            <strong>Primeiro candle local:</strong> {feedDiagnostics.firstCandleLocal}
          </div>
          <div>
            <strong>Último candle UTC:</strong> {feedDiagnostics.lastCandleUtc}
          </div>
          <div>
            <strong>Último candle local:</strong> {feedDiagnostics.lastCandleLocal}
          </div>
          <div>
            <strong>Timezone runtime:</strong> {feedDiagnostics.runtimeTimezone}
          </div>
        </div>

        <div style={debugItemStyle}>
          <div>
            <strong>Candle source:</strong> {feedDiagnostics.candleSource}
          </div>
          <div>
            <strong>Candle provider:</strong> {feedDiagnostics.candleProvider}
          </div>
          <div>
            <strong>Candle session:</strong> {feedDiagnostics.candleSession}
          </div>
          <div>
            <strong>Candle timezone:</strong> {feedDiagnostics.candleTimezone}
          </div>
          <div>
            <strong>Candle delayed:</strong> {feedDiagnostics.candleIsDelayed}
          </div>
          <div>
            <strong>Candle mock:</strong> {feedDiagnostics.candleIsMock}
          </div>
        </div>

        <div style={debugItemStyle}>
          <div>
            <strong>Último tick UTC:</strong> {feedDiagnostics.lastTickUtc}
          </div>
          <div>
            <strong>Último tick local:</strong> {feedDiagnostics.lastTickLocal}
          </div>
          <div>
            <strong>Tick source:</strong> {feedDiagnostics.tickSource}
          </div>
          <div>
            <strong>Tick provider:</strong> {feedDiagnostics.tickProvider}
          </div>
          <div>
            <strong>Tick session:</strong> {feedDiagnostics.tickSession}
          </div>
          <div>
            <strong>Tick timezone:</strong> {feedDiagnostics.tickTimezone}
          </div>
          <div>
            <strong>Tick delayed:</strong> {feedDiagnostics.tickIsDelayed}
          </div>
          <div>
            <strong>Tick mock:</strong> {feedDiagnostics.tickIsMock}
          </div>
        </div>

        <div
          style={{
            ...debugItemStyle,
            borderColor: coverageStatus.border,
            background: coverageStatus.background,
          }}
        >
          <div style={{ color: coverageStatus.color, marginBottom: 8 }}>
            <strong>Status da cobertura:</strong> {coverageStatus.title}
          </div>
          <div>
            <strong>Coverage mode:</strong> {feedDiagnostics.coverageMode}
          </div>
          <div>
            <strong>Coverage count:</strong> {feedDiagnostics.coverageCount}
          </div>
          <div>
            <strong>Coverage start UTC:</strong> {feedDiagnostics.coverageStartUtc}
          </div>
          <div>
            <strong>Coverage end UTC:</strong> {feedDiagnostics.coverageEndUtc}
          </div>
          <div>
            <strong>First open UTC:</strong> {feedDiagnostics.coverageFirstOpenUtc}
          </div>
          <div>
            <strong>Last close UTC:</strong> {feedDiagnostics.coverageLastCloseUtc}
          </div>
          <div>
            <strong>First open local:</strong> {feedDiagnostics.coverageFirstOpenLocal}
          </div>
          <div>
            <strong>Last close local:</strong> {feedDiagnostics.coverageLastCloseLocal}
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 14,
          padding: 12,
          borderRadius: 12,
          background: "#fff7ed",
          border: "1px solid #fdba74",
          color: "#9a3412",
          fontSize: 13,
          lineHeight: 1.6,
        }}
      >
        Se <strong>provider</strong>, <strong>session</strong>,{" "}
        <strong>timezone</strong>, <strong>delayed</strong> ou <strong>mock</strong>{" "}
        vierem como “-”, então o backend ainda não está a enviar essa informação.
        Se <strong>coverage count</strong> estiver baixo ou <strong>last close UTC</strong>{" "}
        ficar muito atrás do tempo atual, então o problema já não é só de feed:
        pode ser cobertura insuficiente da base local ou falha no sync incremental.
        Nesses cenários, o comportamento esperado é preservar o último snapshot
        válido do gráfico, em vez de o substituir por vazio.
      </div>
    </div>
  );
}

export default ChartDiagnosticsCard;