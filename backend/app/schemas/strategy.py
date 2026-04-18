from pydantic import BaseModel

from app.models.domain.strategy_definition import StrategyDefinition


class StrategyListItemResponse(BaseModel):
    key: str
    name: str
    version: str
    description: str | None = None
    category: str


def build_strategy_list_item(definition: StrategyDefinition) -> StrategyListItemResponse:
    return StrategyListItemResponse(
        key=definition.key,
        name=definition.name,
        version=definition.version,
        description=definition.description,
        category=definition.category.value,
    )