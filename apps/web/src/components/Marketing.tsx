import { useEffect, useRef, type ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
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

/**
 * Reveals elements marked `data-reveal` as they scroll into view.
 *
 * IntersectionObserver rather than a scroll handler, so nothing runs on the
 * main thread between frames. Elements are revealed once and then unobserved —
 * content that re-animates every time you scroll past is a distraction, not an
 * effect.
 *
 * If the visitor asked for reduced motion, everything is shown immediately and
 * the observer is never created. The page must be complete without animation.
 */
export function useReveal() {
  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'))
    if (!nodes.length) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced || !('IntersectionObserver' in window)) {
      nodes.forEach((n) => n.setAttribute('data-revealed', 'true'))
      return
    }

    const reveal = (el: Element) => el.setAttribute('data-revealed', 'true')

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          reveal(entry.target)
          observer.unobserve(entry.target)
        })
      },
      // Fires slightly before the element reaches the fold, so the reveal has
      // finished by the time it is properly in view.
      { rootMargin: '0px 0px -8% 0px', threshold: 0.06 },
    )

    nodes.forEach((n) => observer.observe(n))

    // Anything already on screen is revealed on the next frame rather than
    // waiting for the observer, so the top of the page is never briefly blank.
    const raf = requestAnimationFrame(() => {
      nodes.forEach((n) => {
        if (n.getBoundingClientRect().top < window.innerHeight) {
          reveal(n)
          observer.unobserve(n)
        }
      })
    })

    // Last resort. Hiding content until a callback fires means any failure of
    // that callback — a background tab that never composites, an observer that
    // does not run, a browser quirk — leaves the page permanently blank. An
    // animation is never worth that, so everything shows regardless after a
    // moment.
    const failsafe = window.setTimeout(() => {
      nodes.forEach(reveal)
      observer.disconnect()
    }, 1600)

    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(failsafe)
      observer.disconnect()
    }
  }, [])
}

/** Adds a shadow to the nav once the page has moved, so it lifts off the content. */
function useScrolled() {
  const ref = useRef<HTMLElement | null>(null)
  useEffect(() => {
    const onScroll = () => {
      ref.current?.toggleAttribute('data-scrolled', window.scrollY > 8)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return ref
}

export function MarketingNav() {
  const navRef = useScrolled()

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
