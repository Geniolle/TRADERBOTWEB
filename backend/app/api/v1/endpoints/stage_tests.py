from fastapi import APIRouter, HTTPException, Query

from app.schemas.stage_tests import (
    StageTestOptionsResponse,
    StageTestRunRequest,
    StageTestRunResponse,
)
from app.services.stage_tests_service import (
    list_stage_test_options,
    run_stage_test,
)

router = APIRouter()


@router.get("/options", response_model=StageTestOptionsResponse)
def get_stage_test_options(
    min_candles: int = Query(default=1, ge=1),
) -> StageTestOptionsResponse:
    try:
        return StageTestOptionsResponse(**list_stage_test_options(min_candles=min_candles))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/run", response_model=StageTestRunResponse)
def post_stage_test_run(payload: StageTestRunRequest) -> StageTestRunResponse:
    try:
        return StageTestRunResponse(
            **run_stage_test(
                symbol=payload.symbol,
                timeframe=payload.timeframe,
                strategy=payload.strategy,
                min_candles=payload.min_candles,
                extra_args=payload.extra_args,
            )
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc