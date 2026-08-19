import { JobStage, JobStatus } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import { logger } from '../../lib/logger'
import { notFound } from '../../lib/errors'
import { accessTokenFor } from './channels.service'
import { fetchPlaylistPage, fetchUploadsPlaylistId } from './youtube-oauth'

/**
 * Stops a pathological channel from consuming the whole daily quota in one
 * import. 40 pages is 2,000 videos, well past any realistic creator.
 */
const MAX_PAGES = 40

export interface ImportResult {
  imported: number
  updated: number
  pages: number
  truncated: boolean
}

/**
 * FR-2.5 — pulls the channel's back catalogue so FR-9 can compare new scripts
 * against what the creator has already published.
 *
 * Runs in the API process rather than the Python worker: the worker would need
 * the token-encryption key to read credentials, and keeping that key in exactly
 * one runtime is worth more than the tidiness of putting every job on the queue.
 * Paging is cheap — one quota unit per 50 videos — so a typical channel finishes
 * in a few seconds. If that stops being true, the move is an internal
 * token-minting endpoint for the worker, not shipping the key to Python.
 */
export async function importChannelHistory(channelId: string): Promise<ImportResult> {
  const channel = await prisma.channel.findUnique({ where: { id: channelId } })
  if (!channel) throw notFound('No such channel.')

  const job = await prisma.renderJob.create({
    data: {
      stage: JobStage.IMPORT,
      status: JobStatus.RUNNING,
      userId: channel.userId,
      payload: { channelId },
      startedAt: new Date(),
    },
  })

  let imported = 0
  let updated = 0
  let pages = 0
  let truncated = false

  try {
    const accessToken = await accessTokenFor(channelId)
    const playlistId = await fetchUploadsPlaylistId(accessToken)

    let pageToken: string | null = null
    do {
      const page = await fetchPlaylistPage(accessToken, playlistId, pageToken)
      pages += 1

      for (const video of page.videos) {
        // Upsert, so a re-import refreshes titles instead of failing on the
        // unique constraint or duplicating the catalogue.
        const before = await prisma.channelVideo.findUnique({
          where: {
            channelId_youtubeVideoId: { channelId, youtubeVideoId: video.youtubeVideoId },
          },
          select: { id: true },
        })

        await prisma.channelVideo.upsert({
          where: {
            channelId_youtubeVideoId: { channelId, youtubeVideoId: video.youtubeVideoId },
          },
          create: { channelId, ...video },
          update: { title: video.title, description: video.description },
        })

        if (before) updated += 1
        else imported += 1
      }

      pageToken = page.nextPageToken
      if (pages >= MAX_PAGES && pageToken) {
        truncated = true
        logger.warn({ channelId, pages }, 'history import hit the page cap')
        break
      }
    } while (pageToken)

    await prisma.$transaction([
      prisma.channel.update({ where: { id: channelId }, data: { baselineAt: new Date() } }),
      prisma.renderJob.update({
        where: { id: job.id },
        data: {
          status: JobStatus.SUCCEEDED,
          finishedAt: new Date(),
          result: { imported, updated, pages, truncated },
        },
      }),
    ])

    logger.info({ channelId, imported, updated, pages }, 'channel history imported')
    return { imported, updated, pages, truncated }
  } catch (err) {
    await prisma.renderJob.update({
      where: { id: job.id },
      data: {
        status: JobStatus.FAILED,
        finishedAt: new Date(),
        error: err instanceof Error ? err.message.slice(0, 2000) : 'unknown error',
      },
    })
    throw err
  }
}

/**
 * Kicks the import off without making the caller wait. Connect should return as
 * soon as the channel exists; the catalogue arriving a few seconds later is fine,
 * and a failure here must not fail the connection itself.
 */
export function importChannelHistoryInBackground(channelId: string): void {
  setImmediate(() => {
    importChannelHistory(channelId).catch((err) => {
      logger.warn({ err, channelId }, 'background history import failed')
    })
  })
}

export async function listChannelVideos(channelId: string, take = 50) {
  return prisma.channelVideo.findMany({
    where: { channelId },
    orderBy: { publishedAt: 'desc' },
    take: Math.min(take, 200),
    select: {
      id: true,
      youtubeVideoId: true,
      title: true,
      publishedAt: true,
      importedAt: true,
    },
  })
}
