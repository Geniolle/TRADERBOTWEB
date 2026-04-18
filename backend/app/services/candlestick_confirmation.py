# G:\O meu disco\python\Trader-bot\app\services\candlestick_confirmation.py

from __future__ import annotations

from decimal import Decimal, InvalidOperation
from typing import Any, Dict, Iterable, List, Optional, Tuple


BULLISH_MACD_STATES = {
    "bullish_cross",
    "bullish_above_signal",
    "bullish",
}

BEARISH_MACD_STATES = {
    "bearish_cross",
    "bearish_below_signal",
    "bearish",
}

BULLISH_PATTERNS = {
    "morning_star",
    "bullish_engulfing",
    "piercing_line",
    "hammer",
    "inverse_head_and_shoulders",
    "three_white_soldiers",
    "bullish_harami_cross",
    "bullish_kicker",
}

BEARISH_PATTERNS = {
    "evening_star",
    "bearish_engulfing",
    "dark_cloud_cover",
    "shooting_star",
    "head_and_shoulders",
    "three_black_crows",
    "bearish_harami",
    "bearish_kicker",
}


def _safe_str(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _to_decimal(value: Any, default: Decimal = Decimal("0")) -> Decimal:
    if value is None:
        return default
    try:
        text = str(value).strip()
        if not text:
            return default
        return Decimal(text)
    except (InvalidOperation, ValueError, TypeError):
        return default


def _append_unique(target: List[str], value: str) -> None:
    if value and value not in target:
        target.append(value)


def _normalize_direction(setup_direction: Any) -> str:
    raw = _safe_str(setup_direction).lower()
    if raw in {"buy", "long", "bullish"}:
        return "buy"
    if raw in {"sell", "short", "bearish"}:
        return "sell"
    return "buy"


def _is_buy(setup_direction: str) -> bool:
    return _normalize_direction(setup_direction) == "buy"


def _is_sell(setup_direction: str) -> bool:
    return _normalize_direction(setup_direction) == "sell"


def _is_bullish_pattern(pattern_name: str) -> bool:
    return _safe_str(pattern_name).lower() in BULLISH_PATTERNS


def _is_bearish_pattern(pattern_name: str) -> bool:
    return _safe_str(pattern_name).lower() in BEARISH_PATTERNS


def _extract_active_patterns(phase_2_sequence_patterns: Dict[str, Any]) -> List[str]:
    raw_patterns = phase_2_sequence_patterns.get("active_patterns") or []
    patterns: List[str] = []

    if isinstance(raw_patterns, Iterable) and not isinstance(raw_patterns, (str, bytes)):
        for item in raw_patterns:
            text = _safe_str(item).lower()
            if text:
                patterns.append(text)

    dominant_pattern = _safe_str(phase_2_sequence_patterns.get("dominant_pattern")).lower()
    if dominant_pattern and dominant_pattern != "balanced" and dominant_pattern not in patterns:
        patterns.append(dominant_pattern)

    return patterns


def _has_favorable_pattern(setup_direction: str, phase_2_sequence_patterns: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
    patterns = _extract_active_patterns(phase_2_sequence_patterns)
    for pattern in patterns:
        if _is_buy(setup_direction) and _is_bullish_pattern(pattern):
            return True, pattern
        if _is_sell(setup_direction) and _is_bearish_pattern(pattern):
            return True, pattern
    return False, None


def _has_contrary_pattern(setup_direction: str, phase_2_sequence_patterns: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
    patterns = _extract_active_patterns(phase_2_sequence_patterns)
    for pattern in patterns:
        if _is_buy(setup_direction) and _is_bearish_pattern(pattern):
            return True, pattern
        if _is_sell(setup_direction) and _is_bullish_pattern(pattern):
            return True, pattern
    return False, None


def _trigger_is_favorable(setup_direction: str, phase_1_candle_features: Dict[str, Any]) -> bool:
    trigger_strength = _safe_str(phase_1_candle_features.get("trigger_strength_class")).lower()
    trigger_pattern = _safe_str(phase_1_candle_features.get("trigger_pattern")).lower()

    if _is_buy(setup_direction):
        return (
            trigger_strength == "bullish_force"
            or trigger_pattern.startswith("bullish_")
            or trigger_pattern in {"hammer", "morning_star", "bullish_engulfing"}
        )

    return (
        trigger_strength == "bearish_force"
        or trigger_pattern.startswith("bearish_")
        or trigger_pattern in {"shooting_star", "evening_star", "bearish_engulfing"}
    )


def _trigger_is_against_setup(setup_direction: str, phase_1_candle_features: Dict[str, Any]) -> bool:
    trigger_strength = _safe_str(phase_1_candle_features.get("trigger_strength_class")).lower()
    trigger_pattern = _safe_str(phase_1_candle_features.get("trigger_pattern")).lower()

    if _is_buy(setup_direction):
        return (
            trigger_strength == "bearish_force"
            or trigger_pattern.startswith("bearish_")
            or trigger_pattern in {"evening_star", "bearish_engulfing", "shooting_star"}
        )

    return (
        trigger_strength == "bullish_force"
        or trigger_pattern.startswith("bullish_")
        or trigger_pattern in {"morning_star", "bullish_engulfing", "hammer", "piercing_line"}
    )


def _price_supports_setup(setup_direction: str, trend: Dict[str, Any]) -> Tuple[bool, bool]:
    price_vs_ema_20 = _safe_str(trend.get("price_vs_ema_20")).lower()
    price_vs_ema_40 = _safe_str(trend.get("price_vs_ema_40")).lower()

    if _is_buy(setup_direction):
        return price_vs_ema_20 == "above", price_vs_ema_40 == "above"

    return price_vs_ema_20 == "below", price_vs_ema_40 == "below"


def _rsi_supports_setup(setup_direction: str, momentum: Dict[str, Any]) -> bool:
    rsi_slope = _safe_str(momentum.get("rsi_slope")).lower()

    if _is_buy(setup_direction):
        return rsi_slope == "up"

    return rsi_slope == "down"


def _rsi_against_setup(setup_direction: str, momentum: Dict[str, Any]) -> bool:
    rsi_slope = _safe_str(momentum.get("rsi_slope")).lower()

    if _is_buy(setup_direction):
        return rsi_slope == "down"

    return rsi_slope == "up"


def _macd_supports_setup(setup_direction: str, momentum: Dict[str, Any]) -> bool:
    macd_state = _safe_str(momentum.get("macd_state")).lower()

    if _is_buy(setup_direction):
        return macd_state in BULLISH_MACD_STATES

    return macd_state in BEARISH_MACD_STATES


def _structure_supports_setup(setup_direction: str, structure: Dict[str, Any]) -> bool:
    market_structure = _safe_str(structure.get("market_structure")).lower()

    if _is_buy(setup_direction):
        return market_structure in {"bullish", "range"}

    return market_structure in {"bearish", "range"}


def _adx_strength(trend: Dict[str, Any], structure: Dict[str, Any]) -> Tuple[Decimal, bool, bool]:
    adx_value = _to_decimal(trend.get("adx_14"))
    if adx_value <= 0:
        adx_value = _to_decimal(trend.get("adx"))
    if adx_value <= 0:
        adx_value = _to_decimal(structure.get("adx_14"))
    if adx_value <= 0:
        adx_value = _to_decimal(structure.get("adx"))

    is_strong = adx_value >= Decimal("20")
    is_moderate = adx_value >= Decimal("12")
    return adx_value, is_strong, is_moderate


def _macro_points_and_reasons(
    setup_direction: str,
    trend: Dict[str, Any],
    momentum: Dict[str, Any],
    structure: Dict[str, Any],
) -> Tuple[int, List[str], List[str]]:
    reasons_for: List[str] = []
    reasons_against: List[str] = []
    points = 0

    price_ema20_ok, price_ema40_ok = _price_supports_setup(setup_direction, trend)
    macd_ok = _macd_supports_setup(setup_direction, momentum)
    rsi_ok = _rsi_supports_setup(setup_direction, momentum)
    structure_ok = _structure_supports_setup(setup_direction, structure)
    adx_value, adx_strong, adx_moderate = _adx_strength(trend, structure)

    if _is_buy(setup_direction):
        if price_ema20_ok:
            points += 1
            _append_unique(reasons_for, "preco_acima_ema20")
        else:
            _append_unique(reasons_against, "preco_nao_acima_ema20")

        if price_ema40_ok:
            points += 1
            _append_unique(reasons_for, "preco_acima_ema40")
        else:
            _append_unique(reasons_against, "preco_nao_acima_ema40")

        if macd_ok:
            points += 1
            _append_unique(reasons_for, "macd_comprador")
        else:
            _append_unique(reasons_against, "macd_nao_comprador")

        if rsi_ok:
            points += 1
            _append_unique(reasons_for, "rsi_a_subir")
        else:
            _append_unique(reasons_against, "rsi_a_descer")

        if structure_ok:
            points += 1
            _append_unique(reasons_for, "estrutura_bullish")
        else:
            _append_unique(reasons_against, "estrutura_nao_bullish")
    else:
        if price_ema20_ok:
            points += 1
            _append_unique(reasons_for, "preco_abaixo_ema20")
        else:
            _append_unique(reasons_against, "preco_nao_abaixo_ema20")

        if price_ema40_ok:
            points += 1
            _append_unique(reasons_for, "preco_abaixo_ema40")
        else:
            _append_unique(reasons_against, "preco_nao_abaixo_ema40")

        if macd_ok:
            points += 1
            _append_unique(reasons_for, "macd_vendedor")
        else:
            _append_unique(reasons_against, "macd_nao_vendedor")

        if rsi_ok:
            points += 1
            _append_unique(reasons_for, "rsi_a_descer")
        else:
            _append_unique(reasons_against, "rsi_a_subir")

        if structure_ok:
            points += 1
            _append_unique(reasons_for, "estrutura_bearish")
        else:
            _append_unique(reasons_against, "estrutura_nao_bearish")

    if adx_strong:
        points += 1
        _append_unique(reasons_for, "adx_forte")
    elif not adx_moderate:
        _append_unique(reasons_against, "adx_fraco")
    else:
        _append_unique(reasons_for, f"adx_moderado={adx_value.normalize()}")

    return points, reasons_for, reasons_against


def _apply_quality_ceiling(
    setup_direction: str,
    trend: Dict[str, Any],
    momentum: Dict[str, Any],
    phase_1_candle_features: Dict[str, Any],
    phase_2_sequence_patterns: Dict[str, Any],
) -> Tuple[int, List[str]]:
    ceiling = 10
    ceiling_reasons: List[str] = []

    trigger_against = _trigger_is_against_setup(setup_direction, phase_1_candle_features)
    trigger_favorable = _trigger_is_favorable(setup_direction, phase_1_candle_features)
    favorable_pattern, _ = _has_favorable_pattern(setup_direction, phase_2_sequence_patterns)
    contrary_pattern, contrary_pattern_name = _has_contrary_pattern(setup_direction, phase_2_sequence_patterns)

    price_ema20_ok, _ = _price_supports_setup(setup_direction, trend)
    macd_ok = _macd_supports_setup(setup_direction, momentum)
    rsi_against = _rsi_against_setup(setup_direction, momentum)

    exhaustion_detected = bool(phase_2_sequence_patterns.get("exhaustion_detected"))
    impulsion_detected = bool(phase_2_sequence_patterns.get("impulsion_detected"))
    adx_value, _, adx_moderate = _adx_strength(trend, {})

    if trigger_against:
        ceiling = min(ceiling, 3)
        _append_unique(ceiling_reasons, "trigger_contra_o_setup")
    elif not trigger_favorable:
        ceiling = min(ceiling, 7)
        _append_unique(ceiling_reasons, "trigger_neutro")

    if contrary_pattern:
        ceiling = min(ceiling, 7)
        _append_unique(ceiling_reasons, f"padrao_contrario={contrary_pattern_name}")

    if not price_ema20_ok:
        ceiling = min(ceiling, 7)
        if _is_buy(setup_direction):
            _append_unique(ceiling_reasons, "preco_nao_acima_ema20")
        else:
            _append_unique(ceiling_reasons, "preco_nao_abaixo_ema20")

    if not macd_ok:
        ceiling = min(ceiling, 7)
        if _is_buy(setup_direction):
            _append_unique(ceiling_reasons, "macd_nao_comprador")
        else:
            _append_unique(ceiling_reasons, "macd_nao_vendedor")

    if rsi_against:
        ceiling = min(ceiling, 7)
        if _is_buy(setup_direction):
            _append_unique(ceiling_reasons, "rsi_a_descer")
        else:
            _append_unique(ceiling_reasons, "rsi_a_subir")

    if not adx_moderate and not impulsion_detected and not exhaustion_detected:
        ceiling = min(ceiling, 7)
        _append_unique(ceiling_reasons, f"adx_fraco_sem_impulso={adx_value.normalize()}")

    if not favorable_pattern and not impulsion_detected and not exhaustion_detected and not trigger_favorable:
        ceiling = min(ceiling, 5)
        _append_unique(ceiling_reasons, "sem_confirmacao_de_gatilho")

    return ceiling, ceiling_reasons


def _raw_confirmation_score(
    setup_direction: str,
    trend: Dict[str, Any],
    momentum: Dict[str, Any],
    structure: Dict[str, Any],
    phase_1_candle_features: Dict[str, Any],
    phase_2_sequence_patterns: Dict[str, Any],
) -> Tuple[int, int, List[str], List[str]]:
    macro_points, reasons_for, reasons_against = _macro_points_and_reasons(
        setup_direction=setup_direction,
        trend=trend,
        momentum=momentum,
        structure=structure,
    )

    score = macro_points

    trigger_favorable = _trigger_is_favorable(setup_direction, phase_1_candle_features)
    trigger_against = _trigger_is_against_setup(setup_direction, phase_1_candle_features)

    favorable_pattern, favorable_pattern_name = _has_favorable_pattern(setup_direction, phase_2_sequence_patterns)
    contrary_pattern, contrary_pattern_name = _has_contrary_pattern(setup_direction, phase_2_sequence_patterns)

    exhaustion_detected = bool(phase_2_sequence_patterns.get("exhaustion_detected"))
    impulsion_detected = bool(phase_2_sequence_patterns.get("impulsion_detected"))
    continuity_detected = bool(phase_2_sequence_patterns.get("continuity_detected"))
    opposite_side_weakness = bool(phase_2_sequence_patterns.get("opposite_side_weakness"))

    trigger_pattern = _safe_str(phase_1_candle_features.get("trigger_pattern"))

    if trigger_favorable:
        score += 2
        _append_unique(reasons_for, f"trigger_pattern={trigger_pattern}")

    if favorable_pattern and favorable_pattern_name:
        score += 2
        _append_unique(reasons_for, f"padrao_favoravel={favorable_pattern_name}")

    if impulsion_detected:
        score += 1
        _append_unique(reasons_for, "impulsao_detectada")

    if exhaustion_detected:
        score += 1
        _append_unique(reasons_for, "exaustao_detectada")

    if continuity_detected:
        score += 2
        _append_unique(reasons_for, "continuidade_detectada")

    if opposite_side_weakness:
        score += 1
        _append_unique(reasons_for, "fraqueza_do_lado_oposto")

    if trigger_against:
        score -= 3
        _append_unique(reasons_against, "trigger_contra_o_setup")

    if contrary_pattern and contrary_pattern_name:
        score -= 2
        _append_unique(reasons_against, f"padrao_contrario={contrary_pattern_name}")

    return max(score, 0), macro_points, reasons_for, reasons_against


def _score_to_label(score: int) -> Tuple[str, str]:
    if score >= 8:
        return "forte", "validar_entrada"
    if score >= 5:
        return "boa", "aceitar_com_confirmacao"
    if score >= 3:
        return "neutra", "observar"
    return "fraca", "evitar_entrada"


def score_phase_3_confirmation(
    setup_direction: Any,
    trend: Dict[str, Any],
    momentum: Dict[str, Any],
    structure: Dict[str, Any],
    phase_1_candle_features: Dict[str, Any],
    phase_2_sequence_patterns: Dict[str, Any],
) -> Dict[str, Any]:
    normalized_direction = _normalize_direction(setup_direction)

    raw_score, macro_points, reasons_for, reasons_against = _raw_confirmation_score(
        setup_direction=normalized_direction,
        trend=trend,
        momentum=momentum,
        structure=structure,
        phase_1_candle_features=phase_1_candle_features,
        phase_2_sequence_patterns=phase_2_sequence_patterns,
    )

    ceiling, ceiling_reasons = _apply_quality_ceiling(
        setup_direction=normalized_direction,
        trend=trend,
        momentum=momentum,
        phase_1_candle_features=phase_1_candle_features,
        phase_2_sequence_patterns=phase_2_sequence_patterns,
    )

    final_score = min(raw_score, ceiling)

    for reason in ceiling_reasons:
        _append_unique(reasons_against, reason)

    confirmation_label, recommended_action = _score_to_label(final_score)

    return {
        "objective": "gerar score final de confirmação do cruzamento",
        "setup_direction": normalized_direction,
        "macro_points": macro_points,
        "macro_is_strong": macro_points >= 4,
        "macro_is_moderate": macro_points >= 3,
        "raw_confirmation_score": raw_score,
        "score_ceiling": ceiling,
        "confirmation_score": final_score,
        "confirmation_label": confirmation_label,
        "recommended_action": recommended_action,
        "reasons_for": reasons_for,
        "reasons_against": reasons_against,
    }


def build_phase_3_confirmation_from_snapshot(
    setup_direction: Any,
    snapshot: Dict[str, Any],
    phase_1_candle_features: Dict[str, Any],
    phase_2_sequence_patterns: Dict[str, Any],
) -> Dict[str, Any]:
    trend = snapshot.get("trend") or {}
    momentum = snapshot.get("momentum") or {}
    structure = snapshot.get("structure") or {}

    return score_phase_3_confirmation(
        setup_direction=setup_direction,
        trend=trend,
        momentum=momentum,
        structure=structure,
        phase_1_candle_features=phase_1_candle_features,
        phase_2_sequence_patterns=phase_2_sequence_patterns,
    )