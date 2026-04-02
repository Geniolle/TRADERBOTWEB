// src/hooks/useMarketCatalog.ts

import { useEffect, useMemo, useState } from "react";

import { API_HTTP_BASE_URL } from "../constants/config";
import type {
  CatalogInstrument,
  CatalogItemsResponse,
  CatalogProductResponse,
  CatalogProductsResponse,
  CatalogProductSummary,
} from "../types/trading";

function useMarketCatalog() {
  const [marketTypes, setMarketTypes] = useState<CatalogProductSummary[]>([]);
  const [selectedMarketType, setSelectedMarketType] = useState("");
  const [marketTypeDetails, setMarketTypeDetails] =
    useState<CatalogProductResponse | null>(null);
  const [selectedCatalog, setSelectedCatalog] = useState("");
  const [catalogSymbols, setCatalogSymbols] = useState<CatalogInstrument[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState("");

  const [loadingMarketTypes, setLoadingMarketTypes] = useState(true);
  const [loadingCatalogs, setLoadingCatalogs] = useState(false);
  const [loadingSymbols, setLoadingSymbols] = useState(false);

  const [marketTypesError, setMarketTypesError] = useState("");
  const [catalogsError, setCatalogsError] = useState("");
  const [symbolsError, setSymbolsError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadMarketTypes = async () => {
      try {
        setLoadingMarketTypes(true);
        setMarketTypesError("");

        const response = await fetch(`${API_HTTP_BASE_URL}/catalog/products`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data: CatalogProductsResponse = await response.json();
        const products = Array.isArray(data.products) ? data.products : [];

        if (cancelled) return;

        setMarketTypes(products);
        setSelectedMarketType("");
        setMarketTypeDetails(null);
        setSelectedCatalog("");
        setCatalogSymbols([]);
        setSelectedSymbol("");
        setCatalogsError("");
        setSymbolsError("");
      } catch (err) {
        if (!cancelled) {
          setMarketTypesError(
            err instanceof Error ? err.message : "Erro desconhecido ao carregar tipos"
          );
          setMarketTypes([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingMarketTypes(false);
        }
      }
    };

    void loadMarketTypes();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadCatalogs = async () => {
      if (!selectedMarketType) {
        setMarketTypeDetails(null);
        setSelectedCatalog("");
        setCatalogSymbols([]);
        setSelectedSymbol("");
        setCatalogsError("");
        setSymbolsError("");
        setLoadingCatalogs(false);
        return;
      }

      try {
        setLoadingCatalogs(true);
        setCatalogsError("");

        const response = await fetch(
          `${API_HTTP_BASE_URL}/catalog/products/${selectedMarketType}`
        );
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data: CatalogProductResponse = await response.json();

        if (cancelled) return;

        setMarketTypeDetails(data);
        setSelectedCatalog("");
        setCatalogSymbols([]);
        setSelectedSymbol("");
        setSymbolsError("");
      } catch (err) {
        if (!cancelled) {
          setCatalogsError(
            err instanceof Error ? err.message : "Erro desconhecido ao carregar catálogos"
          );
          setMarketTypeDetails(null);
          setSelectedCatalog("");
          setCatalogSymbols([]);
          setSelectedSymbol("");
          setSymbolsError("");
        }
      } finally {
        if (!cancelled) {
          setLoadingCatalogs(false);
        }
      }
    };

    void loadCatalogs();

    return () => {
      cancelled = true;
    };
  }, [selectedMarketType]);

  useEffect(() => {
    let cancelled = false;

    const loadSymbols = async () => {
      if (!selectedMarketType || !selectedCatalog) {
        setCatalogSymbols([]);
        setSelectedSymbol("");
        setSymbolsError("");
        setLoadingSymbols(false);
        return;
      }

      try {
        setLoadingSymbols(true);
        setSymbolsError("");

        const response = await fetch(
          `${API_HTTP_BASE_URL}/catalog/products/${selectedMarketType}/subproducts/${selectedCatalog}`
        );
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data: CatalogItemsResponse = await response.json();
        const items = Array.isArray(data.items) ? data.items : [];

        if (cancelled) return;

        setCatalogSymbols(items);
        setSelectedSymbol("");
      } catch (err) {
        if (!cancelled) {
          setSymbolsError(
            err instanceof Error ? err.message : "Erro desconhecido ao carregar símbolos"
          );
          setCatalogSymbols([]);
          setSelectedSymbol("");
        }
      } finally {
        if (!cancelled) {
          setLoadingSymbols(false);
        }
      }
    };

    void loadSymbols();

    return () => {
      cancelled = true;
    };
  }, [selectedMarketType, selectedCatalog]);

  const availableCatalogs = useMemo(() => {
    return marketTypeDetails?.subproducts ?? [];
  }, [marketTypeDetails]);

  const selectedMarketTypeLabel = useMemo(() => {
    return marketTypes.find((item) => item.code === selectedMarketType)?.label ?? "-";
  }, [marketTypes, selectedMarketType]);

  const selectedCatalogLabel = useMemo(() => {
    return availableCatalogs.find((item) => item.code === selectedCatalog)?.label ?? "-";
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