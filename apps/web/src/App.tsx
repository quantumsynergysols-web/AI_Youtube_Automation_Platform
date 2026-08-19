import { Link, Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './lib/auth'
import Login from './pages/Login'
import Register from './pages/Register'
import VerifyEmail from './pages/VerifyEmail'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Dashboard from './pages/Dashboard'
import Billing from './pages/Billing'

function Protected({ children }: { children: JSX.Element }) {
  const { me, loading } = useAuth()
  if (loading) return <div className="shell"><p className="muted">Loading…</p></div>
  return me ? children : <Navigate to="/login" replace />
}

export default function App() {
  const { me, signOut } = useAuth()

  return (
    <div className="shell">
      <nav>
        <Link to="/">Dashboard</Link>
        <Link to="/billing">Billing</Link>
        <span style={{ marginLeft: 'auto' }} className="muted">
          {me ? (
            <>
              {me.email}{' '}
              <a href="#" onClick={(e) => { e.preventDefault(); void signOut() }}>Sign out</a>
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
        <Route path="/" element={<Protected><Dashboard /></Protected>} />
      </Routes>
    </div>
  )
}
