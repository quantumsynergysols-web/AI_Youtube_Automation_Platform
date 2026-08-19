"""DATABASE_URL is shared with Prisma, which uses parameters libpq rejects."""
from __future__ import annotations

from worker.db import normalise_dsn


def test_prisma_schema_parameter_becomes_a_search_path_option():
    out = normalise_dsn("postgresql://u:p@localhost:5432/db?schema=public")
    assert "schema=public" not in out
    assert "options=-c%20search_path%3Dpublic" in out or "options=-c search_path=public" in out


def test_prisma_only_pool_parameters_are_dropped():
    out = normalise_dsn("postgresql://u:p@h:5432/db?schema=public&connection_limit=5&pool_timeout=10")
    assert "connection_limit" not in out
    assert "pool_timeout" not in out


def test_libpq_parameters_are_preserved():
    out = normalise_dsn("postgresql://u:p@h:5432/db?sslmode=require")
    assert "sslmode=require" in out


def test_url_without_query_is_unchanged():
    url = "postgresql://u:p@localhost:5432/db"
    assert normalise_dsn(url) == url


def test_credentials_and_host_survive_normalisation():
    out = normalise_dsn("postgresql://ytap:secret@localhost:5432/ytap?schema=public")
    assert out.startswith("postgresql://ytap:secret@localhost:5432/ytap")
