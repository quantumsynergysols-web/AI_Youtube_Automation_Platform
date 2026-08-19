import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { LoadingState, PageState } from '../components/PageState'

interface Job { id: string; stage: string; status: string; attempts: number; result: { echo?: string } | null; error: string | null; enqueuedAt: string }
interface JobsResponse { jobs: Job[]; queue: { pending: number; processing: number; dead: number } }

export default function Dashboard() {
  const { me } = useAuth()
  const [data, setData] = useState<JobsResponse | null>(null)
  const dataRef = useRef<JobsResponse | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const response = await api<JobsResponse>('/api/jobs')
      dataRef.current = response
      setData(response)
      setLoadError(false)
    } catch {
      if (!dataRef.current) setLoadError(true)
    }
  }, [])

  useEffect(() => {
    void load()
    const timer = setInterval(() => void load(), 2000)
    return () => clearInterval(timer)
  }, [load])

  async function runProbe(consume: boolean) {
    setActionError(null)
    setBusy(true)
    try {
      await api(`/api/jobs/dummy${consume ? '?consume=1' : ''}`, { method: 'POST', body: JSON.stringify({ message: 'gate G0 probe', delayMs: 500 }) })
      await load()
    } catch {
      setActionError('The queue probe could not be started. Check that the API and worker are running, then try again.')
    } finally { setBusy(false) }
  }

  const sub = me?.subscription
  return (
    <main className="stack page" id="main-content">
      <header className="page-header"><div><p className="eyebrow">Workspace overview</p><h1>Dashboard</h1><p>Review the work, protect your channel, and decide what gets published.</p></div></header>
      <section className="card">
        <div className="section-heading"><h2>Current usage</h2><span className="status-badge">{sub?.plan ?? 'No plan'}</span></div>
        <p>{sub?.videosUsed ?? 0} videos used this period{sub?.periodEnd ? ` · renews ${new Date(sub.periodEnd).toLocaleDateString()}` : ''}</p>
        {actionError ? <div className="notice error" role="alert">{actionError}</div> : null}
        <div className="row"><button onClick={() => void runProbe(false)} disabled={busy}>{busy ? 'Starting…' : 'Run queue probe'}</button><button className="secondary" onClick={() => void runProbe(true)} disabled={busy}>Run and consume allowance</button></div>
        {data ? <p className="muted">Queue · {data.queue.pending} pending · {data.queue.processing} processing · {data.queue.dead} dead</p> : null}
      </section>
      <section className="card" aria-labelledby="recent-jobs">
        <div className="section-heading"><h2 id="recent-jobs">Recent jobs</h2>{data ? <span className="count-badge">{data.jobs.length}</span> : null}</div>
        {!data && !loadError ? <LoadingState label="Loading recent jobs" /> : null}
        {loadError ? <PageState title="Jobs did not load" tone="error" action={<button onClick={() => void load()}>Try again</button>}><p>Recent activity could not be loaded. Check that the API and Redis are available, then retry.</p></PageState> : null}
        {data?.jobs.length === 0 ? <PageState title="No jobs yet"><p>Your production activity will appear here for review. You stay in control of what moves forward and what gets published.</p></PageState> : null}
        {data?.jobs.length ? <div className="table-scroll"><table><thead><tr><th>Job</th><th>Stage</th><th>Status</th><th>Attempts</th><th>Result</th></tr></thead><tbody>{data.jobs.map((job) => <tr key={job.id}><td><code>{job.id.slice(0, 8)}</code></td><td>{job.stage}</td><td><span className="status-badge">{job.status}</span></td><td>{job.attempts}</td><td className="muted">{job.result?.echo ?? job.error ?? '—'}</td></tr>)}</tbody></table></div> : null}
      </section>
    </main>
  )
}
