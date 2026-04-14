// web/src/components/stage-tests/StageTestCaseChartModal.tsx

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  LineSeries,
  LineStyle,
  createChart,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import { API_HTTP_BASE_URL } from "../../constants/config";
import type { StageTestRunCaseItem } from "../../types/trading";

type Props = {
  open: boolean;
  onClose: () => void;
  symbol: string;
  timeframe: string;
  strategyLabel: string;
  selectedCase: StageTestRunCaseItem | null;
};

type CandleApiItem = {
  open_time: string;
  open: string | number;
  high: string | number;
  low: string | number;
  close: string | number;
};

type MarkerLane = "top" | "bottom";

type ChartMarkerItem = {
  id: string;
  label: string;
  shortLabel: string;
  time: string;
  price: number;
  color: string;
  lane: MarkerLane;
};

type MarkerPosition = ChartMarkerItem & {
  left: number;
  pointTop: number;
  labelTop: number;
  labelLeft: number;
};

const CHART_HEIGHT = 560;
const LABEL_HALF_WIDTH = 54;
const TOP_BASE = 18;
const BOTTOM_BASE = CHART_HEIGHT - 34;
const LANE_STEP = 24;

function normalizeTimeframe(value: string): string {
  return String(value ?? "").trim().toLowerCase();
}

function timeframeToMinutes(timeframe: string): number {
  const normalized = normalizeTimeframe(timeframe);

  if (normalized === "1m") return 1;
  if (normalized === "3m") return 3;
  if (normalized === "5m") return 5;
  if (normalized === "15m") return 15;
  if (normalized === "30m") return 30;
  if (normalized === "1h") return 60;
  if (normalized === "4h") return 240;
  if (normalized === "1d") return 1440;

  return 5;
}

function toUtcTimestamp(value: string): UTCTimestamp {
  return Math.floor(new Date(value).getTime() / 1000) as UTCTimestamp;
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string") {
    const normalized = value.replace(",", ".").trim();
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function formatPrice(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "-";

  return value.toLocaleString("pt-PT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleString("pt-PT");
}

function addMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

function subMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() - minutes * 60_000).toISOString();
}

function getCaseReferenceTimes(selectedCase: StageTestRunCaseItem | null): string[] {
  if (!selectedCase) return [];

  return [
    selectedCase.trigger_candle_time,
    selectedCase.trigger_time,
    selectedCase.entry_time,
    selectedCase.close_time,
  ].filter((item): item is string => Boolean(item));
}

function buildWindowFromCase(
  timeframe: string,
  selectedCase: StageTestRunCaseItem | null
): { startAt: string; endAt: string } | null {
  const times = getCaseReferenceTimes(selectedCase);
  if (!times.length) return null;

  const timestamps = times
    .map((item) => new Date(item).getTime())
    .filter((item) => Number.isFinite(item))
    .sort((a, b) => a - b);

  if (!timestamps.length) return null;

  const firstIso = new Date(timestamps[0]).toISOString();
  const lastIso = new Date(timestamps[timestamps.length - 1]).toISOString();

  const tfMinutes = timeframeToMinutes(timeframe);
  const beforeCandles = Math.max(60, tfMinutes <= 5 ? 120 : 80);
  const afterCandles = Math.max(40, tfMinutes <= 5 ? 80 : 50);

  return {
    startAt: subMinutes(firstIso, beforeCandles * tfMinutes),
    endAt: addMinutes(lastIso, afterCandles * tfMinutes),
  };
}

function computeEma(
  values: Array<{ time: UTCTimestamp; value: number }>,
  period: number
): LineData<UTCTimestamp>[] {
  if (!values.length || period <= 0) return [];

  const multiplier = 2 / (period + 1);
  let ema: number | null = null;

  return values.map((item, index) => {
    if (index === 0 || ema === null) {
      ema = item.value;
    } else {
      ema = item.value * multiplier + ema * (1 - multiplier);
    }

    return {
      time: item.time,
      value: Number(ema),
    };
  });
}

