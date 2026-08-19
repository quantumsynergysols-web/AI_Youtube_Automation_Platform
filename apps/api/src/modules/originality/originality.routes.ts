import { Router } from 'express'
import { prisma } from '../../lib/prisma'
import { notFound } from '../../lib/errors'
import { asyncRoute } from '../../middleware/error'
import { requireAuth } from '../../middleware/auth'
import { getOriginalityCheck, runOriginalityCheck } from './originality.service'

const router = Router()

/**
 * Never trust a project id from the URL. Reports "no such project" for someone
 * else's id rather than 403, so the endpoint does not confirm it exists.
 */
async function assertOwnsProject(userId: string, projectId: string): Promise<void> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { userId: true },
  })
  if (!project || project.userId !== userId) throw notFound('No such project.')
}

/** FR-9.1 — run the guard. Re-runnable: fix what was flagged, then ask again. */
router.post(
  '/:id/originality-check',
  requireAuth,
  asyncRoute(async (req, res) => {
    await assertOwnsProject(req.user!.sub, req.params.id!)
    res.json(await runOriginalityCheck(req.params.id!))
  }),
)

router.get(
  '/:id/originality-check',
  requireAuth,
  asyncRoute(async (req, res) => {
    await assertOwnsProject(req.user!.sub, req.params.id!)
    const check = await getOriginalityCheck(req.params.id!)
    if (!check) {
      // Not an error: the creator has simply not run it yet, and the UI needs to
      // tell them that rather than render a failure.
      res.json({ checked: false })
      return
    }
    res.json({ checked: true, ...check })
  }),
)

export default router
