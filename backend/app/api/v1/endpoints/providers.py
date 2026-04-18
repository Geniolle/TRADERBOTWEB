from fastapi import APIRouter

from app.core.settings import get_settings
from app.providers.factory import MarketDataProviderFactory
from app.schemas.provider import ProviderListResponse

router = APIRouter(prefix="/providers", tags=["providers"])


@router.get("", response_model=ProviderListResponse)
def list_providers() -> ProviderListResponse:
    settings = get_settings()
    factory = MarketDataProviderFactory()

    return ProviderListResponse(
        providers=factory.list_providers(),
        selected_provider=settings.market_data_provider,
    )