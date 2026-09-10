import assert from 'node:assert/strict'
import test from 'node:test'
import { GamePythonBridge, MAX_TICK_MOVE } from '../.test-dist/game/GamePythonBridge.js'

const keys = { up: false, down: false, left: false, right: false }
const position = { x: 100, y: 100 }

test('empty/pass behavior leaves the position unchanged', async () => {
  const bridge = new GamePythonBridge({ apply: async () => {}, tick: async () => ({ ...position, stdout: '' }) })
  await bridge.apply('')
  assert.deepEqual(await bridge.tick(keys, position), position)
})

test('right-hand Python behavior moves only when right is pressed', async () => {
  const runner = { apply: async () => {}, tick: async (pressed, current) => ({ ...current, x: current.x + (pressed.right ? 3 : 0), stdout: '' }) }
  const bridge = new GamePythonBridge(runner)
  await bridge.apply('right behavior')
  assert.deepEqual(await bridge.tick({ ...keys, right: true }, position), { x: 103, y: 100 })
  assert.deepEqual(await bridge.tick(keys, position), position)
})

test('Python errors disable behavior without throwing into the game', async () => {
  const messages = []
  const bridge = new GamePythonBridge({ apply: async () => {}, tick: async () => { throw new Error('boom') } }, (message) => messages.push(message))
  await bridge.apply('bad')
  assert.equal(await bridge.tick(keys, position), null)
  assert.equal(await bridge.tick(keys, position), null)
  assert.deepEqual(messages.filter(Boolean), ['boom'])
})

test('non-finite coordinates are rejected', async () => {
  for (const bad of [NaN, Infinity]) {
    const bridge = new GamePythonBridge({ apply: async () => {}, tick: async () => ({ x: bad, y: 1, stdout: '' }) })
    await bridge.apply('bad')
    assert.equal(await bridge.tick(keys, position), null)
  }
})

test('excessive movement is clamped', async () => {
  const bridge = new GamePythonBridge({ apply: async () => {}, tick: async () => ({ x: 999999, y: -999999, stdout: '' }) })
  await bridge.apply('jump')
  assert.deepEqual(await bridge.tick(keys, position), { x: position.x + MAX_TICK_MOVE, y: position.y - MAX_TICK_MOVE })
})

test('concurrent ticks are dropped instead of queued', async () => {
  let finish
  let calls = 0
  const bridge = new GamePythonBridge({ apply: async () => {}, tick: async () => { calls++; return new Promise((resolve) => { finish = resolve }) } })
  await bridge.apply('slow')
  const first = bridge.tick(keys, position)
  assert.equal(await bridge.tick(keys, position), null)
  assert.equal(calls, 1)
  finish({ ...position, stdout: '' })
  await first
})
