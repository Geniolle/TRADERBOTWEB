import { useEffect, useState } from "react";

type HealthResponse = {
  status: string;
  app_name: string;
  environment: string;
};

type StrategyItem = {
  key: string;
  name: string;
  version: string;
  description: string;
  category: string;
};

type RunHistoryItem = {
  id: string;
  strategy_key: string | null;
  strategy_config_id: string;
  mode: string;
  asset_id: string | null;
  symbol: string;
  timeframe: string;
  start_at: string;
  end_at: string;
  status: string;
  total_candles_processed: number;
  total_cases_opened: number;
  total_cases_closed: number;
  started_at: string | null;
  finished_at: string | null;
};

type RunDetailsMetrics = {
  run_id: string;
  total_cases: number;
  total_hits: number;
  total_fails: number;
  total_timeouts: number;
  hit_rate: string;
  fail_rate: string;
  timeout_rate: string;
  avg_bars_to_resolution: string;
  avg_time_to_resolution_seconds: string;
  avg_mfe: string;
  avg_mae: string;
} | null;

type RunDetailsCase = {
  id: string;
  run_id: string;
  strategy_config_id: string;
  asset_id: string | null;
  symbol: string;
  timeframe: string;
  trigger_time: string;
  trigger_candle_time: string;
  entry_time: string;
  entry_price: string;
  target_price: string;
  invalidation_price: string;
  timeout_at: string | null;
  status: string;
  outcome: string | null;
  close_time: string | null;
  close_price: string | null;
  bars_to_resolution: number;
  max_favorable_excursion: string;
  max_adverse_excursion: string;
  metadata: Record<string, unknown>;
};

type RunDetailsResponse = {
  run: RunHistoryItem;
  metrics: RunDetailsMetrics;
  cases: RunDetailsCase[];
};

type CandleItem = {
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
};

