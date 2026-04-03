// web/src/components/chart/IndicatorMenu.tsx

import type { IndicatorSettings } from "../../hooks/useIndicatorSettings";

type IndicatorMenuProps = {
  isOpen: boolean;
  onToggleOpen: () => void;
  settings: IndicatorSettings;
  onSetIndicatorEnabled: (
    key: "ema9" | "ema21" | "bollinger",
    enabled: boolean
  ) => void;
  onSetBollingerPeriod: (value: number) => void;
  onSetBollingerStdDev: (value: number) => void;
};

function IndicatorMenu({
  isOpen,
  onToggleOpen,
  settings,
  onSetIndicatorEnabled,
  onSetBollingerPeriod,
  onSetBollingerStdDev,
}: IndicatorMenuProps) {
  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        left: 12,
        zIndex: 4,
        pointerEvents: "auto",
      }}
    >
      <button
        type="button"
        onClick={onToggleOpen}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          border: "1px solid #cbd5e1",
          background: "#ffffff",
          color: "#0f172a",
          borderRadius: 8,
          padding: "8px 10px",
          fontSize: 13,
          fontWeight: 700,
          cursor: "pointer",
          boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        }}
      >
        <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
        <span>Indicadores</span>
      </button>

      {isOpen && (
        <div
          style={{
            marginTop: 8,
            width: 260,
            background: "#ffffff",
            border: "1px solid #dbe2ea",
            borderRadius: 12,
            padding: 12,
            boxShadow: "0 8px 24px rgba(15, 23, 42, 0.12)",
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "#0f172a",
              marginBottom: 10,
            }}
          >
            Indicadores técnicos
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 14,
                color: "#334155",
              }}
            >
              <input
                type="checkbox"
                checked={settings.ema9}
                onChange={(event) =>
                  onSetIndicatorEnabled("ema9", event.target.checked)
                }
              />
              EMA 9
            </label>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 14,
                color: "#334155",
              }}
            >
              <input
                type="checkbox"
                checked={settings.ema21}
                onChange={(event) =>
                  onSetIndicatorEnabled("ema21", event.target.checked)
                }
              />
              EMA 21
            </label>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 14,
                color: "#334155",
              }}
            >
              <input
                type="checkbox"
                checked={settings.bollinger}
                onChange={(event) =>
                  onSetIndicatorEnabled("bollinger", event.target.checked)
                }
              />
              Bollinger Bands
            </label>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
                paddingLeft: 24,
                opacity: settings.bollinger ? 1 : 0.55,
              }}
            >
              <label
                style={{
                  display: "grid",
                  gap: 4,
                  fontSize: 12,
                  color: "#475569",
                }}
              >
                <span>Período</span>
                <input
                  type="number"
                  min={2}
                  max={200}
                  value={settings.bollingerPeriod}
                  disabled={!settings.bollinger}
                  onChange={(event) =>
                    onSetBollingerPeriod(Number(event.target.value))
                  }
                  style={{
                    border: "1px solid #cbd5e1",
                    borderRadius: 8,
                    padding: "6px 8px",
                    fontSize: 13,
                  }}
                />
              </label>

              <label
                style={{
                  display: "grid",
                  gap: 4,
                  fontSize: 12,
                  color: "#475569",
                }}
              >
                <span>Desvio</span>
                <input
                  type="number"
                  min={0.1}
                  max={10}
                  step={0.1}
                  value={settings.bollingerStdDev}
                  disabled={!settings.bollinger}
                  onChange={(event) =>
                    onSetBollingerStdDev(Number(event.target.value))
                  }
                  style={{
                    border: "1px solid #cbd5e1",
                    borderRadius: 8,
                    padding: "6px 8px",
                    fontSize: 13,
                  }}
                />
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default IndicatorMenu;