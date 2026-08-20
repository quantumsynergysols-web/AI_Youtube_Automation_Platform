import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useReveal, useScrolled } from '../lib/motion'
import '../landing.css'

/**
 * Shared chrome for every public page.
 *
 * Extracted once there was more than one marketing page: a nav duplicated
 * across five files is a nav where four of them go stale the first time a link
 * changes.
 */

export const GUARD_MENU = [
  { title: 'Duplication of your own work', note: 'Scored against your back catalogue before it can publish.' },
  { title: 'Evidence a human was involved', note: 'Hook rewritten and your own commentary, or it stays blocked.' },
  { title: 'Publishing cadence', note: 'Flags upload patterns that get channels looked at.' },
  { title: 'Altered-content disclosure', note: 'Applied for you when publishing, not left as a checkbox.' },
]

export function MarketingNav() {
  const navRef = useScrolled<HTMLElement>()

  return (
    <header className="lp-nav" ref={navRef}>
      <div className="lp-nav-inner">
        <Link to="/" className="lp-brand">
          <svg viewBox="0 0 32 32" aria-hidden="true">
            <rect width="32" height="32" rx="8" fill="#087349" />
            <path d="M8 9l8 15 8-15h-5l-3 7-3-7z" fill="#ffffff" />
          </svg>
          ViralPilot
        </Link>

        <nav className="lp-nav-links" aria-label="Main navigation">
          <NavLink to="/features">Features</NavLink>

          {/* Hover- and focus-driven, so it needs no JS and does not trap a
              keyboard user inside it. */}
          <div className="lp-menu">
            <button type="button" className="lp-menu-trigger" aria-haspopup="true">
              The guard
            </button>
            <div className="lp-menu-panel" role="menu">
              {GUARD_MENU.map((item) => (
                <Link key={item.title} className="lp-menu-item" to="/features#guard" role="menuitem">
                  <b>{item.title}</b>
                  <span>{item.note}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* The dropdown needs hover or focus, neither of which exists on a
              phone, so below the breakpoint it collapses to a plain link and
              the trigger is hidden. */}
          <NavLink to="/features#guard" className="lp-only-mobile">The guard</NavLink>

          <NavLink to="/pricing">Pricing</NavLink>
          <NavLink to="/about">About</NavLink>
        </nav>

        <div className="lp-nav-end">
          <Link to="/login">Sign in</Link>
          <Link className="lp-cta sm" to="/register">Start free</Link>
        </div>
      </div>
    </header>
  )
}

export function MarketingFooter() {
  return (
    <footer className="lp-foot">
      <div className="lp-foot-inner">
        <div className="lp-foot-top">
          <div className="lp-foot-brand">
            <Link to="/" className="lp-brand">
              <svg viewBox="0 0 32 32" aria-hidden="true">
                <rect width="32" height="32" rx="8" fill="#087349" />
                <path d="M8 9l8 15 8-15h-5l-3 7-3-7z" fill="#ffffff" />
              </svg>
              ViralPilot
            </Link>
            <p>
              AI production for creators who already earn from their channel. Built to refuse
              work that would put your monetisation at risk.
            </p>
            <span className="lp-foot-badge"><b>Read-only</b> until you choose to publish</span>
          </div>

          <div className="lp-foot-col">
            <h3>Product</h3>
            <ul>
              <li><Link to="/features">Features</Link></li>
              <li><Link to="/features#guard">The Originality Guard</Link></li>
              <li><Link to="/pricing">Pricing</Link></li>
              <li><Link to="/about">About</Link></li>
            </ul>
          </div>

          <div className="lp-foot-col">
            <h3>Account</h3>
            <ul>
              <li><Link to="/register">Create an account</Link></li>
              <li><Link to="/login">Sign in</Link></li>
              <li><Link to="/forgot-password">Reset password</Link></li>
            </ul>
          </div>

          <div className="lp-foot-col">
            <h3>Legal</h3>
            <ul>
              <li><Link to="/privacy">Privacy policy</Link></li>
              <li><Link to="/terms">Terms of service</Link></li>
            </ul>
          </div>
        </div>

        <div className="lp-foot-bottom">
          <p>© {new Date().getFullYear()} Quantum Synergy Solutions. All rights reserved.</p>
          {/*
            Stated here as well as in the product. YouTube requires
            altered-content disclosure on synthetic media, and a tool that sells
            itself on compliance should not be quiet about producing exactly that.
          */}
          <p className="lp-foot-note">
            Videos produced with ViralPilot use synthetic voice and generated visuals, and are
            disclosed as altered content when published. ViralPilot is not affiliated with,
            endorsed by, or sponsored by YouTube or Google.
          </p>
        </div>
      </div>
    </footer>
  )
}

/** Page shell: nav, content, footer, and the reveal observer. */
export function MarketingPage({ children }: { children: ReactNode }) {
  useReveal()
  return (
    <div className="lp">
      <MarketingNav />
      <main id="main-content">{children}</main>
      <MarketingFooter />
    </div>
  )
}

/** A page-opening band. Used by every page except the landing hero. */
export function PageHead({
  label,
  title,
  lede,
}: {
  label: string
  title: ReactNode
  lede?: ReactNode
}) {
  return (
    <section className="lp-pagehead">
      <div className="lp-inner" data-reveal>
        <p className="lp-label">{label}</p>
        <h1 className="lp-display">{title}</h1>
        {lede ? <p className="lp-lede">{lede}</p> : null}
      </div>
    </section>
  )
}
