import { Router } from 'express'
import { z } from 'zod'
import { asyncRoute } from '../../middleware/error'
import { requireAuth } from '../../middleware/auth'
import { authLimiter } from '../../middleware/rateLimit'
import { badRequest } from '../../lib/errors'
import * as service from './auth.service'

const router = Router()

const passwordRule = z
  .string()
  .min(10, 'Use at least 10 characters.')
  .max(200, 'That password is too long.')

const registerBody = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: passwordRule,
  locale: z.string().max(10).optional(),
})

const loginBody = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
})

const tokenBody = z.object({ token: z.string().min(1) })
const refreshBody = z.object({ refreshToken: z.string().min(1) })

router.post(
  '/register',
  authLimiter,
  asyncRoute(async (req, res) => {
    const body = registerBody.parse(req.body)
    const user = await service.register(body.email, body.password, body.locale)
    res.status(201).json({ user, message: 'Check your inbox to confirm your email address.' })
  }),
)

router.post(
  '/verify-email',
  authLimiter,
  asyncRoute(async (req, res) => {
    const body = tokenBody.parse(req.body)
    res.json(await service.verifyEmail(body.token))
  }),
)

router.post(
  '/login',
  authLimiter,
  asyncRoute(async (req, res) => {
    const body = loginBody.parse(req.body)
    const result = await service.login(body.email, body.password, req.headers['user-agent'])
    res.json(result)
  }),
)

router.post(
  '/google',
  authLimiter,
  asyncRoute(async (req, res) => {
    const body = z
      .object({ idToken: z.string().min(1, 'Missing Google credential.') })
      .parse(req.body)
    const result = await service.signInWithGoogle(body.idToken, req.headers['user-agent'])
    res.json(result)
  }),
)

router.post(
  '/refresh',
  asyncRoute(async (req, res) => {
    const body = refreshBody.parse(req.body)
    res.json(await service.refresh(body.refreshToken, req.headers['user-agent']))
  }),
)

router.post(
  '/logout',
  asyncRoute(async (req, res) => {
    const body = refreshBody.parse(req.body)
    await service.logout(body.refreshToken)
    res.status(204).end()
  }),
)

router.post(
  '/forgot-password',
  authLimiter,
  asyncRoute(async (req, res) => {
    const body = z.object({ email: z.string().email() }).parse(req.body)
    await service.requestPasswordReset(body.email)
    // Same response whether or not the address exists.
    res.json({ message: 'If that address has an account, a reset link is on its way.' })
  }),
)

router.post(
  '/reset-password',
  authLimiter,
  asyncRoute(async (req, res) => {
    const body = z.object({ token: z.string().min(1), password: passwordRule }).parse(req.body)
    await service.resetPassword(body.token, body.password)
    res.json({ message: 'Password updated. Sign in with your new password.' })
  }),
)

router.get(
  '/me',
  requireAuth,
  asyncRoute(async (req, res) => {
    if (!req.user) throw badRequest('Missing session.')
    res.json(await service.currentUser(req.user.sub))
  }),
)

router.delete(
  '/me',
  requireAuth,
  asyncRoute(async (req, res) => {
    if (!req.user) throw badRequest('Missing session.')
    await service.deleteAccount(req.user.sub)
    res.status(204).end()
  }),
)

export default router
