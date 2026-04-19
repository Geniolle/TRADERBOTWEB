import { useMemo, useState } from "react";

import type { RealtimeOrderLogItem } from "../../hooks/useRealtimeStrategyOrders";
import type { BinanceSpotOrderHistoryItem } from "../../services/ordersApi";
import { formatDateTime } from "../../utils/format";

type RealtimeOrdersCardProps = {
  mainCardStyle: React.CSSProperties;
  orders: RealtimeOrderLogItem[];
  autoOrderEnabled: boolean;
  minScore: number;
  quoteOrderQty: number;
  blockedReason: string;
  selectedSymbol: string;
  selectedTimeframe: string;
  historyLoading: boolean;
  historyError: string;
  historyItems: BinanceSpotOrderHistoryItem[];
  historyLastUpdatedAt: string | null;
  onReloadHistory: () => void;
  onClearOrders: () => void;
};

function formatPrice(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "-";
  return value.toFixed(6);
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "-";
  return `${value.toFixed(2)}%`;
}

function formatQuantity(value: unknown): string {
  if (value === null || value === undefined) return "-";
  const text = String(value).trim();
  return text || "-";
}

function formatEpochMillis(value: unknown): string {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return "-";
  return formatDateTime(new Date(numericValue).toISOString());
}

function formatConfirmationStatus(
  value: RealtimeOrderLogItem["confirmationStatus"],
): string {
  if (value === "pending") return "Pendente";
  if (value === "confirmed") return "Confirmada";
  if (value === "rejected") return "Rejeitada";
  if (value === "error") return "Erro";
  return "-";
}

function statusStyle(status: RealtimeOrderLogItem["status"]) {
  if (status === "proposed") {
    return {
      label: "Proposta",
      color: "#075985",
      background: "#f0f9ff",
      border: "#7dd3fc",
    };
  }

  if (status === "confirming") {
    return {
      label: "Confirmando",
      color: "#1d4ed8",
      background: "#eff6ff",
      border: "#93c5fd",
    };
  }

  if (status === "rejected") {
    return {
      label: "Rejeitada",
      color: "#7f1d1d",
      background: "#fef2f2",
      border: "#fca5a5",
    };
  }

  if (status === "created") {
    return {
      label: "Criada",
      color: "#166534",
      background: "#f0fdf4",
      border: "#bbf7d0",
    };
  }

  if (status === "failed") {
    return {
      label: "Falha",
      color: "#991b1b",
      background: "#fef2f2",
      border: "#fecaca",
    };
  }

  return {
    label: "A enviar",
    color: "#92400e",
    background: "#fffbeb",
    border: "#fde68a",
  };
}

function metricCard(label: string, value: string | number, accent: string) {
  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        padding: 12,
        background: "#f8fafc",
        borderTop: `4px solid ${accent}`,
      }}
    >
      <div
        style={{
          fontSize: 12,
          color: "#64748b",
          marginBottom: 6,
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 21,
          fontWeight: 700,
          color: "#0f172a",
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
    </div>
  );
}

