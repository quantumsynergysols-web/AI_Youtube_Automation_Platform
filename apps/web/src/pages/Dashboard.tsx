import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { LoadingState, PageState } from '../components/PageState'
import { nextAction, stateLabel, type ProjectSummary } from './dashboard.logic'

/**
 * The signed-in workspace view.
 *
 * Replaces the Phase 0 queue probe, which was developer scaffolding: it showed
 * job rows and a dummy-enqueue button, neither of which tells a creator what
 * needs their attention. This answers one question instead — what is waiting on
 * me — because the guard blocks on human input, so a stalled project is almost
 * always stalled on the person rather than on the machine.
 */

interface ProjectsResponse {
  projects: ProjectSummary[]
  nextCursor: string | null
}

export default function Dashboard() {
  const { me } = useAuth()
  const [data, setData] = useState<ProjectsResponse | null>(null)
  const [loadError, setLoadError] = useState(false)

  const load = useCallback(async () => {
    try {
      setData(await api<ProjectsResponse>('/api/projects?limit=8'))
      setLoadError(false)
    } catch {
      setLoadError(true)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const sub = me?.subscription
  const projects = data?.projects ?? []
  const waiting = projects.filter((p) => nextAction(p).urgent)

  return (
    <main className="stack page" id="main-content">
      <header className="page-header">
        <div>
          <p className="eyebrow">Workspace</p>
          <h1>Your videos</h1>
          <p>Review the work, protect the channel, and decide what gets published.</p>
        </div>
        <Link className="button-link" to="/projects">New video</Link>
      </header>

      <section className="card">
        <div className="section-heading">
          <h2>This period</h2>
          <span className="status-badge">{sub?.plan ?? 'No plan'}</span>
        </div>
        <p>
          {sub?.videosUsed ?? 0} videos used
          {sub?.periodEnd ? ` · renews ${new Date(sub.periodEnd).toLocaleDateString()}` : ''}
        </p>
        {waiting.length > 0 ? (
          <p className="notice warn" role="status">
            {waiting.length === 1
              ? '1 video is waiting on you before it can publish.'
              : `${waiting.length} videos are waiting on you before they can publish.`}
          </p>
        ) : null}
      </section>

      <section className="card" aria-labelledby="recent-projects">
        <div className="section-heading">
          <h2 id="recent-projects">Recent videos</h2>
          {projects.length ? <Link className="text-link" to="/projects">See all</Link> : null}
        </div>

        {!data && !loadError ? <LoadingState label="Loading your videos" /> : null}

        {loadError ? (
          <PageState title="Videos did not load" tone="error" action={<button onClick={() => void load()}>Try again</button>}>
            <p>Your videos could not be loaded. Check that the API is running, then retry.</p>
          </PageState>
        ) : null}

        {data && projects.length === 0 ? (
          <PageState title="No videos yet" action={<Link className="button-link" to="/projects">Create your first video</Link>}>
            <p>
              Start with a topic. ViralPilot writes the script and the shot list; you rewrite the
              hook and add your own point of view before anything can publish.
            </p>
          </PageState>
        ) : null}

        {projects.length ? (
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
                    </p>
                  </div>
                  <span className={`next-action${action.urgent ? ' urgent' : ''}`}>{action.label}</span>
                </li>
              )
            })}
          </ul>
        ) : null}
      </section>
    </main>
  )
}
