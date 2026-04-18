from pydantic import BaseModel


class ProviderListResponse(BaseModel):
    providers: list[str]
    selected_provider: str