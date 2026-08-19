import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../lib/auth'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
const SCRIPT_SRC = 'https://accounts.google.com/gsi/client'

interface GoogleCredentialResponse {
  credential?: string
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string
            callback: (res: GoogleCredentialResponse) => void
          }) => void
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void
        }
      }
    }
  }
}

function loadScript(): Promise<void> {
  if (document.querySelector(`script[src="${SCRIPT_SRC}"]`)) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const el = document.createElement('script')
    el.src = SCRIPT_SRC
    el.async = true
    el.defer = true
    el.onload = () => resolve()
    el.onerror = () => reject(new Error('Google sign-in could not be loaded.'))
    document.head.appendChild(el)
  })
}

/**
 * Renders Google's own button. It is absent rather than broken when
 * VITE_GOOGLE_CLIENT_ID is unset, so a deployment without Google configured
 * shows email sign-in only instead of a control that fails when clicked.
 */
export function GoogleButton({ onError }: { onError: (err: unknown) => void }) {
  const { signInWithGoogle } = useAuth()
  const host = useRef<HTMLDivElement>(null)
  const [unavailable, setUnavailable] = useState(false)

  useEffect(() => {
    if (!CLIENT_ID) return
    let cancelled = false

    loadScript()
      .then(() => {
        if (cancelled || !host.current || !window.google) return
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: (res) => {
            if (!res.credential) {
              onError(new Error('Google did not return a credential. Try again.'))
              return
            }
            signInWithGoogle(res.credential).catch(onError)
          },
        })
        window.google.accounts.id.renderButton(host.current, {
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          width: 320,
        })
      })
      .catch(() => !cancelled && setUnavailable(true))

    return () => {
      cancelled = true
    }
  }, [onError, signInWithGoogle])

  if (!CLIENT_ID) return null
  if (unavailable) {
    return <p className="muted">Google sign-in is unavailable right now. Use your email and password.</p>
  }

  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="row" style={{ gap: 10 }}>
        <span style={{ flex: 1, height: 1, background: 'var(--rule)' }} />
        <span className="muted" style={{ fontSize: 13 }}>or</span>
        <span style={{ flex: 1, height: 1, background: 'var(--rule)' }} />
      </div>
      <div ref={host} />
    </div>
  )
}
