import { FormEvent, useEffect, useState } from 'react'
import { apiRequest } from '../api/client'
import type { User } from '../app/App'

type ListedUser = User & { created_at: string }

export function AdminPage({ currentUser, onLogout }: { currentUser: User; onLogout: () => void }) {
  const [users, setUsers] = useState<ListedUser[]>([])
  const [message, setMessage] = useState('')
  const loadUsers = () => apiRequest<ListedUser[]>('/admin/users').then(setUsers).catch(error => setMessage(error.message))
  useEffect(() => { void loadUsers() }, [])

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage('')
    const form = event.currentTarget; const data = new FormData(form)
    try {
      await apiRequest<User>('/admin/users', { method: 'POST', body: JSON.stringify(Object.fromEntries(data)) })
      form.reset(); setMessage('User created.'); await loadUsers()
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not create user') }
  }

  return <main className="admin-shell"><header><div><h1>Administration</h1><p>Logged in as: <strong>{currentUser.username}</strong> · Role: admin</p></div><button className="secondary" onClick={onLogout}>Logout</button></header>
    <div className="admin-grid"><section className="card"><h2>Users</h2><table><thead><tr><th>Username</th><th>Role</th><th>Created</th></tr></thead><tbody>{users.map(user => <tr key={user.id}><td>{user.username}</td><td>{user.role}</td><td>{new Date(user.created_at).toLocaleDateString()}</td></tr>)}</tbody></table></section>
    <form className="card" onSubmit={create}><h2>Create user</h2><label>Username<input name="username" minLength={3} maxLength={50} required /></label><label>Temporary password<input name="password" type="password" minLength={8} maxLength={128} required /></label><label>Role<select name="role"><option value="user">user</option><option value="admin">admin</option></select></label>{message && <p role="status">{message}</p>}<button>Create</button></form></div>
  </main>
}
