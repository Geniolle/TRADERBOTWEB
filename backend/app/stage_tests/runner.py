# C:\Trader-bot\app\stage_tests\runner.py

from __future__ import annotations

import argparse
import inspect
import json
import os
import sqlite3
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any
from urllib.parse import unquote, urlparse

from app.core.settings import get_settings
from app.models.domain.candle import Candle
from app.models.domain.strategy_config import StrategyConfig
from app.models.domain.strategy_run import StrategyRun
from app.registry.strategy_registry import build_strategy_registry
from app.stage_tests.strategy_mapper import (
    get_default_parameters,
    resolve_runtime_strategy_key,
)


def normalize_symbol(symbol: str) -> str:
    value = symbol.upper().strip()
    for ch in ["/", "-", "_", " "]:
        value = value.replace(ch, "")
    return value


def get_db_path() -> str:
    env_db_path = os.getenv("DB_PATH", "").strip()
    if env_db_path:
        return env_db_path

    settings = get_settings()
    database_url = (settings.database_url or "").strip()

    if not database_url:
        raise RuntimeError("database_url não configurada e DB_PATH não definido.")

    if database_url.startswith("sqlite:///"):
        raw_path = database_url.replace("sqlite:///", "", 1)
        raw_path = unquote(raw_path).strip()
        if not raw_path:
            raise RuntimeError("database_url SQLite inválida.")
        return raw_path

    parsed = urlparse(database_url)
    if parsed.scheme == "sqlite":
        raw_path = unquote(parsed.path or "").strip()
        if raw_path.startswith("/"):
            raw_path = raw_path[1:]
        if not raw_path:
            raise RuntimeError("database_url SQLite inválida.")
        return raw_path

    raise RuntimeError(
        "Stage Tests suporta apenas SQLite neste momento. "
        f"database_url atual: {database_url}"
    )


def get_existing_candle_columns(conn: sqlite3.Connection) -> set[str]:
    rows = conn.execute("PRAGMA table_info(candles)").fetchall()
    return {str(row[1]) for row in rows}


def load_candles_rows(symbol: str, timeframe: str) -> list[sqlite3.Row]:
    conn = sqlite3.connect(get_db_path())
    conn.row_factory = sqlite3.Row

    existing_columns = get_existing_candle_columns(conn)

    required_columns = [
        "open_time",
        "close_time",
        "open",
        "high",
        "low",
        "close",
        "symbol",
        "timeframe",
    ]

    missing_required = [col for col in required_columns if col not in existing_columns]
    if missing_required:
        conn.close()
        raise RuntimeError(
            f"A tabela candles não contém as colunas obrigatórias: {missing_required}"
        )

    candidate_columns = [
        "id",
        "asset_id",
        "symbol",
        "timeframe",
        "open_time",
        "close_time",
        "open",
        "high",
        "low",
        "close",
        "volume",
        "source",
        "provider",
        "market_session",
        "timezone",
        "is_delayed",
        "is_mock",
    ]

    selected_columns = [col for col in candidate_columns if col in existing_columns]
    select_clause = ",\n        ".join(selected_columns)

    sql = f"""
    SELECT
        {select_clause}
    FROM candles
    WHERE UPPER(REPLACE(REPLACE(REPLACE(REPLACE(symbol, '/', ''), '-', ''), '_', ''), ' ', '')) = ?
      AND timeframe = ?
    ORDER BY open_time ASC
    """

    rows = conn.execute(sql, (normalize_symbol(symbol), timeframe)).fetchall()
    conn.close()
    return rows


def parse_value(value: Any) -> Any:
    if value is None:
        return None

    if isinstance(value, (int, float, bool, Decimal)):
        return value

    if isinstance(value, str):
        raw = value.strip()

        if raw == "":
            return raw

        lower = raw.lower()
        if lower in {"true", "false"}:
            return lower == "true"

        try:
            if any(ch in raw for ch in [".", ","]):
                normalized = raw.replace(",", ".")
                return Decimal(normalized)
            return int(raw)
        except Exception:
            return raw

    return value


def get_constructor_fields(cls: type) -> set[str]:
    try:
        signature = inspect.signature(cls)
        return {
            name
            for name, parameter in signature.parameters.items()
            if name != "self"
            and parameter.kind
            in (
                inspect.Parameter.POSITIONAL_OR_KEYWORD,
                inspect.Parameter.KEYWORD_ONLY,
            )
        }
    except Exception:
        annotations = getattr(cls, "__annotations__", {})
        if isinstance(annotations, dict):
            return set(annotations.keys())
        return set()


