import { FormEvent, useState } from 'react'
import { apiRequest } from '../api/client'
import type { User } from '../app/App'

export function LoginPage({ onLogin }: { onLogin: (user: User) => void }) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true); setError('')
    const data = new FormData(event.currentTarget)
    try {
      const user = await apiRequest<User>('/auth/login', { method: 'POST', body: JSON.stringify({ username: data.get('username'), password: data.get('password') }) })
      history.replaceState(null, '', user.role === 'admin' ? '/admin' : '/')
      onLogin(user)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Login failed') }
    finally { setBusy(false) }
  }

  return <main className="auth-shell"><form className="card" onSubmit={submit}>
    <h1>Pirates of the Aibbean</h1><p>Sign in to continue</p>
    <label>Username<input name="username" minLength={3} required autoComplete="username" autoFocus /></label>
    <label>Password<input name="password" type="password" minLength={8} required autoComplete="current-password" /></label>
    {error && <p className="error" role="alert">{error}</p>}
    <button disabled={busy}>{busy ? 'Signing in…' : 'Login'}</button>
  </form></main>
}
