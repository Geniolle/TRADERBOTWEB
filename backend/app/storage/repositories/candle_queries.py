# G:\O meu disco\python\Trader-bot\app\storage\repositories\candle_queries.py

from app.storage.models import CandleModel


def _normalize_symbol(value: str) -> str:
    return value.strip().upper()


def _normalize_timeframe(value: str) -> str:
    return value.strip().lower()


def _normalize_source(value: str | None) -> str | None:
    if value is None:
        return None

    normalized = value.strip().lower()
    if not normalized:
        return None

    return normalized


class CandleQueryRepository:
    def list_by_symbol_timeframe_range(
        self,
        session,
        symbol: str,
        timeframe: str,
        start_at,
        end_at,
        source: str | None = None,
    ) -> list[CandleModel]:
        query = session.query(CandleModel).filter(
            CandleModel.symbol == _normalize_symbol(symbol),
            CandleModel.timeframe == _normalize_timeframe(timeframe),
            CandleModel.open_time >= start_at,
            CandleModel.close_time <= end_at,
        )

        normalized_source = _normalize_source(source)
        if normalized_source is not None:
            query = query.filter(CandleModel.source == normalized_source)

        return (
            query.order_by(CandleModel.open_time.asc(), CandleModel.id.asc())
            .all()
        )

    def list_by_filters(
        self,
        session,
        symbol: str,
        timeframe: str,
        start_at,
        end_at,
        limit: int = 500,
        source: str | None = None,
    ) -> list[CandleModel]:
        query = session.query(CandleModel).filter(
            CandleModel.symbol == _normalize_symbol(symbol),
            CandleModel.timeframe == _normalize_timeframe(timeframe),
            CandleModel.open_time >= start_at,
            CandleModel.close_time <= end_at,
        )

        normalized_source = _normalize_source(source)
        if normalized_source is not None:
            query = query.filter(CandleModel.source == normalized_source)

        return (
            query.order_by(CandleModel.open_time.asc(), CandleModel.id.asc())
            .limit(limit)
            .all()
        )

    def get_latest(
        self,
        session,
        symbol: str,
        timeframe: str,
        source: str | None = None,
    ) -> CandleModel | None:
        query = session.query(CandleModel).filter(
            CandleModel.symbol == _normalize_symbol(symbol),
            CandleModel.timeframe == _normalize_timeframe(timeframe),
        )

        normalized_source = _normalize_source(source)
        if normalized_source is not None:
            query = query.filter(CandleModel.source == normalized_source)

        return (
            query.order_by(CandleModel.open_time.desc(), CandleModel.id.desc())
            .first()
        )