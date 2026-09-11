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