def instantiate_model(cls: type, candidate_values: dict[str, Any]) -> Any:
    accepted_fields = get_constructor_fields(cls)

    if accepted_fields:
        filtered = {
            key: value
            for key, value in candidate_values.items()
            if key in accepted_fields
        }
        return cls(**filtered)

    instance = cls()
    for key, value in candidate_values.items():
        if hasattr(instance, key):
            setattr(instance, key, value)
    return instance


def build_candle(row: sqlite3.Row) -> Candle:
    raw = dict(row)

    candidate_values = {
        "id": raw.get("id"),
        "asset_id": raw.get("asset_id"),
        "symbol": raw.get("symbol"),
        "timeframe": raw.get("timeframe"),
        "open_time": raw.get("open_time"),
        "close_time": raw.get("close_time"),
        "open": parse_value(raw.get("open")),
        "high": parse_value(raw.get("high")),
        "low": parse_value(raw.get("low")),
        "close": parse_value(raw.get("close")),
        "volume": parse_value(raw.get("volume")),
        "source": raw.get("source"),
        "provider": raw.get("provider"),
        "market_session": raw.get("market_session"),
        "timezone": raw.get("timezone"),
        "is_delayed": raw.get("is_delayed"),
        "is_mock": raw.get("is_mock"),
    }

    return instantiate_model(Candle, candidate_values)


def parse_extra_args(extra: list[str]) -> dict[str, Any]:
    parsed: dict[str, Any] = {}

    i = 0
    while i < len(extra):
        token = extra[i].strip()

        if not token.startswith("--"):
            i += 1
            continue

        key = token[2:].strip().replace("-", "_")
        if not key:
            i += 1
            continue

        next_value: Any = True
        if i + 1 < len(extra) and not extra[i + 1].startswith("--"):
            next_value = parse_value(extra[i + 1])
            i += 1

        parsed[key] = next_value
        i += 1

    return parsed


def build_strategy_config(
    stage_test_strategy: str,
    runtime_strategy: str,
    symbol: str,
    timeframe: str,
    extra_parameters: dict[str, Any],
) -> StrategyConfig:
    defaults = get_default_parameters(stage_test_strategy)
    parameters = {**defaults, **extra_parameters}
    now_iso = datetime.now(timezone.utc).isoformat()

    candidate_values = {
        "id": str(uuid.uuid4()),
        "strategy_key": runtime_strategy,
        "symbol": normalize_symbol(symbol),
        "timeframe": timeframe,
        "name": f"stage-test::{stage_test_strategy}",
        "label": f"stage-test::{stage_test_strategy}",
        "parameters": parameters,
        "is_enabled": True,
        "created_at": now_iso,
        "updated_at": now_iso,
    }

    return instantiate_model(StrategyConfig, candidate_values)


def build_strategy_run(
    runtime_strategy: str,
    strategy_config_id: str,
    symbol: str,
    timeframe: str,
    start_at: str,
    end_at: str,
) -> StrategyRun:
    now_iso = datetime.now(timezone.utc).isoformat()

    candidate_values = {
        "id": str(uuid.uuid4()),
        "strategy_key": runtime_strategy,
        "strategy_config_id": strategy_config_id,
        "symbol": normalize_symbol(symbol),
        "timeframe": timeframe,
        "status": "running",
        "mode": "historical",
        "start_at": start_at,
        "end_at": end_at,
        "started_at": now_iso,
        "created_at": now_iso,
        "updated_at": now_iso,
    }

    return instantiate_model(StrategyRun, candidate_values)


def safe_attr(obj: Any, *names: str, default: Any = None) -> Any:
    for name in names:
        if hasattr(obj, name):
            return getattr(obj, name)
    return default


def decision_is_triggered(decision: Any) -> bool:
    candidates = [
        safe_attr(decision, "triggered"),
        safe_attr(decision, "is_triggered"),
        safe_attr(decision, "should_trigger"),
        safe_attr(decision, "open_case"),
        safe_attr(decision, "fired"),
    ]
    return any(value is True for value in candidates)


def decision_should_close(decision: Any) -> bool:
    candidates = [
        safe_attr(decision, "should_close"),
        safe_attr(decision, "close_case"),
        safe_attr(decision, "closed"),
        safe_attr(decision, "is_closed"),
    ]
    return any(value is True for value in candidates)


