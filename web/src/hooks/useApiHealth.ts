// src/hooks/useApiHealth.ts

import { useEffect, useState } from "react";

import { API_HTTP_BASE_URL } from "../constants/config";
import type { HealthResponse } from "../types/trading";

function useApiHealth() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(true);
  const [healthError, setHealthError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadHealth = async () => {
      try {
        setLoadingHealth(true);
        setHealthError("");

        const response = await fetch(`${API_HTTP_BASE_URL}/health`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data: HealthResponse = await response.json();

        if (!cancelled) {
          setHealth(data);
        }
      } catch (err) {
        if (!cancelled) {
          setHealthError(
            err instanceof Error ? err.message : "Erro desconhecido ao ligar à API"
          );
          setHealth(null);
        }
      } finally {
        if (!cancelled) {
          setLoadingHealth(false);
        }
      }
    };

    void loadHealth();

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    health,
    loadingHealth,
    healthError,
  };
}

export default useApiHealth;