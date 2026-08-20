import type { z } from 'zod/v4'

/**
 * The language-model seam.
 *
 * SRS NFR-7: provider adapters are swappable behind a single interface so that
 * no vendor is load-bearing. Everything above this file describes *what* it
 * wants written; only the adapter below knows who writes it.
 *
 * The interface is deliberately narrow — one call, schema in, typed object out.
 * Chat history, tool use and streaming are not here because the scriptwriter
 * does not need them, and an interface that promises capabilities its second
 * implementation cannot honour is not portable, it is just Anthropic's SDK
 * wearing a different name.
 */

export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max'

export interface LlmRequest<T> {
  /** Standing instructions. Stable across calls, so it caches well. */
  system: string
  /** The specific ask. Varies per project. */
  prompt: string
  /** Shape of the reply. The adapter is responsible for enforcing it. */
  schema: z.ZodType<T>
  /** Names the schema for the provider; also what shows up in logs. */
  schemaName: string
  effort?: Effort
  maxTokens?: number
}

export interface LlmUsage {
  inputTokens: number
  outputTokens: number
  /** Prefix served from cache, billed at a fraction of the input rate. */
  cachedInputTokens: number
  /** Prefix written to cache this call, billed at a premium over input. */
  cacheWriteTokens: number
}

export interface LlmResult<T> {
  data: T
  usage: LlmUsage
  /** The model that actually served the request, not the one requested. */
  model: string
  latencyMs: number
}

export interface LlmProvider {
  /** Short identifier recorded against generated work, e.g. 'anthropic'. */
  readonly name: string
  generate<T>(req: LlmRequest<T>): Promise<LlmResult<T>>
}

/**
 * Raised when the model declines the request outright.
 *
 * Distinct from a transport failure: retrying the identical prompt will not
 * help, so the service surfaces it to the creator rather than backing off.
 */
export class LlmRefusalError extends Error {
  constructor(
    message: string,
    public readonly category: string | null,
  ) {
    super(message)
    this.name = 'LlmRefusalError'
  }
}

/** Raised when the model answered but the answer did not fit the schema. */
export class LlmShapeError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'LlmShapeError'
  }
}
