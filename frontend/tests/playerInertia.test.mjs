import assert from 'node:assert/strict'
import test from 'node:test'
import { PLAYER_ACCELERATION, PLAYER_BRAKING, PLAYER_MAX_SPEED, PLAYER_TURN_ACCELERATION, stepPlayerVelocity } from '../.test-dist/game/movement/PlayerInertia.js'

test('player accelerates progressively and reaches maximum speed', () => {
  const first = stepPlayerVelocity({ x: 0, y: 0 }, { x: PLAYER_MAX_SPEED, y: 0 }, .016)
  assert.ok(first.x > 0 && first.x < PLAYER_MAX_SPEED)
  let velocity = { x: 0, y: 0 }
  for (let i = 0; i < 30; i++) velocity = stepPlayerVelocity(velocity, { x: PLAYER_MAX_SPEED, y: 0 }, .016)
  assert.equal(velocity.x, PLAYER_MAX_SPEED)
})

test('braking is stronger than acceleration', () => {
  assert.ok(PLAYER_BRAKING > PLAYER_ACCELERATION)
  const accelerated = stepPlayerVelocity({ x: 0, y: 0 }, { x: 160, y: 0 }, .016).x
  const remaining = stepPlayerVelocity({ x: 160, y: 0 }, { x: 0, y: 0 }, .016).x
  assert.ok(160 - remaining > accelerated)
})

test('reversal uses faster turn acceleration', () => {
  assert.ok(PLAYER_TURN_ACCELERATION > PLAYER_ACCELERATION)
  assert.equal(stepPlayerVelocity({ x: 80, y: 0 }, { x: -160, y: 0 }, .01).x, 58)
})
