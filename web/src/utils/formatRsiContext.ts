// web/src/utils/formatRsiContext.ts

export type RsiContext = {
  value: number | null;
  label: string;
  trend: string;
  zone: string;
  summary: string;
};

export function formatRsiNumber(value: number | null | undefined): string {
  if (value == null || Number.isNaN(Number(value))) {
    return "-";
  }

  return Number(value).toFixed(2).replace(".", ",");
}

export function formatRsiContext(rsi: number | null | undefined): RsiContext {
  if (rsi == null || Number.isNaN(Number(rsi))) {
    return {
      value: null,
      label: "Sem RSI",
      trend: "Indefinida",
      zone: "Sem dados",
      summary: "RSI indisponível",
    };
  }

  const value = Number(rsi);
  const valueText = formatRsiNumber(value);

  if (value < 20) {
    return {
      value,
      label: "Sobrevenda extrema",
      trend: "Baixista forte",
      zone: "Possível exaustão de queda",
      summary: `RSI ${valueText} • Sobrevenda extrema • Baixista forte`,
    };
  }

  if (value < 30) {
    return {
      value,
      label: "Sobrevenda",
      trend: "Baixista",
      zone: "Possível reversão",
      summary: `RSI ${valueText} • Sobrevenda • Baixista`,
    };
  }

  if (value < 45) {
    return {
      value,
      label: "Fraqueza",
      trend: "Leve baixa",
      zone: "Mercado fraco",
      summary: `RSI ${valueText} • Fraqueza • Leve baixa`,
    };
  }

  if (value < 55) {
    return {
      value,
      label: "Neutro",
      trend: "Indefinida",
      zone: "Equilíbrio",
      summary: `RSI ${valueText} • Neutro • Equilíbrio`,
    };
  }

  if (value < 70) {
    return {
      value,
      label: "Alta com força",
      trend: "Altista",
      zone: "Perto de sobrecompra",
      summary: `RSI ${valueText} • Alta com força • Perto de sobrecompra`,
    };
  }

  if (value < 80) {
    return {
      value,
      label: "Sobrecompra",
      trend: "Altista forte",
      zone: "Mercado esticado",
      summary: `RSI ${valueText} • Sobrecompra • Mercado esticado`,
    };
  }

  return {
    value,
    label: "Sobrecompra extrema",
    trend: "Altista muito forte",
    zone: "Exaustão provável",
    summary: `RSI ${valueText} • Sobrecompra extrema • Exaustão provável`,
  };
}