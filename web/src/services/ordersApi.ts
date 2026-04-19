import { API_HTTP_BASE_URL } from "../constants/config";

type BinanceOrderApiErrorDetail = {
  message?: string;
  error_code?: number | null;
};

export type BinanceSpotOrderRequestPayload = {
  symbol: string;
  side: "BUY" | "SELL";
  type: "MARKET" | "LIMIT";
  quantity?: string | number;
  quoteOrderQty?: string | number;
  price?: string | number;
  timeInForce?: string;
  newClientOrderId?: string;
  recvWindow?: number;
  testMode?: boolean;
};

export type BinanceSpotOrderResponsePayload = {
  ok: boolean;
  test_mode: boolean;
  endpoint: string;
  symbol: string;
  side: string;
  type: string;
  status_code: number;
  safety: {
    base_url: string;
    require_testnet: boolean;
    is_testnet_url: boolean;
  };
  sent_params: Record<string, unknown>;
  exchange_response: Record<string, unknown>;
};

export type BinanceSpotOrderProposalConfirmationRequestPayload = {
  symbol: string;
  timeframe: string;
  strategyKey: string;
  source?: string;
  candleOpenTime?: string;
  parameterOverrides?: Record<string, unknown>;
  maxCandles?: number;
};

export type BinanceSpotOrderProposalConfirmationResponsePayload = {
  ok: boolean;
  confirmed: boolean;
  reason: string;
  message: string;
  strategy_key: string;
  runtime_strategy_key: string;
  symbol: string;
  timeframe: string;
  source?: string | null;
  candles_used: number;
  warmup_required: number;
  evaluated_candle_open_time?: string | null;
  reference_candle_open_time?: string | null;
  metadata: Record<string, unknown>;
};

export type BinanceSpotOrderHistoryItem = {
  symbol?: string;
  orderId?: number;
  clientOrderId?: string;
  status?: string;
  side?: string;
  type?: string;
  price?: string;
  origQty?: string;
  executedQty?: string;
  cummulativeQuoteQty?: string;
  origQuoteOrderQty?: string;
  time?: number;
  updateTime?: number;
  transactTime?: number;
  [key: string]: unknown;
};

export type BinanceSpotOrderHistoryResponsePayload = {
  ok: boolean;
  symbol: string;
  limit: number;
  count: number;
  safety: {
    base_url: string;
    require_testnet: boolean;
    is_testnet_url: boolean;
  };
  items: BinanceSpotOrderHistoryItem[];
};

function extractErrorMessage(payload: unknown): string {
  if (typeof payload === "string" && payload.trim()) {
    return payload;
  }

  if (!payload || typeof payload !== "object") {
    return "Erro inesperado ao enviar ordem para Binance.";
  }

  const record = payload as Record<string, unknown>;

  if (typeof record.detail === "string" && record.detail.trim()) {
    return record.detail;
  }

  if (record.detail && typeof record.detail === "object") {
    const detail = record.detail as BinanceOrderApiErrorDetail;
    const message = typeof detail.message === "string" ? detail.message.trim() : "";
    const errorCode =
      typeof detail.error_code === "number" ? ` (code=${detail.error_code})` : "";

    if (message) {
      return `${message}${errorCode}`;
    }
  }

  return "Erro inesperado ao enviar ordem para Binance.";
}

async function handleResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const payload: unknown = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    throw new Error(extractErrorMessage(payload));
  }

  return payload as T;
}

export async function placeBinanceSpotOrder(
  payload: BinanceSpotOrderRequestPayload,
): Promise<BinanceSpotOrderResponsePayload> {
  const response = await fetch(`${API_HTTP_BASE_URL}/orders/binance/spot`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return handleResponse<BinanceSpotOrderResponsePayload>(response);
}

export async function confirmBinanceSpotOrderProposal(
  payload: BinanceSpotOrderProposalConfirmationRequestPayload,
): Promise<BinanceSpotOrderProposalConfirmationResponsePayload> {
  const response = await fetch(
    `${API_HTTP_BASE_URL}/orders/binance/spot/proposal/confirm`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  return handleResponse<BinanceSpotOrderProposalConfirmationResponsePayload>(response);
}

export async function fetchBinanceSpotOrderHistory(params: {
  symbol: string;
  limit?: number;
}): Promise<BinanceSpotOrderHistoryResponsePayload> {
  const query = new URLSearchParams();
  query.set("symbol", params.symbol);
  query.set("limit", String(params.limit ?? 50));

  const response = await fetch(
    `${API_HTTP_BASE_URL}/orders/binance/spot/all?${query.toString()}`,
    {
      method: "GET",
    },
  );

  return handleResponse<BinanceSpotOrderHistoryResponsePayload>(response);
}
