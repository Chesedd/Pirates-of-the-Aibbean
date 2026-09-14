import assert from 'node:assert/strict'
import test from 'node:test'
import { ISLAND_CENTER } from '../.test-dist/game/islandGeometry.js'
import { createWreckLayout, isWreckPositionWalkable } from '../.test-dist/game/wreckGeometry.js'

const anchor = { x: 900, y: 2400 }

test('wreck layout is deterministic, large, and has a marked entrance', () => {
  const first = createWreckLayout(12345, anchor)
  assert.deepEqual(first, createWreckLayout(12345, anchor))
  assert.notDeepEqual(first, createWreckLayout(54321, anchor))
  assert.ok(first.length >= 400)
  assert.ok(first.width >= 150)
  assert.ok(Number.isFinite(first.entrance.x) && Number.isFinite(first.entrance.y))
  assert.equal(isWreckPositionWalkable(first.entranceApproach, first), true)
  assert.ok(Math.hypot(first.entrance.x - first.entranceApproach.x, first.entrance.y - first.entranceApproach.y) > 50)
})

test('main hull is solid, while clear routes remain around both ends', () => {
  const layout = createWreckLayout(42, anchor)
  const hull = layout.colliders.find(({ id }) => id === 'main-hull')
  assert.ok(hull)
  assert.equal(isWreckPositionWalkable({ x: hull.x, y: hull.y }, layout), false)

  const endA = {
    x: hull.x + Math.cos(layout.angle) * 280,
    y: hull.y + Math.sin(layout.angle) * 280,
  }
  const endB = {
    x: hull.x - Math.cos(layout.angle) * 280,
    y: hull.y - Math.sin(layout.angle) * 280,
  }
  assert.equal(isWreckPositionWalkable(endA, layout), true)
  assert.equal(isWreckPositionWalkable(endB, layout), true)
})

test('the server-style inland spawn remains outside wreck collision', () => {
  for (const seed of [0, 1, 42, 999999999]) {
    const layout = createWreckLayout(seed, anchor)
    const dx = ISLAND_CENTER - anchor.x
    const dy = ISLAND_CENTER - anchor.y
    const length = Math.hypot(dx, dy)
    const spawn = { x: anchor.x + dx / length * 130, y: anchor.y + dy / length * 130 }
    assert.equal(isWreckPositionWalkable(spawn, layout), true)
  }
})
