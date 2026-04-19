from __future__ import annotations

import hashlib
import hmac
import json
import time
from decimal import Decimal
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from app.core.logging import get_logger
from app.core.settings import get_settings
from app.schemas.order import BinanceSpotOrderRequest

logger = get_logger(__name__)


class BinanceOrderValidationError(ValueError):
    pass


class BinanceOrderApiError(RuntimeError):
    def __init__(
        self,
        *,
        status_code: int,
        message: str,
        error_code: int | None = None,
        raw_body: str | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.message = message
        self.error_code = error_code
        self.raw_body = raw_body


class BinanceSpotExecutionService:
    def __init__(self) -> None:
        settings = get_settings()

        api_key = str(
            settings.binance_trading_api_key or settings.binance_api_key or ""
        ).strip()
        api_secret = str(
            settings.binance_trading_api_secret or settings.binance_api_secret or ""
        ).strip()

        if not api_key or not api_secret:
            raise BinanceOrderValidationError(
                "Missing env vars: BINANCE_TRADING_API_KEY/BINANCE_TRADING_API_SECRET "
                "(or BINANCE_API_KEY/BINANCE_API_SECRET as fallback)."
            )

        self.api_key = api_key
        self.api_secret = api_secret
        self.base_url = self._normalize_base_url(settings.binance_trading_base_url)
        self.recv_window_ms = int(settings.binance_trading_recv_window_ms)
        self.timeout_seconds = int(settings.binance_trading_timeout_seconds)
        self.require_testnet = bool(settings.binance_trading_require_testnet)

    def place_spot_order(self, request: BinanceSpotOrderRequest) -> dict:
        symbol = request.symbol.strip().upper()
        side = request.side.strip().upper()
        order_type = request.order_type.strip().upper()

        if side not in {"BUY", "SELL"}:
            raise BinanceOrderValidationError("side must be BUY or SELL")

        if order_type not in {"MARKET", "LIMIT"}:
            raise BinanceOrderValidationError("type must be MARKET or LIMIT")

        is_testnet_url = self._is_testnet_url(self.base_url)
        if self.require_testnet and not is_testnet_url:
            raise BinanceOrderValidationError(
                "BINANCE_TRADING_REQUIRE_TESTNET=true, but BINANCE_TRADING_BASE_URL "
                "does not look like a testnet URL."
            )

        endpoint = "/api/v3/order/test" if request.test_mode else "/api/v3/order"

        params: dict[str, str | int] = {
            "symbol": symbol,
            "side": side,
            "type": order_type,
            "timestamp": int(time.time() * 1000),
            "recvWindow": int(request.recv_window or self.recv_window_ms),
        }

        if request.new_client_order_id:
            params["newClientOrderId"] = request.new_client_order_id

        if order_type == "LIMIT":
            if request.quantity is None or request.price is None:
                raise BinanceOrderValidationError(
                    "LIMIT order requires quantity and price."
                )
            params["timeInForce"] = str(request.time_in_force or "GTC").upper()
            params["quantity"] = self._decimal_as_str(request.quantity)
            params["price"] = self._decimal_as_str(request.price)
        else:
            if request.quantity is None and request.quote_order_qty is None:
                raise BinanceOrderValidationError(
                    "MARKET order requires quantity or quoteOrderQty."
                )
            if request.quantity is not None:
                params["quantity"] = self._decimal_as_str(request.quantity)
            if request.quote_order_qty is not None:
                params["quoteOrderQty"] = self._decimal_as_str(request.quote_order_qty)

        logger.info(
            "[BINANCE_EXEC] place_spot_order | endpoint=%s | test_mode=%s | symbol=%s | side=%s | type=%s",
            endpoint,
            request.test_mode,
            symbol,
            side,
            order_type,
        )

        status_code, payload = self._signed_request(
            method="POST",
            endpoint=endpoint,
            params=params,
        )
        parsed_response = payload if isinstance(payload, dict) else {}

        sent_params = dict(params)
        sent_params.pop("timestamp", None)
        sent_params.pop("recvWindow", None)

        return {
            "ok": True,
            "test_mode": bool(request.test_mode),
            "endpoint": endpoint,
            "symbol": symbol,
            "side": side,
            "type": order_type,
            "status_code": status_code,
            "safety": {
                "base_url": self.base_url,
                "require_testnet": self.require_testnet,
                "is_testnet_url": is_testnet_url,
            },
            "sent_params": sent_params,
            "exchange_response": parsed_response,
        }

    def get_spot_order_history(
        self,
        *,
        symbol: str,
        limit: int = 50,
        order_id: int | None = None,
        start_time: int | None = None,
        end_time: int | None = None,
    ) -> dict:
        normalized_symbol = str(symbol or "").strip().upper()
        if not normalized_symbol:
            raise BinanceOrderValidationError("symbol is required.")

        if limit < 1 or limit > 1000:
            raise BinanceOrderValidationError("limit must be between 1 and 1000.")

        is_testnet_url = self._is_testnet_url(self.base_url)
        if self.require_testnet and not is_testnet_url:
            raise BinanceOrderValidationError(
                "BINANCE_TRADING_REQUIRE_TESTNET=true, but BINANCE_TRADING_BASE_URL "
                "does not look like a testnet URL."
            )

        params: dict[str, str | int] = {
            "symbol": normalized_symbol,
            "limit": int(limit),
            "timestamp": int(time.time() * 1000),
            "recvWindow": int(self.recv_window_ms),
        }

        if order_id is not None:
            params["orderId"] = int(order_id)
        if start_time is not None:
            params["startTime"] = int(start_time)
        if end_time is not None:
            params["endTime"] = int(end_time)

        logger.info(
            "[BINANCE_EXEC] get_spot_order_history | symbol=%s | limit=%s",
            normalized_symbol,
            limit,
        )

        _, payload = self._signed_request(
            method="GET",
            endpoint="/api/v3/allOrders",
            params=params,
        )

        if isinstance(payload, list):
            items = [item for item in payload if isinstance(item, dict)]
        else:
            items = []

        return {
            "ok": True,
            "symbol": normalized_symbol,
            "limit": int(limit),
            "count": len(items),
            "safety": {
                "base_url": self.base_url,
                "require_testnet": self.require_testnet,
                "is_testnet_url": is_testnet_url,
            },
            "items": items,
        }

    def _normalize_base_url(self, raw_base_url: str) -> str:
        value = str(raw_base_url or "").strip().rstrip("/")
        if not value:
            return ""

        if value.lower().endswith("/api"):
            value = value[:-4].rstrip("/")

        return value

    def _is_testnet_url(self, url: str) -> bool:
        lowered = str(url or "").lower()
        return "testnet" in lowered or "demo" in lowered

    def _signed_request(
        self,
        *,
        method: str,
        endpoint: str,
        params: dict[str, str | int],
    ) -> tuple[int, dict | list | str]:
        method_upper = method.strip().upper()
        query = urlencode(params)
        signature = hmac.new(
            self.api_secret.encode("utf-8"),
            query.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        signed_query = f"{query}&signature={signature}"

        request_url = f"{self.base_url}{endpoint}"
        request_data: bytes | None = None

        if method_upper == "GET":
            request_url = f"{request_url}?{signed_query}"
        else:
            request_data = signed_query.encode("utf-8")

        http_request = Request(
            request_url,
            data=request_data,
            method=method_upper,
            headers={
                "Accept": "application/json",
                "Content-Type": "application/x-www-form-urlencoded",
                "X-MBX-APIKEY": self.api_key,
                "User-Agent": "Trader-Bot/1.0",
            },
        )

        try:
            with urlopen(http_request, timeout=self.timeout_seconds) as response:
                status_code = int(response.status)
                response_text = response.read().decode("utf-8")
        except HTTPError as exc:
            raw_body = exc.read().decode("utf-8", errors="replace")
            error_message = raw_body
            error_code: int | None = None
            try:
                payload = json.loads(raw_body)
                if isinstance(payload, dict):
                    error_message = str(payload.get("msg") or raw_body)
                    payload_code = payload.get("code")
                    if payload_code is not None:
                        try:
                            error_code = int(payload_code)
                        except Exception:
                            error_code = None
            except json.JSONDecodeError:
                pass
            raise BinanceOrderApiError(
                status_code=int(exc.code),
                message=error_message,
                error_code=error_code,
                raw_body=raw_body,
            ) from exc
        except URLError as exc:
            raise BinanceOrderApiError(
                status_code=502,
                message=f"Binance network error: {exc.reason}",
            ) from exc

        parsed_payload: dict | list | str = {}
        if response_text.strip():
            try:
                payload = json.loads(response_text)
                if isinstance(payload, (dict, list)):
                    parsed_payload = payload
                else:
                    parsed_payload = response_text
            except json.JSONDecodeError:
                parsed_payload = response_text

        return status_code, parsed_payload

    def _decimal_as_str(self, value: Decimal) -> str:
        decimal_value = Decimal(str(value))
        normalized = decimal_value.normalize()
        return format(normalized, "f")
