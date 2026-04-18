from decimal import Decimal
from typing import Any

from pydantic import BaseModel, Field

from app.models.domain.enums import CaseOutcome


class TriggerDecision(BaseModel):
    triggered: bool = False
    reason: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class CaseCloseDecision(BaseModel):
    should_close: bool = False
    outcome: CaseOutcome | None = None
    reason: str | None = None
    close_price: Decimal | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)