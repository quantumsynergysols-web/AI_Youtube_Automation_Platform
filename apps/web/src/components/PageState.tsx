import type { ReactNode } from 'react'

export function PageState({
  title,
  children,
  action,
  tone = 'neutral',
}: {
  title: string
  children: ReactNode
  action?: ReactNode
  tone?: 'neutral' | 'error'
}) {
  return (
    <div className={`page-state ${tone === 'error' ? 'page-state-error' : ''}`} role={tone === 'error' ? 'alert' : undefined}>
      <div className="state-icon" aria-hidden="true">{tone === 'error' ? '!' : '○'}</div>
      <div className="stack state-copy">
        <h2>{title}</h2>
        <div>{children}</div>
        {action ? <div className="row">{action}</div> : null}
      </div>
    </div>
  )
}

export function LoadingState({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="skeleton-stack" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-line" />
      <div className="skeleton skeleton-line short" />
    </div>
  )
}
