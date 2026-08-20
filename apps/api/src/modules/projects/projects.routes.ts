import { Router } from 'express'
import { z } from 'zod'
import { ProjectState } from '@prisma/client'
import { asyncRoute } from '../../middleware/error'
import { requireAuth } from '../../middleware/auth'
import {
  createProject,
  deleteProject,
  getProject,
  listProjects,
  updateProject,
} from './projects.service'

const router = Router()

const createBody = z.object({
  topic: z.string().min(1).max(500),
  targetDurationSec: z.number().int().min(1).max(3600).optional(),
  language: z.string().min(2).max(10).optional(),
  style: z.string().max(500).nullish(),
  channelId: z.string().uuid().nullish(),
})

// Duration bounds are checked against the caller's plan in the service rather
// than here, because the real limit depends on who is asking.
const updateBody = z
  .object({
    topic: z.string().min(1).max(500).optional(),
    targetDurationSec: z.number().int().min(1).max(3600).optional(),
    language: z.string().min(2).max(10).optional(),
    style: z.string().max(500).nullish(),
    channelId: z.string().uuid().nullish(),
  })
  .refine((b) => Object.keys(b).length > 0, { message: 'Provide at least one field to update.' })

const listQuery = z.object({
  state: z.nativeEnum(ProjectState).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().uuid().optional(),
})

router.post(
  '/',
  requireAuth,
  asyncRoute(async (req, res) => {
    const project = await createProject(req.user!.sub, createBody.parse(req.body ?? {}))
    res.status(201).json(project)
  }),
)

router.get(
  '/',
  requireAuth,
  asyncRoute(async (req, res) => {
    res.json(await listProjects(req.user!.sub, listQuery.parse(req.query)))
  }),
)

router.get(
  '/:id',
  requireAuth,
  asyncRoute(async (req, res) => {
    res.json(await getProject(req.user!.sub, req.params.id!))
  }),
)

router.patch(
  '/:id',
  requireAuth,
  asyncRoute(async (req, res) => {
    res.json(await updateProject(req.user!.sub, req.params.id!, updateBody.parse(req.body ?? {})))
  }),
)

router.delete(
  '/:id',
  requireAuth,
  asyncRoute(async (req, res) => {
    await deleteProject(req.user!.sub, req.params.id!)
    res.status(204).end()
  }),
)

export default router
