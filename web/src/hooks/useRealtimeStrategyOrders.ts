import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  REALTIME_AUTO_ORDER_ENABLED,
  REALTIME_AUTO_ORDER_MAX_LOG_ITEMS,
  REALTIME_AUTO_ORDER_MIN_SCORE,
  REALTIME_AUTO_ORDER_QUOTE_QTY,
} from "../constants/config";
import {
  confirmBinanceSpotOrderProposal,
  placeBinanceSpotOrder,
  type BinanceSpotOrderRequestPayload,
  type BinanceSpotOrderProposalConfirmationResponsePayload,
} from "../services/ordersApi";
import type { StrategyDirection, StrategyStatus } from "../types/strategy";
import type { CandleTickState } from "../types/trading";

type BinanceSide = "BUY" | "SELL";

export type RealtimeStrategyCardBridgeItem = {
  id: string;
  title: string;
  score: number;
  direction: StrategyDirection;
  status: StrategyStatus;
  entry: string | null;
  invalidation: string | null;
  targets: string[];
};

export type RealtimeOrderExecutionStatus =
  | "proposed"
  | "confirming"
  | "rejected"
  | "sending"
  | "created"
  | "failed";

export type RealtimeOrderLogItem = {
  id: string;
  scopeKey: string;
  requestedAt: string;
  symbol: string;
  timeframe: string;
  candleOpenTime: string;
  strategyId: string;
  strategyTitle: string;
  strategyScore: number;
  strategyStatus: StrategyStatus;
  side: BinanceSide;
  triggerPrice: number | null;
  quoteOrderQty: number;
  entryHint: string | null;
  targetHint: string | null;
  stopHint: string | null;
  proposalStrategyKey: string | null;
  confirmationStatus: "pending" | "confirmed" | "rejected" | "error" | null;
  confirmationReason: string | null;
  confirmationCheckedAt: string | null;
  confirmationScore: number | null;
  confirmationMetadata: Record<string, unknown> | null;
  status: RealtimeOrderExecutionStatus;
  message: string;
  statusCode: number | null;
  endpoint: string | null;
  exchangeOrderId: string | null;
  exchangeClientOrderId: string | null;
  exchangeSymbol: string | null;
  safetyBaseUrl: string | null;
  testMode: boolean;
};

type UseRealtimeStrategyOrdersParams = {
  enabled?: boolean;
  symbol: string;
  timeframe: string;
  strategyCards: RealtimeStrategyCardBridgeItem[];
  lastCandleTick: CandleTickState;
};

type UseRealtimeStrategyOrdersResult = {
  isEnabled: boolean;
  minScore: number;
  quoteOrderQty: number;
  blockedReason: string;
  orders: RealtimeOrderLogItem[];
  clearOrders: () => void;
};

