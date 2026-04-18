from decimal import Decimal

from app.services.comparison_service import ComparisonService


class DummyMetrics:
    def __init__(
        self,
        *,
        total_cases: int,
        total_hits: int,
        total_fails: int,
        total_timeouts: int,
        hit_rate: str,
        fail_rate: str,
        timeout_rate: str,
        avg_bars_to_resolution: str,
        avg_time_to_resolution_seconds: str,
        avg_mfe: str,
        avg_mae: str,
    ) -> None:
        self.total_cases = total_cases
        self.total_hits = total_hits
        self.total_fails = total_fails
        self.total_timeouts = total_timeouts
        self.hit_rate = Decimal(hit_rate)
        self.fail_rate = Decimal(fail_rate)
        self.timeout_rate = Decimal(timeout_rate)
        self.avg_bars_to_resolution = Decimal(avg_bars_to_resolution)
        self.avg_time_to_resolution_seconds = Decimal(avg_time_to_resolution_seconds)
        self.avg_mfe = Decimal(avg_mfe)
        self.avg_mae = Decimal(avg_mae)


class DummyRun:
    def __init__(self, strategy_key: str) -> None:
        self.strategy_key = strategy_key


class DummyComparisonRepository:
    def __init__(self, grouped) -> None:
        self.grouped = grouped

    def compare_by_strategy(self, session, symbol, timeframe, strategy_key, limit):
        return self.grouped


def test_compare_strategies_ignores_zero_case_runs_for_averages() -> None:
    grouped = {
        "ema_cross": [
            (
                DummyRun("ema_cross"),
                DummyMetrics(
                    total_cases=0,
                    total_hits=0,
                    total_fails=0,
                    total_timeouts=0,
                    hit_rate="0",
                    fail_rate="0",
                    timeout_rate="0",
                    avg_bars_to_resolution="0",
                    avg_time_to_resolution_seconds="0",
                    avg_mfe="0",
                    avg_mae="0",
                ),
            ),
            (
                DummyRun("ema_cross"),
                DummyMetrics(
                    total_cases=0,
                    total_hits=0,
                    total_fails=0,
                    total_timeouts=0,
                    hit_rate="0",
                    fail_rate="0",
                    timeout_rate="0",
                    avg_bars_to_resolution="0",
                    avg_time_to_resolution_seconds="0",
                    avg_mfe="0",
                    avg_mae="0",
                ),
            ),
            (
                DummyRun("ema_cross"),
                DummyMetrics(
                    total_cases=4,
                    total_hits=0,
                    total_fails=2,
                    total_timeouts=2,
                    hit_rate="0",
                    fail_rate="50",
                    timeout_rate="50",
                    avg_bars_to_resolution="4",
                    avg_time_to_resolution_seconds="60300",
                    avg_mfe="0.90062725",
                    avg_mae="1.51946850",
                ),
            ),
        ]
    }

    service = ComparisonService(repository=DummyComparisonRepository(grouped))

    response = service.compare_strategies(
        session=object(),
        symbol="AAPL",
        timeframe="1h",
        strategy_key="ema_cross",
        limit=100,
    )

    assert response.symbol == "AAPL"
    assert response.timeframe == "1h"
    assert response.strategy_key == "ema_cross"
    assert response.total_groups == 1
    assert len(response.results) == 1

    item = response.results[0]
    assert item.strategy_key == "ema_cross"
    assert item.total_runs == 3
    assert item.total_cases == 4
    assert item.total_hits == 0
    assert item.total_fails == 2
    assert item.total_timeouts == 2

    assert item.avg_hit_rate == Decimal("0")
    assert item.avg_fail_rate == Decimal("50")
    assert item.avg_timeout_rate == Decimal("50")
    assert item.avg_bars_to_resolution == Decimal("4")
    assert item.avg_time_to_resolution_seconds == Decimal("60300")
    assert item.avg_mfe == Decimal("0.90062725")
    assert item.avg_mae == Decimal("1.51946850")


def test_compare_strategies_returns_zero_averages_when_all_runs_have_zero_cases() -> None:
    grouped = {
        "bollinger_reversal": [
            (
                DummyRun("bollinger_reversal"),
                DummyMetrics(
                    total_cases=0,
                    total_hits=0,
                    total_fails=0,
                    total_timeouts=0,
                    hit_rate="0",
                    fail_rate="0",
                    timeout_rate="0",
                    avg_bars_to_resolution="0",
                    avg_time_to_resolution_seconds="0",
                    avg_mfe="0",
                    avg_mae="0",
                ),
            )
        ]
    }

    service = ComparisonService(repository=DummyComparisonRepository(grouped))

    response = service.compare_strategies(
        session=object(),
        symbol="AAPL",
        timeframe="1h",
        strategy_key="bollinger_reversal",
        limit=100,
    )

    assert response.total_groups == 1
    item = response.results[0]

    assert item.total_runs == 1
    assert item.total_cases == 0
    assert item.total_hits == 0
    assert item.total_fails == 0
    assert item.total_timeouts == 0

    assert item.avg_hit_rate == Decimal("0")
    assert item.avg_fail_rate == Decimal("0")
    assert item.avg_timeout_rate == Decimal("0")
    assert item.avg_bars_to_resolution == Decimal("0")
    assert item.avg_time_to_resolution_seconds == Decimal("0")
    assert item.avg_mfe == Decimal("0")
    assert item.avg_mae == Decimal("0")