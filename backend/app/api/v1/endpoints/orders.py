from fastapi import APIRouter, HTTPException, Query

from app.schemas.order import (
    BinanceSpotOrderHistoryResponse,
    BinanceSpotOrderProposalConfirmationRequest,
    BinanceSpotOrderProposalConfirmationResponse,
    BinanceSpotOrderRequest,
    BinanceSpotOrderResponse,
)
from app.services.binance_execution_service import (
    BinanceOrderApiError,
    BinanceOrderValidationError,
    BinanceSpotExecutionService,
)
from app.services.order_proposal_confirmation_service import (
    StrategyProposalConfirmationService,
    StrategyProposalValidationError,
)

router = APIRouter(prefix="/orders", tags=["orders"])


@router.post("/binance/spot", response_model=BinanceSpotOrderResponse)
def place_binance_spot_order(request: BinanceSpotOrderRequest) -> BinanceSpotOrderResponse:
    try:
        response = BinanceSpotExecutionService().place_spot_order(request)
        return BinanceSpotOrderResponse(**response)
    except BinanceOrderValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except BinanceOrderApiError as exc:
        detail = {
            "message": exc.message,
            "error_code": exc.error_code,
        }
        raise HTTPException(status_code=exc.status_code, detail=detail) from exc


@router.post(
    "/binance/spot/proposal/confirm",
    response_model=BinanceSpotOrderProposalConfirmationResponse,
)
def confirm_binance_spot_order_proposal(
    request: BinanceSpotOrderProposalConfirmationRequest,
) -> BinanceSpotOrderProposalConfirmationResponse:
    try:
        response = StrategyProposalConfirmationService().confirm(request)
        return BinanceSpotOrderProposalConfirmationResponse(**response)
    except StrategyProposalValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/binance/spot/all", response_model=BinanceSpotOrderHistoryResponse)
def get_binance_spot_order_history(
    symbol: str = Query(..., min_length=3),
    limit: int = Query(50, ge=1, le=1000),
    order_id: int | None = Query(default=None, alias="orderId"),
    start_time: int | None = Query(default=None, alias="startTime"),
    end_time: int | None = Query(default=None, alias="endTime"),
) -> BinanceSpotOrderHistoryResponse:
    try:
        response = BinanceSpotExecutionService().get_spot_order_history(
            symbol=symbol,
            limit=limit,
            order_id=order_id,
            start_time=start_time,
            end_time=end_time,
        )
        return BinanceSpotOrderHistoryResponse(**response)
    except BinanceOrderValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except BinanceOrderApiError as exc:
        detail = {
            "message": exc.message,
            "error_code": exc.error_code,
        }
        raise HTTPException(status_code=exc.status_code, detail=detail) from exc
