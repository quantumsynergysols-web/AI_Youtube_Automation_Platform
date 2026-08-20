import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api, ApiFailure } from '../lib/api'
import { LoadingState, PageState } from '../components/PageState'
import { nextAction, stateLabel, type ProjectSummary } from './dashboard.logic'
import { DURATION_CHOICES, MAX_DURATION_SEC, createErrorMessage } from './projects.logic'

interface ProjectsResponse {
  projects: ProjectSummary[]
  nextCursor: string | null
}

interface ChannelSummary {
  id: string
  title: string
}

export default function Projects() {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null)
  const [cursor, setCursor] = useState<string | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  const [channels, setChannels] = useState<ChannelSummary[]>([])
  const [topic, setTopic] = useState('')
  const [duration, setDuration] = useState(60)
  const [channelId, setChannelId] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const [deleting, setDeleting] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const response = await api<ProjectsResponse>('/api/projects?limit=20')
      setProjects(response.projects)
      setCursor(response.nextCursor)
      setLoadError(false)
    } catch {
      setLoadError(true)
    }
  }, [])

  useEffect(() => {
    void load()
    // Channels are optional context for the form, so a failure here must not
    // block creating a video — it only means the picker has nothing in it.
    void api<{ channels: ChannelSummary[] }>('/api/channels')
      .then((r) => setChannels(r.channels ?? []))
      .catch(() => setChannels([]))
  }, [load])

  async function loadMore() {
    if (!cursor) return
    setLoadingMore(true)
    try {
      const response = await api<ProjectsResponse>(`/api/projects?limit=20&cursor=${cursor}`)
      setProjects((current) => [...(current ?? []), ...response.projects])
      setCursor(response.nextCursor)
    } catch {
      setActionError('More videos could not be loaded. Check your connection, then try again.')
    } finally {
      setLoadingMore(false)
    }
  }

  async function create(event: FormEvent) {
    event.preventDefault()
    setCreating(true)
    setCreateError(null)
    try {
      const project = await api<{ id: string }>('/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          topic,
          targetDurationSec: duration,
          ...(channelId ? { channelId } : {}),
        }),
      })
      setTopic('')
      setChannelId('')
      await load()
      // Straight to the script screen: an empty project is not a useful place
      // to be left standing.
      window.location.assign(`/projects/${project.id}/script`)
    } catch (error) {
      setCreateError(createErrorMessage(error))
    } finally {
      setCreating(false)
    }
  }

  async function remove(id: string) {
    setDeleting(id)
    setActionError(null)
    try {
      await api(`/api/projects/${id}`, { method: 'DELETE' })
      setProjects((current) => (current ?? []).filter((p) => p.id !== id))
      setConfirmDelete(null)
    } catch (error) {
      setActionError(
        error instanceof ApiFailure && error.status === 400
          ? 'This video is still being worked on and cannot be deleted yet. Wait for it to finish, then try again.'
          : 'The video could not be deleted. Check your connection, then try again.',
      )
    } finally {
      setDeleting(null)
    }
  }

  return (
    <main className="stack page" id="main-content">
      <header className="page-header">
        <div>
          <p className="eyebrow">Videos</p>
          <h1>Every video you have made</h1>
          <p>Each one has to pass the Originality Guard before it can publish.</p>
        </div>
      </header>

      {actionError ? <div className="notice error" role="alert">{actionError}</div> : null}

      <section className="card" aria-labelledby="new-video">
        <div className="section-heading"><h2 id="new-video">Start a new video</h2></div>
        <form className="stack" onSubmit={(e) => void create(e)}>
          <label className="field">
            <span className="field-label">What is it about?</span>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              maxLength={500}
              required
              placeholder="e.g. why your edits take twice as long as they should"
            />
            <span className="muted">
              A specific angle produces a better script than a broad subject. &ldquo;Colour
              grading&rdquo; is a category; &ldquo;why your grades look muddy on phones&rdquo; is a video.
            </span>
          </label>

          <div className="row form-row">
            <label className="field">
              <span className="field-label">Length</span>
              <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
                {DURATION_CHOICES.map((choice) => (
                  <option key={choice} value={choice}>{choice} seconds</option>
                ))}
              </select>
              <span className="muted">Capped at {MAX_DURATION_SEC}s on every plan.</span>
            </label>

            <label className="field">
              <span className="field-label">Channel</span>
              <select value={channelId} onChange={(e) => setChannelId(e.target.value)}>
                <option value="">No channel</option>
                {channels.map((channel) => (
                  <option key={channel.id} value={channel.id}>{channel.title}</option>
                ))}
              </select>
              <span className="muted">
                {channels.length === 0
                  ? 'Connect a channel to check new scripts against what you have already published.'
                  : 'The guard compares this script with that channel’s back catalogue.'}
              </span>
            </label>
          </div>

          {createError ? <div className="notice error" role="alert">{createError}</div> : null}

          <div className="row">
            <button type="submit" disabled={creating || !topic.trim()}>
              {creating ? 'Creating…' : 'Create video'}
            </button>
            {channels.length === 0 ? <Link className="text-link" to="/channels">Connect a channel first</Link> : null}
          </div>
        </form>
      </section>

      <section className="card" aria-labelledby="all-videos">
        <div className="section-heading">
          <h2 id="all-videos">All videos</h2>
          {projects?.length ? <span className="count-badge">{projects.length}</span> : null}
        </div>

        {!projects && !loadError ? <LoadingState label="Loading your videos" /> : null}

        {loadError ? (
          <PageState title="Videos did not load" tone="error" action={<button onClick={() => void load()}>Try again</button>}>
            <p>Your videos could not be loaded. Check that the API is running, then retry.</p>
          </PageState>
        ) : null}

        {projects?.length === 0 ? (
          <PageState title="Nothing here yet">
            <p>Create your first video above. It takes a topic and about a minute.</p>
          </PageState>
        ) : null}

        {projects?.length ? (
          <ul className="project-list">
            {projects.map((project) => {
              const action = nextAction(project)
              return (
                <li key={project.id} className="project-row">
                  <div className="project-main">
                    <Link className="project-topic" to={`/projects/${project.id}/script`}>{project.topic}</Link>
                    <p className="muted">
                      {stateLabel(project.state)} · {project.targetDurationSec}s
                      {project.channel ? ` · ${project.channel.title}` : ' · no channel'}
                      {project.script ? ` · ${project.script.wordCount} words` : ''}
                      {project.originalityCheck ? ` · guard ${project.originalityCheck.verdict.toLowerCase()}` : ''}
                    </p>
                  </div>
                  <div className="row project-actions">
                    <span className={`next-action${action.urgent ? ' urgent' : ''}`}>{action.label}</span>
                    {confirmDelete === project.id ? (
                      <>
                        <button
                          className="danger"
                          onClick={() => void remove(project.id)}
                          disabled={deleting === project.id}
                        >
                          {deleting === project.id ? 'Deleting…' : 'Delete for good'}
                        </button>
                        <button className="secondary" onClick={() => setConfirmDelete(null)}>Keep</button>
                      </>
                    ) : (
                      <button className="secondary" onClick={() => setConfirmDelete(project.id)}>Delete</button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        ) : null}

        {cursor ? (
          <div className="row load-more">
            <button className="secondary" onClick={() => void loadMore()} disabled={loadingMore}>
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          </div>
        ) : null}
      </section>
    </main>
  )
}