def summarize_case_outcome(case: Any) -> str:
    outcome = safe_attr(case, "outcome")
    status = safe_attr(case, "status")
    close_reason = safe_attr(case, "close_reason")

    joined = " | ".join(
        str(v).lower()
        for v in [outcome, status, close_reason]
        if v is not None and str(v).strip()
    )

    if any(word in joined for word in ["hit", "win", "target", "tp", "profit"]):
        return "hit"

    if any(word in joined for word in ["fail", "loss", "stop", "sl"]):
        return "fail"

    if any(word in joined for word in ["timeout", "expired", "time_out"]):
        return "timeout"

    return "other"


def pct(part: int, total: int) -> float:
    if total <= 0:
        return 0.0
    return round((part / total) * 100, 2)


def to_jsonable(value: Any) -> Any:
    if value is None:
        return None

    if isinstance(value, (str, int, float, bool)):
        return value

    if isinstance(value, Decimal):
        return str(value)

    if isinstance(value, uuid.UUID):
        return str(value)

    if isinstance(value, datetime):
        return value.isoformat()

    if isinstance(value, dict):
        return {str(key): to_jsonable(val) for key, val in value.items()}

    if isinstance(value, (list, tuple, set)):
        return [to_jsonable(item) for item in value]

    if hasattr(value, "__dict__"):
        raw = {}
        for key, val in vars(value).items():
            if key.startswith("_"):
                continue
            raw[key] = to_jsonable(val)
        return raw

    return str(value)


def read_case_metadata(case: Any) -> dict[str, Any]:
    metadata = safe_attr(case, "metadata")
    if isinstance(metadata, dict):
        return to_jsonable(metadata)

    if hasattr(metadata, "__dict__"):
        return to_jsonable(metadata)

    return {}


def read_analysis_snapshot_from_case(case: Any) -> dict[str, Any] | None:
    metadata = read_case_metadata(case)

    direct_snapshot = metadata.get("analysis_snapshot")
    if isinstance(direct_snapshot, dict):
        return direct_snapshot

    for candidate_name in [
        "analysis_snapshot",
        "snapshot",
        "technical_snapshot",
    ]:
        candidate = safe_attr(case, candidate_name)
        candidate = to_jsonable(candidate)
        if isinstance(candidate, dict):
            return candidate

    return None


def normalize_direction(value: Any) -> str | None:
    if value is None:
        return None

    raw = str(value).strip().lower()
    if not raw:
        return None

    mapping = {
        "buy": "buy",
        "long": "buy",
        "compra": "buy",
        "sell": "sell",
        "short": "sell",
        "venda": "sell",
        "neutral": "neutral",
        "neutro": "neutral",
    }

    return mapping.get(raw, raw)


def build_rules_from_snapshot(snapshot: dict[str, Any]) -> list[dict[str, Any]]:
    patterns = snapshot.get("patterns") or {}
    bollinger = snapshot.get("bollinger") or {}

    rules: list[dict[str, Any]] = []

    if isinstance(bollinger, dict):
        if "closed_below_lower_band" in bollinger:
            rules.append(
                {
                    "label": "Fecho abaixo da banda inferior",
                    "passed": bollinger.get("closed_below_lower_band"),
                    "value": "",
                }
            )
        if "closed_above_upper_band" in bollinger:
            rules.append(
                {
                    "label": "Fecho acima da banda superior",
                    "passed": bollinger.get("closed_above_upper_band"),
                    "value": "",
                }
            )
        if "reentered_inside_band_long" in bollinger:
            rules.append(
                {
                    "label": "Reentrada na banda (long)",
                    "passed": bollinger.get("reentered_inside_band_long"),
                    "value": "",
                }
            )
        if "reentered_inside_band_short" in bollinger:
            rules.append(
                {
                    "label": "Reentrada na banda (short)",
                    "passed": bollinger.get("reentered_inside_band_short"),
                    "value": "",
                }
            )

    if isinstance(patterns, dict):
        label_map = {
            "bb_reentry_long": "BB reentry long",
            "bb_reentry_short": "BB reentry short",
            "ema_trend_confirmed_long": "EMA trend confirmed long",
            "ema_trend_confirmed_short": "EMA trend confirmed short",
            "price_above_short_ema": "Price above short EMA",
            "price_below_short_ema": "Price below short EMA",
            "price_above_long_ema": "Price above long EMA",
            "price_below_long_ema": "Price below long EMA",
            "price_above_ema_200": "Price above EMA 200",
            "price_below_ema_200": "Price below EMA 200",
            "rsi_recovery_long": "RSI recovery long",
            "rsi_recovery_short": "RSI recovery short",
            "macd_confirmation_long": "MACD confirmation long",
            "macd_confirmation_short": "MACD confirmation short",
            "cross_up_confirmed": "Cross up confirmed",
            "cross_down_confirmed": "Cross down confirmed",
            "countertrend_long": "Countertrend long",
            "countertrend_short": "Countertrend short",
        }

        for key, label in label_map.items():
            if key in patterns:
                rules.append(
                    {
                        "label": label,
                        "passed": patterns.get(key),
                        "value": "",
                    }
                )

    return rules


