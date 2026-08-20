import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { LoadingState, PageState } from '../components/PageState'
import { api } from '../lib/api'
import {
  ActiveTimeAccumulator,
  COMMENTARY_FLOOR,
  countWords,
  generationError,
} from './script-review.logic'

type SceneRole = 'HOOK' | 'INTRODUCTION' | 'BODY' | 'CALL_TO_ACTION'

interface Scene {
  id?: string
  ordinal: number
  role: SceneRole
  narration: string
  prompt: string
  startMs: number
  endMs: number
}

interface Script {
  id: string
  projectId: string
  artDirection: string
  hook: string
  commentary: string | null
  commentaryAddedAt: string | null
  hookEditedAt: string | null
  humanInputMs: number
  wordCount: number
  humanEditedAt: string | null
  project: { topic: string; targetDurationSec: number; language: string; style: string; state: string }
  scenes: Scene[]
}

interface GuardResult {
  verdict: 'PASS' | 'WARNED' | 'BLOCKED'
  score: number
  similarity: number
  duplicateOf: string | null
  hookEdited: boolean
  hasCommentary: boolean
  humanInputMs: number
  requiresDisclosure: boolean
  warnings: string[]
  reason: string | null
  blockedOn: 'SIMILARITY' | 'COMMENTARY' | 'HOOK' | null
}

type GuardResponse = { checked: false } | ({ checked: true } & GuardResult)

const ROLE_LABEL: Record<SceneRole, string> = {
  HOOK: 'Hook',
  INTRODUCTION: 'Introduction',
  BODY: 'Body',
  CALL_TO_ACTION: 'Call to action',
}

const PROGRESS_COPY = [
  'Reading the project brief and channel context…',
  'Finding an angle that avoids covered ground…',
  'Writing the narration and opening hook…',
  'Building a consistent visual direction…',
  'Checking scene order and timing…',
]

