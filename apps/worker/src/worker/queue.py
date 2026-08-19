"""Consumer for the redis-list-v1 protocol described in contracts/jobs.json.

Reliability model: BRPOPLPUSH moves a job from the pending list to a processing
list in one atomic step, so a job is never in neither place. On success or
permanent failure the entry is removed from processing; on a retryable failure
it is removed and re-pushed to pending with an incremented attempt count.
"""
from __future__ import annotations

import json
import signal
import time
from typing import Any

import redis as redis_lib
import structlog

from .config import Config
from .db import JobStore
from .handlers import UnknownJobType, resolve

log = structlog.get_logger()


def pending_key(queue: str) -> str:
    return f"q:{queue}"


def processing_key(queue: str) -> str:
    return f"q:{queue}:processing"


def dead_key(queue: str) -> str:
    return f"q:{queue}:dead"


def record_key(job_id: str) -> str:
    return f"job:{job_id}"


class Worker:
    def __init__(self, cfg: Config, client: redis_lib.Redis, store: JobStore | None = None) -> None:
        self.cfg = cfg
        self.redis = client
        self.store = store
        self._running = False

    def install_signal_handlers(self) -> None:
        for sig in (signal.SIGINT, signal.SIGTERM):
            signal.signal(sig, lambda *_: self.stop())

    def stop(self) -> None:
        log.info("shutdown requested")
        self._running = False

    def run(self) -> None:
        self._running = True
        log.info("worker started", queue=self.cfg.queue, worker_id=self.cfg.worker_id)
        if self.cfg.reclaim_on_start:
            self.reclaim_stale()
        while self._running:
            self.tick()
        log.info("worker stopped")

    def reclaim_stale(self) -> int:
        """Returns jobs abandoned in the processing list to the pending list.

        A worker that dies mid-job leaves its entry in processing, where nothing
        would ever pick it up again. Reclaiming on start recovers those.

        Only safe while a single worker runs against the queue: with several
        workers this would steal jobs that are genuinely in flight. Set
        WORKER_RECLAIM_ON_START=0 before scaling out, and replace this with
        lease expiry based on a per-job heartbeat.
        """
        reclaimed = 0
        while True:
            raw = self.redis.rpoplpush(processing_key(self.cfg.queue), pending_key(self.cfg.queue))
            if raw is None:
                break
            reclaimed += 1

        if reclaimed:
            log.warning("reclaimed abandoned jobs", count=reclaimed, queue=self.cfg.queue)
        return reclaimed

    def tick(self) -> bool:
        """Processes at most one job. Returns True if a job was handled."""
        raw = self.redis.brpoplpush(
            pending_key(self.cfg.queue),
            processing_key(self.cfg.queue),
            timeout=self.cfg.block_seconds,
        )
        if raw is None:
            return False

        raw_text = raw.decode() if isinstance(raw, bytes) else raw

        try:
            message: dict[str, Any] = json.loads(raw_text)
        except json.JSONDecodeError:
            log.error("undecodable job discarded", raw=raw_text[:200])
            self.redis.lrem(processing_key(self.cfg.queue), 1, raw_text)
            self.redis.lpush(dead_key(self.cfg.queue), raw_text)
            return True

        self._process(message, raw_text)
        return True

    def _process(self, message: dict[str, Any], raw_text: str) -> None:
        job_id = message.get("id", "unknown")
        job_type = message.get("type", "")
        attempts = int(message.get("attempts", 0)) + 1
        max_attempts = int(message.get("maxAttempts", 3))

        bound = log.bind(job_id=job_id, type=job_type, attempt=attempts)
        bound.info("job started")

        if self.store:
            self.store.mark_running(job_id, self.cfg.worker_id, attempts)
        self._set_status(job_id, "running")

        try:
            handler = resolve(job_type)
            result = handler(message.get("payload") or {})
        except UnknownJobType as exc:
            # Never retryable: a redeploy is required, not another attempt.
            bound.error("unknown job type", error=str(exc))
            self._finish_failed(message, raw_text, str(exc), dead=True)
            return
        except Exception as exc:  # noqa: BLE001 - any handler error is a job failure
            bound.warning("job failed", error=str(exc))
            self._finish_failed(message, raw_text, str(exc), dead=attempts >= max_attempts)
            return

        self.redis.lrem(processing_key(self.cfg.queue), 1, raw_text)
        if self.store:
            self.store.mark_succeeded(job_id, result)
        self._set_status(job_id, "succeeded", result)
        bound.info("job succeeded")

    def _finish_failed(
        self, message: dict[str, Any], raw_text: str, error: str, dead: bool
    ) -> None:
        job_id = message.get("id", "unknown")
        queue = self.cfg.queue
        self.redis.lrem(processing_key(queue), 1, raw_text)

        if dead:
            self.redis.lpush(dead_key(queue), raw_text)
            if self.store:
                self.store.mark_failed(job_id, error, dead=True)
            self._set_status(job_id, "dead", {"error": error})
            log.error("job dead-lettered", job_id=job_id, error=error)
            return

        message["attempts"] = int(message.get("attempts", 0)) + 1
        if self.store:
            self.store.mark_failed(job_id, error, dead=False)
        self._set_status(job_id, "queued", {"error": error})

        # Linear-ish backoff. Sleeping here is acceptable at Phase 0 volumes;
        # a delayed-set scheduler replaces it when throughput matters.
        delay = self.cfg.backoff_base_ms * message["attempts"] / 1000
        time.sleep(min(delay, 30))
        self.redis.lpush(pending_key(queue), json.dumps(message))
        log.info("job requeued", job_id=job_id, attempt=message["attempts"])

    def _set_status(self, job_id: str, status: str, extra: dict[str, Any] | None = None) -> None:
        payload = {"status": status}
        if extra is not None:
            payload["detail"] = json.dumps(extra)
        self.redis.hset(record_key(job_id), mapping=payload)
        self.redis.expire(record_key(job_id), 60 * 60 * 24 * 7)
