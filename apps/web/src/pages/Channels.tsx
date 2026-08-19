import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { LoadingState, PageState } from '../components/PageState'
import { callbackNotice, channelLoadError, connectError, formatChannelCount, type ChannelNotice } from './channels.logic'

interface Channel {
  id: string
  youtubeChannelId: string
  title: string
  thumbnailUrl: string | null
  subscriberCount: number | null
  videoCount: number | null
  connectedAt: string
  baselineAt: string | null
}

export default function Channels() {
  const location = useLocation()
  const navigate = useNavigate()
  const [channels, setChannels] = useState<Channel[] | null>(null)
  const [loadError, setLoadError] = useState<unknown>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<ChannelNotice | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState<Channel | null>(null)
  const [disconnectBusy, setDisconnectBusy] = useState(false)

  const load = useCallback(async () => {
    setLoadError(null)
    try {
      const response = await api<{ channels: Channel[] }>('/api/channels')
      setChannels(response.channels)
    } catch (error) {
      setLoadError(error)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    const result = callbackNotice(location.search)
    if (!result) return
    setNotice(result)
    navigate(location.pathname, { replace: true })
  }, [location.pathname, location.search, navigate])

  async function connect() {
    setConnecting(true)
    setActionError(null)
    try {
      const response = await api<{ url: string }>('/api/channels/connect', { method: 'POST' })
      window.location.assign(response.url)
    } catch (error) {
      setActionError(connectError(error))
      setConnecting(false)
    }
  }

  async function confirmDisconnect() {
    if (!disconnecting) return
    setDisconnectBusy(true)
    setActionError(null)
    try {
      await api(`/api/channels/${disconnecting.id}`, { method: 'DELETE' })
      const title = disconnecting.title
      setDisconnecting(null)
      setNotice({ tone: 'info', message: `${title} was disconnected. Scheduled uploads to this channel have stopped.` })
      await load()
    } catch {
      setActionError(`Could not disconnect ${disconnecting.title}. Try again; the channel remains connected.`)
      setDisconnecting(null)
    } finally {
      setDisconnectBusy(false)
    }
  }

  return (
    <main className="stack page" id="main-content">
      <header className="page-header">
        <div>
          <p className="eyebrow">Publishing access</p>
          <h1>YouTube channels</h1>
          <p>Connect the channels you want ViralPilot to protect, measure, and publish to with your approval.</p>
        </div>
        {channels?.length ? <button onClick={() => void connect()} disabled={connecting}>{connecting ? 'Opening Google…' : 'Connect channel'}</button> : null}
      </header>

      {notice ? <div className={`notice ${notice.tone}`} role="status"><span>{notice.message}</span><button className="icon-button" aria-label="Dismiss message" onClick={() => setNotice(null)}>×</button></div> : null}
      {actionError ? (
        <div className="notice error" role="alert">
          <span>{actionError}</span>
          {actionError.includes('Billing') ? <Link to="/billing">View billing</Link> : null}
        </div>
      ) : null}

      <section className="card" aria-labelledby="connected-heading">
        <div className="section-heading">
          <div><h2 id="connected-heading">Connected channels</h2><p className="muted">Access stays active until you disconnect it.</p></div>
          {channels ? <span className="count-badge">{channels.length}</span> : null}
        </div>

        {channels === null && !loadError ? <LoadingState label="Loading connected channels" /> : null}
        {loadError ? (
          <PageState title="Channels did not load" tone="error" action={<button onClick={() => void load()}>Try again</button>}>
            <p>{channelLoadError(loadError)}</p>
          </PageState>
        ) : null}
        {channels?.length === 0 ? (
          <PageState title="Connect your first channel" action={<button onClick={() => void connect()} disabled={connecting}>{connecting ? 'Opening Google…' : 'Continue with Google'}</button>}>
            <p>Connect a YouTube channel so ViralPilot can protect its originality, learn from its performance, and publish only the work you approve.</p>
            <ul className="permission-list">
              <li>View your channel and video history</li>
              <li>Read YouTube Analytics for performance feedback</li>
              <li>Upload videos you approve</li>
            </ul>
            <p className="muted">These permissions let ViralPilot compare new work with your catalogue, measure results, and upload after your approval. Google shows every permission before access is granted, and you can revoke it at any time.</p>
          </PageState>
        ) : null}
        {channels?.length ? (
          <div className="channel-grid">
            {channels.map((channel) => (
              <article className="channel-card" key={channel.id}>
                <div className="channel-identity">
                  {channel.thumbnailUrl ? <img src={channel.thumbnailUrl} alt="" className="channel-avatar" /> : <div className="channel-avatar placeholder" aria-hidden="true">{channel.title.charAt(0).toUpperCase()}</div>}
                  <div><h3>{channel.title}</h3><p className="muted">Connected {new Date(channel.connectedAt).toLocaleDateString()}</p></div>
                </div>
                <dl className="channel-stats">
                  <div><dt>Subscribers</dt><dd>{formatChannelCount(channel.subscriberCount)}</dd></div>
                  <div><dt>Videos</dt><dd>{formatChannelCount(channel.videoCount)}</dd></div>
                </dl>
                <button className="danger-ghost" onClick={() => setDisconnecting(channel)}>Disconnect</button>
              </article>
            ))}
          </div>
        ) : null}
      </section>

      {disconnecting ? (
        <DisconnectDialog channel={disconnecting} busy={disconnectBusy} onCancel={() => setDisconnecting(null)} onConfirm={() => void confirmDisconnect()} />
      ) : null}
    </main>
  )
}

function DisconnectDialog({ channel, busy, onCancel, onConfirm }: { channel: Channel; busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    cancelRef.current?.focus()
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busy) onCancel() }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [busy, onCancel])

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onCancel() }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="disconnect-title" aria-describedby="disconnect-description">
        <p className="eyebrow">Disconnect channel</p>
        <h2 id="disconnect-title">Disconnect {channel.title}?</h2>
        <p id="disconnect-description">This revokes this app’s access at Google. Scheduled uploads for {channel.title} will stop until the channel is connected again.</p>
        <div className="row modal-actions">
          <button ref={cancelRef} className="secondary" onClick={onCancel} disabled={busy}>Keep connected</button>
          <button className="danger" onClick={onConfirm} disabled={busy}>{busy ? 'Disconnecting…' : 'Disconnect channel'}</button>
        </div>
      </div>
    </div>
  )
}