export default function ScriptReview() {
  const { id: projectId = '' } = useParams()
  const [script, setScript] = useState<Script | null | undefined>(undefined)
  const [hook, setHook] = useState('')
  const [commentary, setCommentary] = useState('')
  const [guard, setGuard] = useState<GuardResult | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [generationSeconds, setGenerationSeconds] = useState(0)
  const [saving, setSaving] = useState<'hook' | 'commentary' | null>(null)
  const [savingScene, setSavingScene] = useState<number | null>(null)
  const [sceneDrafts, setSceneDrafts] = useState<Record<number, string>>({})
  const [checking, setChecking] = useState(false)
  const [confirmRegenerate, setConfirmRegenerate] = useState(false)
  const tracker = useRef(new ActiveTimeAccumulator())
  const engaged = useRef(false)
  const hookRef = useRef<HTMLTextAreaElement>(null)
  const commentaryRef = useRef<HTMLTextAreaElement>(null)
  const scenesRef = useRef<HTMLElement>(null)
  const regenerateRef = useRef<HTMLElement>(null)
  const hasScript = script !== null && script !== undefined

  const adoptScript = useCallback((next: Script) => {
    setScript(next)
    setHook(next.hook)
    setCommentary(next.commentary ?? '')
    setSceneDrafts(Object.fromEntries(next.scenes.map((scene) => [scene.ordinal, scene.narration])))
  }, [])

  const refreshGuard = useCallback(async () => {
    const response = await api<GuardResponse>(`/api/projects/${projectId}/originality-check`)
    const result = response.checked ? response : null
    setGuard(result)
    return result
  }, [projectId])

  const refreshGuardAfterSave = useCallback(async () => {
    try {
      return await refreshGuard()
    } catch {
      setGuard(null)
      setActionError('Your edit was saved, but its guard status could not be refreshed. Reload this page before relying on the publishing result.')
      return undefined
    }
  }, [refreshGuard])

  const load = useCallback(async () => {
    setLoadError(null)
    try {
      const [scriptResponse, guardResponse] = await Promise.all([
        api<{ generated: false } | ({ generated: true } & Script)>(`/api/projects/${projectId}/script`),
        api<GuardResponse>(`/api/projects/${projectId}/originality-check`),
      ])
      if (scriptResponse.generated) adoptScript(scriptResponse)
      else setScript(null)
      setGuard(guardResponse.checked ? guardResponse : null)
    } catch {
      setLoadError('The script review could not be loaded. Check your connection and that this project still exists, then try again.')
    }
  }, [adoptScript, projectId])

  useEffect(() => { void load() }, [load])

  const flushTime = useCallback(async () => {
    const delta = tracker.current.consume()
    if (!delta || !hasScript) return
    try {
      const updated = await api<Script>(`/api/projects/${projectId}/script`, {
        method: 'PATCH',
        body: JSON.stringify({ humanInputMs: delta }),
      })
      setScript((current) => current ? { ...current, humanInputMs: updated.humanInputMs } : current)
    } catch {
      tracker.current.restore(delta)
    }
  }, [hasScript, projectId])

  useEffect(() => {
    const updateActivity = () => {
      if (engaged.current && document.visibilityState === 'visible' && document.hasFocus()) tracker.current.resume()
      else tracker.current.pause()
    }
    const onBlur = () => tracker.current.pause()
    document.addEventListener('visibilitychange', updateActivity)
    window.addEventListener('focus', updateActivity)
    window.addEventListener('blur', onBlur)
    const interval = window.setInterval(() => { void flushTime() }, 15_000)
    return () => {
      document.removeEventListener('visibilitychange', updateActivity)
      window.removeEventListener('focus', updateActivity)
      window.removeEventListener('blur', onBlur)
      window.clearInterval(interval)
      tracker.current.pause()
      void flushTime()
    }
  }, [flushTime])

  useEffect(() => {
    if (!generating) return
    const started = Date.now()
    const interval = window.setInterval(() => setGenerationSeconds(Math.floor((Date.now() - started) / 1000)), 1_000)
    return () => window.clearInterval(interval)
  }, [generating])

  function beginEditing() {
    engaged.current = true
    if (document.visibilityState === 'visible' && document.hasFocus()) tracker.current.resume()
  }

  function stopEditing() {
    engaged.current = false
    tracker.current.pause()
  }

  async function generate() {
    setGenerating(true)
    setGenerationSeconds(0)
    setActionError(null)
    setNotice(null)
    try {
      await flushTime()
      await api(`/api/projects/${projectId}/script`, { method: 'POST' })
      await load()
      setNotice(script ? 'A new draft replaced the hook and scenes. Your commentary was kept; review the new hook before running the guard.' : 'Your draft is ready. Rewrite the hook and add your own commentary before running the guard.')
      setConfirmRegenerate(false)
    } catch (error) {
      setActionError(generationError(error))
    } finally {
      setGenerating(false)
    }
  }

  async function save(field: 'hook' | 'commentary') {
    setSaving(field)
    setActionError(null)
    setNotice(null)
    stopEditing()
    const delta = tracker.current.consume()
    const body = field === 'hook' ? { hook, humanInputMs: delta } : { commentary, humanInputMs: delta }
    try {
      const updated = await api<Script>(`/api/projects/${projectId}/script`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      })
      adoptScript(updated)
      await refreshGuardAfterSave()
      if (field === 'hook') {
        setNotice(updated.hookEditedAt ? 'Hook saved as your revision. Run the guard after commentary is ready.' : 'Hook saved, but it is unchanged from the generated version. Rewrite it in your own words before publishing can pass.')
      } else {
        const words = countWords(updated.commentary ?? '')
        setNotice(words >= COMMENTARY_FLOOR ? 'Commentary saved. It now meets the 20-word floor; depth and specificity still matter.' : `Commentary saved at ${words} words. Add at least ${COMMENTARY_FLOOR - words} more words before the guard can pass.`)
      }
    } catch (error) {
      tracker.current.restore(delta)
      setActionError(error instanceof Error ? `${error.message} Your text remains here; try saving again.` : 'The edit could not be saved. Your text remains here; try again.')
    } finally {
      setSaving(null)
    }
  }

  async function saveScene(ordinal: number) {
    const narration = sceneDrafts[ordinal] ?? ''
    const hadGuard = guard !== null
    setSavingScene(ordinal)
    setActionError(null)
    setNotice(null)
    stopEditing()
    const delta = tracker.current.consume()
    try {
      const updated = await api<Script>(`/api/projects/${projectId}/script`, {
        method: 'PATCH',
        body: JSON.stringify({ scenes: [{ ordinal, narration }], humanInputMs: delta }),
      })
      adoptScript(updated)
      const currentGuard = await refreshGuardAfterSave()
      if (currentGuard === undefined) {
        setNotice('Scene narration saved. Reload this page to confirm whether the guard needs to run again.')
      } else if (currentGuard) {
        setNotice('Scene narration was unchanged, so the existing guard result still applies.')
      } else if (hadGuard) {
        setNotice('Scene narration saved. The previous guard result was cleared because the script text changed; run it again after your rewrites are complete.')
      } else {
        setNotice('Scene narration saved. Run the Originality Guard after your rewrites are complete.')
      }
    } catch (error) {
      tracker.current.restore(delta)
      setActionError(error instanceof Error ? `${error.message} Your rewritten narration remains here; try saving again.` : 'The scene could not be saved. Your rewritten narration remains here; try again.')
    } finally {
      setSavingScene(null)
    }
  }

  async function runGuard() {
    setChecking(true)
    setActionError(null)
    setNotice(null)
    stopEditing()
    await flushTime()
    try {
      const result = await api<GuardResult>(`/api/projects/${projectId}/originality-check`, { method: 'POST' })
      setGuard(result)
    } catch (error) {
      setActionError(error instanceof Error ? `${error.message} Save your edits, then run the check again.` : 'The originality check could not run. Save your edits, then try again.')
    } finally {
      setChecking(false)
    }
  }

  function goToFix(blockedOn: GuardResult['blockedOn']) {
    const element = blockedOn === 'COMMENTARY' ? commentaryRef.current : blockedOn === 'HOOK' ? hookRef.current : scenesRef.current
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    if (blockedOn !== 'SIMILARITY') element?.focus()
  }

  if (script === undefined && !loadError) return <main className="page"><LoadingState label="Loading script review" /></main>

  return (
    <main className="stack page script-review" id="main-content">
      <header className="page-header">
        <div><p className="eyebrow">Human checkpoint</p><h1>Shape this script</h1><p>This is the evidence that a creator—not an autopilot—made the video worth publishing.</p></div>
        <Link to="/" className="text-link">Back to dashboard</Link>
      </header>

      {notice ? <div className="notice ok" role="status">{notice}</div> : null}
      {actionError ? <div className="notice error" role="alert">{actionError}</div> : null}
      {loadError ? <section className="card"><PageState title="Script review did not load" tone="error" action={<button onClick={() => void load()}>Try again</button>}><p>{loadError}</p></PageState></section> : null}

      {!loadError && script === null ? (
        <section className="card">
          {generating ? <GenerationProgress seconds={generationSeconds} /> : (
            <PageState title="Generate the first draft" action={<button onClick={() => void generate()}>Generate script</button>}>
              <p>ViralPilot will draft the spoken narration, opening hook, scene timing, image prompts, and one visual direction for the whole video.</p>
              <p className="muted">Generation usually takes tens of seconds. The draft is a starting point: publishing stays blocked until you rewrite the hook, add your own commentary, and pass the Originality Guard.</p>
            </PageState>
          )}
        </section>
      ) : null}

      {script ? (
        <>
          <section className="project-brief" aria-label="Project brief">
            <div><p className="eyebrow">Project brief</p><h2>{script.project.topic}</h2></div>
            <div className="brief-facts"><span>{script.project.targetDurationSec}s target</span><span>{script.project.language}</span><span>{script.project.style}</span></div>
          </section>
          <section className="card hook-workspace" id="hook-editor">
            <div className="section-heading">
              <div><p className="eyebrow">The first three seconds</p><h2>Rewrite the hook</h2></div>
              <span className={`review-status ${script.hookEditedAt ? 'complete' : 'required'}`}>{script.hookEditedAt ? 'Human edit recorded' : 'Rewrite required'}</span>
            </div>
            <p>The opening decides whether someone keeps watching. Read the generated line, then rebuild it in your own voice—saving it unchanged does not count as review.</p>
            <label>Opening hook
              <textarea ref={hookRef} className="hook-input" value={hook} maxLength={500} onFocus={beginEditing} onBlur={stopEditing} onChange={(event) => { beginEditing(); setHook(event.target.value) }} />
            </label>
            <div className="editor-footer"><span className="muted">{hook.trim().length}/500 characters</span><button onClick={() => void save('hook')} disabled={saving !== null}>{saving === 'hook' ? 'Saving…' : 'Save hook revision'}</button></div>
          </section>

          <section className="card commentary-workspace" id="commentary-editor">
            <div className="section-heading">
              <div><p className="eyebrow">Your point of view</p><h2>Add creator commentary</h2></div>
              <CommentaryCount value={commentary} />
            </div>
            <p>The draft deliberately avoids inventing your experience. Add the insight, disagreement, context, or firsthand judgement that only you can stand behind. Twenty words is the publishing floor, not the target.</p>
            <label>Your commentary
              <textarea ref={commentaryRef} className="commentary-input" value={commentary} maxLength={5_000} onFocus={beginEditing} onBlur={stopEditing} onChange={(event) => { beginEditing(); setCommentary(event.target.value) }} placeholder="Write what you genuinely think the viewer needs to understand…" />
            </label>
            <div className="editor-footer"><span className="muted">This is saved as your authorship evidence.</span><button onClick={() => void save('commentary')} disabled={saving !== null}>{saving === 'commentary' ? 'Saving…' : 'Save commentary'}</button></div>
          </section>

          <section className="card guard-panel" aria-labelledby="guard-heading">
            <div className="section-heading"><div><p className="eyebrow">Publishing gate</p><h2 id="guard-heading">Originality Guard</h2></div>{guard ? <span className={`verdict verdict-${guard.verdict.toLowerCase()}`}>{guard.verdict}</span> : null}</div>
            {!guard ? <><p>Run the guard after saving both edits. It checks human authorship and compares this draft with the channel’s back catalogue.</p><button className="guard-action" onClick={() => void runGuard()} disabled={checking}>{checking ? 'Checking originality…' : 'Run Originality Guard'}</button></> : <GuardDetails result={guard} checking={checking} onRun={() => void runGuard()} onFix={() => goToFix(guard.blockedOn)} />}
          </section>

          <section className="card">
            <div className="section-heading"><div><p className="eyebrow">Visual continuity</p><h2>Art direction</h2></div></div>
            <p>{script.artDirection}</p>
            <p className="muted">This direction holds the subject, palette, lighting, lens, and mood together across every scene.</p>
          </section>

          <section ref={scenesRef} className="card" aria-labelledby="scenes-heading" id="scene-editor">
            <div className="section-heading"><div><p className="eyebrow">Read in order</p><h2 id="scenes-heading">Scene breakdown</h2></div><span className="count-badge">{script.scenes.length} scenes</span></div>
            <div className="script-metrics"><span><strong>{script.wordCount}</strong> spoken words</span><span><strong>{estimatedDuration(script.scenes)}s</strong> estimated / <strong>{script.project.targetDurationSec}s</strong> target</span><span className="muted">{durationGuidance(estimatedDuration(script.scenes), script.project.targetDurationSec)}</span></div>
            <p className="muted">If the guard finds catalogue similarity, rewrite the narration that follows the same angle or phrasing. Regeneration is available below as a fallback, but it replaces every scene and clears your hook review.</p>
            <div className="scene-list">{script.scenes.map((scene) => <SceneCard key={scene.id ?? scene.ordinal} scene={scene} value={sceneDrafts[scene.ordinal] ?? scene.narration} saving={savingScene === scene.ordinal} onChange={(value) => { beginEditing(); setSceneDrafts((current) => ({ ...current, [scene.ordinal]: value })) }} onFocus={beginEditing} onBlur={stopEditing} onSave={() => void saveScene(scene.ordinal)} />)}</div>
          </section>

          <section ref={regenerateRef} className="card regeneration-panel">
            <div><p className="eyebrow">Start the draft over</p><h2>Regenerate script</h2></div>
            <p>Use regeneration when the angle or scene structure needs replacing—not as a shortcut around review.</p>
            <button className="secondary" onClick={() => setConfirmRegenerate(true)}>Regenerate…</button>
          </section>
        </>
      ) : null}

      {confirmRegenerate ? <RegenerateDialog generating={generating} onCancel={() => setConfirmRegenerate(false)} onConfirm={() => void generate()} seconds={generationSeconds} /> : null}
    </main>
  )
}

