import { FormEvent, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { AuthDivider, AuthShell } from '../components/AuthShell'
import { Field } from '../components/Field'
import { Alert } from '../components/Alert'
import { GoogleButton } from '../components/GoogleButton'

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
    <AuthShell
      title="Sign in"
      lede="Stay in control of every video while ViralPilot handles the production workflow."
      footer={<>No account yet? <Link to="/register">Create one</Link>.</>}
    >
      <Alert error={error} />
      <form className="stack" onSubmit={submit}>
        <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" required />
        <Field label="Password" type="password" value={password} onChange={setPassword} autoComplete="current-password" required />
        <button type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <p className="auth-foot"><Link to="/forgot-password">Forgot your password?</Link></p>
      <AuthDivider />
      <GoogleButton onError={setError} />
    </AuthShell>
  )
}