function detectCrossMarkers(
  emaFast: LineData<UTCTimestamp>[],
  emaSlow: LineData<UTCTimestamp>[],
  selectedCase: StageTestRunCaseItem | null
): ChartMarkerItem[] {
  if (!emaFast.length || !emaSlow.length) return [];

  const slowMap = new Map<number, number>();
  for (const item of emaSlow) {
    if (typeof item.value === "number") {
      slowMap.set(Number(item.time), item.value);
    }
  }

  const crosses: ChartMarkerItem[] = [];
  let previousDiff: number | null = null;

  for (const item of emaFast) {
    const fastValue = typeof item.value === "number" ? item.value : null;
    const slowValue = slowMap.get(Number(item.time));

    if (fastValue == null || slowValue == null) continue;

    const diff = fastValue - slowValue;

    if (
      previousDiff !== null &&
      ((previousDiff <= 0 && diff > 0) || (previousDiff >= 0 && diff < 0))
    ) {
      const timeIso = new Date(Number(item.time) * 1000).toISOString();
      const isBullish = diff > 0;

      crosses.push({
        id: `cross-${item.time}`,
        label: isBullish ? "Cruzamento alta M9/M21" : "Cruzamento baixa M9/M21",
        shortLabel: "Cruzamento",
        time: timeIso,
        price: fastValue,
        color: isBullish ? "#2563eb" : "#f59e0b",
        lane: "top",
      });
    }

    previousDiff = diff;
  }

  if (!selectedCase) return crosses.slice(-3);

  const referenceTime =
    selectedCase.entry_time ??
    selectedCase.trigger_time ??
    selectedCase.trigger_candle_time ??
    selectedCase.close_time ??
    null;

  if (!referenceTime) return crosses.slice(-3);

  const referenceMs = new Date(referenceTime).getTime();
  const nearest = [...crosses]
    .map((item) => ({
      item,
      delta: Math.abs(new Date(item.time).getTime() - referenceMs),
    }))
    .sort((a, b) => a.delta - b.delta)
    .slice(0, 1)
    .map((entry) => ({
      ...entry.item,
      label: `${entry.item.label} (mais próximo do trade)`,
      shortLabel: "Cruzamento",
      color: "#7c3aed",
      lane: "top" as MarkerLane,
    }));

  const recent = crosses.slice(-2);

  const byId = new Map<string, ChartMarkerItem>();
  for (const item of [...recent, ...nearest]) {
    byId.set(item.id, item);
  }

  return Array.from(byId.values());
}

