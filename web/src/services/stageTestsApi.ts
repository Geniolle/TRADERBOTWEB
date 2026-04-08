import type {
  StageTestOptionsResponse,
  StageTestRunRequest,
  StageTestRunResponse,
} from "../types/stageTests";

type ErrorPayload = {
  detail?: string;
};

type ImportMetaEnvLike = {
  VITE_API_BASE_URL?: string;
};

type ImportMetaLike = {
  env?: ImportMetaEnvLike;
};

function getApiBase(): string {
  const meta = import.meta as ImportMetaLike;
  const rawBase = meta.env?.VITE_API_BASE_URL?.trim();

  if (!rawBase) {
    return "http://127.0.0.1:8000";
  }

  return rawBase.replace(/\/$/, "");
}

const API_BASE = getApiBase();

async function handleResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const payload: unknown = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    let detail = "Erro inesperado na API";

    if (typeof payload === "string" && payload.trim()) {
      detail = payload;
    } else if (
      typeof payload === "object" &&
      payload !== null &&
      "detail" in payload
    ) {
      const errorPayload = payload as ErrorPayload;
      if (typeof errorPayload.detail === "string" && errorPayload.detail.trim()) {
        detail = errorPayload.detail;
      }
    }

    throw new Error(detail);
  }

  return payload as T;
}

export async function fetchStageTestOptions(
  minCandles = 1
): Promise<StageTestOptionsResponse> {
  const response = await fetch(
    `${API_BASE}/api/v1/stage-tests/options?min_candles=${minCandles}`,
    {
      method: "GET",
    }
  );

  return handleResponse<StageTestOptionsResponse>(response);
}

export async function runStageTest(
  payload: StageTestRunRequest
): Promise<StageTestRunResponse> {
  const response = await fetch(`${API_BASE}/api/v1/stage-tests/run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return handleResponse<StageTestRunResponse>(response);
}