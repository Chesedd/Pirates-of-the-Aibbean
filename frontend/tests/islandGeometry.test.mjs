import assert from 'node:assert/strict'
import test from 'node:test'
import {
  configureIslandCamera,
  generateIslandGeometry,
  ISLAND_CENTER,
  ISLAND_SIZE,
  pointIsInsideIsland,
  SAFE_SPAWN,
} from '../.test-dist/game/islandGeometry.js'

test('the same seed makes identical geometry and different seeds make different coastlines', () => {
  assert.deepEqual(generateIslandGeometry(123456), generateIslandGeometry(123456))
  assert.notDeepEqual(generateIslandGeometry(123456), generateIslandGeometry(654321))
})

test('the safe spawn is inside every sampled island', () => {
  for (const seed of [0, 1, 42, 999999999]) {
    assert.equal(pointIsInsideIsland(SAFE_SPAWN, generateIslandGeometry(seed)), true)
  }
})

test('the center is land and a distant point is water', () => {
  const coastline = generateIslandGeometry(42)
  assert.equal(pointIsInsideIsland({ x: ISLAND_CENTER, y: ISLAND_CENTER }, coastline), true)
  assert.equal(pointIsInsideIsland({ x: -10_000, y: -10_000 }, coastline), false)
})

test('camera is bounded to the large world and follows the player', () => {
  const calls = []
  const player = {}
  configureIslandCamera({
    setBounds: (...args) => calls.push(['bounds', ...args]),
    startFollow: (...args) => calls.push(['follow', ...args]),
  }, player)
  assert.deepEqual(calls[0], ['bounds', 0, 0, ISLAND_SIZE, ISLAND_SIZE])
  assert.deepEqual(calls[1], ['follow', player, true, 0.12, 0.12])
})
