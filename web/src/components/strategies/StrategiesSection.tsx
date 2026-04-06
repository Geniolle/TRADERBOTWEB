// web/src/components/strategies/StrategiesSection.tsx

import { useMemo, useState } from "react";
import type { MarketStrategyInput, StrategyCard } from "../../types/strategy";
import { buildStrategySection } from "../../services/buildStrategies";

type StrategiesSectionProps = {
  data: MarketStrategyInput;
};

type StrategyVisualTone = "green" | "yellow" | "red";

function getStatusLabel(status: StrategyCard["status"]): string {
  switch (status) {
    case "active":
      return "Ativa";
    case "waiting_trigger":
      return "Aguardando gatilho";
    case "watching":
      return "Em observação";
    case "weak":
      return "Fraca";
    default:
      return "Inválida";
  }
}

function getDirectionLabel(direction: StrategyCard["direction"]): string {
  switch (direction) {
    case "buy":
      return "Compra";
    case "sell":
      return "Venda";
    default:
      return "Neutro";
  }
}

function getToneByScore(score: number): StrategyVisualTone {
  if (score >= 90) return "green";
  if (score >= 50) return "yellow";
  return "red";
}

function getHeaderStylesByScore(score: number | null) {
  const tone = score == null ? "yellow" : getToneByScore(score);

  if (tone === "green") {
    return {
      background: "linear-gradient(90deg, #dcfce7 0%, #f0fdf4 100%)",
      borderBottom: "#bbf7d0",
      titleColor: "#14532d",
      subtitleColor: "#166534",
      badgeBackground: "#ffffff",
      badgeColor: "#166534",
      badgeBorder: "#86efac",
    };
  }

  if (tone === "yellow") {
    return {
      background: "linear-gradient(90deg, #fef3c7 0%, #fffbeb 100%)",
      borderBottom: "#fcd34d",
      titleColor: "#78350f",
      subtitleColor: "#92400e",
      badgeBackground: "#ffffff",
      badgeColor: "#92400e",
      badgeBorder: "#fcd34d",
    };
  }

  return {
    background: "linear-gradient(90deg, #fee2e2 0%, #fff7ed 100%)",
    borderBottom: "#fdba74",
    titleColor: "#7f1d1d",
    subtitleColor: "#9a3412",
    badgeBackground: "#ffffff",
    badgeColor: "#9a3412",
    badgeBorder: "#fdba74",
  };
}

function getToneStyles(tone: StrategyVisualTone) {
  if (tone === "green") {
    return {
      borderColor: "#bbf7d0",
      sideColor: "34, 197, 94",
      glowColor: "22, 163, 74",
      pillBackground: "#ecfdf5",
      pillColor: "#166534",
      pillBorder: "#86efac",
      signalLabel: "Forte",
      scoreBackground: "#ecfdf5",
      scoreColor: "#166534",
      scoreBorder: "#86efac",
    };
  }

  if (tone === "yellow") {
    return {
      borderColor: "#fde68a",
      sideColor: "245, 158, 11",
      glowColor: "217, 119, 6",
      pillBackground: "#fffbeb",
      pillColor: "#92400e",
      pillBorder: "#fcd34d",
      signalLabel: "Moderada",
      scoreBackground: "#fffbeb",
      scoreColor: "#92400e",
      scoreBorder: "#fcd34d",
    };
  }

  return {
    borderColor: "#fecaca",
    sideColor: "239, 68, 68",
    glowColor: "220, 38, 38",
    pillBackground: "#fef2f2",
    pillColor: "#991b1b",
    pillBorder: "#fca5a5",
    signalLabel: "Fraca",
    scoreBackground: "#fef2f2",
    scoreColor: "#991b1b",
    scoreBorder: "#fca5a5",
  };
}

function buildCardStyle(score: number): React.CSSProperties {
  const tone = getToneByScore(score);
  const accent = getToneStyles(tone);

  return {
    border: `1px solid ${accent.borderColor}`,
    background: "#ffffff",
    borderRadius: 14,
    padding: 12,
    borderLeft: `3px solid rgba(${accent.sideColor}, 0.95)`,
    boxShadow: `
      inset 3px 0 0 rgba(${accent.sideColor}, 0.95),
      inset 16px 0 22px rgba(${accent.sideColor}, 0.08),
      0 0 0 1px rgba(${accent.glowColor}, 0.03),
      0 8px 20px rgba(${accent.glowColor}, 0.08)
    `,
  };
}

function pillStyle(score: number): React.CSSProperties {
  const tone = getToneByScore(score);
  const accent = getToneStyles(tone);

  return {
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    background: accent.pillBackground,
    color: accent.pillColor,
    border: `1px solid ${accent.pillBorder}`,
    whiteSpace: "nowrap",
  };
}

function scoreBadgeStyle(score: number): React.CSSProperties {
  const tone = getToneByScore(score);
  const accent = getToneStyles(tone);

  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 68,
    height: 40,
    padding: "0 14px",
    borderRadius: 12,
    fontSize: 18,
    fontWeight: 800,
    background: accent.scoreBackground,
    color: accent.scoreColor,
    border: `1px solid ${accent.scoreBorder}`,
    whiteSpace: "nowrap",
  };
}

