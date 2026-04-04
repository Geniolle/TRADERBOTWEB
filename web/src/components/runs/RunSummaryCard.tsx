// web/src/components/runs/RunSummaryCard.tsx

import { API_WS_BASE_URL } from "../../constants/config";
import type { CandleTickState, RunDetailsResponse } from "../../types/trading";
import { formatDateTime } from "../../utils/format";

type RunSummaryCardProps = {
  mainCardStyle: React.CSSProperties;
  selectedRunId: string;
  loadingRunDetails: boolean;
  runDetailsError: string;
  runDetails: RunDetailsResponse | null;
  wsStatus: string;
  lastWsEvent: string;
  heartbeatCount: number | null;
  heartbeatMessage: string;
  candlesRefreshCount: number | null;
  candlesRefreshReason: string;
  lastCandleTick: CandleTickState;
};

type OutcomeLikeCase = RunDetailsResponse["cases"][number] & {
  outcome?: string | null;
};

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "-";
  return `${value.toFixed(2)}%`;
}

function readMetricNumber(metrics: unknown, key: string): number | null {
  if (!metrics || typeof metrics !== "object") return null;
  const raw = (metrics as Record<string, unknown>)[key];
  return toNumber(raw);
}

function countCasesByOutcome(cases: OutcomeLikeCase[]) {
  let hits = 0;
  let fails = 0;
  let timeouts = 0;

  for (const item of cases) {
    const outcome = String(item.outcome ?? "")
      .trim()
      .toLowerCase();

    if (outcome === "hit") {
      hits += 1;
      continue;
    }

    if (outcome === "fail") {
      fails += 1;
      continue;
    }

    if (outcome === "timeout") {
      timeouts += 1;
    }
  }

  return { hits, fails, timeouts };
}

function buildSummary(runDetails: RunDetailsResponse) {
  const cases = (runDetails.cases ?? []) as OutcomeLikeCase[];
  const metrics = runDetails.metrics;

  const fallbackCounts = countCasesByOutcome(cases);

  const totalCases =
    readMetricNumber(metrics, "total_cases") ??
    readMetricNumber(metrics, "cases_count") ??
    cases.length;

  const totalHits =
    readMetricNumber(metrics, "total_hits") ?? fallbackCounts.hits;

  const totalFails =
    readMetricNumber(metrics, "total_fails") ?? fallbackCounts.fails;

  const totalTimeouts =
    readMetricNumber(metrics, "total_timeouts") ?? fallbackCounts.timeouts;

  const computedHitRate =
    totalCases > 0 ? (totalHits / totalCases) * 100 : 0;
  const computedFailRate =
    totalCases > 0 ? (totalFails / totalCases) * 100 : 0;
  const computedTimeoutRate =
    totalCases > 0 ? (totalTimeouts / totalCases) * 100 : 0;

  const hitRate =
    readMetricNumber(metrics, "hit_rate") ?? computedHitRate;

  const failRate =
    readMetricNumber(metrics, "fail_rate") ?? computedFailRate;

  const timeoutRate =
    readMetricNumber(metrics, "timeout_rate") ?? computedTimeoutRate;

  return {
    totalCases,
    totalHits,
    totalFails,
    totalTimeouts,
    hitRate,
    failRate,
    timeoutRate,
  };
}

