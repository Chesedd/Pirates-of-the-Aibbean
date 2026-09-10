import Editor from '@monaco-editor/react'
import { useEffect, useState } from 'react'
import { apiRequest } from '../api/client'
import { createBrowserPythonRunner } from '../python/PythonRunner'
import type { PythonRuntimeState } from '../python/pythonProtocol'

type CodeResponse = { code: string }
type SaveState = 'loading' | 'saved' | 'unsaved' | 'saving'

export function CodeArea() {
  const [code, setCode] = useState('')
  const [state, setState] = useState<SaveState>('loading')
  const [error, setError] = useState('')
  const [runner] = useState(() => createBrowserPythonRunner())
  const [runtimeState, setRuntimeState] = useState<PythonRuntimeState>(runner.runtimeState)
  const [isRunning, setIsRunning] = useState(false)
  const [output, setOutput] = useState('')

  useEffect(() => {
    const unsubscribe = runner.subscribe(setRuntimeState)
    return () => {
      unsubscribe()
      runner.dispose()
    }
  }, [runner])

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

  const run = async () => {
    setIsRunning(true)
    setOutput('')
    try {
      const execution = await runner.run(code)
      setOutput([execution.stdout, execution.result].filter(Boolean).join('\n'))
    } catch (reason) {
      const executionError = reason as Error & { stdout?: string }
      setOutput([executionError.stdout, executionError.message].filter(Boolean).join('\n'))
    } finally {
      setIsRunning(false)
    }
  }

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
        <button
          className="secondary"
          onClick={run}
          disabled={runtimeState !== 'ready' || isRunning}
        >
          {isRunning ? 'Running…' : 'Run'}
        </button>
        <span className={`save-status ${error ? 'error' : ''}`} aria-live="polite">
          {error || status}
        </span>
        <span className="python-status" aria-live="polite">
          {runtimeState === 'loading' ? 'Loading Python…' : 'Python ready'}
        </span>
      </div>
      <section className="output-panel" aria-labelledby="output-title">
        <h3 id="output-title">OUTPUT</h3>
        <pre aria-live="polite">{output}</pre>
      </section>
    </section>
  )
}
