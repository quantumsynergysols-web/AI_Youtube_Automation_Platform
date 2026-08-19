import { FormEvent, useState } from 'react'
import { api } from '../lib/api'
import { Field } from '../components/Field'
import { Alert } from '../components/Alert'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<unknown>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      const res = await api<{ message: string }>('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      })
      setMessage(res.message)
    } catch (err) {
      setError(err)
    }
  }

  return (
    <div className="card">
      <h1>Reset your password</h1>
      <Alert error={error} message={message} />
      {!message && (
        <form className="stack" onSubmit={submit}>
          <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" required />
          <button type="submit">Send reset link</button>
        </form>
      )}
    </div>
  )
}
