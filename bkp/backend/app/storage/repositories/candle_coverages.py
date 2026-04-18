from datetime import datetime

from app.storage.cache_models import CandleCoverageModel


class CandleCoverageRepository:
    def get_by_symbol_timeframe(
        self,
        session,
        symbol: str,
        timeframe: str,
    ) -> CandleCoverageModel | None:
        return (
            session.query(CandleCoverageModel)
            .filter(
                CandleCoverageModel.symbol == symbol,
                CandleCoverageModel.timeframe == timeframe,
            )
            .first()
        )

    def upsert_coverage(
        self,
        session,
        symbol: str,
        timeframe: str,
        covered_from,
        covered_to,
        provider_name: str | None,
    ) -> CandleCoverageModel:
        row = self.get_by_symbol_timeframe(
            session=session,
            symbol=symbol,
            timeframe=timeframe,
        )

        now = datetime.utcnow()

        if row is None:
            row = CandleCoverageModel(
                symbol=symbol,
                timeframe=timeframe,
                covered_from=covered_from,
                covered_to=covered_to,
                last_synced_at=now,
                last_provider=provider_name,
            )
            session.add(row)
            session.flush()
            return row

        if covered_from is not None:
            if row.covered_from is None or covered_from < row.covered_from:
                row.covered_from = covered_from

        if covered_to is not None:
            if row.covered_to is None or covered_to > row.covered_to:
                row.covered_to = covered_to

        row.last_synced_at = now
        row.last_provider = provider_name

        session.flush()
        return row