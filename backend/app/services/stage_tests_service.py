# C:\Trader-bot\app\services\stage_tests_service.py

from __future__ import annotations

import json
import os
import shlex
import sqlite3
import subprocess
from datetime import datetime, timezone
from typing import Any
from urllib.parse import unquote, urlparse

from app.core.logging import get_logger
from app.core.settings import get_settings
from app.stage_tests.catalog import (
    get_stage_test_strategy_keys,
    list_stage_test_strategies,
)

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


def run_stage_test(
    symbol: str,
    timeframe: str,
    strategy: str,
    min_candles: int = 1,
    extra_args: list[str] | None = None,
) -> dict[str, Any]:
    extra_args = extra_args or []

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
    }