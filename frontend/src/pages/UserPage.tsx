import { useCallback, useEffect, useState } from 'react'
import { apiRequest } from '../api/client'
import type { User } from '../app/App'
import { GameCanvas } from '../game/GameCanvas'
import { CodeArea } from '../components/CodeArea'
import { createBrowserPythonRunner } from '../python/PythonRunner'
import { GamePythonBridge } from '../game/GamePythonBridge'

export type Island = { id: number; generation_seed: number; player: { x: number; y: number } }
export type Progress = { unlocks: string[] }
type PythonRuntime = { runner: ReturnType<typeof createBrowserPythonRunner>; bridge: GamePythonBridge }

export function UserPage({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [island, setIsland] = useState<Island | null>(null)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [journalOpen, setJournalOpen] = useState(false)
  const [error, setError] = useState('')
  const [output, setOutput] = useState('')
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [isEditorFocused, setIsEditorFocused] = useState(false)
  const [runtime, setRuntime] = useState<PythonRuntime | null>(null)

  useEffect(() => {
    const runner = createBrowserPythonRunner()
    let lastSave = 0
    const bridge = new GamePythonBridge(runner, setOutput, (position) => {
      if (Date.now() - lastSave < 5_000) return
      lastSave = Date.now()
      void apiRequest('/game/position', { method: 'PUT', body: JSON.stringify(position) })
    })
    const nextRuntime = { runner, bridge }
    setRuntime(nextRuntime)
    return () => {
      bridge.dispose()
      runner.dispose()
      setRuntime((current) => current === nextRuntime ? null : current)
    }
  }, [])

  useEffect(() => {
    Promise.all([apiRequest<Island>('/game/island'), apiRequest<Progress>('/game/progress')])
      .then(([loadedIsland, loadedProgress]) => {
        setIsland(loadedIsland)
        setProgress(loadedProgress)
      }).catch((reason: Error) => setError(reason.message))
  }, [])

  const movementUnlocked = progress?.unlocks.includes('movement') ?? false
  useEffect(() => runtime?.bridge.setMovementUnlocked(movementUnlocked), [runtime, movementUnlocked])

  const openEditor = useCallback(() => setIsEditorOpen(true), [])
  const openJournal = useCallback(() => setJournalOpen(true), [])

  return <main className="game-page">
    <header className="game-header">
      <div><h1>{movementUnlocked ? 'Your island' : 'Разбитый корабль'}</h1><p>Captain <strong>{user.username}</strong></p></div>
      <button className="secondary" onClick={onLogout}>Logout</button>
    </header>
    <div className={`game-workspace ${isEditorOpen ? 'editor-open' : ''}`}>
      <div className="game-pane">
        {error && <p className="error game-status">Could not load the island: {error}</p>}
        {!error && (!island || !progress) && <p className="game-status">Charting your course…</p>}
        {island && progress && runtime && <GameCanvas
          island={island}
          bridge={runtime.bridge}
          username={user.username}
          keyboardEnabled={!isEditorFocused}
          onPlayerClick={openEditor}
          movementUnlocked={movementUnlocked}
          onJournalClick={openJournal}
        />}
        {journalOpen && <div className="journal-backdrop" role="presentation" onClick={() => setJournalOpen(false)}>
          <section className="journal-dialog" role="dialog" aria-modal="true" aria-labelledby="journal-title" onClick={(event) => event.stopPropagation()}>
            <h2 id="journal-title">Судовой журнал</h2>
            <p>Записи сильно пострадали после кораблекрушения.</p>
            <button type="button" onClick={() => setJournalOpen(false)}>Закрыть</button>
          </section>
        </div>}
      </div>
      {runtime ? <CodeArea
        runner={runtime.runner}
        bridge={runtime.bridge}
        gameOutput={output}
        isOpen={isEditorOpen}
        onClose={() => {
          setIsEditorFocused(false)
          setIsEditorOpen(false)
        }}
        onEditorFocusChange={setIsEditorFocused}
      /> : <p className="python-status" aria-live="polite">Loading Python…</p>}
    </div>
  </main>
}
