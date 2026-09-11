import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const codeArea = await readFile(new URL('../src/components/CodeArea.tsx', import.meta.url), 'utf8')

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
