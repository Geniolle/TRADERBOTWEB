# C:\Trader-bot\app\services\stage_tests_service.py

from __future__ import annotations

import json
import os
import re
import shlex
import sqlite3
import subprocess
from decimal import Decimal, InvalidOperation
from datetime import datetime, timezone
from typing import Any
from urllib.parse import unquote, urlparse
from uuid import uuid4

from app.core.logging import get_logger
from app.core.settings import get_settings
from app.schemas.order import BinanceSpotOrderRequest
from app.services.binance_execution_service import (
    BinanceOrderApiError,
    BinanceOrderValidationError,
    BinanceSpotExecutionService,
)
from app.stage_tests.catalog import (
    get_stage_test_strategy_keys,
    list_stage_test_strategies,
)
from app.storage.database import SessionLocal
from app.storage.models import StrategyCaseModel, StrategyMetricsModel, StrategyRunModel

logger = get_logger(__name__)


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def normalize_symbol(symbol: str) -> str:
    if symbol is None:
        return ""

    value = symbol.upper().strip()

    for ch in ["/", "-", "_", " "]:
        value = value.replace(ch, "")

    return value


def get_db_path() -> str:
    settings = get_settings()

    env_db_path = os.getenv("DB_PATH", "").strip()
    if env_db_path:
        logger.info("[STAGE_TESTS] DB_PATH encontrado no ambiente: %s", env_db_path)
        return env_db_path

    database_url = (settings.database_url or "").strip()
    logger.info("[STAGE_TESTS] database_url lida das settings: %s", database_url)

    if not database_url:
        raise RuntimeError("database_url não configurada.")

    if database_url.startswith("sqlite:///"):
        raw_path = database_url.replace("sqlite:///", "", 1)
        raw_path = unquote(raw_path).strip()

        if not raw_path:
            raise RuntimeError("database_url SQLite inválida.")

        logger.info("[STAGE_TESTS] DB path derivado de database_url: %s", raw_path)
        return raw_path

    parsed = urlparse(database_url)
    if parsed.scheme == "sqlite":
        raw_path = unquote(parsed.path or "").strip()

        if raw_path.startswith("/"):
            raw_path = raw_path[1:]

        if not raw_path:
            raise RuntimeError("database_url SQLite inválida.")

        logger.info("[STAGE_TESTS] DB path derivado via urlparse: %s", raw_path)
        return raw_path

    raise RuntimeError(
        "Stage Tests suporta apenas SQLite neste momento. "
        f"database_url atual: {database_url}"
    )


def connect_db() -> sqlite3.Connection:
    db_path = get_db_path()
    logger.info("[STAGE_TESTS] A abrir ligação SQLite: %s", db_path)

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def list_stage_test_options(min_candles: int = 1) -> dict[str, Any]:
    logger.info("[STAGE_TESTS] list_stage_test_options | min_candles=%s", min_candles)

    sql = """
    SELECT
        UPPER(REPLACE(REPLACE(REPLACE(REPLACE(symbol, '/', ''), '-', ''), '_', ''), ' ', '')) AS normalized_symbol,
        timeframe,
        COUNT(*) AS candles_count,
        MIN(open_time) AS first_candle,
        MAX(open_time) AS last_candle
    FROM candles
    WHERE symbol IS NOT NULL
      AND TRIM(symbol) <> ''
      AND timeframe IS NOT NULL
      AND TRIM(timeframe) <> ''
    GROUP BY normalized_symbol, timeframe
    HAVING COUNT(*) >= ?
    ORDER BY normalized_symbol ASC, timeframe ASC
    """

    with connect_db() as conn:
        rows = conn.execute(sql, (min_candles,)).fetchall()

    items: list[dict[str, Any]] = []
    for row in rows:
        items.append(
            {
                "symbol": row["normalized_symbol"],
                "timeframe": row["timeframe"],
                "candles_count": int(row["candles_count"]),
                "first_candle": row["first_candle"],
                "last_candle": row["last_candle"],
            }
        )

    strategies = list_stage_test_strategies()

    logger.info(
        "[STAGE_TESTS] options carregadas | strategies=%s | symbol_timeframes=%s",
        len(strategies),
        len(items),
    )

    return {
        "strategies": strategies,
        "items": items,
        "refreshed_at": utc_now_iso(),
    }


