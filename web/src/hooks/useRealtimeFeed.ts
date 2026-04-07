// web/src/hooks/useRealtimeFeed.ts

import { useEffect, useMemo, useRef, useState } from "react";

import { API_WS_BASE_URL } from "../constants/config";
import type { CandleItem, CandleTickState, WsEnvelope } from "../types/trading";
import { upsertRealtimeCandle } from "../utils/candles";
import { floorToTimeframeIso } from "../utils/format";

type UseRealtimeFeedParams = {
  effectiveChartMarketType: string;
  effectiveChartCatalog: string;
  effectiveChartSymbol: string;
  effectiveChartTimeframe: string;
  setCandles: React.Dispatch<React.SetStateAction<CandleItem[]>>;
  reloadCandles: (showLoader?: boolean) => Promise<void>;
};

export type ProviderUpdateStatus = "idle" | "waiting" | "success" | "error";

type UseRealtimeFeedResult = {
  wsStatus: string;
  lastWsEvent: string;
  heartbeatCount: number | null;
  heartbeatMessage: string;
  candlesRefreshCount: number | null;
  candlesRefreshReason: string;
  lastCandleTick: CandleTickState;
  providerErrorMessage: string;
  hasLoadedInitialCandles: boolean;
  lastProviderUpdateLog: string;
  lastProviderUpdateAt: string;
  lastProviderReceivedAt: string;
  lastProviderUpdateEvent: string;
  lastProviderUpdateStatus: ProviderUpdateStatus;
};

type RealtimeFeedState = {
  scopeKey: string;
  wsStatus: string;
  lastWsEvent: string;
  heartbeatCount: number | null;
  heartbeatMessage: string;
  candlesRefreshCount: number | null;
  candlesRefreshReason: string;
  lastCandleTick: CandleTickState;
  providerErrorMessage: string;
  hasLoadedInitialCandles: boolean;
  lastProviderUpdateLog: string;
  lastProviderUpdateAt: string;
  lastProviderReceivedAt: string;
  lastProviderUpdateEvent: string;
  lastProviderUpdateStatus: ProviderUpdateStatus;
};

const DEFAULT_RESULT: Omit<RealtimeFeedState, "scopeKey"> = {
  wsStatus: "disconnected",
  lastWsEvent: "-",
  heartbeatCount: null,
  heartbeatMessage: "-",
  candlesRefreshCount: null,
  candlesRefreshReason: "-",
  lastCandleTick: null,
  providerErrorMessage: "",
  hasLoadedInitialCandles: false,
  lastProviderUpdateLog: "Ainda sem atualização do provider.",
  lastProviderUpdateAt: "-",
  lastProviderReceivedAt: "-",
  lastProviderUpdateEvent: "-",
  lastProviderUpdateStatus: "idle",
};

function normalizeSymbol(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().toUpperCase();
}

function normalizeTimeframe(value: unknown): string {
  if (typeof value !== "string") return "";

  const normalized = value.trim().toLowerCase();

  const aliases: Record<string, string> = {
    "1min": "1m",
    "3min": "3m",
    "5min": "5m",
    "15min": "15m",
    "30min": "30m",
    "60min": "1h",
    "1hr": "1h",
    "4hr": "4h",
    "1day": "1d",
  };

  return aliases[normalized] ?? normalized;
}

function safeNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function safeString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function toDataRecord(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== "object") {
    return {};
  }

  return data as Record<string, unknown>;
}

function isValidCandleItem(item: unknown): item is CandleItem {
  if (!item || typeof item !== "object") return false;

  const candidate = item as Partial<CandleItem>;

  return (
    typeof candidate.symbol === "string" &&
    typeof candidate.timeframe === "string" &&
    typeof candidate.open_time === "string"
  );
}

function formatNowPt(): string {
  return new Date().toLocaleString("pt-PT");
}

