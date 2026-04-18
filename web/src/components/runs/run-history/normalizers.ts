// C:\TraderBotWeb\web\src\components\runs\run-history\normalizers.ts

export function normalizeOutcome(value: string | null | undefined): string {
  const raw = (value ?? "").trim().toLowerCase();

  if (["hit", "win", "target", "target_hit", "tp", "profit"].includes(raw)) {
    return "hit";
  }

  if (["fail", "loss", "stop", "stop_loss", "sl"].includes(raw)) {
    return "fail";
  }

  if (["timeout", "expired", "time_out"].includes(raw)) {
    return "timeout";
  }

  return raw || "other";
}

export function normalizeDisplayText(value: string | null | undefined): string {
  const raw = (value ?? "").trim();
  if (!raw) return "-";

  const normalized = raw.toLowerCase();

  const map: Record<string, string> = {
    buy: "Compradora",
    sell: "Vendedora",
    long: "Compradora",
    short: "Vendedora",
    bullish: "Altista",
    bearish: "Baixista",
    mixed: "Misto",
    neutral: "Neutra",
    oversold: "Sobrevendida",
    overbought: "Sobrecomprada",
    above: "Acima",
    below: "Abaixo",
    touching: "Encostado",
    asia: "Ásia",
    london: "Londres",
    "new york": "Nova Iorque",
    new_york: "Nova Iorque",
    newyork: "Nova Iorque",
    range: "Lateral",
    trending: "Tendencial",
    bullish_cross: "Bullish cross",
    bearish_cross: "Bearish cross",
    bearish_below_signal: "bearish_below_signal",
    bullish_above_signal: "bullish_above_signal",
    up: "up",
    down: "down",
    flat: "flat",
    mid_range: "Meio do range",
    balanced: "Equilibrado",
    normal: "Normal",
    high: "Alta",
    low: "Baixa",
    ready: "Sem sinal",
    local_ok: "Entrada validada",
    local_no_signals: "Run sem sinais",
    local_error: "Run com erro",
    hit: "Hit",
    fail: "Fail",
    timeout: "Timeout",
    closed: "Fechado",
    pullback: "Pullback",
  };

  return map[normalized] ?? raw;
}

export function normalizeRuleLabel(label: string): string {
  const map: Record<string, string> = {
    "BB reentry long": "Reentrada Bollinger (long)",
    "BB reentry short": "Reentrada Bollinger (short)",
    "EMA trend confirmed long": "Tendência EMA confirmada (long)",
    "EMA trend confirmed short": "Tendência EMA confirmada (short)",
    "RSI recovery long": "Recuperação RSI (long)",
    "RSI recovery short": "Recuperação RSI (short)",
    "MACD confirmation long": "Confirmação MACD (long)",
    "MACD confirmation short": "Confirmação MACD (short)",
    "Countertrend long": "Sinal contrário comprador",
    "Countertrend short": "Sinal contrário vendedor",
    "Reentrada na banda (long)": "Reentrada na banda (long)",
    "Reentrada na banda (short)": "Reentrada na banda (short)",
    "Fecho abaixo da banda inferior": "Fecho abaixo da banda inferior",
    "Fecho acima da banda superior": "Fecho acima da banda superior",
  };

  return map[label] ?? label;
}
