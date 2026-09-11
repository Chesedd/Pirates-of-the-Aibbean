import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const codeArea = await readFile(new URL('../src/components/CodeArea.tsx', import.meta.url), 'utf8')
const diagnostics = await readFile(new URL('../src/devDiagnostics.ts', import.meta.url), 'utf8')
const userPage = await readFile(new URL('../src/pages/UserPage.tsx', import.meta.url), 'utf8')

test('Run and Apply require a ready Python runtime', () => {
  assert.equal((codeArea.match(/disabled=\{runtimeState !== 'ready' \|\| isRunning\}/g) ?? []).length, 2)
})

test('the Python status presents loading, ready, failure details, and Retry', () => {
  assert.match(codeArea, /Loading Python…/)
  assert.match(codeArea, /Python ready/)
  assert.match(codeArea, /Python failed to load: \{runner\.runtimeError\}/)
  assert.match(codeArea, />\s*Retry\s*</)
})

test('player.py uses an uncontrolled Monaco editor and reads code only for explicit actions', () => {
  assert.match(codeArea, /defaultValue=\{initialCode\}/)
  assert.doesNotMatch(codeArea, /<Editor[\s\S]*?\svalue=\{/)
  assert.match(codeArea, /const editorRef = useRef/)
  assert.match(codeArea, /editorRef\.current\?\.getValue\(\)/)
  assert.doesNotMatch(codeArea, /setCode\(/)

  const changeHandler = codeArea.slice(codeArea.indexOf('const handleEditorChange'), codeArea.indexOf('const handleMount'))
  assert.doesNotMatch(changeHandler, /setState|apiRequest|runner\.|bridge\./)
})

test('the editor disables expensive Monaco features and exposes development diagnostics', () => {
  assert.match(codeArea, /codeLens: false/)
  assert.match(codeArea, /quickSuggestions: false/)
  assert.match(codeArea, /suggestOnTriggerCharacters: false/)
  assert.match(codeArea, /minimap: \{ enabled: false \}/)
  assert.match(codeArea, /import\.meta\.env\.DEV/)
  assert.match(codeArea, /Monaco onChange/)
})

test('development switches isolate textarea, minimal Monaco, canvas, UI, and automatic layout', () => {
  for (const query of ['disableEditor', 'minimalEditor', 'disableCanvas', 'editorOnly', 'disableAutomaticLayout']) {
    assert.match(diagnostics, new RegExp(`query\\.get\\('${query}'\\)`))
  }
  assert.match(codeArea, /<textarea className="plain-code-editor" defaultValue=\{initialCode\}/)
  assert.match(codeArea, /function MinimalCodeEditor[\s\S]*?<Editor theme="vs-dark" defaultValue=\{initialCode\}/)
  assert.match(codeArea, /automaticLayout: !debugSwitches\.disableAutomaticLayout/)
  assert.match(userPage, /!debugSwitches\.disableCanvas && <GameCanvas/)
})

test('input latency probe reports native input and next-paint samples without React state', () => {
  assert.match(diagnostics, /host\.addEventListener\('keydown'/)
  assert.match(diagnostics, /host\.addEventListener\('input'/)
  assert.match(diagnostics, /requestAnimationFrame/)
  assert.match(diagnostics, /input avg .* p95 .* next paint avg .* p95/)
})
