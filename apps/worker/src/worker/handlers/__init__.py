"""Handler registry. A handler takes the job payload and returns a JSON-serialisable result."""
from __future__ import annotations

from collections.abc import Callable
from typing import Any

from .dummy import handle_echo

Handler = Callable[[dict[str, Any]], dict[str, Any]]

REGISTRY: dict[str, Handler] = {
    "dummy.echo": handle_echo,
}


class UnknownJobType(Exception):
    pass


def resolve(job_type: str) -> Handler:
    handler = REGISTRY.get(job_type)
    if handler is None:
        raise UnknownJobType(f"No handler registered for job type {job_type!r}")
    return handler
