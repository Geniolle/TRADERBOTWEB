# app/stage_tests/strategy_mapper.py
# Utilizado por:
# - app/stage_tests/runner.py
# - POST /api/v1/stage-tests/run

from __future__ import annotations

from typing import Any


STAGE_TEST_STRATEGY_MAPPING: dict[str, str] = {
    "pullback": "rsi_reversal",
    "ema_cross": "ema_cross",
    "volatility_breakout": "bollinger_walk_the_band",
    "range_breakout": "bollinger_walk_the_band",
    "mean_reversion": "bollinger_reversal",
    "fade": "rsi_reversal",
}

STAGE_TEST_DEFAULT_PARAMETERS: dict[str, dict[str, Any]] = {
    "pullback": {
        "rsi_period": 14,
        "target_percent": 0.15,
        "stop_percent": 0.10,
        "timeout_bars": 12,
    },
    "ema_cross": {
        "ema_short_period": 9,
        "ema_long_period": 21,
        "target_percent": 0.15,
        "stop_percent": 0.10,
        "timeout_bars": 12,
    },
    "volatility_breakout": {
        "bollinger_period": 20,
        "bollinger_stddev": 2,
        "atr_period": 14,
        "target_percent": 0.15,
        "stop_percent": 0.10,
        "timeout_bars": 12,
    },
    "range_breakout": {
        "atr_period": 14,
        "target_percent": 0.15,
        "stop_percent": 0.10,
        "timeout_bars": 12,
    },
    "mean_reversion": {
        "bollinger_period": 20,
        "bollinger_stddev": 2,
        "target_percent": 0.15,
        "stop_percent": 0.10,
        "timeout_bars": 12,
    },
    "fade": {
        "rsi_period": 14,
        "target_percent": 0.10,
        "stop_percent": 0.08,
        "timeout_bars": 8,
    },
}


def normalize_stage_test_strategy_key(stage_test_strategy_key: str) -> str:
    normalized = (stage_test_strategy_key or "").strip().lower()

    if not normalized:
        raise ValueError("Strategy vazia.")

    return normalized


def resolve_runtime_strategy_key(stage_test_strategy_key: str) -> str:
    normalized = normalize_stage_test_strategy_key(stage_test_strategy_key)
    runtime_key = STAGE_TEST_STRATEGY_MAPPING.get(normalized)

    if not runtime_key:
        raise ValueError(
            f"Strategy de Stage Test sem mapeamento: {stage_test_strategy_key}"
        )

    return runtime_key


def get_default_parameters(stage_test_strategy_key: str) -> dict[str, Any]:
    normalized = normalize_stage_test_strategy_key(stage_test_strategy_key)
    return dict(STAGE_TEST_DEFAULT_PARAMETERS.get(normalized, {}))