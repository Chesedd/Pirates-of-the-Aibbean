import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const stylesheet = await readFile(new URL('../src/styles/global.css', import.meta.url), 'utf8')

function rule(selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return stylesheet.match(new RegExp(`${escapedSelector}\\s*\\{([^}]+)\\}`))?.[1] ?? ''
}

test('journal backdrop dims the game without filtering the viewport', () => {
  const declarations = rule('.journal-backdrop')

  assert.match(declarations, /background\s*:/)
  assert.doesNotMatch(declarations, /(?:backdrop-)?filter\s*:/)
})

test('journal success feedback does not transform the editor spread', () => {
  assert.doesNotMatch(rule('.journal-spread'), /transition\s*:[^;}]*(?:transform|\ball\b)/)
  assert.doesNotMatch(rule('.journal-success'), /transform\s*:/)
})
