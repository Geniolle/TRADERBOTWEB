from pydantic import BaseModel, Field


class CatalogProductSummary(BaseModel):
    code: str
    label: str
    description: str = ""
    total_subproducts: int = 0
    total_items: int = 0


class CatalogSubproduct(BaseModel):
    code: str
    label: str
    description: str = ""


class CatalogInstrument(BaseModel):
    symbol: str
    display_name: str
    base_asset: str
    quote_asset: str


class CatalogProductsResponse(BaseModel):
    products: list[CatalogProductSummary] = Field(default_factory=list)


class CatalogProductResponse(BaseModel):
    code: str
    label: str
    description: str = ""
    subproducts: list[CatalogSubproduct] = Field(default_factory=list)


class CatalogItemsResponse(BaseModel):
    product: str
    subproduct: str | None = None
    total_items: int = 0
    items: list[CatalogInstrument] = Field(default_factory=list)