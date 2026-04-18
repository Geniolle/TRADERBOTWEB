from app.models.domain.candle import Candle
from app.models.domain.strategy_case import StrategyCase
from app.models.domain.strategy_config import StrategyConfig
from app.strategies.base import BaseStrategy
from app.strategies.decisions import CaseCloseDecision


class CaseEngine:
    def process_open_case(
        self,
        case: StrategyCase,
        candle: Candle,
        strategy: BaseStrategy,
        config: StrategyConfig,
    ) -> tuple[StrategyCase, CaseCloseDecision]:
        updated_case = strategy.update_case(
            case=case,
            candle=candle,
            config=config,
        )

        close_decision = strategy.should_close_case(
            case=updated_case,
            candle=candle,
            config=config,
        )

        if close_decision.should_close:
            updated_case = strategy.close_case(
                case=updated_case,
                candle=candle,
                config=config,
                decision=close_decision,
            )

        return updated_case, close_decision