def validate_symbol_timeframe(symbol: str, timeframe: str, min_candles: int = 1) -> None:
    normalized = normalize_symbol(symbol)

    logger.info(
        "[STAGE_TESTS] validate_symbol_timeframe | symbol=%s | timeframe=%s | min_candles=%s",
        normalized,
        timeframe,
        min_candles,
    )

    sql = """
    SELECT COUNT(*) AS total
    FROM candles
    WHERE UPPER(REPLACE(REPLACE(REPLACE(REPLACE(symbol, '/', ''), '-', ''), '_', ''), ' ', '')) = ?
      AND timeframe = ?
    """

    with connect_db() as conn:
        row = conn.execute(sql, (normalized, timeframe)).fetchone()

    total = int(row["total"]) if row else 0

    logger.info(
        "[STAGE_TESTS] validate_symbol_timeframe | encontrados=%s",
        total,
    )

    if total < min_candles:
        raise ValueError(
            f"Não existem candles suficientes para {normalized} {timeframe}. "
            f"Encontrados: {total}, mínimo exigido: {min_candles}."
        )


def validate_strategy(strategy: str) -> None:
    allowed_keys = set(get_stage_test_strategy_keys())

    logger.info(
        "[STAGE_TESTS] validate_strategy | strategy=%s | allowed=%s",
        strategy,
        sorted(allowed_keys),
    )

    if strategy not in allowed_keys:
        raise ValueError(
            f"Strategy inválida: {strategy}. "
            f"Permitidas: {', '.join(sorted(allowed_keys))}"
        )


def build_stage_test_command(
    symbol: str,
    timeframe: str,
    strategy: str,
    extra_args: list[str],
) -> list[str]:
    settings = get_settings()
    base_command = (settings.stage_test_run_command or "").strip()

    if not base_command:
        raise RuntimeError(
            "STAGE_TEST_RUN_COMMAND não configurado. "
            "Exemplo: python -m app.stage_tests.runner"
        )

    command = shlex.split(base_command)
    command.extend(
        [
            "--symbol",
            normalize_symbol(symbol),
            "--timeframe",
            timeframe,
            "--strategy",
            strategy,
        ]
    )

    if extra_args:
        command.extend(extra_args)

    logger.info("[STAGE_TESTS] command=%s", command)
    return command


def extract_metrics_from_stdout(stdout: str) -> dict[str, Any] | None:
    marker = "STAGE_TEST_RESULT_JSON="

    for line in reversed((stdout or "").splitlines()):
        if not line.startswith(marker):
            continue

        payload = line[len(marker):].strip()
        if not payload:
            return None

        try:
            data = json.loads(payload)
            if isinstance(data, dict):
                return data
        except Exception:
            return None

    return None


def extract_analysis_from_metrics(metrics: dict[str, Any] | None) -> dict[str, Any] | None:
    if not isinstance(metrics, dict):
        return None

    direct_candidates = [
        metrics.get("analysis"),
        metrics.get("technical_analysis"),
        metrics.get("validation_analysis"),
    ]

    for candidate in direct_candidates:
        if isinstance(candidate, dict):
            return candidate

    snapshot = metrics.get("analysis_snapshot")
    if isinstance(snapshot, dict):
        return {
            "summary": metrics.get("summary"),
            "direction": metrics.get("direction") or metrics.get("side"),
            "validated_at": metrics.get("validated_at") or metrics.get("validation_time"),
            "trigger_label": metrics.get("trigger_label") or metrics.get("trigger"),
            "snapshot": snapshot,
        }

    return None


