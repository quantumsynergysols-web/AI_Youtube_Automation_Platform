export interface ProjectSummary {
  id: string
  topic: string
  state: string
  targetDurationSec: number
  createdAt: string
  channel: { id: string; title: string } | null
  script: { wordCount: number; hookEditedAt: string | null; commentaryAddedAt: string | null } | null
  originalityCheck: { verdict: string; score: number } | null
}

export interface NextAction {
  label: string
  /** True when the project cannot progress until the creator does something. */
  urgent: boolean
}

/**
 * What this project needs next.
 *
 * Ordered to match the server's own blocking precedence, so the dashboard never
 * points at a fix the guard would not have complained about first. A creator
 * with a dozen drafts should be able to scan one column and know where to spend
 * the next ten minutes.
 */
export function nextAction(project: ProjectSummary): NextAction {
  if (!project.script) return { label: 'Generate the script', urgent: false }
  if (project.originalityCheck?.verdict === 'BLOCKED') {
    return { label: 'Blocked — fix and re-check', urgent: true }
  }
  if (!project.script.hookEditedAt) return { label: 'Rewrite the hook', urgent: true }
  if (!project.script.commentaryAddedAt) return { label: 'Add your commentary', urgent: true }
  // Edits clear a stored verdict server-side, so a script with human input but
  // no check is the normal state after editing — not an anomaly.
  if (!project.originalityCheck) return { label: 'Run the originality guard', urgent: true }
  return { label: 'Ready to publish', urgent: false }
}

export function stateLabel(state: string): string {
  return state.toLowerCase().replace(/_/g, ' ')
}
