import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, tokens } from './api'

export interface Me {
  id: string
  email: string
  status: string
  isAdmin: boolean
  subscription: {
    plan: string
    status: string
    videosUsed: number
    periodEnd: string
    cancelAtPeriodEnd: boolean
  } | null
}

interface AuthValue {
  me: Me | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  reload: () => Promise<void>
}

const Ctx = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!tokens.access) {
      setMe(null)
      setLoading(false)
      return
    }
    try {
      setMe(await api<Me>('/api/auth/me'))
    } catch {
      setMe(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void reload() }, [reload])

  const signIn = useCallback(async (email: string, password: string) => {
    const res = await api<{ accessToken: string; refreshToken: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    tokens.set(res.accessToken, res.refreshToken)
    await reload()
  }, [reload])

  const signOut = useCallback(async () => {
    const refresh = tokens.refresh
    if (refresh) {
      await api('/api/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken: refresh }) })
        .catch(() => undefined)
    }
    tokens.clear()
    setMe(null)
  }, [])

  return <Ctx.Provider value={{ me, loading, signIn, signOut, reload }}>{children}</Ctx.Provider>
}

export function useAuth(): AuthValue {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
