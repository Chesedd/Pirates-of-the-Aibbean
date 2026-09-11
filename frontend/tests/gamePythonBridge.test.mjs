import assert from 'node:assert/strict'
import test from 'node:test'
import { GamePythonBridge, MAX_TICK_MOVE } from '../.test-dist/game/GamePythonBridge.js'
import { generateIslandGeometry, ISLAND_CENTER } from '../.test-dist/game/islandGeometry.js'

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

test('locked movement still runs player Python but preserves coordinates', async () => {
  let ticks = 0
  const runner = { apply: async () => {}, tick: async () => { ticks += 1; return { x: 120, y: 80, stdout: '' } } }
  const bridge = new GamePythonBridge(runner)
  bridge.setMovementUnlocked(false)
  await bridge.apply('x += 20')
  assert.deepEqual(await bridge.tick(keys, position), position)
  assert.equal(ticks, 1)
})

test('movement starts working without reapplying player code after unlock', async () => {
  const runner = { apply: async () => {}, tick: async () => ({ x: 110, y: 100, stdout: '' }) }
  const bridge = new GamePythonBridge(runner)
  bridge.setMovementUnlocked(false)
  await bridge.apply('x += 10')
  assert.deepEqual(await bridge.tick(keys, position), position)
  bridge.setMovementUnlocked(true)
  assert.deepEqual(await bridge.tick(keys, position), { x: 110, y: 100 })
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

function collisionBridge(move) {
  const bridge = new GamePythonBridge({
    apply: async () => {},
    tick: async (_keys, current) => ({ ...move(current), stdout: '' }),
  })
  bridge.setIslandGeometry(generateIslandGeometry(42))
  return bridge
}

test('movement within the island is accepted', async () => {
  const bridge = collisionBridge(({ x, y }) => ({ x: x + 10, y }))
  await bridge.apply('move')
  assert.deepEqual(await bridge.tick(keys, { x: ISLAND_CENTER, y: ISLAND_CENTER }),
    { x: ISLAND_CENTER + 10, y: ISLAND_CENTER })
})

test('an attempt to cross the coast is rejected at the last valid position', async () => {
  const coastline = generateIslandGeometry(42)
  const shore = coastline.reduce((rightmost, point) => point.x > rightmost.x ? point : rightmost)
  const positionNearShore = { x: shore.x - 1, y: shore.y }
  const bridge = collisionBridge(() => ({ x: shore.x + 1000, y: shore.y }))
  await bridge.apply('escape')
  assert.deepEqual(await bridge.tick(keys, positionNearShore), positionNearShore)
})

test('movement parallel to the coast remains available', async () => {
  const coastline = generateIslandGeometry(42)
  const shore = coastline.reduce((rightmost, point) => point.x > rightmost.x ? point : rightmost)
  const positionNearShore = { x: shore.x - 25, y: shore.y }
  const bridge = collisionBridge(({ x, y }) => ({ x, y: y + 10 }))
  await bridge.apply('along coast')
  assert.deepEqual(await bridge.tick(keys, positionNearShore), { x: positionNearShore.x, y: positionNearShore.y + 10 })
})