function CommentaryCount({ value }: { value: string }) {
  const words = countWords(value)
  return <span className={`review-status ${words >= COMMENTARY_FLOOR ? 'complete' : 'required'}`}>{words}/{COMMENTARY_FLOOR} words minimum</span>
}

function GenerationProgress({ seconds }: { seconds: number }) {
  const step = Math.min(PROGRESS_COPY.length - 1, Math.floor(seconds / 8))
  return <div className="generation-progress" role="status" aria-live="polite"><div className="progress-orbit" aria-hidden="true" /><div className="stack"><p className="eyebrow">Drafting · {seconds}s</p><h2>Building a script with room for your voice</h2><p>{PROGRESS_COPY[step]}</p><div className="generation-track"><span style={{ width: `${Math.min(92, 12 + seconds * 1.5)}%` }} /></div><p className="muted">This can take tens of seconds. Keep this page open.</p></div></div>
}

function SceneCard({ scene, value, saving, onChange, onFocus, onBlur, onSave }: { scene: Scene; value: string; saving: boolean; onChange: (value: string) => void; onFocus: () => void; onBlur: () => void; onSave: () => void }) {
  const isHook = scene.role === 'HOOK'
  return <article className="scene-review"><div className="scene-number">{scene.ordinal + 1}</div><div className="stack"><div className="scene-heading"><span className="status-badge">{ROLE_LABEL[scene.role]}</span><span className="muted">{formatTime(scene.startMs)}–{formatTime(scene.endMs)}</span></div><div><h3>Narration</h3>{isHook ? <><p>{scene.narration}</p><p className="field-explainer">Edit this opening in the dedicated hook workspace above so its review status stays clear.</p></> : <><textarea className="scene-narration" value={value} maxLength={5_000} onFocus={onFocus} onBlur={onBlur} onChange={(event) => onChange(event.target.value)} /><div className="scene-save"><p className="field-explainer">This is exactly what the voice will say. Rewriting it changes the text checked for similarity.</p><button className="secondary" onClick={onSave} disabled={saving}>{saving ? 'Saving…' : 'Save narration'}</button></div></>}</div><div className="visual-prompt"><h3>Image prompt</h3><p>{scene.prompt}</p><p className="field-explainer">This directs the scene’s visual; it is not spoken dialogue.</p></div></div></article>
}

