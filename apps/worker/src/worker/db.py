"""RenderJob status updates.

Prisma preserves model and field casing, so every identifier is quoted and
enum values are cast explicitly to the Postgres enum type Prisma generated.
"""
from __future__ import annotations

import json
from typing import Any
from urllib.parse import parse_qsl, quote, urlencode, urlsplit, urlunsplit

import psycopg

# Query parameters Prisma understands but libpq does not. DATABASE_URL is shared
# with the API, so the worker has to tolerate Prisma's dialect of the same URL.
_PRISMA_ONLY = {
    "connection_limit",
    "pool_timeout",
    "pgbouncer",
    "sslidentity",
    "sslcert",
}


def normalise_dsn(url: str) -> str:
    """Converts a Prisma-style Postgres URL into one libpq accepts.

    ``?schema=public`` becomes ``?options=-c search_path=public``; other
    Prisma-only parameters are dropped. Anything libpq already understands is
    passed through untouched.
    """
    parts = urlsplit(url)
    kept: list[tuple[str, str]] = []
    schema: str | None = None

    for key, value in parse_qsl(parts.query, keep_blank_values=True):
        if key == "schema":
            schema = value
        elif key in _PRISMA_ONLY:
            continue
        else:
            kept.append((key, value))

    if schema:
        kept.append(("options", f"-c search_path={schema}"))

    query = urlencode(kept, quote_via=quote, safe="")
    return urlunsplit((parts.scheme, parts.netloc, parts.path, query, parts.fragment))


class JobStore:
    def __init__(self, database_url: str) -> None:
        self._url = normalise_dsn(database_url)
        self._conn: psycopg.Connection | None = None

    def _connection(self) -> psycopg.Connection:
        if self._conn is None or self._conn.closed:
            self._conn = psycopg.connect(self._url, autocommit=True)
        return self._conn

    def mark_running(self, job_id: str, worker_id: str, attempts: int) -> None:
        with self._connection().cursor() as cur:
            cur.execute(
                """
                UPDATE "RenderJob"
                   SET "status" = 'RUNNING'::"JobStatus",
                       "workerId" = %s,
                       "attempts" = %s,
                       "startedAt" = COALESCE("startedAt", now())
                 WHERE "id" = %s
                """,
                (worker_id, attempts, job_id),
            )

    def mark_succeeded(self, job_id: str, result: dict[str, Any]) -> None:
        with self._connection().cursor() as cur:
            cur.execute(
                """
                UPDATE "RenderJob"
                   SET "status" = 'SUCCEEDED'::"JobStatus",
                       "result" = %s::jsonb,
                       "error" = NULL,
                       "finishedAt" = now()
                 WHERE "id" = %s
                """,
                (json.dumps(result), job_id),
            )

    def mark_failed(self, job_id: str, error: str, dead: bool) -> None:
        status = "DEAD" if dead else "FAILED"
        with self._connection().cursor() as cur:
            cur.execute(
                f"""
                UPDATE "RenderJob"
                   SET "status" = '{status}'::"JobStatus",
                       "error" = %s,
                       "finishedAt" = CASE WHEN %s THEN now() ELSE NULL END
                 WHERE "id" = %s
                """,
                (error[:2000], dead, job_id),
            )

    def close(self) -> None:
        if self._conn is not None and not self._conn.closed:
            self._conn.close()