def extract_cases_from_metrics(metrics: dict[str, Any] | None) -> list[dict[str, Any]] | None:
    if not isinstance(metrics, dict):
        return None

    raw_cases = metrics.get("cases")
    if not isinstance(raw_cases, list):
        return None

    normalized_cases: list[dict[str, Any]] = []

    for index, item in enumerate(raw_cases):
        if not isinstance(item, dict):
            continue

        case_id = item.get("id") or item.get("case_id") or f"case-{index + 1}"
        case_number = item.get("case_number") or index + 1

        normalized_case = {
            "id": case_id,
            "case_number": case_number,
            "side": item.get("side"),
            "status": item.get("status"),
            "outcome": item.get("outcome"),
            "trigger_price": item.get("trigger_price"),
            "entry_price": item.get("entry_price"),
            "close_price": item.get("close_price"),
            "target_price": item.get("target_price"),
            "invalidation_price": item.get("invalidation_price"),
            "trigger_time": item.get("trigger_time"),
            "trigger_candle_time": item.get("trigger_candle_time"),
            "entry_time": item.get("entry_time"),
            "close_time": item.get("close_time"),
            "bars_to_resolution": item.get("bars_to_resolution"),
            "max_favorable_excursion": item.get("max_favorable_excursion"),
            "max_adverse_excursion": item.get("max_adverse_excursion"),
            "close_reason": item.get("close_reason"),
            "analysis": item.get("analysis") if isinstance(item.get("analysis"), dict) else None,
            "metadata": item.get("metadata") if isinstance(item.get("metadata"), dict) else None,
        }

        normalized_cases.append(normalized_case)

    return normalized_cases


def to_int(value: Any, default: int = 0) -> int:
    try:
        if value is None:
            return default
        if isinstance(value, bool):
            return int(value)
        if isinstance(value, (int, float)):
            return int(value)
        raw = str(value).strip()
        if not raw:
            return default
        return int(float(raw.replace(",", ".")))
    except Exception:
        return default


def to_decimal(value: Any, default: str = "0") -> Decimal:
    if value is None:
        return Decimal(default)

    if isinstance(value, Decimal):
        return value

    try:
        if isinstance(value, (int, float)):
            return Decimal(str(value))

        raw = str(value).strip()
        if not raw:
            return Decimal(default)

        return Decimal(raw.replace(",", "."))
    except (InvalidOperation, TypeError, ValueError):
        return Decimal(default)


def parse_datetime(value: Any, fallback: datetime | None = None) -> datetime | None:
    if isinstance(value, datetime):
        parsed = value
    elif isinstance(value, str):
        raw = value.strip()
        if not raw:
            return fallback
        normalized = raw.replace("Z", "+00:00")
        try:
            parsed = datetime.fromisoformat(normalized)
        except ValueError:
            return fallback
    else:
        return fallback

    if parsed.tzinfo is not None:
        parsed = parsed.astimezone(timezone.utc).replace(tzinfo=None)

    return parsed


def to_float(value: Any) -> float | None:
    if value is None:
        return None

    if isinstance(value, bool):
        return float(value)

    if isinstance(value, (int, float)):
        numeric = float(value)
        return numeric if numeric == numeric else None

    raw = str(value).strip().replace(",", ".")
    if not raw:
        return None

    try:
        numeric = float(raw)
        return numeric if numeric == numeric else None
    except Exception:
        return None


def to_int_or_none(value: Any) -> int | None:
    if value is None:
        return None
    parsed = to_int(value, -1)
    return parsed if parsed >= 0 else None


def ensure_case_metadata(case: dict[str, Any]) -> dict[str, Any]:
    metadata = case.get("metadata")
    if isinstance(metadata, dict):
        return metadata
    metadata = {}
    case["metadata"] = metadata
    return metadata


def read_confirmation_score(case: dict[str, Any]) -> float | None:
    metadata = case.get("metadata") if isinstance(case.get("metadata"), dict) else {}
    analysis = case.get("analysis") if isinstance(case.get("analysis"), dict) else {}
    snapshot = analysis.get("snapshot") if isinstance(analysis.get("snapshot"), dict) else {}

    intelligence = (
        snapshot.get("candlestick_intelligence")
        if isinstance(snapshot.get("candlestick_intelligence"), dict)
        else {}
    )
    phase_3 = (
        intelligence.get("phase_3_confirmation")
        if isinstance(intelligence.get("phase_3_confirmation"), dict)
        else {}
    )

    candidates: list[Any] = [
        metadata.get("confirmation_score"),
        phase_3.get("confirmation_score"),
        analysis.get("confirmation_score"),
        case.get("confirmation_score"),
    ]

    for candidate in candidates:
        score = to_float(candidate)
        if score is not None:
            return score

    return None


def normalize_confirmation_score_percent(score: float | None) -> float | None:
    if score is None:
        return None

    if score <= 1:
        return score * 100

    if score <= 10:
        return score * 10

    return score


