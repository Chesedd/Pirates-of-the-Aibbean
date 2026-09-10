import { useEffect, useState } from 'react'
import { apiRequest } from '../api/client'
import type { User } from '../app/App'
import { GameCanvas } from '../game/GameCanvas'
import { CodeArea } from '../components/CodeArea'

export type Island = { id: number; player: { x: number; y: number } }

export function UserPage({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [island, setIsland] = useState<Island | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    apiRequest<Island>('/game/island').then(setIsland).catch((reason: Error) => setError(reason.message))
  }, [])

  return <main className="game-page">
    <header className="game-header">
      <div><h1>Your island</h1><p>Captain <strong>{user.username}</strong></p></div>
      <button className="secondary" onClick={onLogout}>Logout</button>
    </header>
    <div className="game-workspace">
      <div className="game-pane">
        {error && <p className="error game-status">Could not load the island: {error}</p>}
        {!error && !island && <p className="game-status">Charting your island…</p>}
        {island && <GameCanvas island={island} />}
      </div>
      <CodeArea />
    </div>
  </main>
}
