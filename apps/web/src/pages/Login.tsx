import { FormEvent, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { Field } from '../components/Field'
import { Alert } from '../components/Alert'

export default function Login() {
  const { me, signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)

  if (me) return <Navigate to="/" replace />

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await signIn(email, password)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <h1>Sign in</h1>
      <Alert error={error} />
      <form className="stack" onSubmit={submit}>
        <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" required />
        <Field label="Password" type="password" value={password} onChange={setPassword} autoComplete="current-password" required />
        <div className="row">
          <button type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          <Link to="/forgot-password" className="muted">Forgot password?</Link>
        </div>
      </form>
      <p className="muted">No account yet? <Link to="/register">Create one</Link>.</p>
    </div>
  )
}