function buildCaseMarkers(selectedCase: StageTestRunCaseItem | null): ChartMarkerItem[] {
  if (!selectedCase) return [];

  const markers: ChartMarkerItem[] = [];

  const triggerPrice = parseNumber(selectedCase.trigger_price);
  const entryPrice = parseNumber(selectedCase.entry_price);
  const closePrice = parseNumber(selectedCase.close_price);
  const targetPrice = parseNumber(selectedCase.target_price);
  const invalidationPrice = parseNumber(selectedCase.invalidation_price);

  if (selectedCase.trigger_time && triggerPrice !== null) {
    markers.push({
      id: `${selectedCase.id}-trigger`,
      label: "Trigger",
      shortLabel: "Trigger",
      time: selectedCase.trigger_time,
      price: triggerPrice,
      color: "#0ea5e9",
      lane: "bottom",
    });
  }

  if (selectedCase.entry_time && entryPrice !== null) {
    markers.push({
      id: `${selectedCase.id}-entry`,
      label: "Entrada",
      shortLabel: "Entrada",
      time: selectedCase.entry_time,
      price: entryPrice,
      color: "#16a34a",
      lane: "bottom",
    });
  }

  if (selectedCase.close_time && closePrice !== null) {
    markers.push({
      id: `${selectedCase.id}-exit`,
      label: "Saída",
      shortLabel: "Saída",
      time: selectedCase.close_time,
      price: closePrice,
      color: "#dc2626",
      lane: "bottom",
    });
  }

  if (selectedCase.entry_time && targetPrice !== null) {
    markers.push({
      id: `${selectedCase.id}-target`,
      label: "Target",
      shortLabel: "Target",
      time: selectedCase.entry_time,
      price: targetPrice,
      color: "#10b981",
      lane: "bottom",
    });
  }

  if (selectedCase.entry_time && invalidationPrice !== null) {
    markers.push({
      id: `${selectedCase.id}-invalidation`,
      label: "Invalidação",
      shortLabel: "Invalidação",
      time: selectedCase.entry_time,
      price: invalidationPrice,
      color: "#f97316",
      lane: "top",
    });
  }

  return markers;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function distributeMarkerLanes(markers: MarkerPosition[]): MarkerPosition[] {
  const byLane: Record<MarkerLane, MarkerPosition[]> = {
    top: [],
    bottom: [],
  };

  for (const marker of markers) {
    byLane[marker.lane].push(marker);
  }

  const processLane = (lane: MarkerLane, items: MarkerPosition[]) => {
    const sorted = [...items].sort((a, b) => a.left - b.left);

    let clusterIndex = 0;
    let previousLeft = -Infinity;

    for (const item of sorted) {
      if (Math.abs(item.left - previousLeft) < 90) {
        clusterIndex += 1;
      } else {
        clusterIndex = 0;
      }

      previousLeft = item.left;

      item.labelTop =
        lane === "top"
          ? TOP_BASE + clusterIndex * LANE_STEP
          : BOTTOM_BASE - clusterIndex * LANE_STEP;
    }
  };

  processLane("top", byLane.top);
  processLane("bottom", byLane.bottom);

  return [...byLane.top, ...byLane.bottom];
}

export default function StageTestCaseChartModal({
  open,
  onClose,
  symbol,
  timeframe,
  strategyLabel,
  selectedCase,
}: Props) {
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const ema9SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const ema21SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [candles, setCandles] = useState<CandleApiItem[]>([]);
  const [markerPositions, setMarkerPositions] = useState<MarkerPosition[]>([]);

  const fetchWindow = useMemo(() => {
    return buildWindowFromCase(timeframe, selectedCase);
  }, [timeframe, selectedCase]);

  const candleData = useMemo<CandlestickData<UTCTimestamp>[]>(() => {
    return candles
      .map((item) => ({
        time: toUtcTimestamp(item.open_time),
        open: Number(item.open),
        high: Number(item.high),
        low: Number(item.low),
        close: Number(item.close),
      }))
      .filter(
        (item) =>
          Number.isFinite(item.time) &&
          Number.isFinite(item.open) &&
          Number.isFinite(item.high) &&
          Number.isFinite(item.low) &&
          Number.isFinite(item.close)
      )
      .sort((a, b) => Number(a.time) - Number(b.time));
  }, [candles]);

  const closeSeries = useMemo(() => {
    return candleData.map((item) => ({
      time: item.time,
      value: item.close,
    }));
  }, [candleData]);

  const ema9Data = useMemo(() => computeEma(closeSeries, 9), [closeSeries]);
  const ema21Data = useMemo(() => computeEma(closeSeries, 21), [closeSeries]);

  const allMarkers = useMemo(() => {
    return [
      ...detectCrossMarkers(ema9Data, ema21Data, selectedCase),
      ...buildCaseMarkers(selectedCase),
    ];
  }, [ema9Data, ema21Data, selectedCase]);

  const syncMarkerPositions = useCallback(() => {
    const chart = chartRef.current;
    const candleSeries = candleSeriesRef.current;
    const container = chartContainerRef.current;

    if (!chart || !candleSeries || !container || !allMarkers.length) {
      setMarkerPositions([]);
      return;
    }

    const width = Math.max(container.clientWidth, 400);

    const nextPositions: MarkerPosition[] = [];

    for (const marker of allMarkers) {
      const time = toUtcTimestamp(marker.time);
      const left = chart.timeScale().timeToCoordinate(time as Time);
      const pointTop = candleSeries.priceToCoordinate(marker.price);

      if (left == null || pointTop == null) continue;

      nextPositions.push({
        ...marker,
        left,
        pointTop,
        labelTop: marker.lane === "top" ? TOP_BASE : BOTTOM_BASE,
        labelLeft: clamp(left, LABEL_HALF_WIDTH, width - LABEL_HALF_WIDTH),
      });
    }

    const distributed = distributeMarkerLanes(nextPositions).map((marker) => ({
      ...marker,
      labelLeft: clamp(marker.left, LABEL_HALF_WIDTH, width - LABEL_HALF_WIDTH),
    }));

    setMarkerPositions(distributed);
  }, [allMarkers]);

  useEffect(() => {
    if (!open || !selectedCase || !fetchWindow) return;

    let cancelled = false;
    const windowRange = fetchWindow;

    async function loadCandles() {
      try {
        setLoading(true);
        setError("");
        setCandles([]);

        const params = new URLSearchParams({
          symbol,
          timeframe,
          start_at: windowRange.startAt,
          end_at: windowRange.endAt,
          limit: "3000",
          mode: "full",
        });

        const response = await fetch(
          `${API_HTTP_BASE_URL}/candles?${params.toString()}`,
          {
            method: "GET",
            headers: {
              Accept: "application/json",
            },
          }
        );

        if (!response.ok) {
          const payloadText = await response.text();
          throw new Error(payloadText || `HTTP ${response.status}`);
        }

        const payload = (await response.json()) as
          | { items?: CandleApiItem[] }
          | CandleApiItem[];

        const rawItems = Array.isArray(payload)
          ? payload
          : Array.isArray(payload.items)
            ? payload.items
            : [];

        if (!cancelled) {
          setCandles(rawItems);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Erro ao carregar candles");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadCandles();

    return () => {
      cancelled = true;
    };
  }, [open, selectedCase, symbol, timeframe, fetchWindow]);

  useEffect(() => {
    if (!open || !chartContainerRef.current) return;

    const container = chartContainerRef.current;
    const width = Math.max(container.clientWidth, 400);

    if (!chartRef.current) {
      const chart = createChart(container, {
        width,
        height: CHART_HEIGHT,
        layout: {
          background: { type: ColorType.Solid, color: "#ffffff" },
          textColor: "#1f2937",
        },
        grid: {
          vertLines: { color: "#eef2f7" },
          horzLines: { color: "#eef2f7" },
        },
        rightPriceScale: {
          visible: true,
          autoScale: true,
          borderVisible: true,
          borderColor: "#dbe2ea",
        },
        timeScale: {
          borderColor: "#dbe2ea",
          timeVisible: true,
          secondsVisible: false,
        },
        localization: {
          locale: "pt-PT",
          priceFormatter: (price: number) => price.toFixed(5),
        },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: {
            visible: true,
            labelVisible: true,
            width: 1,
            style: LineStyle.LargeDashed,
            color: "rgba(100, 116, 139, 0.7)",
            labelBackgroundColor: "#0f172a",
          },
          horzLine: {
            visible: true,
            labelVisible: true,
            width: 1,
            style: LineStyle.LargeDashed,
            color: "rgba(100, 116, 139, 0.7)",
            labelBackgroundColor: "#475569",
          },
        },
      });

      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: "#16a34a",
        downColor: "#dc2626",
        wickUpColor: "#16a34a",
        wickDownColor: "#dc2626",
        borderUpColor: "#16a34a",
        borderDownColor: "#dc2626",
        priceLineVisible: true,
        priceLineWidth: 1,
        priceLineStyle: LineStyle.LargeDashed,
        priceLineColor: "#2563eb",
      });

      const ema9Series = chart.addSeries(LineSeries, {
        color: "#2563eb",
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });

      const ema21Series = chart.addSeries(LineSeries, {
        color: "#7c3aed",
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });

      chartRef.current = chart;
      candleSeriesRef.current = candleSeries;
      ema9SeriesRef.current = ema9Series;
      ema21SeriesRef.current = ema21Series;
    }

    const chart = chartRef.current;

    const handleVisibleRangeChange = () => {
      window.requestAnimationFrame(syncMarkerPositions);
    };

    const handleResize = () => {
      if (!chartContainerRef.current || !chartRef.current) return;

      chartRef.current.applyOptions({
        width: Math.max(chartContainerRef.current.clientWidth, 400),
        height: CHART_HEIGHT,
      });

      window.requestAnimationFrame(syncMarkerPositions);
    };

    chart.timeScale().subscribeVisibleTimeRangeChange(handleVisibleRangeChange);
    window.addEventListener("resize", handleResize);

    return () => {
      chart.timeScale().unsubscribeVisibleTimeRangeChange(handleVisibleRangeChange);
      window.removeEventListener("resize", handleResize);
    };
  }, [open, syncMarkerPositions]);

  useEffect(() => {
    if (!open || !chartRef.current || !candleSeriesRef.current) return;

    candleSeriesRef.current.setData(candleData);
    ema9SeriesRef.current?.setData(ema9Data);
    ema21SeriesRef.current?.setData(ema21Data);

    if (candleData.length > 0) {
      chartRef.current.timeScale().fitContent();
    }

    window.requestAnimationFrame(syncMarkerPositions);
  }, [open, candleData, ema9Data, ema21Data, syncMarkerPositions]);

  useEffect(() => {
    return () => {
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }

      candleSeriesRef.current = null;
      ema9SeriesRef.current = null;
      ema21SeriesRef.current = null;
    };
  }, []);

  if (!open || !selectedCase) return null;

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={headerStyle}>
          <div>
            <h2 style={{ margin: 0 }}>Visualização do trade</h2>
            <div style={{ color: "#94a3b8", marginTop: 6 }}>
              {symbol} / {timeframe} / {strategyLabel}
            </div>
          </div>

          <button onClick={onClose} style={closeButtonStyle}>
            Fechar
          </button>
        </div>

        <div style={summaryGridStyle}>
          <div style={summaryCardStyle}>
            <strong>Case</strong>
            <div>{selectedCase.case_number ?? "-"}</div>
          </div>

          <div style={summaryCardStyle}>
            <strong>Lado</strong>
            <div>{selectedCase.side || "-"}</div>
          </div>

          <div style={summaryCardStyle}>
            <strong>Status</strong>
            <div>{selectedCase.status || "-"}</div>
          </div>

          <div style={summaryCardStyle}>
            <strong>Outcome</strong>
            <div>{selectedCase.outcome || "-"}</div>
          </div>

          <div style={summaryCardStyle}>
            <strong>Trigger</strong>
            <div>{formatPrice(parseNumber(selectedCase.trigger_price))}</div>
          </div>

          <div style={summaryCardStyle}>
            <strong>Entrada</strong>
            <div>{formatPrice(parseNumber(selectedCase.entry_price))}</div>
          </div>

          <div style={summaryCardStyle}>
            <strong>Saída</strong>
            <div>{formatPrice(parseNumber(selectedCase.close_price))}</div>
          </div>

          <div style={summaryCardStyle}>
            <strong>Close reason</strong>
            <div>{selectedCase.close_reason || "-"}</div>
          </div>
        </div>

        <div style={timeBoxStyle}>
          <div>
            <strong>Trigger time:</strong> {formatDateTime(selectedCase.trigger_time)}
          </div>
          <div>
            <strong>Entry time:</strong> {formatDateTime(selectedCase.entry_time)}
          </div>
          <div>
            <strong>Close time:</strong> {formatDateTime(selectedCase.close_time)}
          </div>
        </div>

        {loading && <div style={infoStyle}>A carregar candles do período do trade...</div>}
        {error && <div style={errorStyle}>{error}</div>}

        <div
          style={{
            position: "relative",
            width: "100%",
            height: CHART_HEIGHT,
            border: "1px solid #dbe2ea",
            borderRadius: 16,
            background: "#fff",
            overflow: "hidden",
            marginTop: 16,
          }}
        >
          <div
            ref={chartContainerRef}
            style={{
              width: "100%",
              height: "100%",
            }}
          />

          {markerPositions.map((marker) => {
            const connectorHeight = Math.max(
              12,
              Math.abs(marker.pointTop - marker.labelTop) - 10
            );
            const connectorTop =
              marker.lane === "top" ? marker.labelTop + 18 : marker.pointTop + 8;

            return (
              <div
                key={marker.id}
                title={`${marker.label} | ${formatPrice(marker.price)} | ${formatDateTime(
                  marker.time
                )}`}
                style={{
                  position: "absolute",
                  inset: 0,
                  pointerEvents: "none",
                  zIndex: 10,
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    left: marker.left,
                    top: marker.pointTop,
                    transform: "translate(-50%, -50%)",
                    width: 12,
                    height: 12,
                    borderRadius: 999,
                    background: marker.color,
                    border: "2px solid #ffffff",
                    boxShadow: "0 0 0 1px rgba(15,23,42,0.18)",
                  }}
                />

                <div
                  style={{
                    position: "absolute",
                    left: marker.left,
                    top: connectorTop,
                    transform: "translateX(-50%)",
                    width: 2,
                    height: connectorHeight,
                    background: marker.color,
                    opacity: 0.6,
                  }}
                />

                <div
                  style={{
                    position: "absolute",
                    left: marker.labelLeft,
                    top: marker.labelTop,
                    transform: "translateX(-50%)",
                    padding: "3px 8px",
                    borderRadius: 999,
                    background: "#0f172a",
                    color: "#fff",
                    fontSize: 11,
                    whiteSpace: "nowrap",
                    boxShadow: "0 2px 8px rgba(15,23,42,0.15)",
                    pointerEvents: "auto",
                  }}
                >
                  {marker.shortLabel}
                </div>
              </div>
            );
          })}
        </div>

        <div style={legendStyle}>
          <span style={{ ...legendBadgeStyle, background: "#2563eb" }}>EMA 9</span>
          <span style={{ ...legendBadgeStyle, background: "#7c3aed" }}>EMA 21</span>
          <span style={{ ...legendBadgeStyle, background: "#7c3aed" }}>Cruzamento</span>
          <span style={{ ...legendBadgeStyle, background: "#16a34a" }}>Entrada</span>
          <span style={{ ...legendBadgeStyle, background: "#dc2626" }}>Saída</span>
          <span style={{ ...legendBadgeStyle, background: "#0ea5e9" }}>Trigger</span>
          <span style={{ ...legendBadgeStyle, background: "#10b981" }}>Target</span>
          <span style={{ ...legendBadgeStyle, background: "#f97316" }}>Invalidação</span>
        </div>
      </div>
    </div>
  );
}

const overlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.60)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 10000,
  padding: 24,
};

const modalStyle: CSSProperties = {
  width: "100%",
  maxWidth: 1320,
  maxHeight: "94vh",
  overflow: "auto",
  background: "#0f172a",
  color: "#e5e7eb",
  borderRadius: 20,
  padding: 20,
  boxSizing: "border-box",
};

const headerStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  marginBottom: 16,
};

const closeButtonStyle: CSSProperties = {
  height: 40,
  padding: "0 16px",
  borderRadius: 10,
  border: "1px solid #334155",
  background: "#0f172a",
  color: "#e5e7eb",
  cursor: "pointer",
};

const summaryGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 12,
};

const summaryCardStyle: CSSProperties = {
  padding: 12,
  borderRadius: 12,
  background: "#111827",
  border: "1px solid #1f2937",
  display: "grid",
  gap: 6,
};

const timeBoxStyle: CSSProperties = {
  marginTop: 12,
  padding: 12,
  borderRadius: 12,
  background: "#0b1220",
  border: "1px solid #1e293b",
  display: "grid",
  gap: 6,
};

const infoStyle: CSSProperties = {
  marginTop: 12,
  padding: 12,
  borderRadius: 12,
  background: "#111827",
  border: "1px solid #1f2937",
  color: "#cbd5e1",
};

const errorStyle: CSSProperties = {
  marginTop: 12,
  padding: 12,
  borderRadius: 12,
  background: "#450a0a",
  border: "1px solid #7f1d1d",
  color: "#fecaca",
};

const legendStyle: CSSProperties = {
  marginTop: 14,
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};

const legendBadgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "6px 10px",
  borderRadius: 999,
  color: "#fff",
  fontSize: 12,
  fontWeight: 700,
};