def build_indicators_from_snapshot(snapshot: dict[str, Any]) -> list[dict[str, str]]:
    indicators: list[dict[str, str]] = []

    def add(label: str, value: Any) -> None:
        if value is None:
            return
        text = str(value).strip()
        if text == "":
            return
        indicators.append({"label": label, "value": text})

    trigger_context = snapshot.get("trigger_context") or {}
    trend = snapshot.get("trend") or {}
    bollinger = snapshot.get("bollinger") or {}
    momentum = snapshot.get("momentum") or {}
    volatility = snapshot.get("volatility") or {}
    structure = snapshot.get("structure") or {}
    trigger_candle = snapshot.get("trigger_candle") or {}

    if isinstance(trigger_context, dict):
        add("Preço de referência", trigger_context.get("reference_price"))
        add("Sessão", trigger_context.get("session"))
        add("Direção do setup", trigger_context.get("setup_direction"))
        add("Estado do cruzamento", trigger_context.get("cross_state"))

    if isinstance(trend, dict):
        add("EMA 5", trend.get("ema_5"))
        add(
            "EMA 9",
            trend.get("ema_9")
            or trend.get("ema9")
            or trend.get("m9")
            or trend.get("short_ema"),
        )
        add("EMA 10", trend.get("ema_10"))
        add("EMA 20", trend.get("ema_20"))
        add(
            "EMA 21",
            trend.get("ema_21")
            or trend.get("ema21")
            or trend.get("m21")
            or trend.get("long_ema"),
        )
        add("EMA 30", trend.get("ema_30"))
        add("EMA 40", trend.get("ema_40"))
        add("EMA 200", trend.get("ema_200"))
        add("Inclinação EMA 9", trend.get("ema_9_slope") or trend.get("short_ema_slope"))
        add("Inclinação EMA 21", trend.get("ema_21_slope") or trend.get("long_ema_slope"))
        add("Inclinação EMA 200", trend.get("ema_200_slope"))
        add("Alinhamento EMA", trend.get("ema_alignment"))
        add("Estado do cruzamento", trend.get("cross_state"))
        add("Preço vs EMA curta", trend.get("price_vs_short_ema"))
        add("Preço vs EMA longa", trend.get("price_vs_long_ema"))
        add("Preço vs EMA 20", trend.get("price_vs_ema_20"))
        add("Preço vs EMA 40", trend.get("price_vs_ema_40"))
        add("Preço vs EMA 200", trend.get("price_vs_ema_200"))
        add("ADX", trend.get("adx"))
        add("Inclinação ADX", trend.get("adx_slope"))

    if isinstance(momentum, dict):
        add("RSI 14", momentum.get("rsi_14"))
        add("Zona RSI", momentum.get("rsi_zone"))
        add("Inclinação RSI", momentum.get("rsi_slope"))
        add("MACD", momentum.get("macd_line"))
        add("Signal", momentum.get("macd_signal"))
        add("Histograma", momentum.get("macd_histogram"))
        add("Estado MACD", momentum.get("macd_state"))

    if isinstance(volatility, dict):
        add("ATR 14", volatility.get("atr_14"))
        add("Regime ATR", volatility.get("atr_regime"))
        add("Range candle", volatility.get("candle_range"))
        add("Range vs ATR", volatility.get("candle_range_vs_atr"))

    if isinstance(bollinger, dict):
        add("Bollinger superior", bollinger.get("upper"))
        add("Bollinger média", bollinger.get("middle"))
        add("Bollinger inferior", bollinger.get("lower"))
        add("Bandwidth", bollinger.get("bandwidth"))
        add("Posição do close na banda", bollinger.get("close_position_in_band"))

    if isinstance(structure, dict):
        add("Estrutura de mercado", structure.get("market_structure"))
        add("Local de entrada", structure.get("entry_location"))
        add("Distância ao suporte", structure.get("distance_to_recent_support"))
        add("Distância à resistência", structure.get("distance_to_recent_resistance"))
        add("Distância à EMA curta", structure.get("distance_to_short_ema"))
        add("Distância à EMA longa", structure.get("distance_to_long_ema"))
        add("Distância à EMA 20", structure.get("distance_to_ema_20"))
        add("Distância à EMA 40", structure.get("distance_to_ema_40"))
        add("Distância à EMA 200", structure.get("distance_to_ema_200"))

    if isinstance(trigger_candle, dict):
        add("Candle open", trigger_candle.get("open"))
        add("Candle high", trigger_candle.get("high"))
        add("Candle low", trigger_candle.get("low"))
        add("Candle close", trigger_candle.get("close"))
        add("Body size", trigger_candle.get("body_size"))
        add("Upper wick", trigger_candle.get("upper_wick"))
        add("Lower wick", trigger_candle.get("lower_wick"))
        add("Body ratio", trigger_candle.get("body_ratio"))
        add("Tipo de candle", trigger_candle.get("candle_type"))

    return indicators


