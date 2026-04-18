# app/strategies/ff_fd_mapper.py

from app.strategies.ff_fd import FFFDCase


def to_run_case_item(case: FFFDCase) -> dict:
    return {
        "id": case.id,
        "case_number": case.case_number,
        "side": case.side,
        "status": case.status,
        "trigger_price": case.trigger_price,
        "entry_price": case.entry_price,
        "close_price": case.close_price,
        "target_price": case.target_price,
        "invalidation_price": case.invalidation_price,
        "trigger_time": case.trigger_time,
        "entry_time": case.entry_time,
        "close_time": case.close_time,
        "trigger_candle_time": case.trigger_candle_time,
    }