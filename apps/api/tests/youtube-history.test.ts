import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchPlaylistPage, fetchUploadsPlaylistId } from '../src/modules/channels/youtube-oauth'

function mockFetch(status: number, body: unknown) {
  const fn = vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }))
  vi.stubGlobal('fetch', fn)
  return fn
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchUploadsPlaylistId', () => {
  it('reads the uploads playlist from contentDetails', async () => {
    const fetchFn = mockFetch(200, {
      items: [{ contentDetails: { relatedPlaylists: { uploads: 'UU_abc123' } } }],
    })

    await expect(fetchUploadsPlaylistId('token')).resolves.toBe('UU_abc123')

    // Uploads playlist, not search: 1 quota unit per 50 videos rather than 100 per call.
    const url = String(fetchFn.mock.calls[0]![0])
    expect(url).toContain('/youtube/v3/channels')
    expect(url).toContain('part=contentDetails')
    expect(url).toContain('mine=true')
  })

  it('throws when the channel has no uploads playlist', async () => {
    mockFetch(200, { items: [{ contentDetails: {} }] })
    await expect(fetchUploadsPlaylistId('token')).rejects.toThrow(/no uploads playlist/)
  })

  it('throws on a non-ok response instead of returning undefined', async () => {
    mockFetch(403, {})
    await expect(fetchUploadsPlaylistId('token')).rejects.toThrow()
  })
})

describe('fetchPlaylistPage', () => {
  const page = {
    nextPageToken: 'PAGE2',
    pageInfo: { totalResults: 137 },
    items: [
      {
        contentDetails: { videoId: 'vid1', videoPublishedAt: '2026-01-15T10:00:00Z' },
        snippet: { title: 'How I edit', description: 'My workflow' },
      },
      {
        contentDetails: { videoId: 'vid2' },
        // no videoPublishedAt — must fall back to the snippet
        snippet: { title: 'Second', description: '', publishedAt: '2026-02-01T08:30:00Z' },
      },
    ],
  }

  it('maps items to video records', async () => {
    mockFetch(200, page)
    const result = await fetchPlaylistPage('token', 'UU_abc123')

    expect(result.videos).toHaveLength(2)
    expect(result.videos[0]).toEqual({
      youtubeVideoId: 'vid1',
      title: 'How I edit',
      description: 'My workflow',
      publishedAt: new Date('2026-01-15T10:00:00Z'),
    })
    expect(result.nextPageToken).toBe('PAGE2')
    expect(result.totalResults).toBe(137)
  })

  it('falls back to the snippet publish date when contentDetails omits it', async () => {
    mockFetch(200, page)
    const result = await fetchPlaylistPage('token', 'UU_abc123')
    expect(result.videos[1]!.publishedAt).toEqual(new Date('2026-02-01T08:30:00Z'))
  })

  it('normalises an empty description to null rather than storing an empty string', async () => {
    mockFetch(200, page)
    const result = await fetchPlaylistPage('token', 'UU_abc123')
    expect(result.videos[1]!.description).toBeNull()
  })

  it('drops deleted or private items, which come back without a videoId', async () => {
    mockFetch(200, {
      items: [
        { contentDetails: { videoId: 'kept' }, snippet: { title: 'Kept' } },
        { contentDetails: {}, snippet: { title: 'Deleted video' } },
        { snippet: { title: 'Private video' } },
      ],
    })

    const result = await fetchPlaylistPage('token', 'UU_abc123')
    expect(result.videos.map((v) => v.youtubeVideoId)).toEqual(['kept'])
  })

  it('defaults a missing title rather than failing the whole page', async () => {
    mockFetch(200, { items: [{ contentDetails: { videoId: 'v' }, snippet: {} }] })
    const result = await fetchPlaylistPage('token', 'UU_abc123')
    expect(result.videos[0]!.title).toBe('Untitled')
  })

  it('requests 50 per page and passes the page token through', async () => {
    const fetchFn = mockFetch(200, { items: [] })
    await fetchPlaylistPage('token', 'UU_abc123', 'PAGE2')

    const url = String(fetchFn.mock.calls[0]![0])
    expect(url).toContain('maxResults=50')
    expect(url).toContain('playlistId=UU_abc123')
    expect(url).toContain('pageToken=PAGE2')
  })

  it('omits the page token on the first request', async () => {
    const fetchFn = mockFetch(200, { items: [] })
    await fetchPlaylistPage('token', 'UU_abc123')
    expect(String(fetchFn.mock.calls[0]![0])).not.toContain('pageToken')
  })

  it('reports no next page when the response omits the token', async () => {
    mockFetch(200, { items: [{ contentDetails: { videoId: 'v' }, snippet: { title: 'T' } }] })
    const result = await fetchPlaylistPage('token', 'UU_abc123')
    expect(result.nextPageToken).toBeNull()
  })

  it('throws on a non-ok response so the import records a failure', async () => {
    mockFetch(500, {})
    await expect(fetchPlaylistPage('token', 'UU_abc123')).rejects.toThrow(/channel history/)
  })
})
