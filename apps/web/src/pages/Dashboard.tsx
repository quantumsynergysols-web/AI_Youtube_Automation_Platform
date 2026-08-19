import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { Alert } from '../components/Alert'

interface Job {
  id: string
  stage: string
  status: string
  attempts: number
  result: { echo?: string } | null
  error: string | null
  enqueuedAt: string
}

interface JobsResponse {
  jobs: Job[]
  queue: { pending: number; processing: number; dead: number }
}

export default function Dashboard() {
  const { me } = useAuth()
  const [data, setData] = useState<JobsResponse | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      setData(await api<JobsResponse>('/api/jobs'))
    } catch (err) {
      setError(err)
    }
  }, [])

  useEffect(() => {
    void load()
    // Phase 0 polls. WebSocket push is an open question in the SRS.
    const t = setInterval(() => void load(), 2000)
    return () => clearInterval(t)
  }, [load])

  async function runProbe(consume: boolean) {
    setError(null)
    setBusy(true)
    try {
      await api(`/api/jobs/dummy${consume ? '?consume=1' : ''}`, {
        method: 'POST',
        body: JSON.stringify({ message: 'gate G0 probe', delayMs: 500 }),
      })
      await load()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  const sub = me?.subscription

  return (
    <div className="stack">
      <div className="card">
        <h1>Dashboard</h1>
        <p>
          Plan <strong>{sub?.plan ?? 'unknown'}</strong> · {sub?.videosUsed ?? 0} videos used this period
          {sub?.periodEnd ? ` · renews ${new Date(sub.periodEnd).toLocaleDateString()}` : ''}
        </p>
        <Alert error={error} />
        <div className="row">
          <button onClick={() => void runProbe(false)} disabled={busy}>Run queue probe</button>
          <button className="secondary" onClick={() => void runProbe(true)} disabled={busy}>
            Run probe and consume allowance
          </button>
        </div>
        {data && (
          <p className="muted">
            Queue — pending {data.queue.pending}, processing {data.queue.processing}, dead {data.queue.dead}
          </p>
        )}
      </div>

      <div className="card">
        <h2>Recent jobs</h2>
        {!data?.jobs.length && <p className="muted">No jobs yet. Run the probe above.</p>}
        {!!data?.jobs.length && (
          <table>
            <thead>
              <tr><th>Job</th><th>Stage</th><th>Status</th><th>Attempts</th><th>Result</th></tr>
            </thead>
            <tbody>
              {data.jobs.map((j) => (
                <tr key={j.id}>
                  <td><code>{j.id.slice(0, 8)}</code></td>
                  <td>{j.stage}</td>
                  <td>{j.status}</td>
                  <td>{j.attempts}</td>
                  <td className="muted">{j.result?.echo ?? j.error ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
