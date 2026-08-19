import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'
import { actionErrorMessage } from '../lib/errors'
import { LoadingState, PageState } from '../components/PageState'

interface PlanDef { id: string; name: string; priceUsd: number; videosPerMonth: number; channels: number }
interface Allowance { plan: string; status: string; videosIncluded: number; videosUsed: number; videosRemaining: number; overagePerVideoUsd: number; periodEnd: string }
interface BillingData { plans: PlanDef[]; allowance: Allowance }
const PKR_PER_USD = 278.05

export default function Billing() {
  const [data, setData] = useState<BillingData | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoadError(false)
    try {
      const [plans, allowance] = await Promise.all([api<{ plans: PlanDef[] }>('/api/billing/plans'), api<Allowance>('/api/billing/allowance')])
      setData({ plans: plans.plans, allowance })
    } catch { setLoadError(true) }
  }, [])
  useEffect(() => { void load() }, [load])

  async function subscribe(planId: string) {
    setActionError(null); setBusy(planId)
    try {
      const response = await api<{ url: string }>('/api/billing/checkout', { method: 'POST', body: JSON.stringify({ plan: planId.toUpperCase() }) })
      window.location.assign(response.url)
    } catch (error) {
      setActionError(actionErrorMessage(error, 'Checkout could not be opened.', 'Confirm billing is configured, then try again.'))
      setBusy(null)
    }
  }
  async function openPortal() {
    setActionError(null); setBusy('portal')
    try {
      const response = await api<{ url: string }>('/api/billing/portal', { method: 'POST' })
      window.location.assign(response.url)
    } catch (error) {
      setActionError(actionErrorMessage(error, 'The billing portal could not be opened.', 'Subscribe to a paid plan first or try again shortly.'))
      setBusy(null)
    }
  }

  const allowance = data?.allowance
  return (
    <main className="stack page" id="main-content">
      <header className="page-header"><div><p className="eyebrow">Plan and allowance</p><h1>Billing</h1><p>Compare plans, track this month’s usage, and manage payment details.</p></div></header>
      {actionError ? <div className="notice error" role="alert">{actionError}</div> : null}
      {!data && !loadError ? <section className="card"><LoadingState label="Loading billing details" /></section> : null}
      {loadError ? <section className="card"><PageState title="Billing did not load" tone="error" action={<button onClick={() => void load()}>Try again</button>}><p>Plan and allowance details could not be loaded. Check your connection and retry.</p></PageState></section> : null}
      {data ? <>
        <section className="card usage-card">
          <div className="section-heading"><div><h2>This period</h2><p className="muted">Renews {new Date(allowance!.periodEnd).toLocaleDateString()}</p></div><span className="status-badge">{allowance!.plan}</span></div>
          <div className="usage-number"><strong>{allowance!.videosRemaining}</strong><span>videos remaining</span></div>
          <div className="progress-track" aria-label={`${allowance!.videosUsed} of ${allowance!.videosIncluded} videos used`}><span style={{ width: `${Math.min(100, allowance!.videosIncluded ? (allowance!.videosUsed / allowance!.videosIncluded) * 100 : 0)}%` }} /></div>
          <p className="muted">{allowance!.videosUsed} of {allowance!.videosIncluded} videos used</p>
          <div><button className="secondary" onClick={() => void openPortal()} disabled={busy === 'portal'}>{busy === 'portal' ? 'Opening…' : 'Manage billing'}</button></div>
        </section>
        <section className="card">
          <div className="section-heading"><div><h2>Plans</h2><p className="muted">Choose the channel and video capacity that fits your workflow.</p></div></div>
          {data.plans.length === 0 ? <PageState title="No plans available"><p>Plans have not been configured for this deployment. Ask the deployment administrator to add the plan catalogue.</p></PageState> : <div className="table-scroll"><table><thead><tr><th>Plan</th><th>Monthly</th><th>Videos</th><th>Channels</th><th><span className="sr-only">Action</span></th></tr></thead><tbody>{data.plans.map((plan) => <tr key={plan.id}><td><strong>{plan.name}</strong></td><td>${plan.priceUsd}<span className="muted"> · PKR {Math.round(plan.priceUsd * PKR_PER_USD).toLocaleString()}</span></td><td>{plan.videosPerMonth}</td><td>{plan.channels}</td><td>{plan.priceUsd > 0 ? <button onClick={() => void subscribe(plan.id)} disabled={busy === plan.id}>{busy === plan.id ? 'Opening…' : 'Choose plan'}</button> : <span className="muted">Included</span>}</td></tr>)}</tbody></table></div>}
        </section>
      </> : null}
    </main>
  )
}
