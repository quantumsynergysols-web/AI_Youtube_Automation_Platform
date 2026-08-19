import { FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { Field } from '../components/Field'
import { Alert } from '../components/Alert'

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
    <div className="card">
      <h1>Create an account</h1>
      <Alert error={error} message={done} />
      {!done && (
        <form className="stack" onSubmit={submit}>
          <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" required />
          <Field label="Password" type="password" value={password} onChange={setPassword} autoComplete="new-password" required />
          <p className="muted">At least 10 characters.</p>
          <button type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
        </form>
      )}
      <p className="muted">Already registered? <Link to="/login">Sign in</Link>.</p>
    </div>
  )
}
