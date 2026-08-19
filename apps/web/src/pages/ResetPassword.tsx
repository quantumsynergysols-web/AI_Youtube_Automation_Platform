import { FormEvent, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
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
    <div className="card">
      <h1>Choose a new password</h1>
      <Alert error={error} message={message} />
      {!message && (
        <form className="stack" onSubmit={submit}>
          <Field label="New password" type="password" value={password} onChange={setPassword} autoComplete="new-password" required />
          <button type="submit">Update password</button>
        </form>
      )}
      {message && <p><Link to="/login">Go to sign in</Link></p>}
    </div>
  )
}
