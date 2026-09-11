import Editor, { type OnMount } from '@monaco-editor/react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apiRequest } from '../api/client'
import type { PythonRunner } from '../python/PythonRunner'
import type { GamePythonBridge } from '../game/GamePythonBridge'
import type { PythonRuntimeState } from '../python/pythonProtocol'
import { bindEditorKeyboardFocus } from './editorKeyboardFocus'
import { debugSwitches, DevTiming, devCount, devDiagnosticsEnabled } from '../devDiagnostics'

type CodeResponse = { code: string }
type SaveState = 'loading' | 'saved' | 'unsaved' | 'saving'
type MonacoEditor = Parameters<OnMount>[0]

type CodeAreaProps = {
  runner: PythonRunner
  bridge: GamePythonBridge
  gameOutput: string
  isOpen: boolean
  onClose: () => void
  onEditorFocusChange: (focused: boolean) => void
}

const CodeEditor = memo(function CodeEditor({ initialCode, editorRef, onChange, onMount }: {
  initialCode: string
  editorRef: React.MutableRefObject<MonacoEditor | null>
  onChange: () => void
  onMount: OnMount
}) {
  const renderCount = useRef(0)
  if (devDiagnosticsEnabled) devCount('CodeEditor render', ++renderCount.current)
  const options = useMemo(() => ({
    minimap: { enabled: false },
    codeLens: false,
    quickSuggestions: false,
    suggestOnTriggerCharacters: false,
    parameterHints: { enabled: false },
    inlineSuggest: { enabled: false },
    automaticLayout: true,
    fontSize: 14,
    lineNumbers: 'on' as const,
    insertSpaces: true,
    tabSize: 4,
    detectIndentation: false,
    renderValidationDecorations: debugSwitches.disableDecorations ? 'off' as const : 'on' as const,
  }), [])

  return <Editor
    language="python"
    theme="vs-dark"
    defaultValue={initialCode}
    loading="Loading editor…"
    onChange={onChange}
    onMount={(editor, monaco) => {
      editorRef.current = editor
      onMount(editor, monaco)
    }}
    options={options}
  />
})

