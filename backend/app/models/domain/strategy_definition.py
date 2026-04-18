from pydantic import BaseModel

from app.models.domain.enums import StrategyCategory


class StrategyDefinition(BaseModel):
    key: str
    name: str
    version: str
    description: str | None = None
    category: StrategyCategory = StrategyCategory.CUSTOM