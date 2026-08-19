import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { Alert } from '../components/Alert'

interface PlanDef {
  id: string
  name: string
  priceUsd: number
  videosPerMonth: number
  channels: number
}

interface Allowance {
  plan: string
  status: string
  videosIncluded: number
  videosUsed: number
  videosRemaining: number
  overagePerVideoUsd: number
  periodEnd: string
}

const PKR_PER_USD = 278.05

export default function Billing() {
  const [plans, setPlans] = useState<PlanDef[]>([])
  const [allowance, setAllowance] = useState<Allowance | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    api<{ plans: PlanDef[] }>('/api/billing/plans').then((r) => setPlans(r.plans)).catch(setError)
    api<Allowance>('/api/billing/allowance').then(setAllowance).catch(setError)
  }, [])

  async function subscribe(planId: string) {
    setError(null)
    setBusy(planId)
    try {
      const res = await api<{ url: string }>('/api/billing/checkout', {
        method: 'POST',
        body: JSON.stringify({ plan: planId.toUpperCase() }),
      })
      window.location.href = res.url
    } catch (err) {
      setError(err)
      setBusy(null)
    }
  }

  async function openPortal() {
    setError(null)
    try {
      const res = await api<{ url: string }>('/api/billing/portal', { method: 'POST' })
      window.location.href = res.url
    } catch (err) {
      setError(err)
    }
  }

  return (
    <div className="stack">
      <div className="card">
        <h1>Billing</h1>
        <Alert error={error} />
        {allowance && (
          <p>
            <strong>{allowance.plan}</strong> · {allowance.videosUsed} of {allowance.videosIncluded} videos
            used · {allowance.videosRemaining} remaining · renews{' '}
            {new Date(allowance.periodEnd).toLocaleDateString()}
          </p>
        )}
        <div className="row">
          <button className="secondary" onClick={() => void openPortal()}>Manage billing</button>
        </div>
      </div>

      <div className="card">
        <h2>Plans</h2>
        <table>
          <thead>
            <tr><th>Plan</th><th>Monthly</th><th>Videos</th><th>Channels</th><th /></tr>
          </thead>
          <tbody>
            {plans.map((p) => (
              <tr key={p.id}>
                <td><strong>{p.name}</strong></td>
                <td>
                  ${p.priceUsd}
                  <span className="muted"> (PKR {Math.round(p.priceUsd * PKR_PER_USD).toLocaleString()})</span>
                </td>
                <td>{p.videosPerMonth}</td>
                <td>{p.channels}</td>
                <td>
                  {p.priceUsd > 0 && (
                    <button onClick={() => void subscribe(p.id)} disabled={busy === p.id}>
                      {busy === p.id ? 'Opening…' : 'Choose'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