function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [strategies, setStrategies] = useState<StrategyItem[]>([]);
  const [runs, setRuns] = useState<RunHistoryItem[]>([]);

  const [selectedRunId, setSelectedRunId] = useState<string>("");
  const [runDetails, setRunDetails] = useState<RunDetailsResponse | null>(null);
  const [candles, setCandles] = useState<CandleItem[]>([]);

  const [loadingHealth, setLoadingHealth] = useState(true);
  const [loadingStrategies, setLoadingStrategies] = useState(true);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [loadingRunDetails, setLoadingRunDetails] = useState(false);
  const [loadingCandles, setLoadingCandles] = useState(false);

  const [healthError, setHealthError] = useState("");
  const [strategiesError, setStrategiesError] = useState("");
  const [runsError, setRunsError] = useState("");
  const [runDetailsError, setRunDetailsError] = useState("");
  const [candlesError, setCandlesError] = useState("");

  useEffect(() => {
    const loadHealth = async () => {
      try {
        setLoadingHealth(true);
        setHealthError("");

        const response = await fetch("http://127.0.0.1:8000/api/v1/health");
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data: HealthResponse = await response.json();
        setHealth(data);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Erro desconhecido ao ligar à API";
        setHealthError(message);
      } finally {
        setLoadingHealth(false);
      }
    };

    const loadStrategies = async () => {
      try {
        setLoadingStrategies(true);
        setStrategiesError("");

        const response = await fetch("http://127.0.0.1:8000/api/v1/strategies");
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data: StrategyItem[] = await response.json();
        setStrategies(data);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Erro desconhecido ao carregar estratégias";
        setStrategiesError(message);
      } finally {
        setLoadingStrategies(false);
      }
    };

    const loadRuns = async () => {
      try {
        setLoadingRuns(true);
        setRunsError("");

        const response = await fetch(
          "http://127.0.0.1:8000/api/v1/run-history?limit=10"
        );
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data: RunHistoryItem[] = await response.json();
        setRuns(data);

        if (data.length > 0) {
          const preferredRun =
            data.find((item) => item.strategy_key && item.strategy_key.trim() !== "") ??
            data[0];

          setSelectedRunId(preferredRun.id);
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Erro desconhecido ao carregar histórico";
        setRunsError(message);
      } finally {
        setLoadingRuns(false);
      }
    };

    loadHealth();
    loadStrategies();
    loadRuns();
  }, []);

  useEffect(() => {
    const loadRunDetails = async () => {
      if (!selectedRunId) {
        setRunDetails(null);
        return;
      }

      try {
        setLoadingRunDetails(true);
        setRunDetailsError("");

        const response = await fetch(
          `http://127.0.0.1:8000/api/v1/run-details/${selectedRunId}`
        );
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data: RunDetailsResponse = await response.json();
        setRunDetails(data);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Erro desconhecido ao carregar detalhes do run";
        setRunDetailsError(message);
      } finally {
        setLoadingRunDetails(false);
      }
    };

    loadRunDetails();
  }, [selectedRunId]);

  useEffect(() => {
    const loadCandles = async () => {
      if (!runDetails?.run) {
        setCandles([]);
        return;
      }

      try {
        setLoadingCandles(true);
        setCandlesError("");

        const params = new URLSearchParams({
          symbol: runDetails.run.symbol,
          timeframe: runDetails.run.timeframe,
          start_at: runDetails.run.start_at,
          end_at: runDetails.run.end_at,
          limit: "500",
        });

        const response = await fetch(
          `http://127.0.0.1:8000/api/v1/candles?${params.toString()}`
        );
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data: CandleItem[] = await response.json();
        setCandles(data);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Erro desconhecido ao carregar candles";
        setCandlesError(message);
      } finally {
        setLoadingCandles(false);
      }
    };

    loadCandles();
  }, [runDetails]);

  return (
    <div style={{ padding: 24, fontFamily: "Arial, sans-serif" }}>
      <h1>Trader Bot Dashboard</h1>
      <p>Frontend online com sucesso.</p>
      <p>Próximo passo: carregar candles do run selecionado.</p>

      <hr style={{ margin: "24px 0" }} />

      <h2>Teste de ligação à API</h2>

      {loadingHealth && <p>A carregar healthcheck...</p>}

      {!loadingHealth && healthError && (
        <div>
          <p style={{ color: "red", fontWeight: "bold" }}>Erro ao ligar à API</p>
          <p>{healthError}</p>
        </div>
      )}

      {!loadingHealth && !healthError && health && (
        <div>
          <p><strong>Status:</strong> {health.status}</p>
          <p><strong>App:</strong> {health.app_name}</p>
          <p><strong>Environment:</strong> {health.environment}</p>
        </div>
      )}

      <hr style={{ margin: "24px 0" }} />

      <h2>Estratégias disponíveis</h2>

      {loadingStrategies && <p>A carregar estratégias...</p>}

      {!loadingStrategies && strategiesError && (
        <div>
          <p style={{ color: "red", fontWeight: "bold" }}>
            Erro ao carregar estratégias
          </p>
          <p>{strategiesError}</p>
        </div>
      )}

      {!loadingStrategies && !strategiesError && strategies.length === 0 && (
        <p>Nenhuma estratégia encontrada.</p>
      )}

      {!loadingStrategies && !strategiesError && strategies.length > 0 && (
        <div style={{ display: "grid", gap: 16 }}>
          {strategies.map((strategy) => (
            <div
              key={strategy.key}
              style={{
                border: "1px solid #ccc",
                borderRadius: 8,
                padding: 16,
              }}
            >
              <h3 style={{ marginTop: 0 }}>{strategy.name}</h3>
              <p><strong>Key:</strong> {strategy.key}</p>
              <p><strong>Version:</strong> {strategy.version}</p>
              <p><strong>Category:</strong> {strategy.category}</p>
              <p><strong>Description:</strong> {strategy.description}</p>
            </div>
          ))}
        </div>
      )}

      <hr style={{ margin: "24px 0" }} />

      <h2>Histórico de runs</h2>

      {loadingRuns && <p>A carregar histórico...</p>}

      {!loadingRuns && runsError && (
        <div>
          <p style={{ color: "red", fontWeight: "bold" }}>
            Erro ao carregar histórico
          </p>
          <p>{runsError}</p>
        </div>
      )}

      {!loadingRuns && !runsError && runs.length === 0 && (
        <p>Nenhum run encontrado.</p>
      )}

      {!loadingRuns && !runsError && runs.length > 0 && (
        <div style={{ display: "grid", gap: 16 }}>
          {runs.map((run) => (
            <button
              key={run.id}
              onClick={() => setSelectedRunId(run.id)}
              style={{
                textAlign: "left",
                border: selectedRunId === run.id ? "2px solid #333" : "1px solid #ccc",
                borderRadius: 8,
                padding: 16,
                background: selectedRunId === run.id ? "#f3f3f3" : "#fff",
                cursor: "pointer",
              }}
            >
              <h3 style={{ marginTop: 0 }}>{run.id}</h3>
              <p><strong>Strategy:</strong> {run.strategy_key ?? "(sem strategy_key)"}</p>
              <p><strong>Symbol:</strong> {run.symbol}</p>
              <p><strong>Timeframe:</strong> {run.timeframe}</p>
              <p><strong>Status:</strong> {run.status}</p>
              <p><strong>Candles:</strong> {run.total_candles_processed}</p>
              <p><strong>Cases Opened:</strong> {run.total_cases_opened}</p>
              <p><strong>Cases Closed:</strong> {run.total_cases_closed}</p>
            </button>
          ))}
        </div>
      )}

      <hr style={{ margin: "24px 0" }} />

      <h2>Detalhes do run selecionado</h2>

      {!selectedRunId && <p>Nenhum run selecionado.</p>}

      {selectedRunId && loadingRunDetails && <p>A carregar detalhes do run...</p>}

      {selectedRunId && !loadingRunDetails && runDetailsError && (
        <div>
          <p style={{ color: "red", fontWeight: "bold" }}>
            Erro ao carregar detalhes do run
          </p>
          <p>{runDetailsError}</p>
        </div>
      )}

      {selectedRunId && !loadingRunDetails && !runDetailsError && runDetails && (
        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ border: "1px solid #ccc", borderRadius: 8, padding: 16 }}>
            <h3 style={{ marginTop: 0 }}>Run</h3>
            <p><strong>ID:</strong> {runDetails.run.id}</p>
            <p><strong>Strategy:</strong> {runDetails.run.strategy_key ?? "(sem strategy_key)"}</p>
            <p><strong>Symbol:</strong> {runDetails.run.symbol}</p>
            <p><strong>Timeframe:</strong> {runDetails.run.timeframe}</p>
            <p><strong>Status:</strong> {runDetails.run.status}</p>
            <p><strong>Mode:</strong> {runDetails.run.mode}</p>
            <p><strong>Start:</strong> {runDetails.run.start_at}</p>
            <p><strong>End:</strong> {runDetails.run.end_at}</p>
          </div>

          <div style={{ border: "1px solid #ccc", borderRadius: 8, padding: 16 }}>
            <h3 style={{ marginTop: 0 }}>Métricas</h3>
            {!runDetails.metrics && <p>Sem métricas.</p>}
            {runDetails.metrics && (
              <>
                <p><strong>Total Cases:</strong> {runDetails.metrics.total_cases}</p>
                <p><strong>Total Hits:</strong> {runDetails.metrics.total_hits}</p>
                <p><strong>Total Fails:</strong> {runDetails.metrics.total_fails}</p>
                <p><strong>Total Timeouts:</strong> {runDetails.metrics.total_timeouts}</p>
                <p><strong>Hit Rate:</strong> {runDetails.metrics.hit_rate}</p>
                <p><strong>Fail Rate:</strong> {runDetails.metrics.fail_rate}</p>
                <p><strong>Timeout Rate:</strong> {runDetails.metrics.timeout_rate}</p>
                <p><strong>Avg Bars To Resolution:</strong> {runDetails.metrics.avg_bars_to_resolution}</p>
                <p><strong>Avg Time To Resolution Seconds:</strong> {runDetails.metrics.avg_time_to_resolution_seconds}</p>
                <p><strong>Avg MFE:</strong> {runDetails.metrics.avg_mfe}</p>
                <p><strong>Avg MAE:</strong> {runDetails.metrics.avg_mae}</p>
              </>
            )}
          </div>

          <div style={{ border: "1px solid #ccc", borderRadius: 8, padding: 16 }}>
            <h3 style={{ marginTop: 0 }}>Cases</h3>
            {runDetails.cases.length === 0 && <p>Sem cases neste run.</p>}
            {runDetails.cases.length > 0 && (
              <div style={{ display: "grid", gap: 12 }}>
                {runDetails.cases.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      border: "1px solid #ddd",
                      borderRadius: 8,
                      padding: 12,
                    }}
                  >
                    <p><strong>ID:</strong> {item.id}</p>
                    <p><strong>Status:</strong> {item.status}</p>
                    <p><strong>Outcome:</strong> {item.outcome ?? "-"}</p>
                    <p><strong>Entry Price:</strong> {item.entry_price}</p>
                    <p><strong>Target Price:</strong> {item.target_price}</p>
                    <p><strong>Invalidation Price:</strong> {item.invalidation_price}</p>
                    <p><strong>Trigger Time:</strong> {item.trigger_time}</p>
                    <p><strong>Close Time:</strong> {item.close_time ?? "-"}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ border: "1px solid #ccc", borderRadius: 8, padding: 16 }}>
            <h3 style={{ marginTop: 0 }}>Candles do run</h3>

            {loadingCandles && <p>A carregar candles...</p>}

            {!loadingCandles && candlesError && (
              <div>
                <p style={{ color: "red", fontWeight: "bold" }}>
                  Erro ao carregar candles
                </p>
                <p>{candlesError}</p>
              </div>
            )}

            {!loadingCandles && !candlesError && candles.length === 0 && (
              <p>Sem candles para este run.</p>
            )}

            {!loadingCandles && !candlesError && candles.length > 0 && (
              <>
                <p><strong>Total candles carregados:</strong> {candles.length}</p>
                <p>
                  <strong>Primeiro candle:</strong> {candles[0].open_time} | O: {candles[0].open} | H: {candles[0].high} | L: {candles[0].low} | C: {candles[0].close}
                </p>
                <p>
                  <strong>Último candle:</strong> {candles[candles.length - 1].open_time} | O: {candles[candles.length - 1].open} | H: {candles[candles.length - 1].high} | L: {candles[candles.length - 1].low} | C: {candles[candles.length - 1].close}
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;