function normalizeTimeframe(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeSymbol(value: string): string {
  return value.trim().toUpperCase();
}

function normalizeSymbolForBinance(value: string): string {
  return normalizeSymbol(value).replace(/[^A-Z0-9]/g, "");
}

function toBinanceSide(direction: StrategyDirection): BinanceSide | null {
  if (direction === "buy") return "BUY";
  if (direction === "sell") return "SELL";
  return null;
}

function nowIso(): string {
  return new Date().toISOString();
}

function makeRealtimeOrderId(): string {
  return `rt-order-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeClientOrderId(params: {
  strategyId: string;
  symbol: string;
  timeframe: string;
  candleOpenTime: string;
}): string {
  const compactStrategy =
    params.strategyId.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "stg";
  const compactSymbol =
    params.symbol.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "sym";
  const compactTimeframe =
    params.timeframe.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 4) || "tf";

  const candleStamp = new Date(params.candleOpenTime).getTime();
  const suffix = Number.isFinite(candleStamp)
    ? String(candleStamp).slice(-6)
    : String(Date.now()).slice(-6);

  return `rt-${compactStrategy}-${compactSymbol}-${compactTimeframe}-${suffix}`.slice(
    0,
    36,
  );
}

const STAGE_STRATEGY_KEY_BY_CARD_ID: Record<string, string> = {
  "strategy-pullback": "pullback",
  "strategy-moving-average-crossover": "ema_cross",
  "strategy-volatility-breakout": "volatility_breakout",
  "strategy-range-breakout": "range_breakout",
  "strategy-mean-reversion": "mean_reversion",
  "strategy-fade": "fade",
};

function resolveStageStrategyKey(cardId: string): string | null {
  const normalized = String(cardId ?? "").trim();
  if (!normalized) return null;

  return STAGE_STRATEGY_KEY_BY_CARD_ID[normalized] ?? null;
}

function toNumberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().replace(",", ".");
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function normalizeSource(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  return normalized || undefined;
}

function toBinanceSideFromMetadata(value: unknown): BinanceSide | null {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  if (normalized === "buy" || normalized === "long" || normalized === "compra") {
    return "BUY";
  }
  if (normalized === "sell" || normalized === "short" || normalized === "venda") {
    return "SELL";
  }
  return null;
}

function resolveSideFromConfirmation(
  payload: BinanceSpotOrderProposalConfirmationResponsePayload,
): BinanceSide | null {
  const metadata = asRecord(payload.metadata);
  if (!metadata) return null;

  return (
    toBinanceSideFromMetadata(metadata.direction) ??
    toBinanceSideFromMetadata(metadata.trade_bias) ??
    toBinanceSideFromMetadata(metadata.side)
  );
}

function resolveConfirmationScore(
  payload: BinanceSpotOrderProposalConfirmationResponsePayload,
): number | null {
  const metadata = asRecord(payload.metadata);
  if (!metadata) return null;

  return (
    toNumberOrNull(metadata.validation_confirmation_score) ??
    toNumberOrNull(metadata.confirmation_score) ??
    toNumberOrNull(metadata.score)
  );
}

function shouldBlockForConfigError(errorMessage: string): boolean {
  const normalized = errorMessage.trim().toLowerCase();

  if (!normalized) return false;
  if (normalized.includes("missing env vars")) return true;
  if (normalized.includes("api key")) return true;

  return false;
}

function selectTopCandidate(
  cards: RealtimeStrategyCardBridgeItem[],
): RealtimeStrategyCardBridgeItem | null {
  const eligible = cards
    .filter((item) => {
      if (!Number.isFinite(item.score)) return false;
      if (item.score < REALTIME_AUTO_ORDER_MIN_SCORE) return false;
      if (item.status === "invalid") return false;
      return item.direction === "buy" || item.direction === "sell";
    })
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return left.title.localeCompare(right.title, "pt-PT");
    });

  return eligible[0] ?? null;
}

function updateOrderById(
  previous: RealtimeOrderLogItem[],
  id: string,
  updater: (item: RealtimeOrderLogItem) => RealtimeOrderLogItem,
): RealtimeOrderLogItem[] {
  return previous.map((item) => {
    if (item.id !== id) return item;
    return updater(item);
  });
}

function makeScopeKey(symbol: string, timeframe: string): string {
  return `${normalizeSymbolForBinance(symbol)}::${normalizeTimeframe(timeframe)}`;
}

export default function useRealtimeStrategyOrders({
  enabled,
  symbol,
  timeframe,
  strategyCards,
  lastCandleTick,
}: UseRealtimeStrategyOrdersParams): UseRealtimeStrategyOrdersResult {
  const isEnabled = enabled ?? REALTIME_AUTO_ORDER_ENABLED;
  const normalizedScopeSymbol = normalizeSymbolForBinance(symbol);
  const normalizedScopeTimeframe = normalizeTimeframe(timeframe);
  const scopeKey = useMemo(
    () => makeScopeKey(normalizedScopeSymbol, normalizedScopeTimeframe),
    [normalizedScopeSymbol, normalizedScopeTimeframe],
  );

  const [orders, setOrders] = useState<RealtimeOrderLogItem[]>([]);
  const [blockedReason, setBlockedReason] = useState("");
  const attemptedKeysRef = useRef<Set<string>>(new Set());

  const topCandidate = useMemo(
    () => selectTopCandidate(strategyCards),
    [strategyCards],
  );

  const clearOrders = useCallback(() => {
    setOrders([]);
    attemptedKeysRef.current.clear();
  }, []);

  useEffect(() => {
    clearOrders();
    setBlockedReason("");
  }, [scopeKey, clearOrders]);

  useEffect(() => {
    if (!isEnabled) return;
    if (!normalizedScopeSymbol || !normalizedScopeTimeframe) return;
    if (!lastCandleTick) return;
    if (blockedReason) return;
    if (!topCandidate) return;

    const side = toBinanceSide(topCandidate.direction);
    if (!side) return;

    const tickSymbol = normalizeSymbolForBinance(lastCandleTick.symbol ?? "");
    const tickTimeframe = normalizeTimeframe(lastCandleTick.timeframe ?? "");

    if (
      tickSymbol !== normalizedScopeSymbol ||
      tickTimeframe !== normalizedScopeTimeframe
    ) {
      return;
    }

    const candleOpenTime = String(lastCandleTick.open_time ?? "").trim();
    if (!candleOpenTime) return;

    const executionKey = [
      normalizedScopeSymbol,
      normalizedScopeTimeframe,
      candleOpenTime,
      topCandidate.id,
      side,
    ].join("|");

    if (attemptedKeysRef.current.has(executionKey)) {
      return;
    }

    attemptedKeysRef.current.add(executionKey);

    const orderId = makeRealtimeOrderId();
    const quoteQty = REALTIME_AUTO_ORDER_QUOTE_QTY;
    const proposalStrategyKey = resolveStageStrategyKey(topCandidate.id);

    const requestPayload: BinanceSpotOrderRequestPayload = {
      symbol: normalizedScopeSymbol,
      side,
      type: "MARKET",
      quoteOrderQty: quoteQty,
      testMode: true,
      newClientOrderId: makeClientOrderId({
        strategyId: topCandidate.id,
        symbol: normalizedScopeSymbol,
        timeframe: normalizedScopeTimeframe,
        candleOpenTime,
      }),
    };

    const pendingItem: RealtimeOrderLogItem = {
      id: orderId,
      scopeKey,
      requestedAt: nowIso(),
      symbol: normalizedScopeSymbol,
      timeframe: normalizedScopeTimeframe,
      candleOpenTime,
      strategyId: topCandidate.id,
      strategyTitle: topCandidate.title,
      strategyScore: topCandidate.score,
      strategyStatus: topCandidate.status,
      side,
      triggerPrice: toNumberOrNull(lastCandleTick.close),
      quoteOrderQty: quoteQty,
      entryHint: topCandidate.entry,
      targetHint: topCandidate.targets[0] ?? null,
      stopHint: topCandidate.invalidation,
      proposalStrategyKey,
      confirmationStatus: "pending",
      confirmationReason: null,
      confirmationCheckedAt: null,
      confirmationScore: null,
      confirmationMetadata: null,
      status: "proposed",
      message: "Proposta criada. Aguardando confirmacao da estrategia...",
      statusCode: null,
      endpoint: null,
      exchangeOrderId: null,
      exchangeClientOrderId: null,
      exchangeSymbol: null,
      safetyBaseUrl: null,
      testMode: true,
    };

    setOrders((previous) => {
      const next = [pendingItem, ...previous];
      return next.slice(0, REALTIME_AUTO_ORDER_MAX_LOG_ITEMS);
    });

    const run = async () => {
      if (!proposalStrategyKey) {
        setOrders((previous) =>
          updateOrderById(previous, orderId, (current) => ({
            ...current,
            status: "failed",
            confirmationStatus: "error",
            confirmationReason: "strategy_mapping_not_found",
            confirmationCheckedAt: nowIso(),
            message:
              "Falha ao criar proposta: estrategia do card nao esta mapeada para validacao backend.",
          })),
        );
        return;
      }

      setOrders((previous) =>
        updateOrderById(previous, orderId, (current) => ({
          ...current,
          status: "confirming",
          message: `Proposta em confirmacao tecnica (${proposalStrategyKey})...`,
        })),
      );

      let confirmationResponse: BinanceSpotOrderProposalConfirmationResponsePayload;

      try {
        confirmationResponse = await confirmBinanceSpotOrderProposal({
          symbol: normalizedScopeSymbol,
          timeframe: normalizedScopeTimeframe,
          strategyKey: proposalStrategyKey,
          source:
            normalizeSource(lastCandleTick.source) ??
            normalizeSource(lastCandleTick.provider),
          candleOpenTime,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Falha desconhecida na confirmacao da proposta.";

        setOrders((previous) =>
          updateOrderById(previous, orderId, (current) => ({
            ...current,
            status: "failed",
            confirmationStatus: "error",
            confirmationReason: "confirmation_request_failed",
            confirmationCheckedAt: nowIso(),
            message: `Falha na confirmacao da proposta: ${errorMessage}`,
          })),
        );
        return;
      }

      const confirmationCheckedAt = nowIso();
      const confirmationScore = resolveConfirmationScore(confirmationResponse);
      const confirmationMetadata = asRecord(confirmationResponse.metadata) ?? {};
      const suggestedSide = resolveSideFromConfirmation(confirmationResponse);

      if (!confirmationResponse.confirmed) {
        setOrders((previous) =>
          updateOrderById(previous, orderId, (current) => ({
            ...current,
            status: "rejected",
            confirmationStatus: "rejected",
            confirmationReason: confirmationResponse.reason || "not_confirmed",
            confirmationCheckedAt,
            confirmationScore,
            confirmationMetadata,
            message:
              confirmationResponse.message ||
              "Proposta rejeitada pela validacao da estrategia.",
          })),
        );
        return;
      }

      if (suggestedSide && suggestedSide !== side) {
        setOrders((previous) =>
          updateOrderById(previous, orderId, (current) => ({
            ...current,
            status: "rejected",
            confirmationStatus: "rejected",
            confirmationReason: "direction_mismatch",
            confirmationCheckedAt,
            confirmationScore,
            confirmationMetadata,
            message:
              "Proposta rejeitada: direcao confirmada pela estrategia diverge do lado da ordem.",
          })),
        );
        return;
      }

      setOrders((previous) =>
        updateOrderById(previous, orderId, (current) => ({
          ...current,
          status: "sending",
          confirmationStatus: "confirmed",
          confirmationReason: confirmationResponse.reason || "confirmed",
          confirmationCheckedAt,
          confirmationScore,
          confirmationMetadata,
          message: "Proposta confirmada. A enviar ordem para Binance testnet...",
        })),
      );

      try {
        const response = await placeBinanceSpotOrder(requestPayload);

        const exchangePayload = asRecord(response.exchange_response);
        const exchangeOrderId = exchangePayload
          ? String(exchangePayload.orderId ?? "").trim() || null
          : null;
        const exchangeClientOrderId = exchangePayload
          ? String(exchangePayload.clientOrderId ?? "").trim() || null
          : null;
        const exchangeSymbol = exchangePayload
          ? String(exchangePayload.symbol ?? "").trim() || null
          : null;

        setOrders((previous) =>
          updateOrderById(previous, orderId, (current) => ({
            ...current,
            status: "created",
            message: "Ordem enviada com sucesso para Binance testnet.",
            statusCode: response.status_code ?? null,
            endpoint: response.endpoint ?? null,
            exchangeOrderId,
            exchangeClientOrderId,
            exchangeSymbol,
            safetyBaseUrl: response.safety?.base_url ?? null,
            testMode: Boolean(response.test_mode),
          })),
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Falha desconhecida na criacao da ordem.";

        if (shouldBlockForConfigError(errorMessage)) {
          setBlockedReason(
            "Execucao automatica pausada: credenciais/chaves de trading nao estao configuradas corretamente no backend.",
          );
        }

        setOrders((previous) =>
          updateOrderById(previous, orderId, (current) => ({
            ...current,
            status: "failed",
            message: errorMessage,
          })),
        );
      }
    };

    void run();
  }, [
    blockedReason,
    isEnabled,
    lastCandleTick,
    normalizedScopeSymbol,
    normalizedScopeTimeframe,
    scopeKey,
    topCandidate,
  ]);

  return {
    isEnabled,
    minScore: REALTIME_AUTO_ORDER_MIN_SCORE,
    quoteOrderQty: REALTIME_AUTO_ORDER_QUOTE_QTY,
    blockedReason,
    orders,
    clearOrders,
  };
}
