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
  selectedProvider: string;
  setCandles: React.Dispatch<React.SetStateAction<CandleItem[]>>;
  reloadCandles: (showLoader?: boolean) => Promise<void>;
};

export type ProviderUpdateStatus = "idle" | "waiting" | "success" | "error";

type UseRealtimeFeedResult = {
  wsStatus: string;
  lastWsEvent: string;
  lastWsCloseCode: number | null;
  lastWsCloseReason: string;
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
  lastWsCloseCode: number | null;
  lastWsCloseReason: string;
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

const PERIODIC_RECONCILE_MS = 45_000;
const WS_RECONNECT_BASE_DELAY_MS = 1_000;
const WS_RECONNECT_MAX_DELAY_MS = 10_000;
const WS_RECONNECT_MAX_ATTEMPTS = 8;

const DEFAULT_RESULT: Omit<RealtimeFeedState, "scopeKey"> = {
  wsStatus: "disconnected",
  lastWsEvent: "-",
  lastWsCloseCode: null,
  lastWsCloseReason: "",
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

function normalizeProvider(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase();
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

function normalizeIsoString(value: unknown): string {
  if (typeof value !== "string") return "";

  const parsed = new Date(value).getTime();
  if (!Number.isFinite(parsed)) {
    return value.trim();
  }

  return new Date(parsed).toISOString();
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

function normalizeIncomingCandle(item: CandleItem): CandleItem {
  return {
    ...item,
    symbol: normalizeSymbol(item.symbol),
    timeframe: normalizeTimeframe(item.timeframe),
    open_time: normalizeIsoString(item.open_time),
    close_time: normalizeIsoString(item.close_time),
  };
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

function candleTimestamp(value: string): number {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function candleKey(item: { open_time: string }): string {
  return String(candleTimestamp(item.open_time));
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
    map.set(candleKey(item), normalizeIncomingCandle(item));
  }

  for (const item of incoming) {
    map.set(candleKey(item), normalizeIncomingCandle(item));
  }

  return Array.from(map.values()).sort((a, b) => {
    return candleTimestamp(a.open_time) - candleTimestamp(b.open_time);
  });
}

function shouldReloadCandles(reason: string | null | undefined): boolean {
  const normalized = String(reason ?? "").trim().toLowerCase();

  if (!normalized) return false;
  if (normalized.includes("reload")) return true;
  if (normalized.includes("resync")) return true;
  if (normalized.includes("reconcile")) return true;
  if (normalized.includes("bootstrap")) return true;
  if (normalized.includes("subscription_reset")) return true;

  return false;
}

function useRealtimeFeed({
  effectiveChartMarketType,
  effectiveChartCatalog,
  effectiveChartSymbol,
  effectiveChartTimeframe,
  selectedProvider,
  setCandles,
  reloadCandles,
}: UseRealtimeFeedParams): UseRealtimeFeedResult {
  const scopeKey = useMemo(() => {
    return [
      normalizeProvider(selectedProvider),
      effectiveChartMarketType || "",
      effectiveChartCatalog || "",
      effectiveChartSymbol || "",
      effectiveChartTimeframe || "",
    ].join("::");
  }, [
    selectedProvider,
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
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectScopeKeyRef = useRef("");
  const [wsReconnectTick, setWsReconnectTick] = useState(0);

  useEffect(() => {
    if (!hasSelection) {
      if (reconnectTimerRef.current !== null) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      reconnectAttemptRef.current = 0;
      reconnectScopeKeyRef.current = "";

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
    const currentProvider = normalizeProvider(selectedProvider);

    if (reconnectScopeKeyRef.current !== currentScopeKey) {
      reconnectScopeKeyRef.current = currentScopeKey;
      reconnectAttemptRef.current = 0;
      if (reconnectTimerRef.current !== null) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    }

    isIntentionalCloseRef.current = false;

    const socket = new WebSocket(API_WS_BASE_URL);
    socketRef.current = socket;

    let periodicReconcileHandle: ReturnType<typeof setInterval> | null = null;
    let periodicReconcileInFlight = false;

    const stopPeriodicReconcile = () => {
      if (periodicReconcileHandle !== null) {
        clearInterval(periodicReconcileHandle);
        periodicReconcileHandle = null;
      }
    };

    const runPeriodicReconcile = async () => {
      if (!isMounted) return;
      if (socketRef.current !== socket) return;
      if (periodicReconcileInFlight) return;

      periodicReconcileInFlight = true;

      try {
        await reloadCandles(false);
      } catch (error) {
        if (!isMounted) return;
        if (socketRef.current !== socket) return;

        const message =
          error instanceof Error
            ? error.message
            : "Falha desconhecida na reconciliação periódica.";
        const receivedAt = formatNowPt();

        setState((prev) => ({
          ...prev,
          scopeKey: currentScopeKey,
          lastProviderReceivedAt: receivedAt,
          lastProviderUpdateEvent: "reconcile_timer",
          lastProviderUpdateStatus: "error",
          lastProviderUpdateLog: buildProviderUpdateLog({
            eventName: "reconcile_timer",
            symbol: currentSymbol || "-",
            timeframe: currentTimeframe || "-",
            candleTime:
              prev.lastProviderUpdateAt && prev.lastProviderUpdateAt !== "-"
                ? prev.lastProviderUpdateAt
                : undefined,
            receivedAt,
            extra: `ProviderSelecionado=${currentProvider || "backend-default"} | ConfirmaçãoSQLite=ERRO | ${message}`,
          }),
        }));
      } finally {
        periodicReconcileInFlight = false;
      }
    };

    const startPeriodicReconcile = () => {
      if (periodicReconcileHandle !== null) return;

      periodicReconcileHandle = setInterval(() => {
        void runPeriodicReconcile();
      }, PERIODIC_RECONCILE_MS);
    };

    socket.onopen = () => {
      if (!isMounted) return;

      reconnectAttemptRef.current = 0;
      if (reconnectTimerRef.current !== null) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }

      setState({
        scopeKey: currentScopeKey,
        ...DEFAULT_RESULT,
        wsStatus: "connected",
        lastWsEvent: "connected",
        lastWsCloseCode: null,
        lastWsCloseReason: "",
        lastProviderUpdateLog: `Ligação aberta em ${formatNowPt()}. A aguardar candles do provider ${currentProvider || "backend-default"}.`,
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
            provider: currentProvider || undefined,
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
          if (nextEvent === "subscribed") {
            startPeriodicReconcile();
          }

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
                ? `Subscrição confirmada em ${formatNowPt()}. A aguardar dados do provider ${currentProvider || "backend-default"} para ${currentSymbol} em ${currentTimeframe}.`
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
          const latestOpenTimeValue =
            typeof data.latest_open_time === "string"
              ? normalizeIsoString(data.latest_open_time)
              : undefined;
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
            lastProviderUpdateAt:
              latestOpenTimeValue ||
              (prev.lastProviderUpdateAt && prev.lastProviderUpdateAt !== "-"
                ? prev.lastProviderUpdateAt
                : "-"),
            lastProviderUpdateEvent: "candles_refresh",
            lastProviderUpdateStatus: shouldReloadCandles(
              typeof reasonValue === "string" ? reasonValue : ""
            )
              ? "waiting"
              : "success",
            lastProviderUpdateLog: buildProviderUpdateLog({
              eventName: "candles_refresh",
              symbol: parsedSymbol || currentSymbol,
              timeframe: parsedTimeframe || currentTimeframe,
              candleTime:
                latestOpenTimeValue ||
                (prev.lastProviderUpdateAt && prev.lastProviderUpdateAt !== "-"
                  ? prev.lastProviderUpdateAt
                  : undefined),
              receivedAt,
              count:
                typeof countValue === "number"
                  ? countValue
                  : Number(countValue ?? 0),
              extra:
                typeof reasonValue === "string" && reasonValue
                  ? shouldReloadCandles(reasonValue)
                    ? `ProviderSelecionado=${currentProvider || "backend-default"} | Motivo=${reasonValue} | ConfirmaçãoSQLite=EM_CURSO`
                    : `ProviderSelecionado=${currentProvider || "backend-default"} | Motivo=${reasonValue}`
                  : `ProviderSelecionado=${currentProvider || "backend-default"}`,
            }),
          }));

          if (
            shouldReloadCandles(
              typeof reasonValue === "string" ? reasonValue : ""
            )
          ) {
            try {
              await reloadCandles(false);

              if (!isMounted || socketRef.current !== socket) {
                return;
              }

              setState((prev) => ({
                ...prev,
                scopeKey: currentScopeKey,
                lastProviderUpdateStatus: "success",
                lastProviderUpdateLog: buildProviderUpdateLog({
                  eventName: "candles_refresh",
                  symbol: parsedSymbol || currentSymbol,
                  timeframe: parsedTimeframe || currentTimeframe,
                  candleTime:
                    latestOpenTimeValue ||
                    (prev.lastProviderUpdateAt && prev.lastProviderUpdateAt !== "-"
                      ? prev.lastProviderUpdateAt
                      : undefined),
                  receivedAt,
                  count:
                    typeof countValue === "number"
                      ? countValue
                      : Number(countValue ?? 0),
                  extra:
                    typeof reasonValue === "string" && reasonValue
                      ? `ProviderSelecionado=${currentProvider || "backend-default"} | Motivo=${reasonValue} | ConfirmaçãoSQLite=OK`
                      : `ProviderSelecionado=${currentProvider || "backend-default"} | ConfirmaçãoSQLite=OK`,
                }),
              }));
            } catch (error) {
              const message =
                error instanceof Error
                  ? error.message
                  : "Falha ao recarregar candles após candles_refresh.";

              setState((prev) => ({
                ...prev,
                scopeKey: currentScopeKey,
                lastProviderUpdateStatus: "error",
                lastProviderUpdateLog: buildProviderUpdateLog({
                  eventName: "candles_refresh",
                  symbol: parsedSymbol || currentSymbol,
                  timeframe: parsedTimeframe || currentTimeframe,
                  candleTime:
                    latestOpenTimeValue ||
                    (prev.lastProviderUpdateAt && prev.lastProviderUpdateAt !== "-"
                      ? prev.lastProviderUpdateAt
                      : undefined),
                  receivedAt,
                  count:
                    typeof countValue === "number"
                      ? countValue
                      : Number(countValue ?? 0),
                  extra: `ProviderSelecionado=${currentProvider || "backend-default"} | ConfirmaçãoSQLite=ERRO | ${message}`,
                }),
              }));
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
            lastProviderUpdateLog: `Erro do provider | Provider=${currentProvider || "backend-default"} | Símbolo=${
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
            .map((item) =>
              normalizeIncomingCandle({
                ...item,
                symbol: normalizeSymbol(item.symbol),
                timeframe: normalizeTimeframe(item.timeframe),
              })
            );

          const sortedItems = normalizedItems.sort(
            (a, b) => candleTimestamp(a.open_time) - candleTimestamp(b.open_time)
          );

          const lastOpenTime =
            sortedItems.length > 0
              ? sortedItems[sortedItems.length - 1]?.open_time ?? "-"
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
            lastProviderUpdateStatus: "waiting",
            lastProviderUpdateLog: buildProviderUpdateLog({
              eventName: "initial_candles",
              symbol: parsedSymbol || currentSymbol,
              timeframe: parsedTimeframe || currentTimeframe,
              candleTime: lastOpenTime,
              receivedAt,
              count: sortedItems.length,
              extra: `ProviderSelecionado=${currentProvider || "backend-default"} | Snapshot=RECEBIDO_VIA_WS | ConfirmaçãoSQLite=AGUARDANDO`,
            }),
          }));

          setCandles((prev) => mergeCandlesByOpenTime(prev, sortedItems));
          return;
        }

        if (nextEvent === "candle_tick") {
          if (!isCurrentSubscription) return;

          const openTimeValue = data.open_time;
          const normalizedOpenTime =
            typeof openTimeValue === "string"
              ? normalizeIsoString(
                  floorToTimeframeIso(
                    openTimeValue,
                    parsedTimeframe || currentTimeframe
                  )
                )
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
              extra: `ProviderSelecionado=${currentProvider || "backend-default"} | Persistência=CONFIRMADA_VIA_WS`,
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
      if (socketRef.current !== socket) return;

      const wasIntentional = isIntentionalCloseRef.current;
      stopPeriodicReconcile();
      periodicReconcileInFlight = false;
      const closeCode = Number.isFinite(event.code) ? event.code : null;
      const closeReason =
        typeof event.reason === "string" ? event.reason.trim() : "";

      const canRetry =
        !wasIntentional && reconnectAttemptRef.current < WS_RECONNECT_MAX_ATTEMPTS;

      let retryDelayMs: number | null = null;
      if (canRetry) {
        const nextAttempt = reconnectAttemptRef.current + 1;
        reconnectAttemptRef.current = nextAttempt;
        retryDelayMs = Math.min(
          WS_RECONNECT_BASE_DELAY_MS * 2 ** (nextAttempt - 1),
          WS_RECONNECT_MAX_DELAY_MS
        );

        if (reconnectTimerRef.current !== null) {
          clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = null;
        }

        reconnectTimerRef.current = setTimeout(() => {
          reconnectTimerRef.current = null;
          if (!isMounted) return;
          if (isIntentionalCloseRef.current) return;
          setWsReconnectTick((value) => value + 1);
        }, retryDelayMs);
      }

      setState((prev) => ({
        ...prev,
        scopeKey: currentScopeKey,
        wsStatus: canRetry ? "reconnecting" : "closed",
        lastWsEvent: canRetry
          ? `reconnect_attempt_${reconnectAttemptRef.current}`
          : wasIntentional
            ? prev.lastWsEvent || "closed"
            : "closed",
        lastWsCloseCode: closeCode,
        lastWsCloseReason:
          closeReason ||
          (retryDelayMs !== null
            ? `socket fechado; retry em ${retryDelayMs}ms`
            : "socket fechado"),
      }));

      if (!wasIntentional && !event.wasClean) {
        console.warn("[WS] closed unexpectedly:", {
          code: event.code,
          reason: event.reason,
        });
      }

      if (!wasIntentional && !canRetry) {
        console.error("[WS] reconnect limit reached:", {
          attempts: reconnectAttemptRef.current,
          maxAttempts: WS_RECONNECT_MAX_ATTEMPTS,
        });
      }
    };

    return () => {
      isMounted = false;
      isIntentionalCloseRef.current = true;
      stopPeriodicReconcile();
      periodicReconcileInFlight = false;
      if (reconnectTimerRef.current !== null) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }

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
    selectedProvider,
    effectiveChartMarketType,
    effectiveChartCatalog,
    effectiveChartSymbol,
    effectiveChartTimeframe,
    setCandles,
    reloadCandles,
    wsReconnectTick,
  ]);

  const visibleState = state.scopeKey === scopeKey ? state : null;

  if (!hasSelection) {
    return {
      wsStatus: DEFAULT_RESULT.wsStatus,
      lastWsEvent: DEFAULT_RESULT.lastWsEvent,
      lastWsCloseCode: DEFAULT_RESULT.lastWsCloseCode,
      lastWsCloseReason: DEFAULT_RESULT.lastWsCloseReason,
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
    lastWsCloseCode:
      visibleState?.lastWsCloseCode ?? DEFAULT_RESULT.lastWsCloseCode,
    lastWsCloseReason:
      visibleState?.lastWsCloseReason ?? DEFAULT_RESULT.lastWsCloseReason,
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
