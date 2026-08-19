"""Worker behaviour, exercised against fakeredis so no services are needed."""
from __future__ import annotations

import json

import fakeredis
import pytest

from worker.config import Config
from worker.queue import Worker, dead_key, pending_key, processing_key


@pytest.fixture
def cfg() -> Config:
    return Config(
        redis_url="redis://localhost:6379",
        database_url="postgresql://unused",
        queue="test",
        worker_id="worker-test",
        block_seconds=1,
        backoff_base_ms=1,
        log_level="warning",
        reclaim_on_start=True,
    )


@pytest.fixture
def client() -> fakeredis.FakeRedis:
    return fakeredis.FakeRedis()


def job(**overrides) -> dict:
    base = {
        "id": "job-1",
        "type": "dummy.echo",
        "stage": "DUMMY",
        "userId": "user-1",
        "projectId": None,
        "payload": {"message": "hello"},
        "attempts": 0,
        "maxAttempts": 3,
        "enqueuedAt": "2026-08-19T00:00:00Z",
    }
    base.update(overrides)
    return base


def test_tick_returns_false_when_queue_is_empty(cfg, client):
    worker = Worker(cfg, client)
    assert worker.tick() is False


def test_successful_job_clears_processing_list(cfg, client):
    client.lpush(pending_key(cfg.queue), json.dumps(job()))
    worker = Worker(cfg, client)

    assert worker.tick() is True
    assert client.llen(pending_key(cfg.queue)) == 0
    assert client.llen(processing_key(cfg.queue)) == 0
    assert client.hget("job:job-1", "status") == b"succeeded"


def test_failing_job_is_requeued_with_incremented_attempts(cfg, client):
    client.lpush(pending_key(cfg.queue), json.dumps(job(payload={"message": "__fail__"})))
    worker = Worker(cfg, client)

    worker.tick()

    assert client.llen(processing_key(cfg.queue)) == 0
    requeued = json.loads(client.rpop(pending_key(cfg.queue)))
    assert requeued["attempts"] == 1
    assert client.llen(dead_key(cfg.queue)) == 0


def test_job_is_dead_lettered_on_final_attempt(cfg, client):
    client.lpush(
        pending_key(cfg.queue),
        json.dumps(job(payload={"message": "__fail__"}, attempts=2, maxAttempts=3)),
    )
    worker = Worker(cfg, client)

    worker.tick()

    assert client.llen(pending_key(cfg.queue)) == 0
    assert client.llen(processing_key(cfg.queue)) == 0
    assert client.llen(dead_key(cfg.queue)) == 1
    assert client.hget("job:job-1", "status") == b"dead"


def test_unknown_job_type_is_dead_lettered_immediately(cfg, client):
    client.lpush(pending_key(cfg.queue), json.dumps(job(type="nope.missing")))
    worker = Worker(cfg, client)

    worker.tick()

    assert client.llen(dead_key(cfg.queue)) == 1
    assert client.llen(pending_key(cfg.queue)) == 0


def test_undecodable_payload_is_dead_lettered(cfg, client):
    client.lpush(pending_key(cfg.queue), "not json at all")
    worker = Worker(cfg, client)

    assert worker.tick() is True
    assert client.llen(dead_key(cfg.queue)) == 1


def test_reclaim_returns_abandoned_jobs_to_pending(cfg, client):
    """A worker that dies mid-job leaves its entry in processing; it must come back."""
    client.lpush(processing_key(cfg.queue), json.dumps(job(id="orphan-1")))
    client.lpush(processing_key(cfg.queue), json.dumps(job(id="orphan-2")))
    worker = Worker(cfg, client)

    assert worker.reclaim_stale() == 2
    assert client.llen(processing_key(cfg.queue)) == 0
    assert client.llen(pending_key(cfg.queue)) == 2


def test_reclaim_is_a_noop_when_nothing_is_in_flight(cfg, client):
    worker = Worker(cfg, client)
    assert worker.reclaim_stale() == 0
