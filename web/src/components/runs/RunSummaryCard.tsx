// web/src/components/runs/RunSummaryCard.tsx

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

function formatPrice(value: unknown): string {
  const numberValue = toNumber(value);
  if (numberValue === null) return "-";
  return numberValue.toFixed(5);
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

function buildOutcomeLists(cases: OutcomeLikeCase[]) {
  const hits = cases.filter(
    (item) => String(item.outcome ?? "").trim().toLowerCase() === "hit"
  );

  const fails = cases.filter(
    (item) => String(item.outcome ?? "").trim().toLowerCase() === "fail"
  );

  const sortByTimeDesc = (a: OutcomeLikeCase, b: OutcomeLikeCase) => {
    const aTime = new Date(a.close_time ?? a.entry_time ?? a.trigger_time ?? 0).getTime();
    const bTime = new Date(b.close_time ?? b.entry_time ?? b.trigger_time ?? 0).getTime();
    return bTime - aTime;
  };

  return {
    hits: [...hits].sort(sortByTimeDesc),
    fails: [...fails].sort(sortByTimeDesc),
  };
}

function getTradeSideLabel(item: OutcomeLikeCase): string {
  const metadataTradeBias =
    typeof item.metadata === "object" &&
    item.metadata !== null &&
    "trade_bias" in item.metadata
      ? String((item.metadata as Record<string, unknown>).trade_bias ?? "")
          .trim()
          .toLowerCase()
      : "";

  const rawSide = String(item.side ?? "").trim().toLowerCase();

  const resolved = metadataTradeBias || rawSide;

  if (resolved === "long" || resolved === "buy" || resolved === "compra") {
    return "Compra";
  }

  if (resolved === "short" || resolved === "sell" || resolved === "venda") {
    return "Venda";
  }

  return "-";
}

function outcomeListCard(
  title: string,
  items: OutcomeLikeCase[],
  accentColor: string
) {
  return (
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
          marginBottom: 12,
        }}
      >
        {title}
      </div>

      {items.length === 0 && (
        <p style={{ margin: 0, color: "#64748b", fontSize: 14 }}>
          Nenhum registo nesta categoria.
        </p>
      )}

      {items.length > 0 && (
        <div style={{ display: "grid", gap: 10 }}>
          {items.map((item) => (
            <div
              key={item.id}
              style={{
                border: "1px solid #e2e8f0",
                borderLeft: `4px solid ${accentColor}`,
                borderRadius: 12,
                padding: 12,
                background: "#f8fafc",
                fontSize: 14,
                color: "#334155",
                lineHeight: 1.6,
              }}
            >
              <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>
                {item.id}
              </div>
              <div>
                <strong>Lado:</strong> {getTradeSideLabel(item)}
              </div>
              <div>
                <strong>Trigger:</strong> {formatDateTime(item.trigger_time ?? null)}
              </div>
              <div>
                <strong>Fechamento:</strong> {formatDateTime(item.close_time ?? null)}
              </div>
              <div>
                <strong>Entrada:</strong> {formatPrice(item.entry_price)}
              </div>
              <div>
                <strong>Saída:</strong> {formatPrice(item.close_price)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RunSummaryCard({
  mainCardStyle,
  selectedRunId,
  loadingRunDetails,
  runDetailsError,
  runDetails,
}: RunSummaryCardProps) {
  const summary = runDetails ? buildSummary(runDetails) : null;
  const outcomeLists = runDetails
    ? buildOutcomeLists((runDetails.cases ?? []) as OutcomeLikeCase[])
    : { hits: [], fails: [] };

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
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: 16,
            }}
          >
            {outcomeListCard("Lista de Hits", outcomeLists.hits, "#16a34a")}
            {outcomeListCard("Lista de Fails", outcomeLists.fails, "#dc2626")}
          </div>
        </div>
      )}
    </div>
  );
}

export default RunSummaryCard;