export default function RealtimeOrdersCard({
  mainCardStyle,
  orders,
  autoOrderEnabled,
  minScore,
  quoteOrderQty,
  blockedReason,
  selectedSymbol,
  selectedTimeframe,
  historyLoading,
  historyError,
  historyItems,
  historyLastUpdatedAt,
  onReloadHistory,
  onClearOrders,
}: RealtimeOrdersCardProps) {
  const [expanded, setExpanded] = useState(true);

  const stats = useMemo(() => {
    let created = 0;
    let rejected = 0;
    let failed = 0;
    let pending = 0;

    for (const item of orders) {
      if (item.status === "created") created += 1;
      if (item.status === "rejected") rejected += 1;
      if (item.status === "failed") failed += 1;
      if (
        item.status === "proposed" ||
        item.status === "confirming" ||
        item.status === "sending"
      ) {
        pending += 1;
      }
    }

    return {
      total: orders.length,
      created,
      rejected,
      failed,
      pending,
    };
  }, [orders]);

  const hasSelection = Boolean(selectedSymbol && selectedTimeframe);

  return (
    <div
      style={{
        ...mainCardStyle,
        padding: 0,
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((previous) => !previous)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "14px 16px",
          background: "#f8fafc",
          border: "none",
          borderBottom: expanded ? "1px solid #e2e8f0" : "none",
          cursor: "pointer",
          textAlign: "left",
        }}
        aria-expanded={expanded}
        aria-label={expanded ? "Ocultar ordens realtime" : "Expandir ordens realtime"}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <strong style={{ fontSize: 18, color: "#0f172a", lineHeight: 1.2 }}>
            Ordens em tempo real (Binance test mode)
          </strong>
          <span style={{ fontSize: 12, color: "#64748b", lineHeight: 1.4 }}>
            Cria proposta, valida no backend pela estrategia e so depois envia a ordem.
          </span>
        </div>

        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: 34,
            width: 34,
            height: 34,
            borderRadius: 999,
            border: "1px solid #cbd5e1",
            background: "#ffffff",
            color: "#0f172a",
            fontSize: 16,
            fontWeight: 700,
            lineHeight: 1,
            flexShrink: 0,
          }}
        >
          {expanded ? "-" : "+"}
        </span>
      </button>

      {expanded ? (
        <div style={{ padding: 16, display: "grid", gap: 12 }}>
          <div
            style={{
              border: "1px solid #cbd5e1",
              borderRadius: 10,
              padding: "10px 12px",
              background: autoOrderEnabled ? "#eff6ff" : "#f8fafc",
              color: autoOrderEnabled ? "#1e3a8a" : "#475569",
              fontSize: 13,
              lineHeight: 1.55,
              display: "grid",
              gap: 4,
            }}
          >
            <span>
              <strong>Status:</strong> {autoOrderEnabled ? "Ativo" : "Desligado"}
            </span>
            <span>
              <strong>Regra:</strong> score {"\u003e="} {formatPercent(minScore)}
            </span>
            <span>
              <strong>Quote qty:</strong> {quoteOrderQty}
            </span>
            <span>
              <strong>Contexto atual:</strong> simbolo={selectedSymbol || "-"} | timeframe=
              {selectedTimeframe || "-"}
            </span>
          </div>

          {blockedReason ? (
            <div
              style={{
                border: "1px solid #fecaca",
                borderRadius: 10,
                padding: "10px 12px",
                background: "#fef2f2",
                color: "#991b1b",
                fontSize: 13,
                lineHeight: 1.55,
              }}
            >
              <strong>Pausado:</strong> {blockedReason}
            </div>
          ) : null}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 10,
            }}
          >
            {metricCard("Total tentativas", stats.total, "#94a3b8")}
            {metricCard("Criadas", stats.created, "#16a34a")}
            {metricCard("Rejeitadas", stats.rejected, "#b91c1c")}
            {metricCard("Falhas", stats.failed, "#dc2626")}
            {metricCard("Pendentes", stats.pending, "#d97706")}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={onClearOrders}
              style={{
                height: 34,
                padding: "0 12px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                color: "#0f172a",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Limpar historico
            </button>
          </div>

          {!hasSelection ? (
            <p style={{ margin: 0, color: "#64748b", fontSize: 14 }}>
              Selecione simbolo e timeframe para ativar o monitoramento de ordens.
            </p>
          ) : orders.length === 0 ? (
            <p style={{ margin: 0, color: "#64748b", fontSize: 14 }}>
              Nenhuma tentativa de ordem ainda para a selecao atual.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {orders.map((item) => {
                const tone = statusStyle(item.status);

                return (
                  <div
                    key={item.id}
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: 12,
                      background: "#ffffff",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        padding: "10px 12px",
                        borderBottom: "1px solid #e2e8f0",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 10,
                        flexWrap: "wrap",
                        background: "#f8fafc",
                      }}
                    >
                      <div style={{ display: "grid", gap: 2 }}>
                        <strong style={{ color: "#0f172a", fontSize: 14 }}>
                          {item.strategyTitle}
                        </strong>
                        <span style={{ fontSize: 12, color: "#64748b" }}>
                          score={formatPercent(item.strategyScore)} | lado={item.side} |
                          candle={formatDateTime(item.candleOpenTime)}
                        </span>
                      </div>

                      <span
                        style={{
                          padding: "4px 10px",
                          borderRadius: 999,
                          fontSize: 12,
                          fontWeight: 700,
                          color: tone.color,
                          background: tone.background,
                          border: `1px solid ${tone.border}`,
                        }}
                      >
                        {tone.label}
                      </span>
                    </div>

                    <div
                      style={{
                        padding: 12,
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
                        gap: 8,
                        fontSize: 13,
                        color: "#334155",
                      }}
                    >
                      <div>
                        <strong>Solicitada em:</strong> {formatDateTime(item.requestedAt)}
                      </div>
                      <div>
                        <strong>Simbolo:</strong> {item.symbol}
                      </div>
                      <div>
                        <strong>Timeframe:</strong> {item.timeframe}
                      </div>
                      <div>
                        <strong>Preco no trigger:</strong> {formatPrice(item.triggerPrice)}
                      </div>
                      <div>
                        <strong>Quote qty:</strong> {item.quoteOrderQty}
                      </div>
                      <div>
                        <strong>Entrada (hint):</strong> {item.entryHint || "-"}
                      </div>
                      <div>
                        <strong>Target (hint):</strong> {item.targetHint || "-"}
                      </div>
                      <div>
                        <strong>Stop (hint):</strong> {item.stopHint || "-"}
                      </div>
                      <div>
                        <strong>Estrategia de proposta:</strong>{" "}
                        {item.proposalStrategyKey || "-"}
                      </div>
                      <div>
                        <strong>Status confirmacao:</strong>{" "}
                        {formatConfirmationStatus(item.confirmationStatus)}
                      </div>
                      <div>
                        <strong>Motivo confirmacao:</strong>{" "}
                        {item.confirmationReason || "-"}
                      </div>
                      <div>
                        <strong>Score confirmacao:</strong>{" "}
                        {item.confirmationScore == null
                          ? "-"
                          : formatPercent(item.confirmationScore)}
                      </div>
                      <div>
                        <strong>Confirmada em:</strong>{" "}
                        {formatDateTime(item.confirmationCheckedAt)}
                      </div>
                      <div>
                        <strong>Status code:</strong>{" "}
                        {item.statusCode === null ? "-" : item.statusCode}
                      </div>
                      <div>
                        <strong>Endpoint:</strong> {item.endpoint || "-"}
                      </div>
                      <div>
                        <strong>Order ID (exchange):</strong> {item.exchangeOrderId || "-"}
                      </div>
                      <div>
                        <strong>Client Order ID:</strong>{" "}
                        {item.exchangeClientOrderId || "-"}
                      </div>
                      <div>
                        <strong>Base URL:</strong> {item.safetyBaseUrl || "-"}
                      </div>
                      <div>
                        <strong>Mensagem:</strong> {item.message}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div
            style={{
              marginTop: 8,
              borderTop: "1px solid #e2e8f0",
              paddingTop: 12,
              display: "grid",
              gap: 10,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <strong style={{ fontSize: 15, color: "#0f172a" }}>
                Historico Binance Testnet (allOrders)
              </strong>

              <button
                type="button"
                onClick={onReloadHistory}
                style={{
                  height: 32,
                  padding: "0 12px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  color: "#0f172a",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Atualizar
              </button>
            </div>

            <div style={{ fontSize: 12, color: "#64748b" }}>
              Ultima atualizacao: {formatDateTime(historyLastUpdatedAt)}
            </div>

            {historyError ? (
              <div
                style={{
                  border: "1px solid #fecaca",
                  borderRadius: 10,
                  padding: "10px 12px",
                  background: "#fef2f2",
                  color: "#991b1b",
                  fontSize: 13,
                  lineHeight: 1.55,
                }}
              >
                Falha ao carregar historico: {historyError}
              </div>
            ) : null}

            {historyLoading ? (
              <p style={{ margin: 0, color: "#475569", fontSize: 14 }}>
                A carregar historico da Binance testnet...
              </p>
            ) : historyItems.length === 0 ? (
              <p style={{ margin: 0, color: "#64748b", fontSize: 14 }}>
                Nenhuma ordem encontrada na Binance testnet para este simbolo.
              </p>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {historyItems.map((item, index) => (
                  <div
                    key={`${String(item.orderId ?? "order")}-${index}`}
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: 12,
                      background: "#ffffff",
                      padding: 12,
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                      gap: 8,
                      fontSize: 13,
                      color: "#334155",
                    }}
                  >
                    <div>
                      <strong>Order ID:</strong> {String(item.orderId ?? "-")}
                    </div>
                    <div>
                      <strong>Client Order ID:</strong>{" "}
                      {String(item.clientOrderId ?? "-")}
                    </div>
                    <div>
                      <strong>Status:</strong> {String(item.status ?? "-")}
                    </div>
                    <div>
                      <strong>Lado:</strong> {String(item.side ?? "-")}
                    </div>
                    <div>
                      <strong>Tipo:</strong> {String(item.type ?? "-")}
                    </div>
                    <div>
                      <strong>Preco:</strong> {formatQuantity(item.price)}
                    </div>
                    <div>
                      <strong>Orig Qty:</strong> {formatQuantity(item.origQty)}
                    </div>
                    <div>
                      <strong>Exec Qty:</strong> {formatQuantity(item.executedQty)}
                    </div>
                    <div>
                      <strong>Quote Executada:</strong>{" "}
                      {formatQuantity(item.cummulativeQuoteQty)}
                    </div>
                    <div>
                      <strong>Criada em:</strong> {formatEpochMillis(item.time)}
                    </div>
                    <div>
                      <strong>Atualizada em:</strong> {formatEpochMillis(item.updateTime)}
                    </div>
                    <div>
                      <strong>Transacao:</strong> {formatEpochMillis(item.transactTime)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
