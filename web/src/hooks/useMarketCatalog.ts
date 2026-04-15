// web/src/hooks/useMarketCatalog.ts

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { API_HTTP_BASE_URL } from "../constants/config";
import type {
  CatalogInstrument,
  CatalogItemsResponse,
  CatalogProductResponse,
  CatalogProductsResponse,
  CatalogProductSummary,
} from "../types/trading";

type UseMarketCatalogParams = {
  selectedProvider: string;
};

const STORAGE_KEYS = {
  marketType: "traderbot:selectedMarketType",
  catalog: "traderbot:selectedCatalog",
  symbol: "traderbot:selectedSymbol",
};

const BINANCE_MARKET_TYPES: CatalogProductSummary[] = [
  {
    code: "crypto",
    label: "Crypto",
    description: "Mercado cripto disponível na Binance",
    total_subproducts: 1,
    total_items: 10,
  },
];

const BINANCE_PRODUCT_DETAILS_BY_CODE: Record<string, CatalogProductResponse> = {
  crypto: {
    code: "crypto",
    label: "Crypto",
    description: "Mercado Spot da Binance para pares cripto",
    subproducts: [
      {
        code: "spot",
        label: "Spot",
        description: "Mercado Spot Binance",
      },
    ],
  },
};

const BINANCE_SYMBOLS_BY_MARKET_AND_CATALOG: Record<string, CatalogInstrument[]> = {
  "crypto::spot": [
    {
      symbol: "BTC/USDT",
      display_name: "Bitcoin / Tether",
      base_asset: "BTC",
      quote_asset: "USDT",
    },
    {
      symbol: "ETH/USDT",
      display_name: "Ethereum / Tether",
      base_asset: "ETH",
      quote_asset: "USDT",
    },
    {
      symbol: "BNB/USDT",
      display_name: "BNB / Tether",
      base_asset: "BNB",
      quote_asset: "USDT",
    },
    {
      symbol: "SOL/USDT",
      display_name: "Solana / Tether",
      base_asset: "SOL",
      quote_asset: "USDT",
    },
    {
      symbol: "XRP/USDT",
      display_name: "XRP / Tether",
      base_asset: "XRP",
      quote_asset: "USDT",
    },
    {
      symbol: "ADA/USDT",
      display_name: "Cardano / Tether",
      base_asset: "ADA",
      quote_asset: "USDT",
    },
    {
      symbol: "DOGE/USDT",
      display_name: "Dogecoin / Tether",
      base_asset: "DOGE",
      quote_asset: "USDT",
    },
    {
      symbol: "AVAX/USDT",
      display_name: "Avalanche / Tether",
      base_asset: "AVAX",
      quote_asset: "USDT",
    },
    {
      symbol: "LINK/USDT",
      display_name: "Chainlink / Tether",
      base_asset: "LINK",
      quote_asset: "USDT",
    },
    {
      symbol: "TON/USDT",
      display_name: "Toncoin / Tether",
      base_asset: "TON",
      quote_asset: "USDT",
    },
  ],
};