def resolve_order_side(case: dict[str, Any]) -> str | None:
    metadata = case.get("metadata") if isinstance(case.get("metadata"), dict) else {}
    candidates = [
        metadata.get("trade_bias"),
        metadata.get("setup_direction"),
        metadata.get("direction"),
        metadata.get("side"),
        case.get("side"),
    ]

    for candidate in candidates:
        raw = str(candidate or "").strip().lower()
        if raw in {"buy", "long", "compra"}:
            return "BUY"
        if raw in {"sell", "short", "venda"}:
            return "SELL"

    return None


def make_new_client_order_id(
    *,
    strategy: str,
    symbol: str,
    timeframe: str,
    case_number: int | None,
) -> str:
    short_strategy = re.sub(r"[^a-z0-9]", "", strategy.lower())[:8] or "stg"
    short_symbol = re.sub(r"[^a-z0-9]", "", symbol.lower())[:8] or "sym"
    short_timeframe = re.sub(r"[^a-z0-9]", "", timeframe.lower())[:4] or "tf"
    case_token = f"c{case_number}" if case_number is not None else "c0"
    timestamp_token = datetime.now(timezone.utc).strftime("%H%M%S")

    # Binance Spot newClientOrderId max length is 36.
    return f"stg-{short_strategy}-{short_symbol}-{short_timeframe}-{case_token}-{timestamp_token}"[
        :36
    ]


def sort_cases_for_order_attempt(cases: list[dict[str, Any]]) -> list[tuple[int, dict[str, Any]]]:
    indexed_cases: list[tuple[int, dict[str, Any], datetime]] = []
    fallback_time = datetime.min

    for index, case in enumerate(cases):
        case_time = (
            parse_datetime(case.get("entry_time"))
            or parse_datetime(case.get("trigger_time"))
            or parse_datetime(case.get("trigger_candle_time"))
            or fallback_time
        )
        indexed_cases.append((index, case, case_time))

    indexed_cases.sort(key=lambda item: item[2], reverse=True)
    return [(index, case) for index, case, _ in indexed_cases]


