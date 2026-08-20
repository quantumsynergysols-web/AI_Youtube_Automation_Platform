import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

/**
 * Shared layout for the five auth screens.
 *
 * They previously rendered a bare `.card` inside the full-width shell, which
 * stretched the inputs across the whole page — a 1150px-wide password field
 * looks broken and is genuinely harder to use, because the label and the cursor
 * end up a screen apart. Auth forms are a single column of short fields and
 * want a narrow measure.
 */
export function AuthShell({
  eyebrow,
  title,
  lede,
  children,
  footer,
}: {
  eyebrow?: string
  title: string
  lede?: ReactNode
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <main className="auth" id="main-content">
      <div className="auth-inner">
        <Link to="/" className="auth-brand" aria-label="ViralPilot home">
          <svg viewBox="0 0 32 32" aria-hidden="true">
            <rect width="32" height="32" rx="8" fill="#087349" />
            <path d="M8 9l8 15 8-15h-5l-3 7-3-7z" fill="#ffffff" />
          </svg>
          ViralPilot
        </Link>

        <div className="auth-card">
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h1>{title}</h1>
          {lede ? <p className="auth-lede">{lede}</p> : null}
          {children}
        </div>

        {footer ? <p className="auth-foot">{footer}</p> : null}
      </div>
    </main>
  )
}

/** Separates the password form from the Google button without saying "OR" twice. */
export function AuthDivider({ label = 'or' }: { label?: string }) {
  return <div className="auth-divider" role="separator"><span>{label}</span></div>
}
