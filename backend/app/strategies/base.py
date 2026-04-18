from abc import ABC, abstractmethod

from app.models.domain.candle import Candle
from app.models.domain.strategy_case import StrategyCase
from app.models.domain.strategy_config import StrategyConfig
from app.models.domain.strategy_definition import StrategyDefinition
from app.models.domain.strategy_run import StrategyRun
from app.strategies.decisions import CaseCloseDecision, TriggerDecision


class BaseStrategy(ABC):
    definition: StrategyDefinition

    @abstractmethod
    def warmup_period(self, config: StrategyConfig) -> int:
        """
        Return the minimum number of candles required before the strategy
        can start evaluating triggers.
        """
        raise NotImplementedError

    @abstractmethod
    def calculate_indicators(
        self,
        candles: list[Candle],
        config: StrategyConfig,
    ) -> dict:
        """
        Calculate and return any indicator values needed by the strategy.
        """
        raise NotImplementedError

    @abstractmethod
    def check_trigger(
        self,
        candles: list[Candle],
        index: int,
        config: StrategyConfig,
    ) -> TriggerDecision:
        """
        Evaluate whether the strategy trigger fired at the given candle index.
        """
        raise NotImplementedError

    @abstractmethod
    def create_case(
        self,
        candles: list[Candle],
        index: int,
        config: StrategyConfig,
        run: StrategyRun,
    ) -> StrategyCase:
        """
        Create and return a new strategy case when a trigger is confirmed.
        """
        raise NotImplementedError

    @abstractmethod
    def update_case(
        self,
        case: StrategyCase,
        candle: Candle,
        config: StrategyConfig,
    ) -> StrategyCase:
        """
        Update open case metrics based on a newly closed candle.
        """
        raise NotImplementedError

    @abstractmethod
    def should_close_case(
        self,
        case: StrategyCase,
        candle: Candle,
        config: StrategyConfig,
    ) -> CaseCloseDecision:
        """
        Decide whether the case should be closed on this candle.
        """
        raise NotImplementedError

    @abstractmethod
    def close_case(
        self,
        case: StrategyCase,
        candle: Candle,
        config: StrategyConfig,
        decision: CaseCloseDecision,
    ) -> StrategyCase:
        """
        Apply the final close decision and return the closed case.
        """
        raise NotImplementedError