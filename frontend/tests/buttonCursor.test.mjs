import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const stylesheet = await readFile(new URL('../src/styles/global.css', import.meta.url), 'utf8')

const declarationFor = (selector) => {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return stylesheet.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`))?.[1] ?? ''
}

test('buttons use actionable and disabled cursor styles without busy cursors', () => {
  assert.match(declarationFor('button'), /cursor\s*:\s*pointer\s*;/)
  assert.match(declarationFor('button:disabled'), /cursor\s*:\s*not-allowed\s*;/)
  assert.doesNotMatch(stylesheet, /cursor\s*:\s*(?:wait|progress)\b/)
})
