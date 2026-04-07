// web/src/components/api/ApiStatusCard.tsx

import type { CandleItem, HealthResponse } from "../../types/trading";
import type { ProviderUpdateStatus } from "../../hooks/useRealtimeFeed";

type ApiStatusCardProps = {
  sidebarCardStyle: React.CSSProperties;
  loadingHealth: boolean;
  healthError: string;
  health: HealthResponse | null;
  wsStatus: string;
  lastWsEvent: string;
  providerErrorMessage: string;
  hasLoadedInitialCandles: boolean;
  candles: CandleItem[];
  lastProviderUpdateLog: string;
  lastProviderUpdateAt: string;
  lastProviderReceivedAt: string;
  lastProviderUpdateEvent: string;
  lastProviderUpdateStatus: ProviderUpdateStatus;
};

function getStatusColor(kind: "ok" | "warn" | "error" | "neutral"): string {
  if (kind === "ok") return "#16a34a";
  if (kind === "warn") return "#d97706";
  if (kind === "error") return "#dc2626";
  return "#64748b";
}

function getApiStatusInfo(
  loadingHealth: boolean,
  healthError: string,
  health: HealthResponse | null
) {
  if (loadingHealth) {
    return {
      label: "A verificar...",
      detail: "A carregar healthcheck",
      kind: "neutral" as const,
    };
  }

  if (healthError) {
    return {
      label: "Offline",
      detail: healthError,
      kind: "error" as const,
    };
  }

  if (health) {
    return {
      label: "Online",
      detail: `${health.app_name} / ${health.environment}`,
      kind: "ok" as const,
    };
  }

  return {
    label: "Sem resposta",
    detail: "-",
    kind: "neutral" as const,
  };
}

function getWebSocketStatusInfo(wsStatus: string, lastWsEvent: string) {
  const normalizedStatus = String(wsStatus ?? "").trim().toLowerCase();

  if (normalizedStatus === "subscribed") {
    return {
      label: "Subscrito",
      detail: "Ligação ativa e subscrição confirmada",
      kind: "ok" as const,
    };
  }

  if (normalizedStatus === "connected") {
    return {
      label: "Ligado",
      detail: "Socket aberto, à espera da subscrição",
      kind: "ok" as const,
    };
  }

  if (normalizedStatus === "connecting") {
    return {
      label: "A ligar...",
      detail: "A abrir websocket",
      kind: "warn" as const,
    };
  }

  if (normalizedStatus === "error") {
    return {
      label: "Erro",
      detail: "Falha na ligação websocket",
      kind: "error" as const,
    };
  }

  if (normalizedStatus === "closed") {
    return {
      label: "Fechado",
      detail: `Último evento: ${lastWsEvent || "-"}`,
      kind: "warn" as const,
    };
  }

  return {
    label: "Desligado",
    detail: "-",
    kind: "neutral" as const,
  };
}

function getProviderStatusInfo(
  providerErrorMessage: string,
  hasLoadedInitialCandles: boolean,
  lastWsEvent: string,
  candles: CandleItem[]
) {
  const error = String(providerErrorMessage ?? "").trim();
  const normalizedError = error.toLowerCase();
  const normalizedEvent = String(lastWsEvent ?? "").trim().toLowerCase();

  if (
    normalizedError.includes("token") ||
    normalizedError.includes("auth") ||
    normalizedError.includes("unauthorized") ||
    normalizedError.includes("credential") ||
    normalizedError.includes("api key") ||
    normalizedError.includes("forbidden") ||
    normalizedError.includes("permission")
  ) {
    return {
      label: "Sem token / auth",
      detail: error,
      kind: "error" as const,
    };
  }

  if (error) {
    return {
      label: "Erro no provider",
      detail: error,
      kind: "error" as const,
    };
  }

  if (
    candles.length > 0 ||
    hasLoadedInitialCandles ||
    normalizedEvent === "initial_candles" ||
    normalizedEvent === "candle_tick"
  ) {
    return {
      label: "A comunicar",
      detail:
        candles.length > 0
          ? "Candles carregados com sucesso"
          : "Candles recebidos com sucesso",
      kind: "ok" as const,
    };
  }

  if (normalizedEvent === "subscribed" || normalizedEvent === "connected") {
    return {
      label: "À espera de dados",
      detail: "Ligação aberta, sem candles ainda",
      kind: "warn" as const,
    };
  }

  return {
    label: "Sem confirmação",
    detail: "Ainda sem resposta do provider",
    kind: "neutral" as const,
  };
}

