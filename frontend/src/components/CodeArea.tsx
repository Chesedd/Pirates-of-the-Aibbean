import Editor from '@monaco-editor/react'
import { useEffect, useState } from 'react'
import { apiRequest } from '../api/client'
import type { PythonRunner } from '../python/PythonRunner'
import type { GamePythonBridge } from '../game/GamePythonBridge'
import type { PythonRuntimeState } from '../python/pythonProtocol'
import { bindEditorKeyboardFocus } from './editorKeyboardFocus'

type CodeResponse = { code: string }
type SaveState = 'loading' | 'saved' | 'unsaved' | 'saving'

type CodeAreaProps = {
  runner: PythonRunner
  bridge: GamePythonBridge
  gameOutput: string
  isOpen: boolean
  onClose: () => void
  onEditorFocusChange: (focused: boolean) => void
}

export function CodeArea({ runner, bridge, gameOutput, isOpen, onClose, onEditorFocusChange }: CodeAreaProps) {
  const [code, setCode] = useState('')
  const [state, setState] = useState<SaveState>('loading')
  const [error, setError] = useState('')
  const [runtimeState, setRuntimeState] = useState<PythonRuntimeState>(runner.runtimeState)
  const [isRunning, setIsRunning] = useState(false)
  const [output, setOutput] = useState('')

  useEffect(() => {
    const unsubscribe = runner.subscribe(setRuntimeState)
    return () => {
      unsubscribe()
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

  const apply = async () => {
    setIsRunning(true)
    setOutput('')
    await bridge.apply(code)
    setIsRunning(false)
  }

  return (
    <section className="code-panel" aria-labelledby="code-title" hidden={!isOpen}>
      <div className="code-panel-header">
        <h2 id="code-title">player.py</h2>
        <button className="code-panel-close secondary" type="button" onClick={onClose} aria-label="Close player.py editor">Close</button>
      </div>
      <div className="code-editor">
        <Editor
          language="python"
          theme="vs-dark"
          value={code}
          loading="Loading editor…"
          onChange={(value: string | undefined) => {
            setCode(value ?? '')
            setState('unsaved')
            setError('')
          }}
          onMount={(editor) => {
            const focusBinding = bindEditorKeyboardFocus(editor, onEditorFocusChange)
            editor.onDidDispose(() => focusBinding.dispose())
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
        <button className="secondary" onClick={apply} disabled={runtimeState !== 'ready' || isRunning}>
          Apply
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
        <pre aria-live="polite">{gameOutput || output}</pre>
      </section>
    </section>
  )
}
