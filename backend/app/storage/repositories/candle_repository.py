# G:\O meu disco\python\Trader-bot\app\storage\repositories\candle_repository.py

from app.models.domain.candle import Candle
from app.storage.models import CandleModel


def _normalize_symbol(value: str) -> str:
    return value.strip().upper()


def _normalize_timeframe(value: str) -> str:
    return value.strip().lower()


def _normalize_source(value: str | None) -> str:
    normalized = (value or "unknown").strip().lower()
    return normalized or "unknown"


class CandleRepository:
    def _find_existing(self, session, candle: Candle, normalized_source: str) -> CandleModel | None:
        return (
            session.query(CandleModel)
            .filter(
                CandleModel.symbol == _normalize_symbol(candle.symbol),
                CandleModel.timeframe == _normalize_timeframe(candle.timeframe),
                CandleModel.open_time == candle.open_time,
                CandleModel.source == normalized_source,
            )
            .first()
        )

    def _apply_values(self, db_obj: CandleModel, candle: Candle, normalized_source: str) -> CandleModel:
        db_obj.asset_id = candle.asset_id
        db_obj.symbol = _normalize_symbol(candle.symbol)
        db_obj.timeframe = _normalize_timeframe(candle.timeframe)
        db_obj.open_time = candle.open_time
        db_obj.close_time = candle.close_time
        db_obj.open = candle.open
        db_obj.high = candle.high
        db_obj.low = candle.low
        db_obj.close = candle.close
        db_obj.volume = candle.volume
        db_obj.source = normalized_source
        return db_obj

    def save_many(self, session, candles: list[Candle]) -> list[CandleModel]:
        saved_items: list[CandleModel] = []
        seen_keys: dict[tuple[str, str, object, str], CandleModel] = {}

        for candle in candles:
            normalized_symbol = _normalize_symbol(candle.symbol)
            normalized_timeframe = _normalize_timeframe(candle.timeframe)
            normalized_source = _normalize_source(candle.source)

            dedupe_key = (
                normalized_symbol,
                normalized_timeframe,
                candle.open_time,
                normalized_source,
            )

            if dedupe_key in seen_keys:
                db_obj = seen_keys[dedupe_key]
                self._apply_values(db_obj, candle, normalized_source)
                continue

            existing = self._find_existing(
                session=session,
                candle=candle,
                normalized_source=normalized_source,
            )

            if existing is not None:
                db_obj = self._apply_values(existing, candle, normalized_source)
            else:
                db_obj = CandleModel(
                    asset_id=candle.asset_id,
                    symbol=normalized_symbol,
                    timeframe=normalized_timeframe,
                    open_time=candle.open_time,
                    close_time=candle.close_time,
                    open=candle.open,
                    high=candle.high,
                    low=candle.low,
                    close=candle.close,
                    volume=candle.volume,
                    source=normalized_source,
                )
                session.add(db_obj)

            seen_keys[dedupe_key] = db_obj
            saved_items.append(db_obj)

        session.commit()

        for item in saved_items:
            try:
                session.refresh(item)
            except Exception:
                pass

        return saved_items

    def get_latest(self, session, symbol: str, timeframe: str, source: str | None = None) -> CandleModel | None:
        normalized_source = _normalize_source(source)

        return (
            session.query(CandleModel)
            .filter(
                CandleModel.symbol == _normalize_symbol(symbol),
                CandleModel.timeframe == _normalize_timeframe(timeframe),
                CandleModel.source == normalized_source,
            )
            .order_by(CandleModel.open_time.desc(), CandleModel.id.desc())
            .first()
        )