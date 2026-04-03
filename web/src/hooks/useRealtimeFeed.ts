// src/hooks/useRealtimeFeed.ts

import { useEffect, useState } from "react";

import { API_WS_BASE_URL } from "../constants/config";
import type { CandleTickState, WsEnvelope } from "../types/trading";
import { upsertRealtimeCandle } from "../utils/candles";
import { floorToMinuteIso } from "../utils/format";

type UseRealtimeFeedParams = {
  effectiveChartSymbol: string;
  effectiveChartTimeframe: string;
  setCandles: React.Dispatch<
    React.SetStateAction<
      Array<{
        id: string;
        asset_id: string | null;
        symbol: string;
        timeframe: string;
        open_time: string;
        close_time: string;
        open: string;
        high: string;
        low: string;
        close: string;
        volume: string;
        source: string | null;
        provider?: string | null;
        market_session?: string | null;
        timezone?: string | null;
        is_delayed?: boolean | null;
        is_mock?: boolean | null;
      }>
    >
  >;
  reloadCandles: (showLoader?: boolean) => Promise<void>;
};

type UseRealtimeFeedResult = {
  wsStatus: string;
  lastWsEvent: string;
  heartbeatCount: number | null;
  heartbeatMessage: string;
  candlesRefreshCount: number | null;
  candlesRefreshReason: string;
  lastCandleTick: CandleTickState;
};

function useRealtimeFeed({
  effectiveChartSymbol,
  effectiveChartTimeframe,
  setCandles,
}: UseRealtimeFeedParams): UseRealtimeFeedResult {
  const [wsStatus, setWsStatus] = useState("disconnected");
  const [lastWsEvent, setLastWsEvent] = useState("-");
  const [heartbeatCount, setHeartbeatCount] = useState<number | null>(null);
  const [heartbeatMessage, setHeartbeatMessage] = useState("-");
  const [candlesRefreshCount, setCandlesRefreshCount] = useState<number | null>(null);
  const [candlesRefreshReason, setCandlesRefreshReason] = useState("-");
  const [lastCandleTick, setLastCandleTick] = useState<CandleTickState>(null);

  useEffect(() => {
    if (!effectiveChartSymbol || !effectiveChartTimeframe) {
      return;
    }

    let isMounted = true;
    const socket = new WebSocket(API_WS_BASE_URL);

    socket.onopen = () => {
      if (!isMounted) return;

      setWsStatus("connected");
      setLastWsEvent("connected");
      console.log("[WS] connected");

      socket.send("frontend_connected");

      socket.send(
        JSON.stringify({
          action: "subscribe",
          symbol: effectiveChartSymbol,
          timeframe: effectiveChartTimeframe,
        })
      );
    };

    socket.onmessage = (event) => {
      if (!isMounted) return;

      console.log("[WS] message:", event.data);

      try {
        const parsed: WsEnvelope = JSON.parse(event.data);
        const nextEvent = parsed.event ?? "unknown";

        if (nextEvent === "connected" || nextEvent === "subscribed" || nextEvent === "echo") {
          setLastWsEvent(nextEvent);
          return;
        }

        if (nextEvent === "heartbeat") {
          const countValue = parsed.data?.count;
          const messageValue = parsed.data?.message;

          setLastWsEvent("heartbeat");
          setHeartbeatCount(
            typeof countValue === "number" ? countValue : Number(countValue ?? 0)
          );
          setHeartbeatMessage(typeof messageValue === "string" ? messageValue : "-");
          return;
        }

        const symbolValue =
          typeof parsed.data?.symbol === "string" ? parsed.data.symbol : "";
        const timeframeValue =
          typeof parsed.data?.timeframe === "string" ? parsed.data.timeframe : "";

        const isCurrentSubscription =
          symbolValue === effectiveChartSymbol &&
          timeframeValue === effectiveChartTimeframe;

        if (nextEvent === "candles_refresh") {
          if (!isCurrentSubscription) {
            return;
          }

          const countValue = parsed.data?.count;
          const reasonValue = parsed.data?.reason;

          setLastWsEvent("candles_refresh");
          setCandlesRefreshCount(
            typeof countValue === "number" ? countValue : Number(countValue ?? 0)
          );
          setCandlesRefreshReason(typeof reasonValue === "string" ? reasonValue : "-");
          return;
        }

        if (nextEvent === "provider_error") {
          if (!isCurrentSubscription) {
            return;
          }

          setLastWsEvent("provider_error");
          return;
        }

        if (nextEvent === "initial_candles") {
          if (!isCurrentSubscription) {
            return;
          }

          const items = Array.isArray(parsed.data?.candles) ? parsed.data.candles : [];
          setLastWsEvent("initial_candles");

          setCandles(() => {
            return items.filter(
              (item) =>
                item &&
                typeof item.symbol === "string" &&
                typeof item.timeframe === "string" &&
                typeof item.open_time === "string"
            );
          });

          return;
        }

        if (nextEvent === "candle_tick") {
          if (!isCurrentSubscription) {
            return;
          }

          const openTimeValue = parsed.data?.open_time;
          const openValue = Number(parsed.data?.open);
          const highValue = Number(parsed.data?.high);
          const lowValue = Number(parsed.data?.low);
          const closeValue = Number(parsed.data?.close);
          const countValue = Number(parsed.data?.count);

          const normalizedOpenTime =
            typeof openTimeValue === "string" ? floorToMinuteIso(openTimeValue) : "-";

          const nextTick: NonNullable<CandleTickState> = {
            symbol: symbolValue || "-",
            timeframe: timeframeValue || "-",
            open_time: normalizedOpenTime,
            open: openValue,
            high: highValue,
            low: lowValue,
            close: closeValue,
            count: countValue,
            source: typeof parsed.data?.source === "string" ? parsed.data.source : null,
            provider:
              typeof parsed.data?.provider === "string" ? parsed.data.provider : null,
            market_session:
              typeof parsed.data?.market_session === "string"
                ? parsed.data.market_session
                : null,
            timezone:
              typeof parsed.data?.timezone === "string" ? parsed.data.timezone : null,
            is_delayed:
              typeof parsed.data?.is_delayed === "boolean"
                ? parsed.data.is_delayed
                : null,
            is_mock:
              typeof parsed.data?.is_mock === "boolean" ? parsed.data.is_mock : null,
          };

          setLastWsEvent("candle_tick");
          setLastCandleTick(nextTick);
          setCandles((prev) => upsertRealtimeCandle(prev, nextTick));
        }
      } catch (error) {
        console.error("[WS] failed to parse message:", error);
      }
    };

    socket.onerror = (error) => {
      if (!isMounted) return;
      setWsStatus("error");
      console.error("[WS] error:", error);
    };

    socket.onclose = () => {
      if (!isMounted) return;
      setWsStatus("closed");
      console.log("[WS] closed");
    };

    return () => {
      isMounted = false;
      socket.close();
    };
  }, [effectiveChartSymbol, effectiveChartTimeframe, setCandles]);

  return {
    wsStatus,
    lastWsEvent,
    heartbeatCount,
    heartbeatMessage,
    candlesRefreshCount,
    candlesRefreshReason,
    lastCandleTick,
  };
}

export default useRealtimeFeed;