function GuardDetails({ result, checking, onRun, onFix }: { result: GuardResult; checking: boolean; onRun: () => void; onFix: () => void }) {
  return <div className="stack"><p className="guard-summary">Originality score <strong>{Math.round(result.score * 100)}%</strong> · catalogue similarity <strong>{Math.round(result.similarity * 100)}%</strong></p>{result.verdict === 'BLOCKED' ? <div className="guard-block"><h3>Publishing is blocked</h3><p>{result.reason}</p>{result.duplicateOf ? <p className="muted">Closest catalogue video: {result.duplicateOf}</p> : null}<button onClick={onFix}>Go to what needs fixing</button></div> : <div className="guard-pass"><h3>{result.verdict === 'PASS' ? 'Publishing checkpoint passed' : 'Checkpoint passed with warnings'}</h3><p>Your hook edit and commentary were recorded. Re-run the guard after any further script change.</p></div>}{result.warnings.length ? <div className="guard-warnings"><h3>Cadence warnings — these do not block publishing</h3><ul>{result.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div> : null}<div className="guard-facts"><span>{result.hookEdited ? '✓ Hook edited' : '○ Hook edit missing'}</span><span>{result.hasCommentary ? '✓ Commentary floor met' : '○ Commentary below floor'}</span><span>{Math.round(result.humanInputMs / 1000)}s active editing recorded</span><span>{result.requiresDisclosure ? 'Altered-content disclosure required' : 'No disclosure required'}</span></div><button className="secondary guard-action" onClick={onRun} disabled={checking}>{checking ? 'Checking again…' : 'Run check again'}</button></div>
}

function RegenerateDialog({ generating, onCancel, onConfirm, seconds }: { generating: boolean; onCancel: () => void; onConfirm: () => void; seconds: number }) {
  return <div className="modal-backdrop"><div className="modal" role="dialog" aria-modal="true" aria-labelledby="regenerate-title"><p className="eyebrow">Replace generated work</p><h2 id="regenerate-title">Regenerate this script?</h2><div className="regeneration-impact"><p><strong>Replaced:</strong> every scene and the current hook. The hook will return to “rewrite required.”</p><p><strong>Kept:</strong> all commentary you wrote in your own words.</p></div>{generating ? <GenerationProgress seconds={seconds} /> : <div className="row modal-actions"><button className="secondary" onClick={onCancel}>Keep this draft</button><button onClick={onConfirm}>Replace hook and scenes</button></div>}</div></div>
}

function estimatedDuration(scenes: Scene[]): number {
  return Math.round(Math.max(0, ...scenes.map((scene) => scene.endMs)) / 1000)
}

function durationGuidance(estimated: number, target: number): string {
  const difference = estimated - target
  if (Math.abs(difference) <= 3) return 'Draft is close to the project target.'
  return difference > 0 ? `Draft runs about ${difference}s over target.` : `Draft runs about ${Math.abs(difference)}s under target.`
}

function formatTime(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`
}
