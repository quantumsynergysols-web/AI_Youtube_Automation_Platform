import { FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { AuthDivider, AuthShell } from '../components/AuthShell'
import { Field } from '../components/Field'
import { Alert } from '../components/Alert'
import { GoogleButton } from '../components/GoogleButton'

export default function Register() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<unknown>(null)
  const [done, setDone] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const res = await api<{ message: string }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      setDone(res.message)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell
      title="Create an account"
      lede="Built for established creators who put channel protection before output volume."
      footer={<>Already registered? <Link to="/login">Sign in</Link>.</>}
    >
      <Alert error={error} message={done} />
      {!done && (
        <>
          <form className="stack" onSubmit={submit}>
            <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" required />
            <Field
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
              hint="At least 10 characters."
              required
            />
            <button type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
          </form>
          <AuthDivider />
          <GoogleButton onError={setError} />
          <p className="field-hint">
            Three videos free, no card. Your channel stays read-only until you choose to publish.
          </p>
        </>
      )}
    </AuthShell>
  )
}
