import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app'

const app = createApp()

describe('service surface', () => {
  it('reports liveness without touching a datastore', async () => {
    const res = await request(app).get('/health/live')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok' })
  })

  it('serves the plan catalogue unauthenticated', async () => {
    const res = await request(app).get('/api/billing/plans')
    expect(res.status).toBe(200)
    expect(res.body.plans).toHaveLength(5)
  })

  it('rejects an unauthenticated call to a protected route', async () => {
    const res = await request(app).get('/api/billing/allowance')
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('unauthorized')
  })

  it('rejects a malformed bearer token', async () => {
    const res = await request(app)
      .get('/api/billing/allowance')
      .set('Authorization', 'Bearer not-a-real-jwt')
    expect(res.status).toBe(401)
  })

  it('returns a structured 404 for unknown routes', async () => {
    const res = await request(app).get('/api/nope')
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('not_found')
  })

  it('reports validation errors field by field', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'not-an-email', password: 'short' })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('validation_failed')
    const fields = res.body.error.details.map((d: { field: string }) => d.field)
    expect(fields).toContain('email')
    expect(fields).toContain('password')
  })

  it('refuses a stripe webhook that carries no signature', async () => {
    const res = await request(app)
      .post('/api/billing/webhook')
      .set('Content-Type', 'application/json')
      .send({ id: 'evt_test', type: 'checkout.session.completed' })
    expect(res.status).toBe(400)
  })
})
