import { ApiFailure } from './errors'
export { ApiFailure, type ApiError } from './errors'

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4300'

const ACCESS = 'ytap.access'
const REFRESH = 'ytap.refresh'

export const tokens = {
  get access() { return localStorage.getItem(ACCESS) },
  get refresh() { return localStorage.getItem(REFRESH) },
  set(access: string, refresh: string) {
    localStorage.setItem(ACCESS, access)
    localStorage.setItem(REFRESH, refresh)
  },
  clear() {
    localStorage.removeItem(ACCESS)
    localStorage.removeItem(REFRESH)
  },
}

async function raw<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(tokens.access ? { Authorization: `Bearer ${tokens.access}` } : {}),
      ...init.headers,
    },
  })

  if (res.status === 204) return undefined as T
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new ApiFailure(res.status, body.error ?? { code: 'unknown', message: 'Request failed.' })
  }
  return body as T
}

/** Retries once through the refresh endpoint when the access token has expired. */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  try {
    return await raw<T>(path, init)
  } catch (err) {
    const isExpired = err instanceof ApiFailure && err.status === 401 && tokens.refresh
    if (!isExpired) throw err

    try {
      const refreshed = await raw<{ accessToken: string; refreshToken: string }>('/api/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: tokens.refresh }),
      })
      tokens.set(refreshed.accessToken, refreshed.refreshToken)
    } catch {
      tokens.clear()
      throw err
    }
    return raw<T>(path, init)
  }
}
