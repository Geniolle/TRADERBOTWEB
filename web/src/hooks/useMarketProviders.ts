import { useCallback, useEffect, useMemo, useState } from "react";

import { API_PROVIDERS_URL } from "../constants/config";

type ProviderListResponse = {
  providers?: unknown;
  selected_provider?: unknown;
};

const PROVIDER_STORAGE_KEY = "traderbot:selectedProvider";

function readStoredProvider(): string {
  try {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(PROVIDER_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeStoredProvider(value: string): void {
  try {
    if (typeof window === "undefined") return;

    if (value) {
      window.localStorage.setItem(PROVIDER_STORAGE_KEY, value);
    } else {
      window.localStorage.removeItem(PROVIDER_STORAGE_KEY);
    }
  } catch {
    // ignora erros de storage
  }
}

function normalizeProvidersResponse(data: unknown): {
  providers: string[];
  selectedProviderFromBackend: string;
} {
  if (!data || typeof data !== "object") {
    return {
      providers: [],
      selectedProviderFromBackend: "",
    };
  }

  const candidate = data as ProviderListResponse;

  const providers = Array.isArray(candidate.providers)
    ? candidate.providers
        .filter(
          (item): item is string =>
            typeof item === "string" && item.trim().length > 0
        )
        .map((item) => item.trim())
    : [];

  const selectedProviderFromBackend =
    typeof candidate.selected_provider === "string"
      ? candidate.selected_provider.trim()
      : "";

  return {
    providers: Array.from(new Set(providers)),
    selectedProviderFromBackend,
  };
}

async function safeFetchJson(signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(API_PROVIDERS_URL, {
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

function useMarketProviders() {
  const [providers, setProviders] = useState<string[]>([]);
  const [selectedProviderState, setSelectedProviderState] = useState<string>(() =>
    readStoredProvider()
  );
  const [backendSelectedProvider, setBackendSelectedProvider] =
    useState<string>("");

  const [loadingProviders, setLoadingProviders] = useState<boolean>(true);
  const [providersError, setProvidersError] = useState<string>("");

  const setSelectedProvider = useCallback((value: string) => {
    setSelectedProviderState((current) => {
      if (current === value) return current;
      return value;
    });
  }, []);

  useEffect(() => {
    writeStoredProvider(selectedProviderState);
  }, [selectedProviderState]);

  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;

    const loadProviders = async () => {
      try {
        setLoadingProviders(true);
        setProvidersError("");

        const data = await safeFetchJson(controller.signal);

        if (!isMounted) return;

        const normalized = normalizeProvidersResponse(data);

        setProviders(normalized.providers);
        setBackendSelectedProvider(normalized.selectedProviderFromBackend);

        const storedProvider = readStoredProvider();

        const nextSelectedProvider =
          (storedProvider &&
            normalized.providers.includes(storedProvider) &&
            storedProvider) ||
          (normalized.selectedProviderFromBackend &&
            normalized.providers.includes(
              normalized.selectedProviderFromBackend
            ) &&
            normalized.selectedProviderFromBackend) ||
          normalized.providers[0] ||
          "";

        setSelectedProviderState(nextSelectedProvider);
      } catch (error) {
        if (!isMounted || controller.signal.aborted) return;

        setProviders([]);
        setBackendSelectedProvider("");
        setProvidersError(
          error instanceof Error
            ? error.message
            : "Erro desconhecido ao carregar providers"
        );
      } finally {
        if (isMounted) {
          setLoadingProviders(false);
        }
      }
    };

    void loadProviders();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  const selectedProvider = useMemo(() => {
    if (selectedProviderState && providers.includes(selectedProviderState)) {
      return selectedProviderState;
    }

    if (backendSelectedProvider && providers.includes(backendSelectedProvider)) {
      return backendSelectedProvider;
    }

    return providers[0] ?? "";
  }, [selectedProviderState, backendSelectedProvider, providers]);

  return {
    providers,
    selectedProvider,
    setSelectedProvider,
    backendSelectedProvider,
    loadingProviders,
    providersError,
  };
}

export default useMarketProviders;