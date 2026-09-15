import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveTopDownMovement, MAX_MOVEMENT_SUBSTEP } from '../.test-dist/game/movement/TopDownMovementResolver.js'
import { PLAYER_COLLISION_RADIUS } from '../.test-dist/game/player/playerConfig.js'

const world = (...colliders) => ({ colliders })
test('circle contact preserves tangential barrel movement', () => {
  const next = resolveTopDownMovement({ x: -20, y: -12 }, { x: 20, y: -12 }, world({ kind: 'circle', id: 'barrel', x: 0, y: 0, radius: 10 }), 3)
  assert.ok(next.x > -10, `slid to ${next.x}`)
  assert.ok(Math.hypot(next.x, next.y) >= 13 - 1e-3)
})
test('rectangle corner slides instead of stopping', () => {
  const previous = { x: -8, y: -8 }
  const next = resolveTopDownMovement(previous, { x: 8, y: 4 }, world({ kind: 'rect', id: 'table', x: 0, y: 0, width: 10, height: 10 }), 3)
  assert.notDeepEqual(next, previous)
  assert.ok(next.x < 0 || next.y < 0)
})
test('oriented rail provides a rotated sliding normal', () => {
  const rail = { kind: 'orientedRect', id: 'rail', x: 0, y: 0, halfWidth: 30, halfHeight: 2, angle: Math.PI / 4 }
  const next = resolveTopDownMovement({ x: -15, y: -8 }, { x: 15, y: 8 }, world(rail), 3)
  assert.ok(Math.hypot(next.x + 15, next.y + 8) > 1)
})
test('substeps prevent tunnelling through a thin obstacle', () => {
  assert.equal(MAX_MOVEMENT_SUBSTEP, 3)
  const next = resolveTopDownMovement({ x: -20, y: 0 }, { x: 20, y: 0 }, world({ kind: 'rect', id: 'wall', x: 0, y: -20, width: 1, height: 40 }), 2)
  assert.ok(next.x < 0)
})
test('player footprint is the shared compact radius', () => assert.equal(PLAYER_COLLISION_RADIUS, 12.5))
