import { ApiFailure } from '../lib/errors.ts'

export const COMMENTARY_FLOOR = 20

export function countWords(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length
}

export function generationError(error: unknown): string {
  if (error instanceof ApiFailure) {
    if (error.status === 501 || error.error.code === 'provider_not_configured') {
      return 'Script generation is not configured on this deployment. Ask the operator to set ANTHROPIC_API_KEY and restart the API.'
    }
    if (error.status === 422 || error.error.code === 'provider_refused') {
      return 'The scriptwriter declined this topic. Rephrase the project topic or choose a different angle, then generate again.'
    }
    if (error.status === 502 || error.error.code === 'provider_bad_output') {
      return 'The scriptwriter returned an incomplete draft. Generate again; your project and commentary are unchanged.'
    }
    return `${error.error.message} Try generating again.`
  }
  return 'The script could not be generated. Check your connection, then try again.'
}

export type GuardTarget = 'hook' | 'commentary' | 'scenes'

export function guardTarget(result: { hookEdited: boolean; hasCommentary: boolean; similarity: number }): GuardTarget {
  if (result.similarity >= 0.55) return 'scenes'
  if (!result.hasCommentary) return 'commentary'
  return 'hook'
}

/** Tracks only active, focused work and hands callers non-overlapping deltas. */
export class ActiveTimeAccumulator {
  private activeSince: number | null = null
  private pendingMs = 0
  private readonly now: () => number

  constructor(now: () => number = () => performance.now()) {
    this.now = now
  }

  resume(): void {
    if (this.activeSince === null) this.activeSince = this.now()
  }

  pause(): void {
    if (this.activeSince === null) return
    this.pendingMs += Math.max(0, this.now() - this.activeSince)
    this.activeSince = null
  }

  consume(): number {
    if (this.activeSince !== null) {
      const current = this.now()
      this.pendingMs += Math.max(0, current - this.activeSince)
      this.activeSince = current
    }
    const delta = Math.round(this.pendingMs)
    this.pendingMs = 0
    return delta
  }

  restore(delta: number): void {
    this.pendingMs += Math.max(0, delta)
  }
}
