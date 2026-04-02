// src/hooks/useRunDetails.ts

import { useEffect, useMemo, useState } from "react";

import { API_HTTP_BASE_URL } from "../constants/config";
import type { RunDetailsResponse } from "../types/trading";

type UseRunDetailsResult = {
  runDetails: RunDetailsResponse | null;
  selectedCaseId: string;
  setSelectedCaseId: (value: string) => void;
  loadingRunDetails: boolean;
  runDetailsError: string;
};

function useRunDetails(selectedRunId: string): UseRunDetailsResult {
  const [runDetails, setRunDetails] = useState<RunDetailsResponse | null>(null);
  const [selectedCaseId, setSelectedCaseId] = useState<string>("");
  const [loadingRunDetails, setLoadingRunDetails] = useState(false);
  const [runDetailsError, setRunDetailsError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadRunDetails = async () => {
      if (!selectedRunId) {
        setRunDetails(null);
        setSelectedCaseId("");
        return;
      }

      try {
        setLoadingRunDetails(true);
        setRunDetailsError("");

        const response = await fetch(`${API_HTTP_BASE_URL}/run-details/${selectedRunId}`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data: RunDetailsResponse = await response.json();

        if (cancelled) return;

        setRunDetails(data);

        if (data.cases.length > 0) {
          setSelectedCaseId((prev) => {
            const exists = data.cases.some((item) => item.id === prev);
            return exists ? prev : data.cases[0].id;
          });
        } else {
          setSelectedCaseId("");
        }
      } catch (err) {
        if (!cancelled) {
          setRunDetailsError(
            err instanceof Error
              ? err.message
              : "Erro desconhecido ao carregar detalhes do run"
          );
          setRunDetails(null);
          setSelectedCaseId("");
        }
      } finally {
        if (!cancelled) {
          setLoadingRunDetails(false);
        }
      }
    };

    void loadRunDetails();

    return () => {
      cancelled = true;
    };
  }, [selectedRunId]);

  return useMemo(
    () => ({
      runDetails,
      selectedCaseId,
      setSelectedCaseId,
      loadingRunDetails,
      runDetailsError,
    }),
    [runDetails, selectedCaseId, loadingRunDetails, runDetailsError]
  );
}

export default useRunDetails;