def apply_stage_test_auto_orders(
    *,
    symbol: str,
    timeframe: str,
    strategy: str,
    cases: list[dict[str, Any]] | None,
) -> dict[str, Any]:
    settings = get_settings()

    normalized_symbol = normalize_symbol(symbol)
    threshold = float(settings.stage_test_auto_order_min_confirmation_score)
    max_orders_per_run = max(int(settings.stage_test_auto_order_max_orders_per_run), 0)
    quote_order_qty = Decimal(str(settings.stage_test_auto_order_quote_order_qty))
    test_mode = bool(settings.stage_test_auto_order_test_mode)
    policy_enabled = bool(settings.stage_test_auto_order_enabled)

    normalized_cases = cases or []

    summary = {
        "policy_enabled": policy_enabled,
        "min_confirmation_score": threshold,
        "max_orders_per_run": max_orders_per_run,
        "test_mode": test_mode,
        "quote_order_qty": str(quote_order_qty),
        "total_cases": len(normalized_cases),
        "eligible_cases": 0,
        "attempted_orders": 0,
        "created_orders": 0,
        "failed_orders": 0,
        "skipped_orders": 0,
    }

    if not normalized_cases:
        return summary

    execution_service: BinanceSpotExecutionService | None = None
    service_init_error: str | None = None

    sorted_cases = sort_cases_for_order_attempt(normalized_cases)
    created_count = 0

    for _, case in sorted_cases:
        metadata = ensure_case_metadata(case)

        confirmation_score_raw = read_confirmation_score(case)
        confirmation_score = normalize_confirmation_score_percent(
            confirmation_score_raw
        )
        case_number = to_int_or_none(case.get("case_number"))
        side = resolve_order_side(case)

        order_payload: dict[str, Any] = {
            "policy_enabled": policy_enabled,
            "min_confirmation_score": threshold,
            "confirmation_score": confirmation_score,
            "confirmation_score_raw": confirmation_score_raw,
            "eligible": False,
            "attempted": False,
            "created": False,
            "status": "skipped",
            "reason": "",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "request": None,
            "response": None,
        }

        if not policy_enabled:
            order_payload["reason"] = "policy_disabled"
            metadata["order_execution"] = order_payload
            summary["skipped_orders"] += 1
            continue

        if confirmation_score is None:
            order_payload["reason"] = "missing_confirmation_score"
            metadata["order_execution"] = order_payload
            summary["skipped_orders"] += 1
            continue

        if confirmation_score < threshold:
            order_payload["reason"] = "below_threshold"
            metadata["order_execution"] = order_payload
            summary["skipped_orders"] += 1
            continue

        summary["eligible_cases"] += 1
        order_payload["eligible"] = True

        if max_orders_per_run == 0:
            order_payload["reason"] = "max_orders_per_run_zero"
            metadata["order_execution"] = order_payload
            summary["skipped_orders"] += 1
            continue

        if created_count >= max_orders_per_run:
            order_payload["reason"] = "max_orders_limit_reached"
            metadata["order_execution"] = order_payload
            summary["skipped_orders"] += 1
            continue

        if not side:
            order_payload["reason"] = "invalid_side"
            metadata["order_execution"] = order_payload
            summary["failed_orders"] += 1
            continue

        new_client_order_id = make_new_client_order_id(
            strategy=strategy,
            symbol=normalized_symbol,
            timeframe=timeframe,
            case_number=case_number,
        )

        request_payload = {
            "symbol": normalized_symbol,
            "side": side,
            "type": "MARKET",
            "quoteOrderQty": str(quote_order_qty),
            "testMode": test_mode,
            "newClientOrderId": new_client_order_id,
        }
        order_payload["request"] = request_payload
        order_payload["attempted"] = True
        summary["attempted_orders"] += 1

        try:
            if execution_service is None:
                execution_service = BinanceSpotExecutionService()

            response = execution_service.place_spot_order(
                BinanceSpotOrderRequest(**request_payload)
            )
            order_payload["created"] = True
            order_payload["status"] = "created"
            order_payload["reason"] = "order_sent"
            order_payload["response"] = {
                "status_code": response.get("status_code"),
                "endpoint": response.get("endpoint"),
                "symbol": response.get("symbol"),
                "side": response.get("side"),
                "type": response.get("type"),
                "safety": response.get("safety"),
                "exchange_response": response.get("exchange_response"),
            }
            created_count += 1
            summary["created_orders"] += 1
        except BinanceOrderValidationError as exc:
            if service_init_error is None:
                service_init_error = str(exc)
            order_payload["status"] = "failed"
            order_payload["reason"] = "validation_error"
            order_payload["response"] = {"error": str(exc)}
            summary["failed_orders"] += 1
        except BinanceOrderApiError as exc:
            order_payload["status"] = "failed"
            order_payload["reason"] = "api_error"
            order_payload["response"] = {
                "status_code": exc.status_code,
                "error_code": exc.error_code,
                "message": exc.message,
            }
            summary["failed_orders"] += 1
        except Exception as exc:
            order_payload["status"] = "failed"
            order_payload["reason"] = "unexpected_error"
            order_payload["response"] = {"error": str(exc)}
            summary["failed_orders"] += 1

        metadata["order_execution"] = order_payload

    if service_init_error:
        summary["service_error"] = service_init_error

    logger.info(
        "[STAGE_TESTS] auto_order | enabled=%s | threshold=%.2f | total=%s | eligible=%s | attempted=%s | created=%s | failed=%s | skipped=%s",
        summary["policy_enabled"],
        summary["min_confirmation_score"],
        summary["total_cases"],
        summary["eligible_cases"],
        summary["attempted_orders"],
        summary["created_orders"],
        summary["failed_orders"],
        summary["skipped_orders"],
    )

    return summary


def normalize_case_status(value: Any) -> str:
    raw = str(value or "").strip().lower()
    if raw in {"open", "opened"}:
        return "open"
    return "closed"


def normalize_case_outcome(value: Any) -> str | None:
    raw = str(value or "").strip().lower()
    if not raw:
        return None

    if raw in {"hit", "win", "target", "tp"}:
        return "hit"
    if raw in {"fail", "loss", "stop", "sl"}:
        return "fail"
    if raw in {"timeout", "expired", "time_out"}:
        return "timeout"
    if raw in {"cancelled", "canceled"}:
        return "cancelled"

    return raw


