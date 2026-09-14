import assert from 'node:assert/strict'
import test from 'node:test'
import { ISLAND_CENTER } from '../.test-dist/game/islandGeometry.js'
import {
  createWreckLayout,
  isWreckPositionWalkable,
  resolveWreckMovement,
  wreckLocalToWorld,
} from '../.test-dist/game/wreckGeometry.js'

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

test('deck interiors and companionway approach are walkable', () => {
  const layout = createWreckLayout(42, anchor)
  for (const local of [[70, 30], [-235, 35], [-145, 0]]) {
    assert.equal(isWreckPositionWalkable(wreckLocalToWorld(anchor, layout.angle, ...local), layout), true)
  }
  assert.equal(layout.colliders.some(({ id }) => id === 'main-hull'), false)
})

test('real deck obstacles and hull sides are blocked, but nearby ground is not', () => {
  const layout = createWreckLayout(42, anchor)
  for (const local of [[8, -6], [-77, 0], [-205, -125]]) {
    assert.equal(isWreckPositionWalkable(wreckLocalToWorld(anchor, layout.angle, ...local), layout), false)
  }
  assert.equal(isWreckPositionWalkable(wreckLocalToWorld(anchor, layout.angle, -50, -190), layout), true)
})

test('gangway is a continuous walkable route onto the deck', () => {
  const layout = createWreckLayout(42, anchor)
  for (const local of [[117, 242], [117, 205], [117, 170], [117, 139], [117, 95]]) {
    assert.equal(isWreckPositionWalkable(wreckLocalToWorld(anchor, layout.angle, ...local), layout), true)
  }
})

test('a persisted player on the formerly solid deck can move normally', () => {
  const layout = createWreckLayout(42, anchor)
  const previous = wreckLocalToWorld(anchor, layout.angle, 70, 30)
  const target = { x: previous.x + 8, y: previous.y }
  assert.deepEqual(resolveWreckMovement(previous, target, layout), target)
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
