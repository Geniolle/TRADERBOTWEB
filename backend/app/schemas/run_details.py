from pydantic import BaseModel

from app.schemas.run import (
    StrategyCaseResponse,
    StrategyMetricsResponse,
    StrategyRunResponse,
)


class RunDetailsResponse(BaseModel):
    run: StrategyRunResponse
    metrics: StrategyMetricsResponse | None = None
    cases: list[StrategyCaseResponse]