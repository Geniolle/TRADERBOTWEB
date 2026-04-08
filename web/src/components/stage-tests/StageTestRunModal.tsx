// C:\TraderBotWeb\web\src\components\stage-tests\StageTestRunModal.tsx
// Backend:
// - GET  /api/v1/stage-tests/options
// - POST /api/v1/stage-tests/run

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  fetchStageTestOptions,
  runStageTest,
} from "../../services/stageTestsApi";
import type {
  StageTestOptionItem,
  StageTestRunResponse,
  StageTestStrategyOption,
} from "../../types/stageTests";

type Props = {
  open: boolean;
  onClose: () => void;
};

const REFRESH_MS = 15000;

function fmtPct(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "-";
  return `${value.toFixed(2)}%`;
}

export default function StageTestRunModal({ open, onClose }: Props) {
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [running, setRunning] = useState(false);

  const [items, setItems] = useState<StageTestOptionItem[]>([]);
  const [strategies, setStrategies] = useState<StageTestStrategyOption[]>([]);
  const [refreshedAt, setRefreshedAt] = useState<string>("");

  const [error, setError] = useState<string>("");
  const [runResult, setRunResult] = useState<StageTestRunResponse | null>(null);

  const [symbol, setSymbol] = useState("");
  const [timeframe, setTimeframe] = useState("");
  const [strategy, setStrategy] = useState("");
  const [minCandles, setMinCandles] = useState<number>(1);
  const [extraArgsText, setExtraArgsText] = useState("");

  async function loadOptions() {
    try {
      setLoadingOptions(true);
      setError("");

      const data = await fetchStageTestOptions(minCandles);

      setItems(data.items);
      setStrategies(data.strategies);
      setRefreshedAt(data.refreshed_at);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar opções");
    } finally {
      setLoadingOptions(false);
    }
  }

  useEffect(() => {
    if (!open) return;

    void loadOptions();

    const timer = window.setInterval(() => {
      void loadOptions();
    }, REFRESH_MS);

    return () => window.clearInterval(timer);
  }, [open, minCandles]);

  const symbols = useMemo(() => {
    return Array.from(new Set(items.map((item) => item.symbol))).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [items]);

  useEffect(() => {
    if (!open) return;

    if (!symbols.length) {
      setSymbol("");
      return;
    }

    if (!symbol || !symbols.includes(symbol)) {
      setSymbol(symbols[0]);
    }
  }, [open, symbols, symbol]);

  const timeframesForSelectedSymbol = useMemo(() => {
    return items
      .filter((item) => item.symbol === symbol)
      .map((item) => item.timeframe)
      .sort((a, b) => a.localeCompare(b));
  }, [items, symbol]);

  useEffect(() => {
    if (!open) return;

    if (!timeframesForSelectedSymbol.length) {
      setTimeframe("");
      return;
    }

    if (!timeframe || !timeframesForSelectedSymbol.includes(timeframe)) {
      setTimeframe(timeframesForSelectedSymbol[0]);
    }
  }, [open, timeframesForSelectedSymbol, timeframe]);

  useEffect(() => {
    if (!open) return;

    if (!strategies.length) {
      setStrategy("");
      return;
    }

    const strategyExists = strategies.some((item) => item.key === strategy);

    if (!strategy || !strategyExists) {
      setStrategy(strategies[0].key);
    }
  }, [open, strategies, strategy]);

  const selectedItem = useMemo(() => {
    return items.find(
      (item) => item.symbol === symbol && item.timeframe === timeframe
    );
  }, [items, symbol, timeframe]);

  const selectedStrategy = useMemo(() => {
    return strategies.find((item) => item.key === strategy) ?? null;
  }, [strategies, strategy]);

  async function handleRun() {
    if (!symbol || !timeframe || !strategy) return;

    try {
      setRunning(true);
      setError("");
      setRunResult(null);

      const extraArgs = extraArgsText
        .split(" ")
        .map((part) => part.trim())
        .filter(Boolean);

      const result = await runStageTest({
        symbol,
        timeframe,
        strategy,
        min_candles: minCandles,
        extra_args: extraArgs,
      });

      setRunResult(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao executar stage test"
      );
    } finally {
      setRunning(false);
    }
  }

  if (!open) return null;

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={headerStyle}>
          <h2 style={{ margin: 0 }}>Run Stage Testes</h2>
          <button onClick={onClose} style={closeButtonStyle}>
            Fechar
          </button>
        </div>

        <div style={gridStyle}>
          <label style={fieldStyle}>
            <span>Símbolo</span>
            <select
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              style={inputStyle}
            >
              {symbols.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label style={fieldStyle}>
            <span>Timeframe</span>
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              style={inputStyle}
            >
              {timeframesForSelectedSymbol.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label style={fieldStyle}>
            <span>Estratégia</span>
            <select
              value={strategy}
              onChange={(e) => setStrategy(e.target.value)}
              style={inputStyle}
            >
              {strategies.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label style={fieldStyle}>
            <span>Mínimo de candles</span>
            <input
              type="number"
              min={1}
              value={minCandles}
              onChange={(e) => setMinCandles(Number(e.target.value || 1))}
              style={inputStyle}
            />
          </label>
        </div>

        <label style={{ ...fieldStyle, marginTop: 12 }}>
          <span>Extra args</span>
          <input
            value={extraArgsText}
            onChange={(e) => setExtraArgsText(e.target.value)}
            style={inputStyle}
            placeholder="--rsi_period 14 --target_percent 0.15"
          />
        </label>

        <div style={infoBoxStyle}>
          <div>
            <strong>Atualizado:</strong>{" "}
            {refreshedAt ? new Date(refreshedAt).toLocaleString("pt-PT") : "-"}
          </div>
          <div>
            <strong>Total de combinações:</strong> {items.length}
          </div>
          <div>
            <strong>Total de estratégias:</strong> {strategies.length}
          </div>
          <div>
            <strong>Carregando:</strong> {loadingOptions ? "Sim" : "Não"}
          </div>
        </div>

        {selectedStrategy && (
          <div style={summaryBoxStyle}>
            <div>
              <strong>Estratégia:</strong> {selectedStrategy.label}
            </div>
            <div>
              <strong>Key:</strong> {selectedStrategy.key}
            </div>
            <div>
              <strong>Descrição:</strong> {selectedStrategy.description || "-"}
            </div>
          </div>
        )}

        {selectedItem && (
          <div style={summaryBoxStyle}>
            <div>
              <strong>Combinação:</strong> {selectedItem.symbol} /{" "}
              {selectedItem.timeframe}
            </div>
            <div>
              <strong>Candles:</strong> {selectedItem.candles_count}
            </div>
            <div>
              <strong>Primeiro:</strong> {selectedItem.first_candle || "-"}
            </div>
            <div>
              <strong>Último:</strong> {selectedItem.last_candle || "-"}
            </div>
          </div>
        )}

        {error && <div style={errorStyle}>{error}</div>}

        <div style={actionsStyle}>
          <button onClick={() => void loadOptions()} style={secondaryButtonStyle}>
            Atualizar lista
          </button>

          <button
            onClick={() => void handleRun()}
            disabled={running || !symbol || !timeframe || !strategy}
            style={primaryButtonStyle}
          >
            {running ? "A executar..." : "Run"}
          </button>
        </div>

        <div style={resultBoxStyle}>
          <h3 style={{ marginTop: 0 }}>Resultado</h3>
          {!runResult && <div>Nenhum run executado nesta sessão.</div>}

          {runResult && (
            <>
              <div>
                <strong>Status:</strong> {runResult.ok ? "OK" : "ERRO"}
              </div>
              <div>
                <strong>Command:</strong> {runResult.command.join(" ")}
              </div>
              <div>
                <strong>Return code:</strong> {runResult.return_code}
              </div>

              {runResult.metrics && (
                <div style={metricsBoxStyle}>
                  <div>
                    <strong>Strategy class:</strong>{" "}
                    {runResult.metrics.strategy_class}
                  </div>
                  <div>
                    <strong>Runtime strategy:</strong>{" "}
                    {runResult.metrics.runtime_strategy}
                  </div>
                  <div>
                    <strong>Total candles:</strong>{" "}
                    {runResult.metrics.total_candles}
                  </div>
                  <div>
                    <strong>Warmup:</strong> {runResult.metrics.warmup}
                  </div>
                  <div>
                    <strong>Triggers:</strong> {runResult.metrics.triggers}
                  </div>
                  <div>
                    <strong>Closed cases:</strong>{" "}
                    {runResult.metrics.closed_cases}
                  </div>
                  <div>
                    <strong>Hits:</strong> {runResult.metrics.hits}
                  </div>
                  <div>
                    <strong>Fails:</strong> {runResult.metrics.fails}
                  </div>
                  <div>
                    <strong>Timeouts:</strong> {runResult.metrics.timeouts}
                  </div>
                  <div>
                    <strong>Hit rate:</strong>{" "}
                    {fmtPct(runResult.metrics.hit_rate)}
                  </div>
                  <div>
                    <strong>Fail rate:</strong>{" "}
                    {fmtPct(runResult.metrics.fail_rate)}
                  </div>
                  <div>
                    <strong>Timeout rate:</strong>{" "}
                    {fmtPct(runResult.metrics.timeout_rate)}
                  </div>
                  <div>
                    <strong>Primeiro candle:</strong>{" "}
                    {runResult.metrics.first_candle || "-"}
                  </div>
                  <div>
                    <strong>Último candle:</strong>{" "}
                    {runResult.metrics.last_candle || "-"}
                  </div>
                </div>
              )}

              <div style={{ marginTop: 12 }}>
                <strong>STDOUT</strong>
                <pre style={preStyle}>{runResult.stdout || "(vazio)"}</pre>
              </div>

              <div style={{ marginTop: 12 }}>
                <strong>STDERR</strong>
                <pre style={preStyle}>{runResult.stderr || "(vazio)"}</pre>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const overlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.55)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 9999,
  padding: 24,
};

const modalStyle: CSSProperties = {
  width: "100%",
  maxWidth: 960,
  maxHeight: "90vh",
  overflow: "auto",
  background: "#0f172a",
  color: "#e5e7eb",
  borderRadius: 16,
  padding: 20,
  boxSizing: "border-box",
};

const headerStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 16,
};

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 12,
};

const fieldStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const inputStyle: CSSProperties = {
  height: 40,
  borderRadius: 10,
  border: "1px solid #334155",
  background: "#111827",
  color: "#e5e7eb",
  padding: "0 12px",
};

const infoBoxStyle: CSSProperties = {
  marginTop: 12,
  padding: 12,
  borderRadius: 12,
  background: "#111827",
  border: "1px solid #1f2937",
  display: "grid",
  gap: 6,
};

const summaryBoxStyle: CSSProperties = {
  marginTop: 12,
  padding: 12,
  borderRadius: 12,
  background: "#0b1220",
  border: "1px solid #1e293b",
  display: "grid",
  gap: 6,
};

const metricsBoxStyle: CSSProperties = {
  marginTop: 12,
  padding: 12,
  borderRadius: 12,
  background: "#0b1220",
  border: "1px solid #1e293b",
  display: "grid",
  gap: 6,
};

const actionsStyle: CSSProperties = {
  marginTop: 16,
  display: "flex",
  justifyContent: "flex-end",
  gap: 12,
};

const primaryButtonStyle: CSSProperties = {
  height: 40,
  padding: "0 16px",
  borderRadius: 10,
  border: "none",
  background: "#2563eb",
  color: "#fff",
  cursor: "pointer",
};

const secondaryButtonStyle: CSSProperties = {
  height: 40,
  padding: "0 16px",
  borderRadius: 10,
  border: "1px solid #334155",
  background: "#0f172a",
  color: "#e5e7eb",
  cursor: "pointer",
};

const closeButtonStyle: CSSProperties = {
  ...secondaryButtonStyle,
};

const errorStyle: CSSProperties = {
  marginTop: 12,
  padding: 12,
  borderRadius: 12,
  background: "#450a0a",
  border: "1px solid #7f1d1d",
  color: "#fecaca",
};

const resultBoxStyle: CSSProperties = {
  marginTop: 18,
  padding: 12,
  borderRadius: 12,
  background: "#111827",
  border: "1px solid #1f2937",
};

const preStyle: CSSProperties = {
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  padding: 12,
  borderRadius: 10,
  background: "#020617",
  border: "1px solid #1e293b",
  maxHeight: 240,
  overflow: "auto",
};