def average_decimal(values: list[Decimal]) -> Decimal:
    if not values:
        return Decimal("0")
    return sum(values, Decimal("0")) / Decimal(len(values))


def persist_stage_test_run(
    *,
    symbol: str,
    timeframe: str,
    stage_strategy: str,
    metrics: dict[str, Any] | None,
    cases: list[dict[str, Any]] | None,
    return_code: int,
    started_at_utc: datetime,
    finished_at_utc: datetime,
) -> tuple[str | None, str | None]:
    session = SessionLocal()
    persisted_run_id: str | None = None

    try:
        normalized_symbol = normalize_symbol(symbol)
        runtime_strategy = str(
            (metrics or {}).get("runtime_strategy") or stage_strategy
        ).strip() or stage_strategy
        stage_config_id = f"stage-test::{stage_strategy}"

        started_at = parse_datetime(started_at_utc, started_at_utc)
        finished_at = parse_datetime(finished_at_utc, finished_at_utc)

        start_at = parse_datetime(
            (metrics or {}).get("first_candle"),
            started_at,
        ) or started_at
        end_at = parse_datetime(
            (metrics or {}).get("last_candle"),
            finished_at,
        )

        normalized_cases = cases or []
        closed_cases_count = to_int((metrics or {}).get("closed_cases"), len(normalized_cases))
        trigger_count = to_int((metrics or {}).get("triggers"), closed_cases_count)
        total_candles = to_int((metrics or {}).get("total_candles"), 0)

        persisted_run_id = str(uuid4())

        run_row = StrategyRunModel(
            id=persisted_run_id,
            strategy_key=stage_strategy,
            strategy_config_id=stage_config_id,
            mode="replay",
            asset_id=None,
            symbol=normalized_symbol,
            timeframe=timeframe,
            start_at=start_at,
            end_at=end_at,
            status="completed" if return_code == 0 else "failed",
            total_candles_processed=total_candles,
            total_cases_opened=trigger_count,
            total_cases_closed=closed_cases_count,
            started_at=started_at,
            finished_at=finished_at,
        )
        session.add(run_row)

        bars_values: list[Decimal] = []
        duration_seconds_values: list[Decimal] = []
        mfe_values: list[Decimal] = []
        mae_values: list[Decimal] = []

        for index, case in enumerate(normalized_cases):
            case_id_raw = str(case.get("id") or "").strip()
            # Persist always with a DB-unique id. Stage test case ids are often
            # "case-1", "case-2", etc. and collide across different runs.
            case_id = str(uuid4())

            trigger_time = parse_datetime(case.get("trigger_time"), start_at) or start_at
            trigger_candle_time = (
                parse_datetime(case.get("trigger_candle_time"), trigger_time) or trigger_time
            )
            entry_time = parse_datetime(case.get("entry_time"), trigger_candle_time) or trigger_candle_time
            close_time = parse_datetime(case.get("close_time"), None)
            timeout_at = parse_datetime(case.get("timeout_at"), None)

            entry_price = to_decimal(
                case.get("entry_price")
                if case.get("entry_price") is not None
                else case.get("trigger_price")
            )
            target_price = to_decimal(
                case.get("target_price")
                if case.get("target_price") is not None
                else entry_price
            )
            invalidation_price = to_decimal(
                case.get("invalidation_price")
                if case.get("invalidation_price") is not None
                else entry_price
            )
            close_price = (
                to_decimal(case.get("close_price"))
                if case.get("close_price") is not None
                else None
            )

            bars_to_resolution = to_int(case.get("bars_to_resolution"), 0)
            mfe = to_decimal(case.get("max_favorable_excursion"), "0")
            mae = to_decimal(case.get("max_adverse_excursion"), "0")

            if bars_to_resolution >= 0:
                bars_values.append(Decimal(bars_to_resolution))
            mfe_values.append(mfe)
            mae_values.append(mae)

            if close_time is not None:
                elapsed_seconds = max((close_time - entry_time).total_seconds(), 0.0)
                duration_seconds_values.append(Decimal(str(elapsed_seconds)))

            metadata_payload: dict[str, Any] = {}
            raw_metadata = case.get("metadata")
            if isinstance(raw_metadata, dict):
                metadata_payload.update(raw_metadata)

            raw_analysis = case.get("analysis")
            if isinstance(raw_analysis, dict):
                metadata_payload.setdefault("analysis", raw_analysis)

            if case.get("close_reason") is not None:
                metadata_payload.setdefault("close_reason", case.get("close_reason"))

            metadata_payload.setdefault("stage_test_strategy_key", stage_strategy)
            metadata_payload.setdefault("runtime_strategy_key", runtime_strategy)
            metadata_payload.setdefault("case_number", case.get("case_number") or index + 1)
            if case_id_raw:
                metadata_payload.setdefault("source_case_id", case_id_raw)

            case_row = StrategyCaseModel(
                id=case_id,
                run_id=persisted_run_id,
                strategy_config_id=stage_config_id,
                asset_id=None,
                symbol=normalized_symbol,
                timeframe=timeframe,
                trigger_time=trigger_time,
                trigger_candle_time=trigger_candle_time,
                entry_time=entry_time,
                entry_price=entry_price,
                target_price=target_price,
                invalidation_price=invalidation_price,
                timeout_at=timeout_at,
                status=normalize_case_status(case.get("status")),
                outcome=normalize_case_outcome(case.get("outcome")),
                close_time=close_time,
                close_price=close_price,
                bars_to_resolution=bars_to_resolution,
                max_favorable_excursion=mfe,
                max_adverse_excursion=mae,
                metadata_json=json.dumps(metadata_payload, ensure_ascii=False, default=str),
            )
            session.add(case_row)

        total_hits = to_int(
            (metrics or {}).get("hits"),
            sum(1 for case in normalized_cases if normalize_case_outcome(case.get("outcome")) == "hit"),
        )
        total_fails = to_int(
            (metrics or {}).get("fails"),
            sum(1 for case in normalized_cases if normalize_case_outcome(case.get("outcome")) == "fail"),
        )
        total_timeouts = to_int(
            (metrics or {}).get("timeouts"),
            sum(1 for case in normalized_cases if normalize_case_outcome(case.get("outcome")) == "timeout"),
        )

        total_cases_for_rates = max(closed_cases_count, 1)
        computed_hit_rate = Decimal(total_hits * 100) / Decimal(total_cases_for_rates)
        computed_fail_rate = Decimal(total_fails * 100) / Decimal(total_cases_for_rates)
        computed_timeout_rate = Decimal(total_timeouts * 100) / Decimal(total_cases_for_rates)

        metrics_row = StrategyMetricsModel(
            id=str(uuid4()),
            run_id=persisted_run_id,
            total_cases=closed_cases_count,
            total_hits=total_hits,
            total_fails=total_fails,
            total_timeouts=total_timeouts,
            hit_rate=to_decimal((metrics or {}).get("hit_rate"), str(computed_hit_rate)),
            fail_rate=to_decimal((metrics or {}).get("fail_rate"), str(computed_fail_rate)),
            timeout_rate=to_decimal(
                (metrics or {}).get("timeout_rate"),
                str(computed_timeout_rate),
            ),
            avg_bars_to_resolution=average_decimal(bars_values),
            avg_time_to_resolution_seconds=average_decimal(duration_seconds_values),
            avg_mfe=average_decimal(mfe_values),
            avg_mae=average_decimal(mae_values),
        )
        session.add(metrics_row)

        session.commit()

        logger.info(
            "[STAGE_TESTS] persistência concluída | run_id=%s | strategy=%s | symbol=%s | timeframe=%s | cases=%s",
            persisted_run_id,
            stage_strategy,
            normalized_symbol,
            timeframe,
            len(normalized_cases),
        )

        return persisted_run_id, None
    except Exception as exc:
        session.rollback()
        logger.exception("[STAGE_TESTS] falha ao persistir run de stage test: %s", exc)
        return None, "db_persistence_failed"
    finally:
        session.close()


