from pydantic import BaseModel, Field


class StrategyConfig(BaseModel):
    id: str | None = Field(default=None)
    strategy_key: str
    name: str
    timeframe: str
    parameters: dict = Field(default_factory=dict)
    entry_rule: str | None = None
    target_rule: str | None = None
    invalidation_rule: str | None = None
    timeout_bars: int = 0
    enabled: bool = True