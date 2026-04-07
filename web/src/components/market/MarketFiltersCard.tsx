// web/src/components/market/MarketFiltersCard.tsx

import type {
  CatalogInstrument,
  CatalogProductSummary,
  CatalogSubproduct,
} from "../../types/trading";

type TimeframeOption = {
  value: string;
  label: string;
};

type MarketFiltersCardProps = {
  sidebarCardStyle: React.CSSProperties;
  loadingMarketTypes: boolean;
  loadingCatalogs: boolean;
  loadingSymbols: boolean;
  loadingStrategies: boolean;
  marketTypesError: string;
  catalogsError: string;
  symbolsError: string;
  strategiesError: string;
  marketTypes: CatalogProductSummary[];
  selectedMarketType: string;
  setSelectedMarketType: (value: string) => void;
  availableCatalogs: CatalogSubproduct[];
  selectedCatalog: string;
  setSelectedCatalog: (value: string) => void;
  catalogSymbols: CatalogInstrument[];
  selectedSymbol: string;
  setSelectedSymbol: (value: string) => void;
  selectedTimeframe: string;
  setSelectedTimeframe: (value: string) => void;
  timeframeOptions: TimeframeOption[];
  selectedMarketTypeLabel: string;
  selectedCatalogLabel: string;
  selectedSymbolData: CatalogInstrument | null;
};

type MarketStatusInfo = {
  label: string;
  detail: string;
  color: string;
};

function getCurrentUtcDate(): Date {
  return new Date();
}

function getForexStatus(nowUtc: Date): MarketStatusInfo {
  const day = nowUtc.getUTCDay();
  const hour = nowUtc.getUTCHours();
  const minute = nowUtc.getUTCMinutes();
  const totalMinutes = hour * 60 + minute;

  if (day === 6) {
    return {
      label: "Fechado",
      detail: "Forex fecha ao sábado",
      color: "#dc2626",
    };
  }

  if (day === 0 && totalMinutes < 22 * 60) {
    return {
      label: "Fechado",
      detail: "Forex abre no domingo às 22:00 UTC",
      color: "#dc2626",
    };
  }

  if (day === 5 && totalMinutes >= 22 * 60) {
    return {
      label: "Fechado",
      detail: "Forex fecha na sexta às 22:00 UTC",
      color: "#dc2626",
    };
  }

  return {
    label: "Aberto",
    detail: "Forex ativo no ciclo 24/5",
    color: "#16a34a",
  };
}

function getCryptoStatus(): MarketStatusInfo {
  return {
    label: "Aberto",
    detail: "Cripto funciona 24/7",
    color: "#16a34a",
  };
}

function getMarketStatusInfo(
  selectedMarketTypeLabel: string,
  selectedCatalogLabel: string,
  selectedSymbolData: CatalogInstrument | null
): MarketStatusInfo {
  const marketType = String(selectedMarketTypeLabel ?? "").trim().toLowerCase();
  const catalog = String(selectedCatalogLabel ?? "").trim().toLowerCase();
  const symbolName = String(selectedSymbolData?.display_name ?? "")
    .trim()
    .toLowerCase();
  const symbolCode = String(selectedSymbolData?.symbol ?? "").trim().toLowerCase();

  const combinedText = [marketType, catalog, symbolName, symbolCode].join(" ");
  const nowUtc = getCurrentUtcDate();

  if (
    combinedText.includes("crypto") ||
    combinedText.includes("cripto") ||
    combinedText.includes("bitcoin") ||
    combinedText.includes("ethereum") ||
    combinedText.includes("usdt")
  ) {
    return getCryptoStatus();
  }

  if (
    combinedText.includes("forex") ||
    combinedText.includes("majors") ||
    combinedText.includes("minors") ||
    combinedText.includes("exotics") ||
    combinedText.includes("eurusd") ||
    combinedText.includes("gbpusd") ||
    combinedText.includes("usdjpy") ||
    combinedText.includes("usdchf") ||
    combinedText.includes("audusd") ||
    combinedText.includes("nzdusd") ||
    combinedText.includes("usdcad")
  ) {
    return getForexStatus(nowUtc);
  }

  return {
    label: "Não confirmado",
    detail: "Estado do mercado ainda não definido para este tipo",
    color: "#d97706",
  };
}