function buildProviderUpdateLog(params: {
  eventName: string;
  symbol: string;
  timeframe: string;
  candleTime?: string;
  receivedAt: string;
  count?: number | null;
  extra?: string;
}) {
  const parts = [
    `Evento=${params.eventName}`,
    `Símbolo=${params.symbol || "-"}`,
    `Timeframe=${params.timeframe || "-"}`,
  ];

  if (params.candleTime) {
    parts.push(`Candle=${params.candleTime}`);
  }

  parts.push(`Recebido=${params.receivedAt}`);

  if (typeof params.count === "number" && Number.isFinite(params.count)) {
    parts.push(`Count=${params.count}`);
  }

  if (params.extra) {
    parts.push(params.extra);
  }

  return parts.join(" | ");
}

function mergeCandlesByOpenTime(
  previous: CandleItem[],
  incoming: CandleItem[]
): CandleItem[] {
  if (incoming.length === 0) {
    return previous;
  }

  const map = new Map<string, CandleItem>();

  for (const item of previous) {
    map.set(item.open_time, item);
  }

  for (const item of incoming) {
    map.set(item.open_time, item);
  }

  return Array.from(map.values()).sort((a, b) => {
    return new Date(a.open_time).getTime() - new Date(b.open_time).getTime();
  });
}