function readStorage(key: string): string {
  try {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function writeStorage(key: string, value: string): void {
  try {
    if (typeof window === "undefined") return;

    if (value) {
      window.localStorage.setItem(key, value);
    } else {
      window.localStorage.removeItem(key);
    }
  } catch {
    // ignora erros de storage
  }
}

function normalizeProvider(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase();
}

function normalizeProductsResponse(data: unknown): CatalogProductSummary[] {
  if (!data || typeof data !== "object") return [];

  const products = (data as CatalogProductsResponse).products;
  if (!Array.isArray(products)) return [];

  return products.filter(
    (item) =>
      item &&
      typeof item === "object" &&
      typeof item.code === "string" &&
      typeof item.label === "string"
  );
}

function normalizeProductResponse(data: unknown): CatalogProductResponse | null {
  if (!data || typeof data !== "object") return null;

  const candidate = data as CatalogProductResponse;

  if (
    typeof candidate.code !== "string" ||
    typeof candidate.label !== "string" ||
    !Array.isArray(candidate.subproducts)
  ) {
    return null;
  }

  return {
    code: candidate.code,
    label: candidate.label,
    description:
      typeof candidate.description === "string" ? candidate.description : "",
    subproducts: candidate.subproducts.filter(
      (item) =>
        item &&
        typeof item === "object" &&
        typeof item.code === "string" &&
        typeof item.label === "string"
    ),
  };
}

function normalizeItemsResponse(data: unknown): CatalogInstrument[] {
  if (!data || typeof data !== "object") return [];

  const items = (data as CatalogItemsResponse).items;
  if (!Array.isArray(items)) return [];

  return items.filter(
    (item) =>
      item &&
      typeof item === "object" &&
      typeof item.symbol === "string" &&
      typeof item.display_name === "string"
  );
}

async function safeFetchJson(
  url: string,
  signal?: AbortSignal
): Promise<unknown> {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    signal,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

function getBinanceProductDetails(marketType: string): CatalogProductResponse | null {
  return BINANCE_PRODUCT_DETAILS_BY_CODE[marketType] ?? null;
}

function getBinanceSymbols(
  marketType: string,
  catalog: string
): CatalogInstrument[] {
  return BINANCE_SYMBOLS_BY_MARKET_AND_CATALOG[`${marketType}::${catalog}`] ?? [];
}

function useMarketCatalog({ selectedProvider }: UseMarketCatalogParams) {
  const normalizedProvider = useMemo(
    () => normalizeProvider(selectedProvider),
    [selectedProvider]
  );

  const [marketTypes, setMarketTypes] = useState<CatalogProductSummary[]>([]);
  const [selectedMarketTypeState, setSelectedMarketTypeState] = useState<string>(
    () => readStorage(STORAGE_KEYS.marketType)
  );
  const [marketTypeDetails, setMarketTypeDetails] =
    useState<CatalogProductResponse | null>(null);
  const [selectedCatalogState, setSelectedCatalogState] = useState<string>(() =>
    readStorage(STORAGE_KEYS.catalog)
  );
  const [catalogSymbols, setCatalogSymbols] = useState<CatalogInstrument[]>([]);
  const [selectedSymbolState, setSelectedSymbolState] = useState<string>(() =>
    readStorage(STORAGE_KEYS.symbol)
  );

  const selectedCatalogRef = useRef<string>(selectedCatalogState);
  const selectedSymbolRef = useRef<string>(selectedSymbolState);

  const [loadingMarketTypes, setLoadingMarketTypes] = useState<boolean>(true);
  const [loadingCatalogs, setLoadingCatalogs] = useState<boolean>(false);
  const [loadingSymbols, setLoadingSymbols] = useState<boolean>(false);

  const [marketTypesError, setMarketTypesError] = useState<string>("");
  const [catalogsError, setCatalogsError] = useState<string>("");
  const [symbolsError, setSymbolsError] = useState<string>("");

  const setSelectedMarketType = useCallback((value: string) => {
    setSelectedMarketTypeState((current) => {
      if (current === value) return current;
      return value;
    });

    setMarketTypeDetails(null);
    setSelectedCatalogState("");
    setCatalogSymbols([]);
    setSelectedSymbolState("");
    setCatalogsError("");
    setSymbolsError("");
    setLoadingCatalogs(false);
    setLoadingSymbols(false);
  }, []);

  const setSelectedCatalog = useCallback((value: string) => {
    setSelectedCatalogState((current) => {
      if (current === value) return current;
      return value;
    });

    setCatalogSymbols([]);
    setSelectedSymbolState("");
    setSymbolsError("");
    setLoadingSymbols(false);
  }, []);

  const setSelectedSymbol = useCallback((value: string) => {
    setSelectedSymbolState(value);
  }, []);

  const selectedMarketType = selectedMarketTypeState;
  const selectedCatalog = selectedCatalogState;
  const selectedSymbol = selectedSymbolState;

  useEffect(() => {
    selectedCatalogRef.current = selectedCatalog;
  }, [selectedCatalog]);

  useEffect(() => {
    selectedSymbolRef.current = selectedSymbol;
  }, [selectedSymbol]);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.marketType, selectedMarketType);
  }, [selectedMarketType]);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.catalog, selectedCatalog);
  }, [selectedCatalog]);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.symbol, selectedSymbol);
  }, [selectedSymbol]);

  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;

    const loadMarketTypes = async () => {
      if (normalizedProvider === "binance") {
        const products = BINANCE_MARKET_TYPES;

        setMarketTypes(products);
        setMarketTypesError("");
        setCatalogsError("");
        setSymbolsError("");
        setLoadingMarketTypes(false);
        setLoadingCatalogs(false);
        setLoadingSymbols(false);

        const currentSelectedMarketType = selectedMarketTypeState;
        const hasStoredMarketType = products.some(
          (item) => item.code === currentSelectedMarketType
        );

        if (!hasStoredMarketType) {
          setSelectedMarketTypeState(products[0]?.code ?? "");
          setSelectedCatalogState("");
          setCatalogSymbols([]);
          setSelectedSymbolState("");
        }

        return;
      }

      try {
        setLoadingMarketTypes(true);
        setMarketTypesError("");

        const data = await safeFetchJson(
          `${API_HTTP_BASE_URL}/catalog/products`,
          controller.signal
        );

        if (!isMounted) return;

        const products = normalizeProductsResponse(data);
        setMarketTypes(products);

        const hasStoredMarketType = products.some(
          (item) => item.code === selectedMarketType
        );

        if (!hasStoredMarketType) {
          setSelectedMarketTypeState("");
          setMarketTypeDetails(null);
          setSelectedCatalogState("");
          setCatalogSymbols([]);
          setSelectedSymbolState("");
        }
      } catch (error) {
        if (!isMounted || controller.signal.aborted) return;

        setMarketTypes([]);
        setMarketTypesError(
          error instanceof Error
            ? error.message
            : "Erro desconhecido ao carregar tipos"
        );
      } finally {
        if (isMounted) {
          setLoadingMarketTypes(false);
        }
      }
    };

    void loadMarketTypes();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [normalizedProvider, selectedMarketType, selectedMarketTypeState]);

  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;

    const loadCatalogs = async () => {
      if (normalizedProvider === "binance") {
        if (!selectedMarketType) {
          setMarketTypeDetails(null);
          setSelectedCatalogState("");
          setCatalogSymbols([]);
          setSelectedSymbolState("");
          setCatalogsError("");
          setSymbolsError("");
          setLoadingCatalogs(false);
          return;
        }

        const normalized = getBinanceProductDetails(selectedMarketType);

        if (!normalized) {
          setMarketTypeDetails(null);
          setSelectedCatalogState("");
          setCatalogSymbols([]);
          setSelectedSymbolState("");
          setCatalogsError("Tipo Binance inválido");
          setLoadingCatalogs(false);
          return;
        }

        setMarketTypeDetails(normalized);
        setCatalogsError("");
        setSymbolsError("");
        setLoadingCatalogs(false);

        const currentSelectedCatalog = selectedCatalogRef.current;

        const hasStoredCatalog = normalized.subproducts.some(
          (item) => item.code === currentSelectedCatalog
        );

        if (!hasStoredCatalog) {
          setSelectedCatalogState(normalized.subproducts[0]?.code ?? "");
          setCatalogSymbols([]);
          setSelectedSymbolState("");
        }

        return;
      }

      if (!selectedMarketType) {
        setMarketTypeDetails(null);
        setSelectedCatalogState("");
        setCatalogSymbols([]);
        setSelectedSymbolState("");
        setCatalogsError("");
        setSymbolsError("");
        setLoadingCatalogs(false);
        return;
      }

      try {
        setLoadingCatalogs(true);
        setCatalogsError("");

        const data = await safeFetchJson(
          `${API_HTTP_BASE_URL}/catalog/products/${encodeURIComponent(
            selectedMarketType
          )}`,
          controller.signal
        );

        if (!isMounted) return;

        const normalized = normalizeProductResponse(data);

        if (!normalized) {
          throw new Error("Resposta inválida ao carregar catálogos");
        }

        setMarketTypeDetails(normalized);

        const currentSelectedCatalog = selectedCatalogRef.current;

        const hasStoredCatalog = normalized.subproducts.some(
          (item) => item.code === currentSelectedCatalog
        );

        if (!hasStoredCatalog) {
          setSelectedCatalogState("");
          setCatalogSymbols([]);
          setSelectedSymbolState("");
        }
      } catch (error) {
        if (!isMounted || controller.signal.aborted) return;

        setMarketTypeDetails(null);
        setSelectedCatalogState("");
        setCatalogSymbols([]);
        setSelectedSymbolState("");
        setSymbolsError("");
        setCatalogsError(
          error instanceof Error
            ? error.message
            : "Erro desconhecido ao carregar catálogos"
        );
      } finally {
        if (isMounted) {
          setLoadingCatalogs(false);
        }
      }
    };

    void loadCatalogs();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [normalizedProvider, selectedMarketType]);

  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;

    const loadSymbols = async () => {
      if (normalizedProvider === "binance") {
        if (!selectedMarketType || !selectedCatalog) {
          setCatalogSymbols([]);
          setSelectedSymbolState("");
          setSymbolsError("");
          setLoadingSymbols(false);
          return;
        }

        const items = getBinanceSymbols(selectedMarketType, selectedCatalog);

        setCatalogSymbols(items);
        setSymbolsError("");
        setLoadingSymbols(false);

        const currentSelectedSymbol = selectedSymbolRef.current;

        const hasStoredSymbol = items.some(
          (item) => item.symbol === currentSelectedSymbol
        );

        if (!hasStoredSymbol) {
          setSelectedSymbolState(items[0]?.symbol ?? "");
        }

        return;
      }

      if (!selectedMarketType || !selectedCatalog) {
        setCatalogSymbols([]);
        setSelectedSymbolState("");
        setSymbolsError("");
        setLoadingSymbols(false);
        return;
      }

      try {
        setLoadingSymbols(true);
        setSymbolsError("");

        const data = await safeFetchJson(
          `${API_HTTP_BASE_URL}/catalog/products/${encodeURIComponent(
            selectedMarketType
          )}/subproducts/${encodeURIComponent(selectedCatalog)}`,
          controller.signal
        );

        if (!isMounted) return;

        const items = normalizeItemsResponse(data);
        setCatalogSymbols(items);

        const currentSelectedSymbol = selectedSymbolRef.current;

        const hasStoredSymbol = items.some(
          (item) => item.symbol === currentSelectedSymbol
        );

        if (!hasStoredSymbol) {
          setSelectedSymbolState("");
        }
      } catch (error) {
        if (!isMounted || controller.signal.aborted) return;

        setCatalogSymbols([]);
        setSelectedSymbolState("");
        setSymbolsError(
          error instanceof Error
            ? error.message
            : "Erro desconhecido ao carregar símbolos"
        );
      } finally {
        if (isMounted) {
          setLoadingSymbols(false);
        }
      }
    };

    void loadSymbols();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [normalizedProvider, selectedMarketType, selectedCatalog]);

  const availableCatalogs = useMemo(() => {
    return marketTypeDetails?.subproducts ?? [];
  }, [marketTypeDetails]);

  const selectedMarketTypeLabel = useMemo(() => {
    return (
      marketTypes.find((item) => item.code === selectedMarketType)?.label ?? "-"
    );
  }, [marketTypes, selectedMarketType]);

  const selectedCatalogLabel = useMemo(() => {
    return (
      availableCatalogs.find((item) => item.code === selectedCatalog)?.label ?? "-"
    );
  }, [availableCatalogs, selectedCatalog]);

  const selectedSymbolData = useMemo(() => {
    return catalogSymbols.find((item) => item.symbol === selectedSymbol) ?? null;
  }, [catalogSymbols, selectedSymbol]);

  return {
    marketTypes,
    selectedMarketType,
    setSelectedMarketType,
    selectedCatalog,
    setSelectedCatalog,
    catalogSymbols,
    selectedSymbol,
    setSelectedSymbol,
    availableCatalogs,
    selectedMarketTypeLabel,
    selectedCatalogLabel,
    selectedSymbolData,
    loadingMarketTypes,
    loadingCatalogs,
    loadingSymbols,
    marketTypesError,
    catalogsError,
    symbolsError,
  };
}

export default useMarketCatalog;