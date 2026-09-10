import { useCallback, useEffect, useState } from 'react'
import { apiRequest } from '../api/client'
import type { User } from '../app/App'
import { GameCanvas } from '../game/GameCanvas'
import { CodeArea } from '../components/CodeArea'
import { createBrowserPythonRunner } from '../python/PythonRunner'
import { GamePythonBridge } from '../game/GamePythonBridge'

export type Island = { id: number; generation_seed: number; player: { x: number; y: number } }
export function UserPage({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [island, setIsland] = useState<Island | null>(null)
  const [error, setError] = useState('')
  const [output, setOutput] = useState('')
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [isEditorFocused, setIsEditorFocused] = useState(false)
  const [runner] = useState(() => createBrowserPythonRunner())
  const [bridge] = useState(() => {
    let lastSave = 0
    return new GamePythonBridge(runner, setOutput, (position) => {
      if (Date.now() - lastSave < 5_000) return
      lastSave = Date.now()
      void apiRequest('/game/position', { method: 'PUT', body: JSON.stringify(position) })
    })
  })

  useEffect(() => () => runner.dispose(), [runner])

  useEffect(() => {
    apiRequest<Island>('/game/island').then(setIsland).catch((reason: Error) => setError(reason.message))
  }, [])

  const openEditor = useCallback(() => setIsEditorOpen(true), [])

  return <main className="game-page">
    <header className="game-header">
      <div><h1>Your island</h1><p>Captain <strong>{user.username}</strong></p></div>
      <button className="secondary" onClick={onLogout}>Logout</button>
    </header>
    <div className={`game-workspace ${isEditorOpen ? 'editor-open' : ''}`}>
      <div className="game-pane">
        {error && <p className="error game-status">Could not load the island: {error}</p>}
        {!error && !island && <p className="game-status">Charting your island…</p>}
        {island && <GameCanvas
          island={island}
          bridge={bridge}
          username={user.username}
          keyboardEnabled={!isEditorFocused}
          onPlayerClick={openEditor}
        />}
      </div>
      <CodeArea
        runner={runner}
        bridge={bridge}
        gameOutput={output}
        isOpen={isEditorOpen}
        onClose={() => {
          setIsEditorFocused(false)
          setIsEditorOpen(false)
        }}
        onEditorFocusChange={setIsEditorFocused}
      />
    </div>
  </main>
}
