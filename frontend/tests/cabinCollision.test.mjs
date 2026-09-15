import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CABIN_OBSTACLES,
  isCabinPositionWalkable,
  resolveCabinMovement,
} from '../.test-dist/game/cabinCollision.js'

test('substantial cabin furniture has explicit logical collision shapes', () => {
  assert.deepEqual(CABIN_OBSTACLES.map(({ id }) => id), ['hammock', 'barrel', 'table', 'chest'])
  assert.equal(isCabinPositionWalkable(705, 300, false), false, 'table')
  assert.equal(isCabinPositionWalkable(182, 408, false), false, 'chest')
  assert.equal(isCabinPositionWalkable(744, 130, false), false, 'barrel')
  assert.equal(isCabinPositionWalkable(190, 150, false), false, 'hammock')
})

test('the player can approach the journal and hatch without crossing furniture', () => {
  assert.equal(isCabinPositionWalkable(705, 195, false), true, 'journal-side of table')
  assert.equal(isCabinPositionWalkable(470, 470, false), true, 'hatch approach')
  assert.equal(isCabinPositionWalkable(470, 540, false), false, 'locked hatch')
  assert.equal(isCabinPositionWalkable(470, 540, true), true, 'unlocked exit passage')
})

test('collision is resolved at the logical target and slides along obstacles', () => {
  const previous = { x: 580, y: 210 }
  const slid = resolveCabinMovement(previous, { x: 630, y: 250 }, false)
  assert.notDeepEqual(slid, previous)
  assert.equal(isCabinPositionWalkable(slid.x, slid.y, false), true)
  assert.deepEqual(resolveCabinMovement({ x: 470, y: 300 }, { x: 490, y: 300 }, false), { x: 490, y: 300 })
})

test('all first movement steps from the tutorial spawn are walkable after movement unlock', () => {
  const spawn = { x: 470, y: 300 }
  for (const target of [
    { x: 470, y: 292 }, // W
    { x: 470, y: 308 }, // S
    { x: 462, y: 300 }, // A
    { x: 478, y: 300 }, // D
  ]) {
    assert.equal(isCabinPositionWalkable(target.x, target.y, true), true)
    assert.deepEqual(resolveCabinMovement(spawn, target, true), target)
  }
})
