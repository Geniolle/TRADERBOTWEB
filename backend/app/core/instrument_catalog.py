from copy import deepcopy


PRODUCT_CATALOG: list[dict] = [
    {
        "code": "crypto",
        "label": "Cripto",
        "description": "Catálogo base de instrumentos de criptomoedas.",
        "subproducts": [
            {
                "code": "spot",
                "label": "Spot",
                "description": "Pares spot mais comuns para consulta e testes.",
                "items": [
                    {
                        "symbol": "BTCUSDT",
                        "display_name": "Bitcoin / Tether",
                        "base_asset": "BTC",
                        "quote_asset": "USDT",
                    },
                    {
                        "symbol": "ETHUSDT",
                        "display_name": "Ethereum / Tether",
                        "base_asset": "ETH",
                        "quote_asset": "USDT",
                    },
                    {
                        "symbol": "SOLUSDT",
                        "display_name": "Solana / Tether",
                        "base_asset": "SOL",
                        "quote_asset": "USDT",
                    },
                    {
                        "symbol": "BNBUSDT",
                        "display_name": "BNB / Tether",
                        "base_asset": "BNB",
                        "quote_asset": "USDT",
                    },
                    {
                        "symbol": "XRPUSDT",
                        "display_name": "XRP / Tether",
                        "base_asset": "XRP",
                        "quote_asset": "USDT",
                    },
                    {
                        "symbol": "ADAUSDT",
                        "display_name": "Cardano / Tether",
                        "base_asset": "ADA",
                        "quote_asset": "USDT",
                    },
                    {
                        "symbol": "DOGEUSDT",
                        "display_name": "Dogecoin / Tether",
                        "base_asset": "DOGE",
                        "quote_asset": "USDT",
                    },
                    {
                        "symbol": "AVAXUSDT",
                        "display_name": "Avalanche / Tether",
                        "base_asset": "AVAX",
                        "quote_asset": "USDT",
                    },
                    {
                        "symbol": "LINKUSDT",
                        "display_name": "Chainlink / Tether",
                        "base_asset": "LINK",
                        "quote_asset": "USDT",
                    },
                    {
                        "symbol": "MATICUSDT",
                        "display_name": "Polygon / Tether",
                        "base_asset": "MATIC",
                        "quote_asset": "USDT",
                    },
                ],
            },
            {
                "code": "perpetual",
                "label": "Perpetual",
                "description": "Contratos perpétuos comuns para derivativos em cripto.",
                "items": [
                    {
                        "symbol": "BTCUSDT.P",
                        "display_name": "Bitcoin Perpetual / Tether",
                        "base_asset": "BTC",
                        "quote_asset": "USDT",
                    },
                    {
                        "symbol": "ETHUSDT.P",
                        "display_name": "Ethereum Perpetual / Tether",
                        "base_asset": "ETH",
                        "quote_asset": "USDT",
                    },
                    {
                        "symbol": "SOLUSDT.P",
                        "display_name": "Solana Perpetual / Tether",
                        "base_asset": "SOL",
                        "quote_asset": "USDT",
                    },
                    {
                        "symbol": "XRPUSDT.P",
                        "display_name": "XRP Perpetual / Tether",
                        "base_asset": "XRP",
                        "quote_asset": "USDT",
                    },
                    {
                        "symbol": "DOGEUSDT.P",
                        "display_name": "Dogecoin Perpetual / Tether",
                        "base_asset": "DOGE",
                        "quote_asset": "USDT",
                    },
                ],
            },
        ],
    },
    {
        "code": "forex",
        "label": "Forex",
        "description": "Catálogo base de pares cambiais.",
        "subproducts": [
            {
                "code": "majors",
                "label": "Majors",
                "description": "Principais pares de moedas do mercado cambial.",
                "items": [
                    {
                        "symbol": "EURUSD",
                        "display_name": "Euro / US Dollar",
                        "base_asset": "EUR",
                        "quote_asset": "USD",
                    },
                    {
                        "symbol": "GBPUSD",
                        "display_name": "British Pound / US Dollar",
                        "base_asset": "GBP",
                        "quote_asset": "USD",
                    },
                    {
                        "symbol": "USDJPY",
                        "display_name": "US Dollar / Japanese Yen",
                        "base_asset": "USD",
                        "quote_asset": "JPY",
                    },
                    {
                        "symbol": "USDCHF",
                        "display_name": "US Dollar / Swiss Franc",
                        "base_asset": "USD",
                        "quote_asset": "CHF",
                    },
                    {
                        "symbol": "AUDUSD",
                        "display_name": "Australian Dollar / US Dollar",
                        "base_asset": "AUD",
                        "quote_asset": "USD",
                    },
                    {
                        "symbol": "USDCAD",
                        "display_name": "US Dollar / Canadian Dollar",
                        "base_asset": "USD",
                        "quote_asset": "CAD",
                    },
                    {
                        "symbol": "NZDUSD",
                        "display_name": "New Zealand Dollar / US Dollar",
                        "base_asset": "NZD",
                        "quote_asset": "USD",
                    },
                ],
            },
            {
                "code": "minors",
                "label": "Minors",
                "description": "Pares secundários sem o dólar americano numa das pontas.",
                "items": [
                    {
                        "symbol": "EURGBP",
                        "display_name": "Euro / British Pound",
                        "base_asset": "EUR",
                        "quote_asset": "GBP",
                    },
                    {
                        "symbol": "EURJPY",
                        "display_name": "Euro / Japanese Yen",
                        "base_asset": "EUR",
                        "quote_asset": "JPY",
                    },
                    {
                        "symbol": "GBPJPY",
                        "display_name": "British Pound / Japanese Yen",
                        "base_asset": "GBP",
                        "quote_asset": "JPY",
                    },
                    {
                        "symbol": "EURAUD",
                        "display_name": "Euro / Australian Dollar",
                        "base_asset": "EUR",
                        "quote_asset": "AUD",
                    },
                    {
                        "symbol": "GBPAUD",
                        "display_name": "British Pound / Australian Dollar",
                        "base_asset": "GBP",
                        "quote_asset": "AUD",
                    },
                ],
            },
        ],
    },
]


class InstrumentCatalogService:
    def list_products(self) -> list[dict]:
        return deepcopy(PRODUCT_CATALOG)

    def get_product(self, product_code: str) -> dict | None:
        normalized = product_code.strip().lower()

        for product in PRODUCT_CATALOG:
            if product["code"] == normalized:
                return deepcopy(product)

        return None

    def get_subproduct(self, product_code: str, subproduct_code: str) -> dict | None:
        product = self.get_product(product_code)
        if product is None:
            return None

        normalized = subproduct_code.strip().lower()

        for subproduct in product["subproducts"]:
            if subproduct["code"] == normalized:
                return deepcopy(subproduct)

        return None

    def list_items(self, product_code: str, subproduct_code: str | None = None) -> list[dict]:
        product = self.get_product(product_code)
        if product is None:
            return []

        if subproduct_code:
            subproduct = self.get_subproduct(product_code, subproduct_code)
            if subproduct is None:
                return []
            return deepcopy(subproduct["items"])

        items: list[dict] = []
        for subproduct in product["subproducts"]:
            items.extend(subproduct["items"])

        return deepcopy(items)