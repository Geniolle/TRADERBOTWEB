# app/stage_tests/catalog.py
# Endpoints relacionados:
# - GET  /api/v1/stage-tests/options
# - POST /api/v1/stage-tests/run

from __future__ import annotations

from typing import Any


STAGE_TEST_STRATEGIES: list[dict[str, Any]] = [
    {
        "key": "pullback",
        "label": "Pullback",
        "description": "Procura continuação após retração do preço.",
    },
    {
        "key": "ema_cross",
        "label": "Cruzamento de Médias",
        "description": "Gera sinais com base no cruzamento de médias móveis.",
    },
    {
        "key": "volatility_breakout",
        "label": "Rompimento de Volatilidade",
        "description": "Procura expansão de movimento após compressão de volatilidade.",
    },
    {
        "key": "range_breakout",
        "label": "Rompimento de Range",
        "description": "Procura rompimento de consolidação/lateralização.",
    },
    {
        "key": "mean_reversion",
        "label": "Reversão à Média",
        "description": "Procura retorno do preço à média após afastamento.",
    },
    {
        "key": "fade",
        "label": "Fade",
        "description": "Procura operação contrária a movimentos estendidos/exagerados.",
    },
]


def list_stage_test_strategies() -> list[dict[str, Any]]:
    return [dict(item) for item in STAGE_TEST_STRATEGIES]


def get_stage_test_strategy_keys() -> list[str]:
    return [item["key"] for item in STAGE_TEST_STRATEGIES]


def is_valid_stage_test_strategy(strategy_key: str) -> bool:
    return strategy_key in set(get_stage_test_strategy_keys())