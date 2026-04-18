# app/registry/strategy_registry.py

from app.strategies.base import BaseStrategy
from app.strategies.bollinger_reversal import BollingerReversalStrategy
from app.strategies.bollinger_walk_the_band import BollingerWalkTheBandStrategy
from app.strategies.ema_cross import EmaCrossStrategy
from app.strategies.rsi_reversal import RsiReversalStrategy


class StrategyRegistry:
    def __init__(self) -> None:
        self._strategies: dict[str, BaseStrategy] = {}

    def register(self, strategy: BaseStrategy) -> None:
        strategy_key = strategy.definition.key

        if strategy_key in self._strategies:
            raise ValueError(f"Strategy already registered: {strategy_key}")

        self._strategies[strategy_key] = strategy

    def get(self, strategy_key: str) -> BaseStrategy:
        strategy = self._strategies.get(strategy_key)

        if strategy is None:
            raise KeyError(f"Strategy not found: {strategy_key}")

        return strategy

    def has(self, strategy_key: str) -> bool:
        return strategy_key in self._strategies

    def list_keys(self) -> list[str]:
        return sorted(self._strategies.keys())

    def list_strategies(self) -> list[BaseStrategy]:
        return [self._strategies[key] for key in self.list_keys()]


def build_strategy_registry() -> StrategyRegistry:
    registry = StrategyRegistry()
    registry.register(BollingerReversalStrategy())
    registry.register(BollingerWalkTheBandStrategy())
    registry.register(EmaCrossStrategy())
    registry.register(RsiReversalStrategy())
    return registry