def get_phase3_confirmation(snapshot: dict[str, Any]) -> dict[str, Any]:
    intelligence = snapshot.get("candlestick_intelligence") or {}
    if not isinstance(intelligence, dict):
        return {}

    phase_3 = intelligence.get("phase_3_confirmation") or {}
    if not isinstance(phase_3, dict):
        return {}

    return phase_3


def build_case_metadata_summary(case: Any, snapshot: dict[str, Any] | None) -> dict[str, Any]:
    metadata = read_case_metadata(case)
    if not isinstance(metadata, dict):
        metadata = {}

    phase_3 = get_phase3_confirmation(snapshot or {})

    consolidated_metadata = dict(metadata)

    if phase_3:
        consolidated_metadata["confirmation_score"] = to_jsonable(
            phase_3.get("confirmation_score")
        )
        consolidated_metadata["confirmation_label"] = to_jsonable(
            phase_3.get("confirmation_label")
        )
        consolidated_metadata["recommended_action"] = to_jsonable(
            phase_3.get("recommended_action")
        )
        consolidated_metadata["entry_mode"] = to_jsonable(
            phase_3.get("entry_mode")
        )
        consolidated_metadata["hard_blockers"] = to_jsonable(
            phase_3.get("hard_blockers")
        )

    if snapshot:
        trigger_context = snapshot.get("trigger_context") or {}
        trend = snapshot.get("trend") or {}
        structure = snapshot.get("structure") or {}

        if isinstance(trigger_context, dict):
            if trigger_context.get("setup_direction") is not None:
                consolidated_metadata["setup_direction"] = to_jsonable(
                    trigger_context.get("setup_direction")
                )
            if trigger_context.get("cross_state") is not None:
                consolidated_metadata["cross_state"] = to_jsonable(
                    trigger_context.get("cross_state")
                )

        if isinstance(trend, dict):
            for source_key, target_key in [
                ("short_ema", "current_short_ema_snapshot"),
                ("long_ema", "current_long_ema_snapshot"),
                ("ema_200", "current_ema_200_snapshot"),
                ("short_ema_slope", "short_ema_slope"),
                ("long_ema_slope", "long_ema_slope"),
                ("ema_200_slope", "ema_200_slope"),
                ("price_vs_short_ema", "price_vs_short_ema"),
                ("price_vs_long_ema", "price_vs_long_ema"),
                ("price_vs_ema_200", "price_vs_ema_200"),
                ("adx", "adx_snapshot"),
                ("adx_slope", "adx_slope"),
                ("macd_state", "macd_state"),
            ]:
                if trend.get(source_key) is not None:
                    consolidated_metadata[target_key] = to_jsonable(trend.get(source_key))

        if isinstance(structure, dict):
            if structure.get("entry_location") is not None:
                consolidated_metadata["entry_location"] = to_jsonable(
                    structure.get("entry_location")
                )
            if structure.get("market_structure") is not None:
                consolidated_metadata["market_structure"] = to_jsonable(
                    structure.get("market_structure")
                )

    return consolidated_metadata


