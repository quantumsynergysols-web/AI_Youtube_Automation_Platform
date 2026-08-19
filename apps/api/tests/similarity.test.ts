import { describe, expect, it } from 'vitest'
import {
  closestMatch,
  containment,
  jaccard,
  normalise,
  shingles,
  tokenise,
} from '../src/modules/originality/similarity'

describe('normalise', () => {
  it('lowercases, strips punctuation and collapses whitespace', () => {
    expect(normalise('  How I  EDIT, faster!! ')).toBe('how i edit faster')
  })

  it('strips urls, which otherwise dominate description comparisons', () => {
    expect(normalise('Subscribe at https://example.com/channel today')).toBe(
      'subscribe at today',
    )
  })

  it('keeps non-latin script rather than stripping it to nothing', () => {
    // Urdu and Hindi are target languages; a normaliser that ate them would
    // score every non-English script as identical to every other.
    expect(normalise('ویڈیو ایڈیٹنگ')).toBe('ویڈیو ایڈیٹنگ')
    expect(normalise('वीडियो संपादन')).toBe('वीडियो संपादन')
  })

  it('returns empty for punctuation-only input', () => {
    expect(normalise('!!! ??? ---')).toBe('')
  })
})

describe('tokenise', () => {
  it('drops stop words by default', () => {
    expect(tokenise('the art of the edit')).toEqual(['art', 'edit'])
  })

  it('keeps stop words when asked', () => {
    expect(tokenise('the art of the edit', false)).toEqual(['the', 'art', 'of', 'the', 'edit'])
  })
})

describe('shingles', () => {
  it('produces overlapping trigrams', () => {
    expect([...shingles('alpha beta gamma delta')]).toEqual([
      'alpha beta gamma',
      'beta gamma delta',
    ])
  })

  it('falls back to tokens when the text is shorter than one shingle', () => {
    // Short titles must still compare against each other rather than score zero.
    expect([...shingles('quick edit')]).toEqual(['quick', 'edit'])
  })

  it('returns empty for empty input', () => {
    expect(shingles('').size).toBe(0)
    expect(shingles('!!!').size).toBe(0)
  })

  it('distinguishes word order, which token sets cannot', () => {
    const a = shingles('how to edit video faster')
    const b = shingles('faster video edit to how')
    expect(jaccard(a, b)).toBeLessThan(0.5)
  })
})

describe('jaccard', () => {
  it('scores identical text as 1', () => {
    const text = 'the complete guide to colour grading in davinci resolve'
    expect(jaccard(shingles(text), shingles(text))).toBe(1)
  })

  it('scores unrelated text near 0', () => {
    const a = shingles('the complete guide to colour grading in davinci resolve')
    const b = shingles('why my sourdough starter keeps dying in winter')
    expect(jaccard(a, b)).toBe(0)
  })

  it('scores a light rewording high', () => {
    const original = shingles('How I edit my videos faster using three simple keyboard shortcuts')
    const reworded = shingles('How I edit my videos faster using three simple keyboard shortcuts!')
    expect(jaccard(original, reworded)).toBeGreaterThan(0.9)
  })

  it('is symmetric', () => {
    const a = shingles('one two three four five')
    const b = shingles('one two three six seven')
    expect(jaccard(a, b)).toBe(jaccard(b, a))
  })

  it('treats two empty sets as 0 rather than 1', () => {
    // Two empty scripts are not "identical" for guard purposes; scoring them 1
    // would block every project whose script had not been written yet.
    expect(jaccard(new Set(), new Set())).toBe(0)
  })
})

describe('containment', () => {
  it('detects a short script lifted wholesale into a longer one', () => {
    const short = shingles('three keyboard shortcuts that save me an hour every single week')
    const long = shingles(
      'welcome back to the channel today we are talking about editing ' +
        'three keyboard shortcuts that save me an hour every single week ' +
        'and then we will look at colour grading and audio levelling too',
    )

    // Jaccard is diluted by the extra material; containment is not.
    expect(jaccard(short, long)).toBeLessThan(0.5)
    expect(containment(short, long)).toBeGreaterThan(0.9)
  })

  it('is directional, unlike jaccard', () => {
    const small = shingles('alpha beta gamma')
    const big = shingles('alpha beta gamma delta epsilon zeta eta theta')
    expect(containment(small, big)).toBeGreaterThan(containment(big, small))
  })

  it('returns 0 for an empty candidate', () => {
    expect(containment(new Set(), shingles('anything at all here'))).toBe(0)
  })
})

describe('closestMatch', () => {
  const corpus = [
    { reference: 'vid1', text: 'How I edit my videos faster with keyboard shortcuts' },
    { reference: 'vid2', text: 'My honest review of the new camera after six months' },
    { reference: 'vid3', text: 'Why sourdough starters die and how to revive them' },
  ]

  it('returns the single worst offender, not an average', () => {
    const hit = closestMatch('How I edit my videos faster with keyboard shortcuts', corpus)
    expect(hit?.reference).toBe('vid1')
    expect(hit?.score).toBeGreaterThan(0.9)
  })

  it('scores genuinely new material low', () => {
    const hit = closestMatch('A beginners guide to fermenting hot sauce at home', corpus)
    expect(hit!.score).toBeLessThan(0.2)
  })

  it('is not diluted by a large unrelated corpus', () => {
    // One wholesale duplicate must still surface among fifty unrelated entries.
    const padded = [
      ...corpus,
      ...Array.from({ length: 50 }, (_, i) => ({
        reference: `pad${i}`,
        text: `some entirely unrelated topic number ${i} about gardening`,
      })),
    ]
    const hit = closestMatch('How I edit my videos faster with keyboard shortcuts', padded)
    expect(hit?.reference).toBe('vid1')
    expect(hit?.score).toBeGreaterThan(0.9)
  })

  it('returns null for an empty candidate', () => {
    expect(closestMatch('', corpus)).toBeNull()
    expect(closestMatch('!!!', corpus)).toBeNull()
  })

  it('returns null for an empty corpus, so a first-ever video is never blocked', () => {
    expect(closestMatch('Anything at all', [])).toBeNull()
  })

  it('skips corpus entries that normalise to nothing', () => {
    const hit = closestMatch('a real script about editing workflow', [
      { reference: 'empty', text: '!!!' },
      { reference: 'real', text: 'a real script about editing workflow' },
    ])
    expect(hit?.reference).toBe('real')
  })
})
