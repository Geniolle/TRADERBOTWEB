// C:\TraderBotWeb\web\src\components\chart\ChartStrategyHighlights.tsx

type StrategyHighlightItem = {
  id: string;
  label: string;
  score: number;
};

type ChartStrategyHighlightsProps = {
  items: StrategyHighlightItem[];
  minScore: number;
};

function getBadgeStyle(score: number) {
  if (score >= 90) {
    return {
      background: "#166534",
      border: "#14532d",
      color: "#ffffff",
    };
  }

  return {
    background: "#16a34a",
    border: "#15803d",
    color: "#ffffff",
  };
}

function formatScore(score: number): string {
  if (!Number.isFinite(score)) return "-";
  return `${Math.round(score)}%`;
}

function ChartStrategyHighlights({
  items,
  minScore,
}: ChartStrategyHighlightsProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        marginBottom: 10,
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          alignSelf: "flex-start",
          padding: "4px 10px",
          borderRadius: 999,
          background: "rgba(15, 23, 42, 0.86)",
          color: "#ffffff",
          fontSize: 11,
          fontWeight: 800,
          boxShadow: "0 1px 3px rgba(0,0,0,0.18)",
        }}
      >
        Estratégias ≥ {Math.round(minScore)}%
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        {items.map((item) => {
          const tone = getBadgeStyle(item.score);

          return (
            <div
              key={item.id}
              title={`${item.label} | ${formatScore(item.score)}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 10px",
                borderRadius: 999,
                background: tone.background,
                color: tone.color,
                border: `1px solid ${tone.border}`,
                fontSize: 12,
                fontWeight: 800,
                boxShadow: "0 2px 6px rgba(0,0,0,0.16)",
                whiteSpace: "nowrap",
              }}
            >
              <span>{item.label}</span>
              <span
                style={{
                  padding: "2px 6px",
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.16)",
                  color: "#ffffff",
                  fontSize: 11,
                  fontWeight: 900,
                }}
              >
                {formatScore(item.score)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ChartStrategyHighlights;