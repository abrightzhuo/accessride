import { Accessibility, Building2, Eye, EyeOff, LogIn } from 'lucide-react'
import { useState, type FormEvent } from 'react'

export function LoginScreen({
  mode,
  onLogin,
}: {
  mode: 'rider' | 'agency'
  onLogin: (identity: string, password: string) => Promise<void>
}) {
  const [identity, setIdentity] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      await onLogin(identity, password)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to sign in.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="login-brand">
          <span className="brand-mark">
            {mode === 'rider' ? <Accessibility size={28} /> : <Building2 size={27} />}
          </span>
          <span>AccessRide</span>
        </div>
        <div className="login-heading">
          <p>{mode === 'rider' ? 'Rider app' : 'Agency app'}</p>
          <h1>{mode === 'rider' ? 'Welcome back' : 'Agency sign in'}</h1>
        </div>
        <form onSubmit={submit} className="login-form">
          <label className="field">
            <span>{mode === 'rider' ? 'Username' : 'Work email'}</span>
            <input
              autoCapitalize="none"
              autoComplete={mode === 'rider' ? 'username' : 'email'}
              value={identity}
              onChange={(event) => setIdentity(event.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>Password</span>
            <span className="password-input">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </span>
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-button login-submit" disabled={loading}>
            <LogIn size={20} />
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </section>
    </main>
  )
}
