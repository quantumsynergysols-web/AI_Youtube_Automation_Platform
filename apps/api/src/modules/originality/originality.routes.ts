import { Router } from 'express'
import { assertOwnsProject } from '../../lib/ownership'
import { asyncRoute } from '../../middleware/error'
import { requireAuth } from '../../middleware/auth'
import { getOriginalityCheck, runOriginalityCheck } from './originality.service'

const router = Router()

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
