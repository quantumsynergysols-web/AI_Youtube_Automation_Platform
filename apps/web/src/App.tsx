import type { ReactNode } from 'react'
import { Link, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './lib/auth'
import { usePageEnter } from './lib/motion'
import Login from './pages/Login'
import Register from './pages/Register'
import VerifyEmail from './pages/VerifyEmail'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Landing from './pages/Landing'
import { Privacy, Terms } from './pages/Legal'
import Features from './pages/Features'
import PricingPage from './pages/Pricing'
import About from './pages/About'
import Dashboard from './pages/Dashboard'
import Projects from './pages/Projects'
import Billing from './pages/Billing'
import Channels from './pages/Channels'
import ScriptReview from './pages/ScriptReview'

/**
 * The root is the marketing page for a visitor and the workspace for a customer.
 *
 * Sending logged-out traffic to /login instead — which is what happened before —
 * asks someone who has never heard of the product to authenticate to something
 * they cannot see.
 */
function Home() {
  const { me, loading } = useAuth()
  if (loading) return <div className="card"><p className="muted" role="status">Loading…</p></div>
  return me ? <Dashboard /> : <Landing />
}

/**
 * Runs the enter transition on every route change.
 *
 * Keyed on the path so it replays on navigation; applied here rather than in
 * each page so a new screen cannot forget it, and so there is exactly one place
 * to change the timing.
 */
function PageEnter({ children }: { children: ReactNode }) {
  const location = useLocation()
  const entered = usePageEnter(location.pathname)
  return (
    <div className="page-enter" data-entered={String(entered)}>
      {children}
    </div>
  )
}

function Protected({ children }: { children: JSX.Element }) {
  const { me, loading } = useAuth()
  if (loading) return <div className="card"><p className="muted" role="status">Loading your account…</p></div>
  return me ? children : <Navigate to="/login" replace />
}

export default function App() {
  const { me, signOut, loading } = useAuth()
  const location = useLocation()

  // The marketing page runs full-bleed — alternating edge-to-edge dark and white
  // bands are the thing that stops it reading like every other constrained-column
  // template, and that cannot be done from inside .shell. It brings its own nav
  // and footer.
  // Marketing pages carry their own full-width nav and footer, so they render
  // outside .shell. Reachable signed out — Google requires the legal pages to be
  // public before it will verify the OAuth app.
  if (!me && !loading && location.pathname === '/') return <PageEnter><Landing /></PageEnter>
  if (location.pathname === '/features') return <PageEnter><Features /></PageEnter>
  if (location.pathname === '/pricing') return <PageEnter><PricingPage /></PageEnter>
  if (location.pathname === '/about') return <PageEnter><About /></PageEnter>
  if (location.pathname === '/privacy') return <PageEnter><Privacy /></PageEnter>
  if (location.pathname === '/terms') return <PageEnter><Terms /></PageEnter>
  // Auth screens are public too, and carry the same header and footer as the
  // rest of the public site rather than the app chrome.
  if (location.pathname === '/login') return <PageEnter><Login /></PageEnter>
  if (location.pathname === '/register') return <PageEnter><Register /></PageEnter>
  if (location.pathname === '/forgot-password') return <PageEnter><ForgotPassword /></PageEnter>
  if (location.pathname === '/reset-password') return <PageEnter><ResetPassword /></PageEnter>
  if (location.pathname === '/verify-email') return <PageEnter><VerifyEmail /></PageEnter>

  return (
    <div className="shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <nav aria-label="Main navigation">
        <Link to="/" className="brand">ViralPilot</Link>
        <div className="nav-links">
          {me ? (
            <>
              <NavLink to="/" end>Dashboard</NavLink>
              <NavLink to="/projects">Videos</NavLink>
              <NavLink to="/channels">Channels</NavLink>
              <NavLink to="/billing">Billing</NavLink>
            </>
          ) : (
            // Real routes, not in-page anchors. These render on /login and
            // /register too, where #how and #guard point at sections that only
            // exist on the landing page — so they scrolled nowhere.
            <>
              <NavLink to="/features">Features</NavLink>
              <NavLink to="/pricing">Pricing</NavLink>
              <NavLink to="/about">About</NavLink>
            </>
          )}
        </div>
        <span className="account-nav">
          {me ? (
            <>
              {me.email}{' '}
              <button className="link-button" onClick={() => void signOut()}>Sign out</button>
            </>
          ) : (
            <>
              <Link to="/login">Sign in</Link>
              <Link className="button-link nav-cta" to="/register">Start free</Link>
            </>
          )}
        </span>
      </nav>

      <PageEnter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/billing" element={<Protected><Billing /></Protected>} />
        <Route path="/channels" element={<Protected><Channels /></Protected>} />
        <Route path="/projects" element={<Protected><Projects /></Protected>} />
        <Route path="/projects/:id/script" element={<Protected><ScriptReview /></Protected>} />
        <Route path="/" element={<Home />} />
      </Routes>
      </PageEnter>
    </div>
  )
}