def build_analysis_from_case(case: Any) -> dict[str, Any] | None:
    snapshot = read_analysis_snapshot_from_case(case)
    metadata = build_case_metadata_summary(case, snapshot)

    if not snapshot and not metadata:
        return None

    trade_bias = normalize_direction(
        metadata.get("trade_bias") or safe_attr(case, "side")
    )

    trigger_time = (
        safe_attr(case, "trigger_time")
        or safe_attr(case, "trigger_candle_time")
        or metadata.get("trigger_time")
    )

    summary = None
    if isinstance(snapshot, dict):
        structure = snapshot.get("structure") or {}
        if isinstance(structure, dict):
            summary = structure.get("market_structure")

    if not summary:
        setup_type = metadata.get("setup_type")
        close_reason = metadata.get("close_reason")
        summary_parts = [value for value in [setup_type, close_reason] if value]
        summary = " | ".join(summary_parts) if summary_parts else None

    trigger_label = None
    if isinstance(snapshot, dict):
        structure = snapshot.get("structure") or {}
        if isinstance(structure, dict):
            trigger_label = structure.get("entry_location")

    if not trigger_label:
        trigger_label = metadata.get("setup_type")

    return {
        "summary": summary,
        "direction": trade_bias,
        "validated_at": trigger_time,
        "trigger_label": trigger_label,
        "indicators": build_indicators_from_snapshot(snapshot or {}),
        "rules": build_rules_from_snapshot(snapshot or {}),
        "snapshot": snapshot,
    }


def serialize_case(case: Any, case_number: int) -> dict[str, Any]:
    snapshot = read_analysis_snapshot_from_case(case)
    metadata = build_case_metadata_summary(case, snapshot)
    analysis = build_analysis_from_case(case)

    case_id = (
        safe_attr(case, "id")
        or safe_attr(case, "case_id")
        or safe_attr(case, "uuid")
        or f"case-{case_number}"
    )

    return {
        "id": str(case_id),
        "case_number": case_number,
        "side": to_jsonable(safe_attr(case, "side")),
        "status": to_jsonable(safe_attr(case, "status")),
        "outcome": to_jsonable(safe_attr(case, "outcome")),
        "trigger_price": to_jsonable(safe_attr(case, "trigger_price")),
        "entry_price": to_jsonable(safe_attr(case, "entry_price")),
        "close_price": to_jsonable(safe_attr(case, "close_price")),
        "target_price": to_jsonable(safe_attr(case, "target_price")),
        "invalidation_price": to_jsonable(safe_attr(case, "invalidation_price")),
        "trigger_time": to_jsonable(safe_attr(case, "trigger_time")),
        "trigger_candle_time": to_jsonable(safe_attr(case, "trigger_candle_time")),
        "entry_time": to_jsonable(safe_attr(case, "entry_time")),
        "close_time": to_jsonable(safe_attr(case, "close_time")),
        "bars_to_resolution": to_jsonable(safe_attr(case, "bars_to_resolution")),
        "max_favorable_excursion": to_jsonable(
            safe_attr(case, "max_favorable_excursion")
        ),
        "max_adverse_excursion": to_jsonable(
            safe_attr(case, "max_adverse_excursion")
        ),
        "close_reason": to_jsonable(
            safe_attr(case, "close_reason")
            or metadata.get("close_reason")
        ),
        "analysis": to_jsonable(analysis),
        "metadata": to_jsonable(metadata),
    }


def select_best_analysis_case(closed_cases: list[Any], open_cases: list[Any]) -> Any | None:
    candidates = list(reversed(closed_cases)) + list(reversed(open_cases))

    for case in candidates:
        analysis = build_analysis_from_case(case)
        if analysis:
            return case

    return None