function MarketFiltersCard({
  sidebarCardStyle,
  loadingMarketTypes,
  loadingCatalogs,
  loadingSymbols,
  loadingStrategies,
  marketTypesError,
  catalogsError,
  symbolsError,
  strategiesError,
  marketTypes,
  selectedMarketType,
  setSelectedMarketType,
  availableCatalogs,
  selectedCatalog,
  setSelectedCatalog,
  catalogSymbols,
  selectedSymbol,
  setSelectedSymbol,
  selectedTimeframe,
  setSelectedTimeframe,
  timeframeOptions,
  selectedMarketTypeLabel,
  selectedCatalogLabel,
  selectedSymbolData,
}: MarketFiltersCardProps) {
  const marketStatusInfo = getMarketStatusInfo(
    selectedMarketTypeLabel,
    selectedCatalogLabel,
    selectedSymbolData
  );

  return (
    <div style={sidebarCardStyle}>
      <h2
        style={{
          marginTop: 0,
          marginBottom: 12,
          fontSize: 20,
          fontWeight: 700,
        }}
      >
        Mercado
      </h2>

      <div style={{ display: "grid", gap: 12 }}>
        <div>
          <label
            htmlFor="market-type"
            style={{
              display: "block",
              marginBottom: 6,
              fontSize: 13,
              fontWeight: 700,
              color: "#334155",
            }}
          >
            Tipo
          </label>

          <select
            id="market-type"
            value={selectedMarketType}
            onChange={(e) => setSelectedMarketType(e.target.value)}
            disabled={loadingMarketTypes || marketTypes.length === 0}
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #cbd5e1",
              outline: "none",
              fontSize: 14,
              background: "#fff",
            }}
          >
            <option value="">Selecione um tipo</option>
            {marketTypes.map((item) => (
              <option key={item.code} value={item.code}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="market-catalog"
            style={{
              display: "block",
              marginBottom: 6,
              fontSize: 13,
              fontWeight: 700,
              color: "#334155",
            }}
          >
            Catálogo
          </label>

          <select
            id="market-catalog"
            value={selectedCatalog}
            onChange={(e) => setSelectedCatalog(e.target.value)}
            disabled={
              !selectedMarketType ||
              loadingCatalogs ||
              availableCatalogs.length === 0
            }
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #cbd5e1",
              outline: "none",
              fontSize: 14,
              background: "#fff",
            }}
          >
            <option value="">Selecione um catálogo</option>
            {availableCatalogs.map((item) => (
              <option key={item.code} value={item.code}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="market-symbol"
            style={{
              display: "block",
              marginBottom: 6,
              fontSize: 13,
              fontWeight: 700,
              color: "#334155",
            }}
          >
            Símbolo
          </label>

          <select
            id="market-symbol"
            value={selectedSymbol}
            onChange={(e) => setSelectedSymbol(e.target.value)}
            disabled={
              !selectedCatalog || loadingSymbols || catalogSymbols.length === 0
            }
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #cbd5e1",
              outline: "none",
              fontSize: 14,
              background: "#fff",
            }}
          >
            <option value="">Selecione um símbolo</option>
            {catalogSymbols.map((item) => (
              <option key={item.symbol} value={item.symbol}>
                {item.symbol}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="market-timeframe"
            style={{
              display: "block",
              marginBottom: 6,
              fontSize: 13,
              fontWeight: 700,
              color: "#334155",
            }}
          >
            Timeframe
          </label>

          <select
            id="market-timeframe"
            value={selectedTimeframe}
            onChange={(e) => setSelectedTimeframe(e.target.value)}
            disabled={!selectedSymbol}
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #cbd5e1",
              outline: "none",
              fontSize: 14,
              background: "#fff",
            }}
          >
            <option value="">Selecione um timeframe</option>
            {timeframeOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div
          style={{
            marginTop: 4,
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #bfdbfe",
            background: "#f8fafc",
            fontSize: 12,
            lineHeight: 1.5,
            color: "#475569",
          }}
        >
          A execução dos runs é automática. Sempre que entra um novo candle, o
          sistema corre todas as estratégias da secção Stage Testes.
        </div>
      </div>

      {loadingMarketTypes && (
        <p style={{ margin: "12px 0 0 0" }}>A carregar tipos...</p>
      )}

      {!loadingMarketTypes && marketTypesError && (
        <div style={{ marginTop: 12 }}>
          <p style={{ color: "#dc2626", fontWeight: "bold", marginBottom: 6 }}>
            Erro ao carregar tipos
          </p>
          <p style={{ margin: 0 }}>{marketTypesError}</p>
        </div>
      )}

      {!loadingCatalogs && catalogsError && (
        <div style={{ marginTop: 12 }}>
          <p style={{ color: "#dc2626", fontWeight: "bold", marginBottom: 6 }}>
            Erro ao carregar catálogos
          </p>
          <p style={{ margin: 0 }}>{catalogsError}</p>
        </div>
      )}

      {!loadingSymbols && symbolsError && (
        <div style={{ marginTop: 12 }}>
          <p style={{ color: "#dc2626", fontWeight: "bold", marginBottom: 6 }}>
            Erro ao carregar símbolos
          </p>
          <p style={{ margin: 0 }}>{symbolsError}</p>
        </div>
      )}

      {!loadingStrategies && strategiesError && (
        <div style={{ marginTop: 12 }}>
          <p style={{ color: "#dc2626", fontWeight: "bold", marginBottom: 6 }}>
            Erro ao carregar estratégias
          </p>
          <p style={{ margin: 0 }}>{strategiesError}</p>
        </div>
      )}

      {!loadingSymbols &&
        !symbolsError &&
        selectedMarketType &&
        selectedCatalog &&
        selectedSymbolData && (
          <div
            style={{
              marginTop: 12,
              fontSize: 13,
              lineHeight: 1.5,
              color: "#475569",
            }}
          >
            <div>
              <strong>Tipo selecionado:</strong> {selectedMarketTypeLabel}
            </div>
            <div>
              <strong>Catálogo selecionado:</strong> {selectedCatalogLabel}
            </div>
            <div>
              <strong>Símbolo:</strong> {selectedSymbolData.symbol}
            </div>
            <div>
              <strong>Descrição:</strong> {selectedSymbolData.display_name}
            </div>
            <div>
              <strong>Estado do mercado:</strong>{" "}
              <span
                style={{
                  color: marketStatusInfo.color,
                  fontWeight: 700,
                }}
              >
                {marketStatusInfo.label}
              </span>
            </div>
            <div>
              <strong>Sessão:</strong> {marketStatusInfo.detail}
            </div>
            <div>
              <strong>Timeframe:</strong> {selectedTimeframe || "-"}
            </div>
            <div>
              <strong>Execução:</strong> Automática por novo candle
            </div>
          </div>
        )}
    </div>
  );
}

export default MarketFiltersCard;