from fastapi import APIRouter, HTTPException

from app.schemas.catalog import (
    CatalogItemsResponse,
    CatalogProductResponse,
    CatalogProductsResponse,
)
from app.services.catalog_service import CatalogService

router = APIRouter(prefix="/catalog", tags=["catalog"])

service = CatalogService()


@router.get("/products", response_model=CatalogProductsResponse)
def list_products() -> CatalogProductsResponse:
    return service.list_products()


@router.get("/products/{product_code}", response_model=CatalogProductResponse)
def get_product(product_code: str) -> CatalogProductResponse:
    result = service.get_product(product_code=product_code)

    if result is None:
        raise HTTPException(
            status_code=404,
            detail=f"Product not found: {product_code}",
        )

    return result


@router.get(
    "/products/{product_code}/subproducts/{subproduct_code}",
    response_model=CatalogItemsResponse,
)
def get_subproduct_items(
    product_code: str,
    subproduct_code: str,
) -> CatalogItemsResponse:
    result = service.get_subproduct_items(
        product_code=product_code,
        subproduct_code=subproduct_code,
    )

    if result is None:
        raise HTTPException(
            status_code=404,
            detail=f"Subproduct not found: {product_code}/{subproduct_code}",
        )

    return result