function useRealtimeFeed({
  effectiveChartMarketType,
  effectiveChartCatalog,
  effectiveChartSymbol,
  effectiveChartTimeframe,
  setCandles,
  reloadCandles,
}: UseRealtimeFeedParams): UseRealtimeFeedResult {
  const scopeKey = useMemo(() => {
    return [
      effectiveChartMarketType || "",
      effectiveChartCatalog || "",
      effectiveChartSymbol || "",
      effectiveChartTimeframe || "",
    ].join("::");
  }, [
    effectiveChartMarketType,
    effectiveChartCatalog,
    effectiveChartSymbol,
    effectiveChartTimeframe,
  ]);

  const hasSelection = useMemo(() => {
    return Boolean(effectiveChartSymbol && effectiveChartTimeframe);
  }, [effectiveChartSymbol, effectiveChartTimeframe]);

  const [state, setState] = useState<RealtimeFeedState>({
    scopeKey: "",
    ...DEFAULT_RESULT,
  });

  const socketRef = useRef<WebSocket | null>(null);
  const isIntentionalCloseRef = useRef(false);

  useEffect(() => {
    if (!hasSelection) {
      const activeSocket = socketRef.current;
      socketRef.current = null;
      isIntentionalCloseRef.current = true;

      if (
        activeSocket &&
        (activeSocket.readyState === WebSocket.OPEN ||
          activeSocket.readyState === WebSocket.CONNECTING)
      ) {
        try {
          activeSocket.close();
        } catch {
          // ignora
        }
      }

      return;
    }

    let isMounted = true;

    const currentScopeKey = scopeKey;
    const currentSymbol = normalizeSymbol(effectiveChartSymbol);
    const currentTimeframe = normalizeTimeframe(effectiveChartTimeframe);

    isIntentionalCloseRef.current = false;

    const socket = new WebSocket(API_WS_BASE_URL);
    socketRef.current = socket;

    socket.onopen = () => {
      if (!isMounted) return;

      setState({
        scopeKey: currentScopeKey,
        ...DEFAULT_RESULT,
        wsStatus: "connected",
        lastWsEvent: "connected",
        lastProviderUpdateLog: `Ligação aberta em ${formatNowPt()}. A aguardar candles do provider.`,
        lastProviderUpdateStatus: "waiting",
      });

      try {
        socket.send("frontend_connected");

        socket.send(
          JSON.stringify({
            action: "subscribe",
            market_type: effectiveChartMarketType || undefined,
            catalog: effectiveChartCatalog || undefined,
            symbol: effectiveChartSymbol,
            timeframe: effectiveChartTimeframe,
          })
        );
      } catch (error) {
        if (!isIntentionalCloseRef.current) {
          console.error("[WS] failed to send subscription message:", error);
        }
      }
    };

    socket.onmessage = async (event) => {
      if (!isMounted) return;

      try {
        const parsed: WsEnvelope = JSON.parse(event.data);
        const nextEvent =
          typeof parsed.event === "string" ? parsed.event : "unknown";
        const data = toDataRecord(parsed.data);

        if (
          nextEvent === "connected" ||
          nextEvent === "echo" ||
          nextEvent === "subscribed"
        ) {
          setState((prev) => ({
            ...prev,
            scopeKey: currentScopeKey,
            wsStatus: nextEvent === "subscribed" ? "subscribed" : prev.wsStatus,
            lastWsEvent: nextEvent,
            lastProviderUpdateStatus:
              nextEvent === "subscribed"
                ? "waiting"
                : prev.lastProviderUpdateStatus,
            lastProviderUpdateLog:
              nextEvent === "subscribed"
                ? `Subscrição confirmada em ${formatNowPt()}. A aguardar dados do provider para ${currentSymbol} em ${currentTimeframe}.`
                : prev.lastProviderUpdateLog,
          }));
          return;
        }

        if (nextEvent === "heartbeat") {
          const countValue = data.count;
          const messageValue = data.message;

          setState((prev) => ({
            ...prev,
            scopeKey: currentScopeKey,
            lastWsEvent: "heartbeat",
            heartbeatCount:
              typeof countValue === "number"
                ? countValue
                : Number(countValue ?? 0),
            heartbeatMessage:
              typeof messageValue === "string" ? messageValue : "-",
          }));
          return;
        }

        const parsedSymbol = normalizeSymbol(data.symbol);
        const parsedTimeframe = normalizeTimeframe(data.timeframe);

        const hasSubscriptionIdentity =
          Boolean(parsedSymbol) && Boolean(parsedTimeframe);

        const isCurrentSubscription = hasSubscriptionIdentity
          ? parsedSymbol === currentSymbol && parsedTimeframe === currentTimeframe
          : true;

        if (nextEvent === "candles_refresh") {
          if (!isCurrentSubscription) return;

          const countValue = data.count;
          const reasonValue = data.reason;
          const receivedAt = formatNowPt();

          setState((prev) => ({
            ...prev,
            scopeKey: currentScopeKey,
            lastWsEvent: "candles_refresh",
            candlesRefreshCount:
              typeof countValue === "number"
                ? countValue
                : Number(countValue ?? 0),
            candlesRefreshReason:
              typeof reasonValue === "string" ? reasonValue : "-",
            lastProviderReceivedAt: receivedAt,
            lastProviderUpdateEvent: "candles_refresh",
            lastProviderUpdateStatus: "success",
            lastProviderUpdateLog: buildProviderUpdateLog({
              eventName: "candles_refresh",
              symbol: parsedSymbol || currentSymbol,
              timeframe: parsedTimeframe || currentTimeframe,
              candleTime:
                prev.lastProviderUpdateAt && prev.lastProviderUpdateAt !== "-"
                  ? prev.lastProviderUpdateAt
                  : undefined,
              receivedAt,
              count:
                typeof countValue === "number"
                  ? countValue
                  : Number(countValue ?? 0),
              extra:
                typeof reasonValue === "string" && reasonValue
                  ? `Motivo=${reasonValue}`
                  : undefined,
            }),
          }));

          if (
            typeof reasonValue === "string" &&
            reasonValue.toLowerCase().includes("reload")
          ) {
            try {
              await reloadCandles(false);
            } catch (error) {
              console.error("[WS] reloadCandles failed:", error);
            }
          }

          return;
        }

        if (nextEvent === "provider_error") {
          if (!isCurrentSubscription) return;

          const errorMessage =
            safeString(data.message) ||
            safeString(data.error) ||
            "Erro ao obter candles do provider.";

          const receivedAt = formatNowPt();

          setState((prev) => ({
            ...prev,
            scopeKey: currentScopeKey,
            lastWsEvent: "provider_error",
            providerErrorMessage: errorMessage,
            lastProviderReceivedAt: receivedAt,
            lastProviderUpdateEvent: "provider_error",
            lastProviderUpdateStatus: "error",
            lastProviderUpdateLog: `Erro do provider | Símbolo=${
              parsedSymbol || currentSymbol || "-"
            } | Timeframe=${
              parsedTimeframe || currentTimeframe || "-"
            } | Recebido=${receivedAt} | ${errorMessage}`,
          }));
          return;
        }

        if (nextEvent === "initial_candles") {
          if (!isCurrentSubscription) return;

          const items = Array.isArray(data.candles) ? data.candles : [];

          const normalizedItems = items
            .filter(isValidCandleItem)
            .map((item) => ({
              ...item,
              symbol: normalizeSymbol(item.symbol),
              timeframe: normalizeTimeframe(item.timeframe),
            }));

          const lastOpenTime =
            normalizedItems.length > 0
              ? normalizedItems[normalizedItems.length - 1]?.open_time ?? "-"
              : "-";

          const receivedAt = formatNowPt();

          setState((prev) => ({
            ...prev,
            scopeKey: currentScopeKey,
            lastWsEvent: "initial_candles",
            hasLoadedInitialCandles: true,
            providerErrorMessage: "",
            lastProviderUpdateAt: lastOpenTime,
            lastProviderReceivedAt: receivedAt,
            lastProviderUpdateEvent: "initial_candles",
            lastProviderUpdateStatus: "success",
            lastProviderUpdateLog: buildProviderUpdateLog({
              eventName: "initial_candles",
              symbol: parsedSymbol || currentSymbol,
              timeframe: parsedTimeframe || currentTimeframe,
              candleTime: lastOpenTime,
              receivedAt,
              count: normalizedItems.length,
            }),
          }));

          setCandles((prev) => mergeCandlesByOpenTime(prev, normalizedItems));
          return;
        }

        if (nextEvent === "candle_tick") {
          if (!isCurrentSubscription) return;

          const openTimeValue = data.open_time;
          const normalizedOpenTime =
            typeof openTimeValue === "string"
              ? floorToTimeframeIso(openTimeValue, parsedTimeframe || currentTimeframe)
              : "-";

          const nextTick: NonNullable<CandleTickState> = {
            symbol: parsedSymbol || currentSymbol || "-",
            timeframe: parsedTimeframe || currentTimeframe || "-",
            open_time: normalizedOpenTime,
            open: safeNumber(data.open),
            high: safeNumber(data.high),
            low: safeNumber(data.low),
            close: safeNumber(data.close),
            count: safeNumber(data.count),
            source: typeof data.source === "string" ? data.source : null,
            provider: typeof data.provider === "string" ? data.provider : null,
            market_session:
              typeof data.market_session === "string"
                ? data.market_session
                : null,
            timezone: typeof data.timezone === "string" ? data.timezone : null,
            is_delayed:
              typeof data.is_delayed === "boolean" ? data.is_delayed : null,
            is_mock: typeof data.is_mock === "boolean" ? data.is_mock : null,
          };

          const receivedAt = formatNowPt();

          setState((prev) => ({
            ...prev,
            scopeKey: currentScopeKey,
            lastWsEvent: "candle_tick",
            providerErrorMessage: "",
            hasLoadedInitialCandles: true,
            lastCandleTick: nextTick,
            lastProviderUpdateAt: nextTick.open_time,
            lastProviderReceivedAt: receivedAt,
            lastProviderUpdateEvent: "candle_tick",
            lastProviderUpdateStatus: "success",
            lastProviderUpdateLog: buildProviderUpdateLog({
              eventName: "candle_tick",
              symbol: nextTick.symbol,
              timeframe: nextTick.timeframe,
              candleTime: nextTick.open_time,
              receivedAt,
              count: nextTick.count,
            }),
          }));

          setCandles((prev) => upsertRealtimeCandle(prev, nextTick));
          return;
        }

        setState((prev) => ({
          ...prev,
          scopeKey: currentScopeKey,
          lastWsEvent: nextEvent,
        }));
      } catch (error) {
        console.error("[WS] failed to parse message:", error);
      }
    };

    socket.onerror = (error) => {
      if (!isMounted) return;
      if (isIntentionalCloseRef.current) return;

      setState((prev) => ({
        ...prev,
        scopeKey: currentScopeKey,
        wsStatus: "error",
        lastWsEvent: "error",
      }));

      console.error("[WS] error:", error);
    };

    socket.onclose = (event) => {
      if (!isMounted) return;

      const wasIntentional = isIntentionalCloseRef.current;

      setState((prev) => ({
        ...prev,
        scopeKey: currentScopeKey,
        wsStatus: "closed",
        lastWsEvent: wasIntentional
          ? prev.lastWsEvent || "closed"
          : "closed",
      }));

      if (!wasIntentional && !event.wasClean) {
        console.warn("[WS] closed unexpectedly:", {
          code: event.code,
          reason: event.reason,
        });
      }
    };

    return () => {
      isMounted = false;
      isIntentionalCloseRef.current = true;

      const activeSocket = socketRef.current;
      socketRef.current = null;

      if (!activeSocket) {
        return;
      }

      if (
        activeSocket.readyState === WebSocket.OPEN ||
        activeSocket.readyState === WebSocket.CONNECTING
      ) {
        try {
          activeSocket.close();
        } catch {
          // ignora
        }
      }
    };
  }, [
    hasSelection,
    scopeKey,
    effectiveChartMarketType,
    effectiveChartCatalog,
    effectiveChartSymbol,
    effectiveChartTimeframe,
    setCandles,
    reloadCandles,
  ]);

  const visibleState = state.scopeKey === scopeKey ? state : null;

  if (!hasSelection) {
    return {
      wsStatus: DEFAULT_RESULT.wsStatus,
      lastWsEvent: DEFAULT_RESULT.lastWsEvent,
      heartbeatCount: DEFAULT_RESULT.heartbeatCount,
      heartbeatMessage: DEFAULT_RESULT.heartbeatMessage,
      candlesRefreshCount: DEFAULT_RESULT.candlesRefreshCount,
      candlesRefreshReason: DEFAULT_RESULT.candlesRefreshReason,
      lastCandleTick: DEFAULT_RESULT.lastCandleTick,
      providerErrorMessage: DEFAULT_RESULT.providerErrorMessage,
      hasLoadedInitialCandles: DEFAULT_RESULT.hasLoadedInitialCandles,
      lastProviderUpdateLog: DEFAULT_RESULT.lastProviderUpdateLog,
      lastProviderUpdateAt: DEFAULT_RESULT.lastProviderUpdateAt,
      lastProviderReceivedAt: DEFAULT_RESULT.lastProviderReceivedAt,
      lastProviderUpdateEvent: DEFAULT_RESULT.lastProviderUpdateEvent,
      lastProviderUpdateStatus: DEFAULT_RESULT.lastProviderUpdateStatus,
    };
  }

  return {
    wsStatus: visibleState?.wsStatus ?? "connecting",
    lastWsEvent: visibleState?.lastWsEvent ?? "connecting",
    heartbeatCount:
      visibleState?.heartbeatCount ?? DEFAULT_RESULT.heartbeatCount,
    heartbeatMessage:
      visibleState?.heartbeatMessage ?? DEFAULT_RESULT.heartbeatMessage,
    candlesRefreshCount:
      visibleState?.candlesRefreshCount ?? DEFAULT_RESULT.candlesRefreshCount,
    candlesRefreshReason:
      visibleState?.candlesRefreshReason ?? DEFAULT_RESULT.candlesRefreshReason,
    lastCandleTick:
      visibleState?.lastCandleTick ?? DEFAULT_RESULT.lastCandleTick,
    providerErrorMessage:
      visibleState?.providerErrorMessage ??
      DEFAULT_RESULT.providerErrorMessage,
    hasLoadedInitialCandles:
      visibleState?.hasLoadedInitialCandles ??
      DEFAULT_RESULT.hasLoadedInitialCandles,
    lastProviderUpdateLog:
      visibleState?.lastProviderUpdateLog ??
      DEFAULT_RESULT.lastProviderUpdateLog,
    lastProviderUpdateAt:
      visibleState?.lastProviderUpdateAt ??
      DEFAULT_RESULT.lastProviderUpdateAt,
    lastProviderReceivedAt:
      visibleState?.lastProviderReceivedAt ??
      DEFAULT_RESULT.lastProviderReceivedAt,
    lastProviderUpdateEvent:
      visibleState?.lastProviderUpdateEvent ??
      DEFAULT_RESULT.lastProviderUpdateEvent,
    lastProviderUpdateStatus:
      visibleState?.lastProviderUpdateStatus ??
      DEFAULT_RESULT.lastProviderUpdateStatus,
  };
}

export default useRealtimeFeed;