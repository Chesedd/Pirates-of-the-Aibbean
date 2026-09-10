import Editor from '@monaco-editor/react'
import { useEffect, useState } from 'react'
import { apiRequest } from '../api/client'

type CodeResponse = { code: string }
type SaveState = 'loading' | 'saved' | 'unsaved' | 'saving'

export function CodeArea() {
  const [code, setCode] = useState('')
  const [state, setState] = useState<SaveState>('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    apiRequest<CodeResponse>('/game/code')
      .then(({ code: savedCode }) => {
        setCode(savedCode)
        setState('saved')
      })
      .catch((reason: Error) => {
        setError(`Could not load player.py: ${reason.message}`)
        setState('unsaved')
      })
  }, [])

  const save = async () => {
    setState('saving')
    setError('')
    try {
      const saved = await apiRequest<CodeResponse>('/game/code', {
        method: 'PUT',
        body: JSON.stringify({ code }),
      })
      setCode(saved.code)
      setState('saved')
    } catch (reason) {
      setError(`Could not save player.py: ${(reason as Error).message}`)
      setState('unsaved')
    }
  }

  const status = {
    loading: 'Loading…',
    saved: 'Saved',
    unsaved: 'Unsaved changes',
    saving: 'Saving…',
  }[state]

  return (
    <section className="code-panel" aria-labelledby="code-title">
      <h2 id="code-title">player.py</h2>
      <div className="code-editor">
        <Editor
          language="python"
          theme="vs-dark"
          value={code}
          loading="Loading editor…"
          onChange={(value) => {
            setCode(value ?? '')
            setState('unsaved')
            setError('')
          }}
          options={{ minimap: { enabled: false }, automaticLayout: true, fontSize: 14 }}
        />
      </div>
      <div className="code-actions">
        <button onClick={save} disabled={state === 'loading' || state === 'saving'}>Save</button>
        <span className={`save-status ${error ? 'error' : ''}`} aria-live="polite">
          {error || status}
        </span>
      </div>
    </section>
  )
}
