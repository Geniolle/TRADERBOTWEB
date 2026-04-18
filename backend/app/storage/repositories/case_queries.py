from app.storage.models import StrategyCaseModel


class StrategyCaseQueryRepository:
    def list_by_run_id(self, session, run_id: str) -> list[StrategyCaseModel]:
        return (
            session.query(StrategyCaseModel)
            .filter(StrategyCaseModel.run_id == run_id)
            .order_by(StrategyCaseModel.trigger_time.asc(), StrategyCaseModel.id.asc())
            .all()
        )