function getProviderUpdateInfo(
  status: ProviderUpdateStatus,
  log: string,
  candleAt: string,
  receivedAt: string,
  eventName: string
) {
  if (status === "error") {
    return {
      label: "Falhou",
      detail: log,
      kind: "error" as const,
      candleAt: candleAt || "-",
      receivedAt: receivedAt || "-",
      eventName: eventName || "-",
    };
  }

  if (status === "success") {
    return {
      label: "Atualizado",
      detail: log,
      kind: "ok" as const,
      candleAt: candleAt || "-",
      receivedAt: receivedAt || "-",
      eventName: eventName || "-",
    };
  }

  if (status === "waiting") {
    return {
      label: "À espera",
      detail: log,
      kind: "warn" as const,
      candleAt: candleAt || "-",
      receivedAt: receivedAt || "-",
      eventName: eventName || "-",
    };
  }

  return {
    label: "Sem dados",
    detail: log || "Ainda sem atualização do provider.",
    kind: "neutral" as const,
    candleAt: candleAt || "-",
    receivedAt: receivedAt || "-",
    eventName: eventName || "-",
  };
}

function statusRow(
  title: string,
  label: string,
  detail: string,
  kind: "ok" | "warn" | "error" | "neutral"
) {
  const color = getStatusColor(kind);

  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        padding: 12,
        background: "#f8fafc",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
          marginBottom: 6,
        }}
      >
        <strong style={{ color: "#0f172a" }}>{title}</strong>
        <span
          style={{
            color,
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          {label}
        </span>
      </div>

      <div
        style={{
          fontSize: 13,
          color: "#475569",
          lineHeight: 1.5,
          wordBreak: "break-word",
        }}
      >
        {detail || "-"}
      </div>
    </div>
  );
}

function infoRow(label: string, value: string) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        padding: "6px 0",
        borderBottom: "1px solid rgba(148, 163, 184, 0.18)",
        fontSize: 13,
      }}
    >
      <span style={{ color: "#64748b" }}>{label}</span>
      <strong style={{ color: "#0f172a", textAlign: "right" }}>{value}</strong>
    </div>
  );
}

function ApiStatusCard({
  sidebarCardStyle,
  loadingHealth,
  healthError,
  health,
  wsStatus,
  lastWsEvent,
  providerErrorMessage,
  hasLoadedInitialCandles,
  candles,
  lastProviderUpdateLog,
  lastProviderUpdateAt,
  lastProviderReceivedAt,
  lastProviderUpdateEvent,
  lastProviderUpdateStatus,
}: ApiStatusCardProps) {
  const apiInfo = getApiStatusInfo(loadingHealth, healthError, health);
  const wsInfo = getWebSocketStatusInfo(wsStatus, lastWsEvent);
  const providerInfo = getProviderStatusInfo(
    providerErrorMessage,
    hasLoadedInitialCandles,
    lastWsEvent,
    candles
  );

  const providerUpdateInfo = getProviderUpdateInfo(
    lastProviderUpdateStatus,
    lastProviderUpdateLog,
    lastProviderUpdateAt,
    lastProviderReceivedAt,
    lastProviderUpdateEvent
  );

  const firstCandle = candles[0]?.open_time ?? "-";
  const lastCandle = candles[candles.length - 1]?.open_time ?? "-";

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
        Estado da ligação
      </h2>

      <div style={{ display: "grid", gap: 10 }}>
        {statusRow("API", apiInfo.label, apiInfo.detail, apiInfo.kind)}
        {statusRow("WebSocket", wsInfo.label, wsInfo.detail, wsInfo.kind)}
        {statusRow(
          "Provider",
          providerInfo.label,
          providerInfo.detail,
          providerInfo.kind
        )}
        {statusRow(
          "Última atualização do provider",
          providerUpdateInfo.label,
          providerUpdateInfo.detail,
          providerUpdateInfo.kind
        )}
      </div>

      <div
        style={{
          marginTop: 12,
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          padding: 12,
          background: "#ffffff",
        }}
      >
        <div
          style={{
            marginBottom: 8,
            fontSize: 13,
            fontWeight: 700,
            color: "#0f172a",
          }}
        >
          Dados carregados
        </div>

        <div style={{ display: "grid", gap: 2 }}>
          {infoRow("Total candles", `${candles.length}`)}
          {infoRow("Primeiro candle", firstCandle)}
          {infoRow("Último candle", lastCandle)}
          {infoRow("Último evento provider", providerUpdateInfo.eventName)}
          {infoRow("Último candle provider", providerUpdateInfo.candleAt)}
          {infoRow("Recebido em", providerUpdateInfo.receivedAt)}
        </div>
      </div>

      {health && (
        <div
          style={{
            marginTop: 12,
            fontSize: 12,
            color: "#64748b",
            lineHeight: 1.5,
          }}
        >
          <div>
            <strong>App:</strong> {health.app_name}
          </div>
          <div>
            <strong>Environment:</strong> {health.environment}
          </div>
          <div>
            <strong>Health:</strong> {health.status}
          </div>
        </div>
      )}
    </div>
  );
}

export default ApiStatusCard;