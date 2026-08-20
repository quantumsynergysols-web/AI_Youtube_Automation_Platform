import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { env } from '../../../config/env'
import { logger } from '../../../lib/logger'
import { LlmRefusalError, LlmShapeError, type LlmProvider, type LlmRequest, type LlmResult } from './llm'

/**
 * Claude adapter for the language-model seam.
 *
 * Everything specific to Anthropic lives here — model id, thinking, effort,
 * structured outputs, refusal handling. The scriptwriter above knows none of it.
 */

const MODEL = 'claude-opus-5'

/**
 * Generous, because the cap covers thinking *and* the answer on this model, and
 * a 60-second script with a scene breakdown is a few thousand tokens before the
 * model has reasoned about any of it. Staying under ~16k also keeps the request
 * inside the SDK's HTTP timeout without needing to stream.
 */
const MAX_TOKENS = 16_000

export class AnthropicProvider implements LlmProvider {
  readonly name = 'anthropic'
  private client: Anthropic

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey })
  }

  async generate<T>(req: LlmRequest<T>): Promise<LlmResult<T>> {
    const startedAt = Date.now()

    const message = await this.client.beta.messages.parse({
      model: MODEL,
      max_tokens: req.maxTokens ?? MAX_TOKENS,

      // Claude's safety classifiers can decline a request outright, which
      // arrives as a normal 200 rather than an error. 'default' lets the API
      // re-run the declined request on Anthropic's recommended substitute
      // in the same call, so a false positive on an ordinary creator topic
      // does not surface to the creator as a dead end.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',

      // Let the model decide how long to think. A two-minute explainer about
      // sourdough does not need the deliberation a technical teardown does,
      // and a fixed budget would overpay for one and starve the other.
      thinking: { type: 'adaptive' },

      output_config: {
        effort: req.effort ?? 'high',
        format: betaZodOutputFormat(req.schema),
      },

      // Stable across every call, and marked cacheable for that reason. The
      // per-project prompt goes in the user turn, after the breakpoint, so it
      // never invalidates the cached prefix.
      system: [{ type: 'text', text: req.system, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: req.prompt }],
    })

    const latencyMs = Date.now() - startedAt

    if (message.stop_reason === 'refusal') {
      // Retrying the identical prompt will not help, so this must not be
      // treated as a transient failure by anything upstream.
      const category = message.stop_details?.type === 'refusal' ? message.stop_details.category : null
      throw new LlmRefusalError(
        'The model declined to write this script. Try a different topic or angle.',
        category ?? null,
      )
    }

    if (message.stop_reason === 'max_tokens') {
      throw new LlmShapeError(
        `The script was cut off at the ${req.maxTokens ?? MAX_TOKENS} token limit before it was complete.`,
      )
    }

    if (message.parsed_output === null || message.parsed_output === undefined) {
      throw new LlmShapeError('The model replied but the reply did not match the expected shape.')
    }

    const usage = {
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
      cachedInputTokens: message.usage.cache_read_input_tokens ?? 0,
      // Without this the reported cost understates the truth: a cached prefix
      // leaves input_tokens holding only the uncached remainder, so the system
      // prompt would vanish from the numbers entirely on the call that writes it.
      cacheWriteTokens: message.usage.cache_creation_input_tokens ?? 0,
    }

    logger.info(
      { provider: this.name, model: message.model, schema: req.schemaName, latencyMs, ...usage },
      'llm generation completed',
    )

    return { data: message.parsed_output as T, usage, model: message.model, latencyMs }
  }
}

let cached: AnthropicProvider | null = null

/**
 * Returns the configured provider, or null when no key is set.
 *
 * Null rather than throwing, so the API still boots without a key and the
 * script routes report 501 — the same treatment Google sign-in gets. A missing
 * provider key should disable one feature, not the whole service.
 */
export function llmProvider(): LlmProvider | null {
  if (!env.ANTHROPIC_API_KEY) return null
  if (!cached) cached = new AnthropicProvider(env.ANTHROPIC_API_KEY)
  return cached
}
