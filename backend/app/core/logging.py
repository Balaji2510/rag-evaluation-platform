import logging
import sys


def setup_logging(debug: bool = False) -> None:
    """Configure structured logging for the application."""
    log_level = logging.DEBUG if debug else logging.INFO

    logging_config = {
        "level": log_level,
        "format": "%(asctime)s [%(levelname)s] [%(name)s]: %(message)s",
        "datefmt": "%Y-%m-%d %H:%M:%S",
        "handlers": [logging.StreamHandler(sys.stdout)],
    }

    logging.basicConfig(**logging_config)

    # Set external libraries log levels
    logging.getLogger("uvicorn.access").setLevel(logging.INFO)
    logging.getLogger("uvicorn.error").setLevel(logging.INFO)
    logging.getLogger("motor").setLevel(logging.WARNING)
    logging.getLogger("pymongo").setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    """Retrieve logger instance with given name."""
    return logging.getLogger(name)

