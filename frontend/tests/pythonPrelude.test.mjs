import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { buildGamePrelude } from '../.test-dist/python/pythonPrelude.js'

const position = { x: 10, y: 20 }
const allReleased = { up: false, down: false, left: false, right: false }

function execute(keys, program) {
  const source = `${buildGamePrelude(keys, position)}\n${program}\nprint(json.dumps({'x': x, 'y': y, 'right': key_pressed('right'), 'unknown': key_pressed('missing')}))`
  const result = spawnSync('python3', ['-c', source], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  return JSON.parse(result.stdout)
}

test('all false and unknown keyboard keys are Python False', () => {
  assert.deepEqual(execute(allReleased, 'pass'), { x: 10, y: 20, right: false, unknown: false })
})

test('a true right key is a Python bool and can control game code', () => {
  assert.deepEqual(execute({ ...allReleased, right: true }, 'if key_pressed("right"):\n    x += 3'),
    { x: 13, y: 20, right: true, unknown: false })
})

test('multiple pressed keys survive safe JSON decoding', () => {
  const value = execute({ ...allReleased, right: true, up: true }, 'if key_pressed("up"):\n    y -= 3')
  assert.deepEqual(value, { x: 10, y: 17, right: true, unknown: false })
})
