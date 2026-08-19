/**
 * Text similarity primitives for the Originality Guard (FR-9.2).
 *
 * Deliberately lexical rather than semantic. Shingled Jaccard is deterministic,
 * costs nothing, needs no network call, and is exhaustively testable — and it
 * catches the failure mode that actually matters here: a creator regenerating a
 * near-identical script on a topic they have already covered.
 *
 * It will NOT catch a genuine paraphrase that shares no wording. Embeddings are
 * the upgrade path for that, at the cost of an API call per check. Worth doing
 * when there is evidence paraphrase duplication is happening, not before.
 */

/** Words carrying no signal for duplicate detection; dropped before shingling. */
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for', 'from', 'has',
  'have', 'he', 'her', 'his', 'how', 'i', 'in', 'is', 'it', 'its', 'my', 'of',
  'on', 'or', 'she', 'so', 'that', 'the', 'their', 'them', 'they', 'this', 'to',
  'was', 'we', 'were', 'what', 'when', 'which', 'who', 'will', 'with', 'you',
  'your',
])

const SHINGLE_SIZE = 3

/**
 * Lowercase, strip punctuation and collapse whitespace.
 *
 * Punctuation and case are exactly the things a creator changes when lightly
 * reworking a script they have already published, so normalising them away is
 * the point rather than a convenience.
 */
export function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    // \p{M} matters: Devanagari vowel signs and Arabic diacritics are combining
    // MARKS, not letters. Dropping them reduces Hindi to consonant skeletons, which
    // would make unrelated scripts look near-identical and falsely block the very
    // regional-language creators this product targets.
    .replace(/[^\p{L}\p{N}\p{M}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function tokenise(text: string, dropStopWords = true): string[] {
  const words = normalise(text).split(' ').filter(Boolean)
  return dropStopWords ? words.filter((w) => !STOP_WORDS.has(w)) : words
}

/**
 * Overlapping word n-grams. Shingles capture word ORDER, which single tokens do
 * not: "how to edit faster" and "faster editing how to" share every token but no
 * shingle, and are not the same script.
 */
export function shingles(text: string, size = SHINGLE_SIZE): Set<string> {
  const tokens = tokenise(text)
  const out = new Set<string>()

  if (tokens.length === 0) return out
  if (tokens.length < size) {
    // Too short to shingle. Fall back to the tokens so very short titles still
    // compare against each other rather than silently scoring zero.
    for (const t of tokens) out.add(t)
    return out
  }

  for (let i = 0; i <= tokens.length - size; i++) {
    out.add(tokens.slice(i, i + size).join(' '))
  }
  return out
}

/** Jaccard index: shared shingles over total distinct shingles. 0 = nothing in common, 1 = identical. */
export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0
  if (a.size === 0 || b.size === 0) return 0

  let shared = 0
  const [small, large] = a.size <= b.size ? [a, b] : [b, a]
  for (const item of small) if (large.has(item)) shared++

  return shared / (a.size + b.size - shared)
}

/**
 * Containment: how much of `candidate` already appears in `existing`.
 *
 * Jaccard alone is misleading when lengths differ sharply — a 60-second script
 * lifted wholesale into a 10-minute one scores low on Jaccard but is still
 * duplication. Containment catches that; the guard takes the higher of the two.
 */
export function containment(candidate: Set<string>, existing: Set<string>): number {
  if (candidate.size === 0) return 0
  let shared = 0
  for (const item of candidate) if (existing.has(item)) shared++
  return shared / candidate.size
}

export interface SimilarityHit {
  /** Identifier of the prior work this resembles. */
  reference: string
  score: number
}

/**
 * Highest similarity between `candidate` and anything in `corpus`.
 *
 * Returns the single worst offender rather than an average: one wholesale
 * duplicate is a problem even when the other fifty entries are unrelated, and
 * an average would dilute it into invisibility.
 */
export function closestMatch(
  candidate: string,
  corpus: Array<{ reference: string; text: string }>,
): SimilarityHit | null {
  const candidateShingles = shingles(candidate)
  if (candidateShingles.size === 0) return null

  let best: SimilarityHit | null = null

  for (const entry of corpus) {
    const entryShingles = shingles(entry.text)
    if (entryShingles.size === 0) continue

    const score = Math.max(
      jaccard(candidateShingles, entryShingles),
      containment(candidateShingles, entryShingles),
    )

    if (!best || score > best.score) best = { reference: entry.reference, score }
  }

  return best
}
