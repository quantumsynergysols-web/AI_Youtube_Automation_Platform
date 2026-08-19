import { Link, Navigate, NavLink, Route, Routes } from 'react-router-dom'
import { useAuth } from './lib/auth'
import Login from './pages/Login'
import Register from './pages/Register'
import VerifyEmail from './pages/VerifyEmail'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Dashboard from './pages/Dashboard'
import Billing from './pages/Billing'
import Channels from './pages/Channels'
import ScriptReview from './pages/ScriptReview'

function Protected({ children }: { children: JSX.Element }) {
  const { me, loading } = useAuth()
  if (loading) return <div className="card"><p className="muted" role="status">Loading your account…</p></div>
  return me ? children : <Navigate to="/login" replace />
}

export default function App() {
  const { me, signOut } = useAuth()

  return (
    <div className="shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <nav aria-label="Main navigation">
        <Link to="/" className="brand">ViralPilot</Link>
        <div className="nav-links">
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/channels">Channels</NavLink>
          <NavLink to="/billing">Billing</NavLink>
        </div>
        <span className="account-nav">
          {me ? (
            <>
              {me.email}{' '}
              <button className="link-button" onClick={() => void signOut()}>Sign out</button>
            </>
          ) : (
            <Link to="/login">Sign in</Link>
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
        <Route path="/projects/:id/script" element={<Protected><ScriptReview /></Protected>} />
        <Route path="/" element={<Protected><Dashboard /></Protected>} />
      </Routes>
    </div>
  )
}