export const CodeArea = memo(function CodeArea({ runner, bridge, gameOutput, isOpen, onClose, onEditorFocusChange }: CodeAreaProps) {
  const editorRef = useRef<MonacoEditor | null>(null)
  const statusRef = useRef<HTMLSpanElement | null>(null)
  const saveStateRef = useRef<SaveState>('loading')
  const renderCount = useRef(0)
  const changeCount = useRef(0)
  const lastKeyDown = useRef<number | null>(null)
  const changeTiming = useRef(new DevTiming('Monaco onChange')).current
  const keyTiming = useRef(new DevTiming('keydown -> Monaco callback complete')).current
  const [initialCode, setInitialCode] = useState<string | null>(null)
  const [state, setState] = useState<SaveState>('loading')
  const [error, setError] = useState('')
  const [runtimeState, setRuntimeState] = useState<PythonRuntimeState>(runner.runtimeState)
  const [isRunning, setIsRunning] = useState(false)
  const [output, setOutput] = useState('')

  if (import.meta.env.DEV && devDiagnosticsEnabled) devCount('CodeArea render', ++renderCount.current)

  useEffect(() => {
    const unsubscribe = runner.subscribe(setRuntimeState)
    return () => {
      unsubscribe()
    }
  }, [runner])

  useEffect(() => {
    apiRequest<CodeResponse>('/game/code')
      .then(({ code }) => {
        setInitialCode(code)
        saveStateRef.current = 'saved'
        setState('saved')
      })
      .catch((reason: Error) => {
        setInitialCode('')
        setError(`Could not load player.py: ${reason.message}`)
        saveStateRef.current = 'unsaved'
        setState('unsaved')
      })
  }, [])

  const handleEditorChange = useCallback(() => {
    const started = devDiagnosticsEnabled ? performance.now() : 0
    // Keep keystrokes entirely inside Monaco: refs and this DOM label do not render React.
    saveStateRef.current = 'unsaved'
    if (statusRef.current) {
      statusRef.current.textContent = 'Unsaved changes'
      statusRef.current.classList.remove('error')
    }
    if (devDiagnosticsEnabled) {
      changeCount.current += 1
      const completed = performance.now()
      changeTiming.add(completed - started)
      if (lastKeyDown.current !== null) keyTiming.add(completed - lastKeyDown.current)
      console.debug(`[diagnostics] Monaco onChange #${changeCount.current}`)
      lastKeyDown.current = null
    }
  }, [changeTiming, keyTiming])

  const handleMount = useCallback<OnMount>((editor) => {
    const focusBinding = bindEditorKeyboardFocus(editor, onEditorFocusChange)
    const keyBinding = devDiagnosticsEnabled ? editor.onKeyDown(() => { lastKeyDown.current = performance.now() }) : null
    editor.onDidDispose(() => {
      editorRef.current = null
      focusBinding.dispose()
      keyBinding?.dispose()
    })
  }, [onEditorFocusChange])

  const readCode = useCallback(() => editorRef.current?.getValue() ?? initialCode ?? '', [initialCode])

  const save = useCallback(async () => {
    saveStateRef.current = 'saving'
    setState('saving')
    setError('')
    try {
      await apiRequest<CodeResponse>('/game/code', {
        method: 'PUT',
        body: JSON.stringify({ code: readCode() }),
      })
      saveStateRef.current = 'saved'
      setState('saved')
    } catch (reason) {
      setError(`Could not save player.py: ${(reason as Error).message}`)
      saveStateRef.current = 'unsaved'
      setState('unsaved')
    }
  }, [readCode])

  const run = useCallback(async () => {
    setIsRunning(true)
    setOutput('')
    try {
      const execution = await runner.run(readCode())
      setOutput([execution.stdout, execution.result].filter(Boolean).join('\n'))
    } catch (reason) {
      const executionError = reason as Error & { stdout?: string }
      setOutput([executionError.stdout, executionError.message].filter(Boolean).join('\n'))
    } finally {
      setIsRunning(false)
    }
  }, [readCode, runner])

  const apply = useCallback(async () => {
    setIsRunning(true)
    setOutput('')
    await bridge.apply(readCode())
    setIsRunning(false)
  }, [bridge, readCode])

  const displayedState = saveStateRef.current
  const status = { loading: 'Loading…', saved: 'Saved', unsaved: 'Unsaved changes', saving: 'Saving…' }[displayedState]
  const displayedError = displayedState === 'unsaved' ? '' : error

  return <section className="code-panel" aria-labelledby="code-title" hidden={!isOpen}>
    <div className="code-panel-header">
      <h2 id="code-title">player.py</h2>
      <button className="code-panel-close secondary" type="button" onClick={onClose} aria-label="Close player.py editor">Close</button>
    </div>
    <div className="code-editor">
      {initialCode !== null && <CodeEditor initialCode={initialCode} editorRef={editorRef} onChange={handleEditorChange} onMount={handleMount} />}
    </div>
    <div className="code-actions">
      <button onClick={save} disabled={state === 'loading' || state === 'saving'}>Save</button>
      <button className="secondary" onClick={run} disabled={runtimeState !== 'ready' || isRunning}>{isRunning ? 'Running…' : 'Run'}</button>
      <button className="secondary" onClick={apply} disabled={runtimeState !== 'ready' || isRunning}>Apply</button>
      <span ref={statusRef} className={`save-status ${displayedError ? 'error' : ''}`} aria-live="polite">{displayedError || status}</span>
      <span className={`python-status ${runtimeState === 'error' ? 'error' : ''}`} aria-live="polite">
        {runtimeState === 'loading' && 'Loading Python…'}
        {runtimeState === 'ready' && 'Python ready'}
        {runtimeState === 'error' && <>Python failed to load: {runner.runtimeError}</>}
      </span>
      {runtimeState === 'error' && <button className="secondary" type="button" onClick={() => runner.retry()}>Retry</button>}
    </div>
    <section className="output-panel" aria-labelledby="output-title"><h3 id="output-title">OUTPUT</h3><pre aria-live="polite">{gameOutput || output}</pre></section>
  </section>
})
