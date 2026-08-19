from __future__ import annotations

import logging
import sys

import redis as redis_lib
import structlog

from .config import load
from .db import JobStore
from .queue import Worker


def configure_logging(level: str) -> None:
    logging.basicConfig(format="%(message)s", stream=sys.stdout, level=level.upper())
    structlog.configure(
        processors=[
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.dev.ConsoleRenderer(),
        ]
    )


def main() -> int:
    cfg = load()
    configure_logging(cfg.log_level)

    client = redis_lib.from_url(cfg.redis_url)
    store = JobStore(cfg.database_url)
    worker = Worker(cfg, client, store)
    worker.install_signal_handlers()

    try:
        worker.run()
    finally:
        store.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
