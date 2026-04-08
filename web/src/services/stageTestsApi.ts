import type {
  StageTestOptionsResponse,
  StageTestRunRequest,
  StageTestRunResponse,
} from "../types/stageTests";

const API_BASE =
  (import.meta as any).env?.VITE_API_BASE_URL?.replace(/\/$/, "") || "";

async function handleResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  const payload = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const detail =
      typeof payload === "string"
        ? payload
        : payload?.detail || "Erro inesperado na API";
    throw new Error(detail);
  }

  return payload as T;
}

export async function fetchStageTestOptions(
  minCandles = 1
): Promise<StageTestOptionsResponse> {
  const response = await fetch(
    `${API_BASE}/api/stage-tests/options?min_candles=${minCandles}`,
    {
      method: "GET",
    }
  );

  return handleResponse<StageTestOptionsResponse>(response);
}

export async function runStageTest(
  payload: StageTestRunRequest
): Promise<StageTestRunResponse> {
  const response = await fetch(`${API_BASE}/api/stage-tests/run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return handleResponse<StageTestRunResponse>(response);
}