function toggleButtonStyle(score: number): React.CSSProperties {
  const tone = getToneByScore(score);
  const accent = getToneStyles(tone);

  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 34,
    height: 34,
    borderRadius: 999,
    border: `1px solid ${accent.pillBorder}`,
    background: "#ffffff",
    color: accent.pillColor,
    fontSize: 16,
    fontWeight: 700,
    lineHeight: 1,
    cursor: "pointer",
    flexShrink: 0,
  };
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(110px, 150px) minmax(0, 1fr)",
        gap: 12,
        alignItems: "start",
        padding: "8px 0",
        borderBottom: "1px solid rgba(148, 163, 184, 0.18)",
      }}
    >
      <span
        style={{
          color: "#64748b",
          fontSize: 13,
          lineHeight: 1.45,
        }}
      >
        {label}
      </span>

      <strong
        style={{
          color: "#0f172a",
          fontSize: 13,
          lineHeight: 1.45,
          textAlign: "left",
          wordBreak: "break-word",
          whiteSpace: "normal",
        }}
      >
        {value}
      </strong>
    </div>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        padding: 12,
        background: "#ffffff",
      }}
    >
      <div
        style={{
          marginBottom: 10,
          fontSize: 13,
          fontWeight: 700,
          color: "#0f172a",
        }}
      >
        {title}
      </div>

      {children}
    </div>
  );
}

function StrategyCardView({
  card,
}: {
  card: StrategyCard;
}) {
  const [expanded, setExpanded] = useState(false);
  const tone = getToneByScore(card.score);
  const toneStyles = getToneStyles(tone);

  return (
    <article style={buildCardStyle(card.score)}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "nowrap",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            minWidth: 0,
            flex: 1,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <strong style={{ fontSize: 15, color: "#0f172a" }}>
              {card.title}
            </strong>

            <div style={scoreBadgeStyle(card.score)}>{card.score}%</div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <span style={pillStyle(card.score)}>
              {getStatusLabel(card.status)}
            </span>
            <span style={pillStyle(card.score)}>
              {getDirectionLabel(card.direction)}
            </span>
            <span style={pillStyle(card.score)}>
              Leitura {toneStyles.signalLabel}
            </span>
          </div>

          <div
            style={{
              fontSize: 12,
              lineHeight: 1.6,
              color: "#475569",
            }}
          >
            {card.summary}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setExpanded((previous) => !previous)}
          style={toggleButtonStyle(card.score)}
          aria-expanded={expanded}
          aria-label={expanded ? `Ocultar ${card.title}` : `Expandir ${card.title}`}
        >
          {expanded ? "−" : "+"}
        </button>
      </div>

      {expanded ? (
        <div style={{ marginTop: 14 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 8,
              marginBottom: 12,
            }}
          >
            <SectionCard title="Execução">
              <SummaryRow label="Zona ideal" value={card.idealZone || "--"} />
              <SummaryRow label="Gatilho" value={card.trigger || "--"} />
              <SummaryRow label="Entrada" value={card.entry || "--"} />
              <SummaryRow
                label="Alvos"
                value={card.targets?.join(" / ") || "--"}
              />
              <SummaryRow
                label="Invalidação"
                value={card.invalidation || "--"}
              />
            </SectionCard>

            <SectionCard title="Condições previstas para dar match">
              <div style={{ display: "grid", gap: 0 }}>
                {(card.factors || []).map((factor) => (
                  <SummaryRow
                    key={`${card.id}-${factor.label}`}
                    label={factor.label}
                    value={factor.value}
                  />
                ))}
              </div>
            </SectionCard>
          </div>

          <SectionCard title="Justificativa">
            <div
              style={{
                fontSize: 12,
                lineHeight: 1.6,
                color: "#475569",
              }}
            >
              {card.rationale || "--"}
            </div>
          </SectionCard>
        </div>
      ) : null}
    </article>
  );
}

export default function StrategiesSection({ data }: StrategiesSectionProps) {
  const [expanded, setExpanded] = useState(true);

  const section = useMemo(() => buildStrategySection(data), [data]);
  const headerStyles = useMemo(
    () => getHeaderStylesByScore(section.topScore),
    [section.topScore],
  );

  return (
    <section
      style={{
        marginTop: 18,
        marginBottom: 18,
        border: "1px solid #dbe2ea",
        borderRadius: 16,
        background: "#ffffff",
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((previous) => !previous)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "14px 16px",
          background: headerStyles.background,
          border: "none",
          borderBottom: expanded ? `1px solid ${headerStyles.borderBottom}` : "none",
          cursor: "pointer",
          textAlign: "left",
        }}
        aria-expanded={expanded}
        aria-label={expanded ? "Retrair Estratégias" : "Expandir Estratégias"}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <strong style={{ fontSize: 16, color: headerStyles.titleColor }}>
              {section.title}
            </strong>

            <span
              style={{
                padding: "4px 10px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 700,
                background: headerStyles.badgeBackground,
                color: headerStyles.badgeColor,
                border: `1px solid ${headerStyles.badgeBorder}`,
              }}
            >
              {section.biasLabel}
            </span>
          </div>

          <span style={{ fontSize: 12, color: headerStyles.subtitleColor }}>
            {section.subtitle}
          </span>

          <span style={{ fontSize: 12, color: headerStyles.subtitleColor }}>
            {section.summaryLabel}
          </span>
        </div>

        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: 34,
            width: 34,
            height: 34,
            borderRadius: 999,
            border: `1px solid ${headerStyles.badgeBorder}`,
            background: "#ffffff",
            color: headerStyles.badgeColor,
            fontSize: 16,
            fontWeight: 700,
            lineHeight: 1,
          }}
        >
          {expanded ? "−" : "+"}
        </span>
      </button>

      {expanded ? (
        <div style={{ padding: 8 }}>
          {section.cards.length === 0 ? (
            <div
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: 14,
                padding: 16,
                background: "#f8fafc",
                color: "#475569",
                fontSize: 13,
                lineHeight: 1.6,
              }}
            >
              Não há estratégia visível neste momento.
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                gap: 8,
                alignItems: "start",
              }}
            >
              {section.cards.map((card) => (
                <StrategyCardView key={card.id} card={card} />
              ))}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}