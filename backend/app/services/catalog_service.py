from app.schemas.catalog import (
    CatalogInstrument,
    CatalogItemsResponse,
    CatalogProductResponse,
    CatalogProductsResponse,
    CatalogProductSummary,
    CatalogSubproduct,
)


CATALOG_DATA = {
    "forex": {
        "label": "Forex",
        "description": "Pares cambiais disponíveis para análise.",
        "subproducts": {
            "majors": {
                "label": "Majors",
                "description": "Principais pares cambiais.",
                "items": [
                    {
                        "symbol": "EUR/USD",
                        "display_name": "Euro / US Dollar",
                        "base_asset": "EUR",
                        "quote_asset": "USD",
                    },
                    {
                        "symbol": "GBP/USD",
                        "display_name": "British Pound / US Dollar",
                        "base_asset": "GBP",
                        "quote_asset": "USD",
                    },
                    {
                        "symbol": "USD/JPY",
                        "display_name": "US Dollar / Japanese Yen",
                        "base_asset": "USD",
                        "quote_asset": "JPY",
                    },
                    {
                        "symbol": "USD/CHF",
                        "display_name": "US Dollar / Swiss Franc",
                        "base_asset": "USD",
                        "quote_asset": "CHF",
                    },
                    {
                        "symbol": "AUD/USD",
                        "display_name": "Australian Dollar / US Dollar",
                        "base_asset": "AUD",
                        "quote_asset": "USD",
                    },
                    {
                        "symbol": "USD/CAD",
                        "display_name": "US Dollar / Canadian Dollar",
                        "base_asset": "USD",
                        "quote_asset": "CAD",
                    },
                    {
                        "symbol": "NZD/USD",
                        "display_name": "New Zealand Dollar / US Dollar",
                        "base_asset": "NZD",
                        "quote_asset": "USD",
                    },
                ],
            },
            "crosses": {
                "label": "Crosses",
                "description": "Pares cruzados relevantes.",
                "items": [
                    {
                        "symbol": "EUR/GBP",
                        "display_name": "Euro / British Pound",
                        "base_asset": "EUR",
                        "quote_asset": "GBP",
                    },
                    {
                        "symbol": "EUR/JPY",
                        "display_name": "Euro / Japanese Yen",
                        "base_asset": "EUR",
                        "quote_asset": "JPY",
                    },
                    {
                        "symbol": "GBP/JPY",
                        "display_name": "British Pound / Japanese Yen",
                        "base_asset": "GBP",
                        "quote_asset": "JPY",
                    },
                    {
                        "symbol": "AUD/JPY",
                        "display_name": "Australian Dollar / Japanese Yen",
                        "base_asset": "AUD",
                        "quote_asset": "JPY",
                    },
                ],
            },
        },
    },
}


class CatalogService:
    def list_products(self) -> CatalogProductsResponse:
        products: list[CatalogProductSummary] = []

        for product_code, product_data in CATALOG_DATA.items():
            subproducts = product_data.get("subproducts", {})
            total_items = sum(len(subproduct.get("items", [])) for subproduct in subproducts.values())

            products.append(
                CatalogProductSummary(
                    code=product_code,
                    label=product_data.get("label", product_code),
                    description=product_data.get("description", ""),
                    total_subproducts=len(subproducts),
                    total_items=total_items,
                )
            )

        return CatalogProductsResponse(products=products)

    def get_product(self, product_code: str) -> CatalogProductResponse | None:
        product = CATALOG_DATA.get(product_code)
        if not product:
            return None

        subproducts = []
        for subproduct_code, subproduct_data in product.get("subproducts", {}).items():
            subproducts.append(
                CatalogSubproduct(
                    code=subproduct_code,
                    label=subproduct_data.get("label", subproduct_code),
                    description=subproduct_data.get("description", ""),
                )
            )

        return CatalogProductResponse(
            code=product_code,
            label=product.get("label", product_code),
            description=product.get("description", ""),
            subproducts=subproducts,
        )

    def get_subproduct_items(
        self,
        product_code: str,
        subproduct_code: str,
    ) -> CatalogItemsResponse | None:
        product = CATALOG_DATA.get(product_code)
        if not product:
            return None

        subproduct = product.get("subproducts", {}).get(subproduct_code)
        if not subproduct:
            return None

        items = [
            CatalogInstrument(
                symbol=item["symbol"],
                display_name=item["display_name"],
                base_asset=item["base_asset"],
                quote_asset=item["quote_asset"],
            )
            for item in subproduct.get("items", [])
        ]

        return CatalogItemsResponse(
            product=product_code,
            subproduct=subproduct_code,
            total_items=len(items),
            items=items,
        )