function summaryMetricCard(
  label: string,
  value: string | number,
  accent?: React.CSSProperties["borderTop"]
) {
  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        padding: 14,
        background: "#f8fafc",
        borderTop: accent ?? "4px solid #cbd5e1",
      }}
    >
      <div
        style={{
          fontSize: 13,
          color: "#64748b",
          marginBottom: 6,
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 24,
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

function RunSummaryCard({
  mainCardStyle,
  selectedRunId,
  loadingRunDetails,
  runDetailsError,
  runDetails,
  wsStatus,
  lastWsEvent,
  heartbeatCount,
  heartbeatMessage,
  candlesRefreshCount,
  candlesRefreshReason,
  lastCandleTick,
}: RunSummaryCardProps) {
  const summary = runDetails ? buildSummary(runDetails) : null;

  return (
    <div style={mainCardStyle}>
      <h2
        style={{
          marginTop: 0,
          marginBottom: 20,
          textAlign: "center",
          fontSize: 24,
          fontWeight: 700,
          color: "#0f172a",
        }}
      >
        Análise do run selecionado
      </h2>

      {!selectedRunId && <p>Nenhum run selecionado.</p>}

      {selectedRunId && loadingRunDetails && <p>A carregar detalhes do run...</p>}

      {selectedRunId && !loadingRunDetails && runDetailsError && (
        <div>
          <p style={{ color: "#dc2626", fontWeight: "bold" }}>
            Erro ao carregar detalhes do run
          </p>
          <p>{runDetailsError}</p>
        </div>
      )}

      {selectedRunId && !loadingRunDetails && !runDetailsError && runDetails && summary && (
        <div style={{ display: "grid", gap: 20 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 14,
              fontSize: 15,
              color: "#334155",
            }}
          >
            <div>
              <strong>ID:</strong> {runDetails.run.id}
            </div>
            <div>
              <strong>Strategy:</strong>{" "}
              {runDetails.run.strategy_key ?? "(sem strategy_key)"}
            </div>
            <div>
              <strong>Symbol:</strong> {runDetails.run.symbol}
            </div>
            <div>
              <strong>Timeframe:</strong> {runDetails.run.timeframe}
            </div>
            <div>
              <strong>Status:</strong> {runDetails.run.status}
            </div>
            <div>
              <strong>Mode:</strong> {runDetails.run.mode}
            </div>
            <div>
              <strong>Start:</strong> {formatDateTime(runDetails.run.start_at)}
            </div>
            <div>
              <strong>End:</strong> {formatDateTime(runDetails.run.end_at)}
            </div>
          </div>

          <div
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: 14,
              padding: 16,
              background: "#ffffff",
            }}
          >
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: "#0f172a",
                marginBottom: 8,
              }}
            >
              Resumo do intervalo analisado
            </div>

            <div
              style={{
                fontSize: 14,
                color: "#475569",
                lineHeight: 1.7,
                marginBottom: 16,
              }}
            >
              <div>
                <strong>Intervalo:</strong>{" "}
                {formatDateTime(runDetails.run.start_at)} →{" "}
                {formatDateTime(runDetails.run.end_at)}
              </div>
              <div>
                <strong>Candles analisados:</strong>{" "}
                {runDetails.run.candles_count ?? "-"}
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 12,
              }}
            >
              {summaryMetricCard("Total de Cases", summary.totalCases, "4px solid #94a3b8")}
              {summaryMetricCard("Hits", summary.totalHits, "4px solid #16a34a")}
              {summaryMetricCard("Fails", summary.totalFails, "4px solid #dc2626")}
              {summaryMetricCard("Timeouts", summary.totalTimeouts, "4px solid #f59e0b")}
              {summaryMetricCard("Hit Rate", formatPercent(summary.hitRate), "4px solid #16a34a")}
              {summaryMetricCard("Fail Rate", formatPercent(summary.failRate), "4px solid #dc2626")}
              {summaryMetricCard(
                "Timeout Rate",
                formatPercent(summary.timeoutRate),
                "4px solid #f59e0b"
              )}
            </div>
          </div>

          <div
            style={{
              textAlign: "center",
              fontSize: 14,
              color: "#475569",
              lineHeight: 1.7,
              paddingTop: 4,
              borderTop: "1px solid #e2e8f0",
            }}
          >
            <div>
              <strong>Atualização:</strong> candle_tick direto
            </div>
            <div>
              <strong>WS:</strong> {API_WS_BASE_URL}
            </div>
            <div>
              <strong>WS status:</strong> {wsStatus}
            </div>
            <div>
              <strong>Último evento WS:</strong> {lastWsEvent}
            </div>
            <div>
              <strong>Heartbeat count:</strong> {heartbeatCount ?? "-"}
            </div>
            <div>
              <strong>Heartbeat message:</strong> {heartbeatMessage}
            </div>
            <div>
              <strong>Candles refresh count:</strong> {candlesRefreshCount ?? "-"}
            </div>
            <div>
              <strong>Candles refresh reason:</strong> {candlesRefreshReason}
            </div>
            <div>
              <strong>Último candle tick:</strong>{" "}
              {lastCandleTick ? formatDateTime(lastCandleTick.open_time) : "-"}
            </div>
            <div>
              <strong>Tick símbolo:</strong> {lastCandleTick?.symbol ?? "-"}
              <span style={{ margin: "0 2px" }}>•</span>
              <strong>Tick timeframe:</strong> {lastCandleTick?.timeframe ?? "-"}
            </div>
            <div>
              <strong>Tick OHLC:</strong>{" "}
              {lastCandleTick
                ? `${Number(lastCandleTick.open).toFixed(5)} / ${Number(
                    lastCandleTick.high
                  ).toFixed(5)} / ${Number(lastCandleTick.low).toFixed(5)} / ${Number(
                    lastCandleTick.close
                  ).toFixed(5)}`
                : "-"}
            </div>
            <div>
              <strong>Tick count:</strong> {lastCandleTick?.count ?? "-"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RunSummaryCard;