import { FormEvent, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import { AuthShell } from '../components/AuthShell'
import { Field } from '../components/Field'
import { Alert } from '../components/Alert'

export default function ResetPassword() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<unknown>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      const res = await api<{ message: string }>('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      })
      setMessage(res.message)
    } catch (err) {
      setError(err)
    }
  }

  return (
    <AuthShell title="Choose a new password">
      <Alert error={error} message={message} />
      {!message && (
        <form className="stack" onSubmit={submit}>
          <Field
            label="New password"
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            hint="At least 10 characters."
            required
          />
          <button type="submit">Update password</button>
        </form>
      )}
      {message && <p className="auth-foot"><Link to="/login">Go to sign in</Link></p>}
    </AuthShell>
  )
}
