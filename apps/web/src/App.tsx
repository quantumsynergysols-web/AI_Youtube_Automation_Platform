import { Link, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './lib/auth'
import Login from './pages/Login'
import Register from './pages/Register'
import VerifyEmail from './pages/VerifyEmail'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Landing from './pages/Landing'
import { Privacy, Terms } from './pages/Legal'
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
  if (!me && !loading && location.pathname === '/') return <Landing />
  // Public, and they carry their own nav — Google requires both reachable
  // without an account before it will verify the OAuth app.
  if (location.pathname === '/privacy') return <Privacy />
  if (location.pathname === '/terms') return <Terms />

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
            // Marketing nav. A landing page with sections and no way to reach
            // them makes a visitor scroll to find out whether it is worth
            // scrolling.
            <>
              <a href="#how">How it works</a>
              <a href="#guard">The guard</a>
              <a href="#pricing">Pricing</a>
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
    </div>
  )
}
