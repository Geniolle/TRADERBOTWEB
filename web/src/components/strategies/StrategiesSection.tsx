// web/src/components/strategy/StrategiesSection.tsx

import { useMemo, useState } from "react";
import type { MarketStrategyInput, StrategyCard } from "../../types/strategy";
import { buildStrategySection } from "../../services/buildStrategies";

type StrategiesSectionProps = {
  data: MarketStrategyInput;
};

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

export default function StrategiesSection({
  data,
}: StrategiesSectionProps) {
  const [expanded, setExpanded] = useState(true);

  const section = useMemo(() => buildStrategySection(data), [data]);

  return (
    <section className="market-card">
      <div className="market-card__header">
        <div>
          <div className="market-card__title-row">
            <h3>Estratégias</h3>
            <span className="pill">{section.biasLabel}</span>
            {section.topScore != null ? (
              <span className="pill">{section.topScore}%</span>
            ) : null}
          </div>

          <p className="market-card__subtitle">{section.subtitle}</p>
          <p className="market-card__summary">{section.summaryLabel}</p>
        </div>

        <button
          type="button"
          className="market-card__toggle"
          onClick={() => setExpanded((prev) => !prev)}
          aria-label={expanded ? "Ocultar estratégias" : "Mostrar estratégias"}
        >
          {expanded ? "−" : "+"}
        </button>
      </div>

      {expanded ? (
        <div className="strategy-grid">
          {section.cards.map((card) => (
            <article key={card.id} className="strategy-card">
              <div className="strategy-card__header">
                <div className="strategy-card__title-row">
                  <h4>{card.title}</h4>
                  <span className="pill">{getStatusLabel(card.status)}</span>
                </div>

                <div className="strategy-card__meta-row">
                  <span className="pill">{card.score}%</span>
                  <span className="pill">{getDirectionLabel(card.direction)}</span>
                </div>
              </div>

              <p className="strategy-card__summary">{card.summary}</p>

              <div className="strategy-card__block">
                <strong>Zona ideal</strong>
                <p>{card.idealZone || "--"}</p>
              </div>

              <div className="strategy-card__block">
                <strong>Gatilho</strong>
                <p>{card.trigger || "--"}</p>
              </div>

              <div className="strategy-card__block">
                <strong>Entrada</strong>
                <p>{card.entry || "--"}</p>
              </div>

              <div className="strategy-card__block">
                <strong>Alvos</strong>
                <p>{card.targets?.join(" / ") || "--"}</p>
              </div>

              <div className="strategy-card__block">
                <strong>Invalidação</strong>
                <p>{card.invalidation || "--"}</p>
              </div>

              <div className="strategy-card__block">
                <strong>Justificativa</strong>
                <p>{card.rationale || "--"}</p>
              </div>

              {card.factors?.length ? (
                <div className="strategy-card__factors">
                  {card.factors.map((factor) => (
                    <div key={`${card.id}-${factor.label}`} className="strategy-factor">
                      <span>{factor.label}</span>
                      <strong>{factor.value}</strong>
                    </div>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}