def debug_first_serialized_case(serialized_cases: list[dict[str, Any]]) -> None:
    if not serialized_cases:
        print("[STAGE_TESTS][DEBUG] FIRST_CASE=None")
        return

    first_case = serialized_cases[0]
    analysis = first_case.get("analysis")
    snapshot = analysis.get("snapshot") if isinstance(analysis, dict) else None
    trend = snapshot.get("trend") if isinstance(snapshot, dict) else None
    indicators = analysis.get("indicators") if isinstance(analysis, dict) else None
    metadata = first_case.get("metadata") if isinstance(first_case, dict) else None

    print(
        "[STAGE_TESTS][DEBUG] FIRST_CASE_KEYS="
        + json.dumps(list(first_case.keys()), ensure_ascii=False)
    )
    print(
        "[STAGE_TESTS][DEBUG] FIRST_ANALYSIS_KEYS="
        + json.dumps(
            list(analysis.keys()) if isinstance(analysis, dict) else None,
            ensure_ascii=False,
        )
    )
    print(
        "[STAGE_TESTS][DEBUG] FIRST_SNAPSHOT_KEYS="
        + json.dumps(
            list(snapshot.keys()) if isinstance(snapshot, dict) else None,
            ensure_ascii=False,
        )
    )
    print(
        "[STAGE_TESTS][DEBUG] FIRST_METADATA_JSON="
        + json.dumps(metadata, ensure_ascii=False, default=str)
    )
    print(
        "[STAGE_TESTS][DEBUG] FIRST_TREND_JSON="
        + json.dumps(trend, ensure_ascii=False, default=str)
    )

    if isinstance(trend, dict):
        ema_debug = {
            "ema_5": trend.get("ema_5"),
            "ema_9": trend.get("ema_9"),
            "ema9": trend.get("ema9"),
            "m9": trend.get("m9"),
            "short_ema": trend.get("short_ema"),
            "ema_9_slope": trend.get("ema_9_slope"),
            "short_ema_slope": trend.get("short_ema_slope"),
            "ema_10": trend.get("ema_10"),
            "ema_20": trend.get("ema_20"),
            "ema_21": trend.get("ema_21"),
            "ema21": trend.get("ema21"),
            "m21": trend.get("m21"),
            "long_ema": trend.get("long_ema"),
            "ema_21_slope": trend.get("ema_21_slope"),
            "long_ema_slope": trend.get("long_ema_slope"),
            "ema_30": trend.get("ema_30"),
            "ema_40": trend.get("ema_40"),
            "ema_200": trend.get("ema_200"),
            "ema_200_slope": trend.get("ema_200_slope"),
            "ema_alignment": trend.get("ema_alignment"),
            "cross_state": trend.get("cross_state"),
            "price_vs_short_ema": trend.get("price_vs_short_ema"),
            "price_vs_long_ema": trend.get("price_vs_long_ema"),
            "price_vs_ema_20": trend.get("price_vs_ema_20"),
            "price_vs_ema_40": trend.get("price_vs_ema_40"),
            "price_vs_ema_200": trend.get("price_vs_ema_200"),
        }
    else:
        ema_debug = None

    print(
        "[STAGE_TESTS][DEBUG] FIRST_TREND_EMA_DEBUG="
        + json.dumps(ema_debug, ensure_ascii=False, default=str)
    )
    print(
        "[STAGE_TESTS][DEBUG] FIRST_INDICATORS_JSON="
        + json.dumps(indicators, ensure_ascii=False, default=str)
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Stage Testes runner")
    parser.add_argument("--symbol", required=True)
    parser.add_argument("--timeframe", required=True)
    parser.add_argument("--strategy", required=True)
    args, extra = parser.parse_known_args()

    requested_strategy = args.strategy
    runtime_strategy = resolve_runtime_strategy_key(requested_strategy)
    extra_parameters = parse_extra_args(extra)

    registry = build_strategy_registry()

    if not registry.has(runtime_strategy):
        raise RuntimeError(
            f"Strategy mapeada não existe no registry: {runtime_strategy}"
        )

    strategy_impl = registry.get(runtime_strategy)

    rows = load_candles_rows(args.symbol, args.timeframe)
    candles = [build_candle(row) for row in rows]

    print("============================================================")
    print("STAGE TESTES V2")
    print("============================================================")
    print(f"DATA/HORA              : {datetime.now().isoformat()}")
    print(f"DB_PATH                : {get_db_path()}")
    print(f"SYMBOL                 : {normalize_symbol(args.symbol)}")
    print(f"TIMEFRAME              : {args.timeframe}")
    print(f"STAGE_TEST_STRATEGY    : {requested_strategy}")
    print(f"RUNTIME_STRATEGY       : {runtime_strategy}")
    print(f"STRATEGY_CLASS         : {strategy_impl.__class__.__name__}")
    print(f"EXTRA ARGS             : {extra}")
    print(f"EXTRA PARAMETERS       : {extra_parameters}")
    print(f"TOTAL CANDLES          : {len(candles)}")

    if not candles:
        print("RESULTADO              : SEM DADOS")
        raise SystemExit(2)

    first_row = rows[0]
    last_row = rows[-1]

    config = build_strategy_config(
        stage_test_strategy=requested_strategy,
        runtime_strategy=runtime_strategy,
        symbol=args.symbol,
        timeframe=args.timeframe,
        extra_parameters=extra_parameters,
    )

    config_id = safe_attr(config, "id")
    if not config_id:
        raise RuntimeError("StrategyConfig criado sem id.")

    run = build_strategy_run(
        runtime_strategy=runtime_strategy,
        strategy_config_id=str(config_id),
        symbol=args.symbol,
        timeframe=args.timeframe,
        start_at=str(first_row["open_time"]),
        end_at=str(last_row["close_time"] or last_row["open_time"]),
    )

    warmup = strategy_impl.warmup_period(config)
    indicators = strategy_impl.calculate_indicators(candles, config)

    print(f"WARMUP                 : {warmup}")
    print(
        f"INDICATORS_TYPE        : {type(indicators).__name__ if indicators is not None else 'None'}"
    )

    open_cases: list[Any] = []
    closed_cases: list[Any] = []
    trigger_count = 0

    for index in range(max(warmup, 0), len(candles)):
        candle = candles[index]

        try:
            trigger_decision = strategy_impl.check_trigger(
                candles=candles,
                index=index,
                config=config,
            )
        except Exception as exc:
            print(f"ERRO_TRIGGER           : index={index} | erro={exc}")
            continue

        if decision_is_triggered(trigger_decision):
            trigger_count += 1
            try:
                new_case = strategy_impl.create_case(
                    candles=candles,
                    index=index,
                    config=config,
                    run=run,
                )
                open_cases.append(new_case)
            except Exception as exc:
                print(f"ERRO_CREATE_CASE       : index={index} | erro={exc}")

        still_open_cases: list[Any] = []

        for case in open_cases:
            try:
                updated_case = strategy_impl.update_case(
                    case=case,
                    candle=candle,
                    config=config,
                )
            except Exception as exc:
                print(f"ERRO_UPDATE_CASE       : index={index} | erro={exc}")
                still_open_cases.append(case)
                continue

            try:
                close_decision = strategy_impl.should_close_case(
                    case=updated_case,
                    candle=candle,
                    config=config,
                )
            except Exception as exc:
                print(f"ERRO_SHOULD_CLOSE      : index={index} | erro={exc}")
                still_open_cases.append(updated_case)
                continue

            if decision_should_close(close_decision):
                try:
                    closed_case = strategy_impl.close_case(
                        case=updated_case,
                        candle=candle,
                        config=config,
                        decision=close_decision,
                    )
                    closed_cases.append(closed_case)
                except Exception as exc:
                    print(f"ERRO_CLOSE_CASE        : index={index} | erro={exc}")
                    still_open_cases.append(updated_case)
            else:
                still_open_cases.append(updated_case)

        open_cases = still_open_cases

    hit_count = 0
    fail_count = 0
    timeout_count = 0
    other_count = 0

    for case in closed_cases:
        bucket = summarize_case_outcome(case)
        if bucket == "hit":
            hit_count += 1
        elif bucket == "fail":
            fail_count += 1
        elif bucket == "timeout":
            timeout_count += 1
        else:
            other_count += 1

    best_case = select_best_analysis_case(closed_cases, open_cases)
    analysis = build_analysis_from_case(best_case) if best_case is not None else None

    serialized_cases = [
        serialize_case(case, case_number=index + 1)
        for index, case in enumerate(closed_cases)
    ]

    debug_first_serialized_case(serialized_cases)

    print(f"PRIMEIRO               : {first_row['open_time']}")
    print(f"ÚLTIMO                 : {last_row['open_time']}")
    print(f"TRIGGERS               : {trigger_count}")
    print(f"OPEN_CASES_FINAL       : {len(open_cases)}")
    print(f"CLOSED_CASES           : {len(closed_cases)}")
    print(f"HITS                   : {hit_count}")
    print(f"FAILS                  : {fail_count}")
    print(f"TIMEOUTS               : {timeout_count}")
    print(f"OTHERS                 : {other_count}")
    print(f"ANALYSIS_PRESENT       : {'SIM' if analysis else 'NAO'}")
    print(f"CASES_SERIALIZED       : {len(serialized_cases)}")
    print("RESULTADO              : RUN EXECUTADO COM SUCESSO")
    print("============================================================")

    metrics = {
        "strategy_class": strategy_impl.__class__.__name__,
        "runtime_strategy": runtime_strategy,
        "total_candles": len(candles),
        "warmup": int(warmup),
        "triggers": trigger_count,
        "open_cases_final": len(open_cases),
        "closed_cases": len(closed_cases),
        "hits": hit_count,
        "fails": fail_count,
        "timeouts": timeout_count,
        "others": other_count,
        "hit_rate": pct(hit_count, len(closed_cases)),
        "fail_rate": pct(fail_count, len(closed_cases)),
        "timeout_rate": pct(timeout_count, len(closed_cases)),
        "first_candle": str(first_row["open_time"]),
        "last_candle": str(last_row["open_time"]),
        "analysis": to_jsonable(analysis),
        "cases": to_jsonable(serialized_cases),
    }

    print(f"STAGE_TEST_RESULT_JSON={json.dumps(metrics, ensure_ascii=False)}")


if __name__ == "__main__":
    main()