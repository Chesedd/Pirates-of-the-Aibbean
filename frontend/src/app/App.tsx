import { useEffect, useState } from 'react'
import { apiRequest } from '../api/client'
import { AdminPage } from '../pages/AdminPage'
import { LoginPage } from '../pages/LoginPage'
import { UserPage } from '../pages/UserPage'

export type User = { id: number; username: string; role: 'user' | 'admin' }

export function App() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiRequest<User>('/auth/me').then(setUser).catch(() => setUser(null)).finally(() => setLoading(false))
  }, [])

  const logout = async () => {
    await apiRequest<void>('/auth/logout', { method: 'POST' })
    setUser(null)
    history.replaceState(null, '', '/login')
  }

  if (loading) return <main className="auth-shell"><p>Loading…</p></main>
  if (!user) return <LoginPage onLogin={setUser} />
  if (user.role === 'admin') return <AdminPage currentUser={user} onLogout={logout} />
  return <UserPage user={user} onLogout={logout} />
}
