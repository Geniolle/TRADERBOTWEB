import logging
import sys

from app.core.settings import get_settings


LOG_FORMAT = "%(asctime)s | %(levelname)s | %(name)s | %(message)s"


def setup_logging() -> None:
    settings = get_settings()
    log_level = getattr(logging, settings.log_level.upper(), logging.INFO)

    logging.basicConfig(
        level=log_level,
        format=LOG_FORMAT,
        handlers=[logging.StreamHandler(sys.stdout)],
        force=True,
    )

    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)

    for noisy_logger_name in (
        "uvicorn.access",
        "uvicorn.error",
        "httpx",
        "websockets",
    ):
        logging.getLogger(noisy_logger_name).setLevel(log_level)

    logger = get_logger(__name__)
    logger.info("###################################################################################")
    logger.info("🚀 LOGGING INICIALIZADO")
    logger.info("LOG_LEVEL=%s", settings.log_level.upper())
    logger.info("TIMEZONE=%s", settings.timezone)
    logger.info("APP_ENV=%s", settings.app_env)
    logger.info("###################################################################################")


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)