def run_stage_test(
    symbol: str,
    timeframe: str,
    strategy: str,
    min_candles: int = 1,
    extra_args: list[str] | None = None,
) -> dict[str, Any]:
    extra_args = extra_args or []
    started_at_utc = datetime.now(timezone.utc)

    logger.info(
        "[STAGE_TESTS] run_stage_test | symbol=%s | timeframe=%s | strategy=%s | min_candles=%s | extra_args=%s",
        symbol,
        timeframe,
        strategy,
        min_candles,
        extra_args,
    )

    validate_strategy(strategy)

    validate_symbol_timeframe(
        symbol=symbol,
        timeframe=timeframe,
        min_candles=min_candles,
    )

    command = build_stage_test_command(
        symbol=symbol,
        timeframe=timeframe,
        strategy=strategy,
        extra_args=extra_args,
    )

    result = subprocess.run(
        command,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    finished_at_utc = datetime.now(timezone.utc)

    stdout_text = result.stdout or ""
    stderr_text = result.stderr or ""

    if stdout_text.strip():
        logger.info("[STAGE_TESTS] runner stdout:\n%s", stdout_text)
    else:
        logger.info("[STAGE_TESTS] runner stdout: <vazio>")

    if stderr_text.strip():
        logger.info("[STAGE_TESTS] runner stderr:\n%s", stderr_text)
    else:
        logger.info("[STAGE_TESTS] runner stderr: <vazio>")

    metrics = extract_metrics_from_stdout(stdout_text)
    analysis = extract_analysis_from_metrics(metrics)
    cases = extract_cases_from_metrics(metrics)
    order_summary = apply_stage_test_auto_orders(
        symbol=symbol,
        timeframe=timeframe,
        strategy=strategy,
        cases=cases,
    )

    if isinstance(metrics, dict):
        logger.info(
            "[STAGE_TESTS] metrics keys=%s",
            sorted(metrics.keys()),
        )
    else:
        logger.info("[STAGE_TESTS] metrics keys=<sem metrics>")

    if isinstance(analysis, dict):
        logger.info(
            "[STAGE_TESTS] analysis keys=%s",
            sorted(analysis.keys()),
        )
    else:
        logger.info("[STAGE_TESTS] analysis keys=<sem analysis>")

    if isinstance(cases, list) and cases:
        first_case = cases[0]
        logger.info(
            "[STAGE_TESTS] first case keys=%s",
            sorted(first_case.keys()),
        )

        first_analysis = first_case.get("analysis")
        if isinstance(first_analysis, dict):
            logger.info(
                "[STAGE_TESTS] first case analysis keys=%s",
                sorted(first_analysis.keys()),
            )
            snapshot = first_analysis.get("snapshot")
            if isinstance(snapshot, dict):
                logger.info(
                    "[STAGE_TESTS] first case snapshot keys=%s",
                    sorted(snapshot.keys()),
                )
                trend = snapshot.get("trend")
                if isinstance(trend, dict):
                    logger.info(
                        "[STAGE_TESTS] first case trend=%s",
                        json.dumps(trend, ensure_ascii=False, default=str),
                    )
                else:
                    logger.info("[STAGE_TESTS] first case trend=<sem trend>")
            else:
                logger.info("[STAGE_TESTS] first case snapshot=<sem snapshot>")
        else:
            logger.info("[STAGE_TESTS] first case analysis=<sem analysis>")
    else:
        logger.info("[STAGE_TESTS] first case=<sem cases>")

    logger.info(
        "[STAGE_TESTS] run concluído | return_code=%s | ok=%s | metrics_present=%s | analysis_present=%s | cases_present=%s",
        result.returncode,
        result.returncode == 0,
        metrics is not None,
        analysis is not None,
        cases is not None,
    )

    persisted_run_id, persistence_error = persist_stage_test_run(
        symbol=symbol,
        timeframe=timeframe,
        stage_strategy=strategy,
        metrics=metrics,
        cases=cases,
        return_code=int(result.returncode),
        started_at_utc=started_at_utc,
        finished_at_utc=finished_at_utc,
    )

    return {
        "ok": result.returncode == 0,
        "command": command,
        "symbol": normalize_symbol(symbol),
        "timeframe": timeframe,
        "strategy": strategy,
        "stdout": stdout_text,
        "stderr": stderr_text,
        "return_code": int(result.returncode),
        "metrics": metrics,
        "analysis": analysis,
        "cases": cases,
        "orders": order_summary,
        "persisted": persisted_run_id is not None,
        "persisted_run_id": persisted_run_id,
        "persistence_error": persistence_error,
    }
