import type { User } from '../app/App'

export function UserPage({ user, onLogout }: { user: User; onLogout: () => void }) {
  return <main className="auth-shell"><section className="card">
    <h1>Welcome aboard</h1><p>Logged in as: <strong>{user.username}</strong></p><p>Role: {user.role}</p>
    <div className="placeholder">Game will be here.</div><button className="secondary" onClick={onLogout}>Logout</button>
  </section></main>
}
