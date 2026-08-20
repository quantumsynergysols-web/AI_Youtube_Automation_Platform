import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import { AuthShell } from '../components/AuthShell'
import { Alert } from '../components/Alert'

export default function VerifyEmail() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const [error, setError] = useState<unknown>(null)
  const [ok, setOk] = useState(false)

  useEffect(() => {
    if (!token) return
    api('/api/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) })
      .then(() => setOk(true))
      .catch(setError)
  }, [token])

  return (
    <AuthShell title="Confirm your email">
      {!token && <p className="auth-lede">This link is missing its token. Use the link from your email exactly as sent.</p>}
      <Alert error={error} message={ok ? 'Your email is confirmed. You can sign in now.' : null} />
      {ok && <p className="auth-foot"><Link to="/login">Go to sign in</Link></p>}
    </AuthShell>
  )
}
