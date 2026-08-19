"""Gate G0 probe handler.

Does no real work. Its only job is to prove that a request to the API reaches
Redis, is picked up by this process, and lands back in Postgres.
"""
from __future__ import annotations

import time
from datetime import UTC, datetime
from typing import Any


def handle_echo(payload: dict[str, Any]) -> dict[str, Any]:
    delay_ms = int(payload.get("delayMs") or 0)
    if delay_ms:
        time.sleep(min(delay_ms, 10_000) / 1000)

    message = payload.get("message", "")
    if message == "__fail__":
        # Deliberate failure path, used to exercise retry and dead-lettering.
        raise RuntimeError("dummy.echo asked to fail")

    return {
        "echo": message,
        "processedAt": datetime.now(UTC).isoformat(),
        "delayedMs": delay_ms,
    }
