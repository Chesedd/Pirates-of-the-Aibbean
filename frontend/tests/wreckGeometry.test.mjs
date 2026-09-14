import assert from 'node:assert/strict'
import test from 'node:test'
import { generateIslandGeometry, pointIsInsideIsland } from '../.test-dist/game/islandGeometry.js'
import {
  createWreckLayout,
  findBlockingWreckCollider,
  isWreckPositionWalkable,
  recoverWreckPosition,
  resolveWreckMovement,
  wreckLocalToWorld,
} from '../.test-dist/game/wreckGeometry.js'

const anchor = { x: 900, y: 2400 }

function serverStyleWreckAndSpawn(seed) {
  const coastline = generateIslandGeometry(seed)
  const shore = coastline[(seed >>> 0) % coastline.length]
  const dx = 2600 - shore.x
  const dy = 2600 - shore.y
  const length = Math.hypot(dx, dy)
  const wreck = { x: shore.x + dx / length * 180, y: shore.y + dy / length * 180 }
  return [wreck, createWreckLayout(seed, wreck).entranceApproach]
}

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

test('a persisted position trapped in fixed deck cargo is recovered nearby', () => {
  const coastline = generateIslandGeometry(42)
  const layout = createWreckLayout(42, anchor)
  const previous = wreckLocalToWorld(anchor, layout.angle, 259, 48)
  assert.equal(isWreckPositionWalkable(previous, layout), false)
  assert.equal(findBlockingWreckCollider(previous, layout), 'deck-barrel')
  const recovered = recoverWreckPosition(previous, layout, coastline)
  assert.equal(isWreckPositionWalkable(recovered, layout), true)
  assert.equal(pointIsInsideIsland(recovered, coastline), true)
  assert.ok(Math.hypot(recovered.x - previous.x, recovered.y - previous.y) <= 64)
})

test('ordinary 8px steps can escape an invalid cargo position', () => {
  const layout = createWreckLayout(42, anchor)
  let position = wreckLocalToWorld(anchor, layout.angle, 259, 48)
  const direction = { x: Math.sin(layout.angle), y: -Math.cos(layout.angle) }
  for (let step = 0; step < 8; step += 1) {
    const target = { x: position.x + direction.x * 8, y: position.y + direction.y * 8 }
    const next = resolveWreckMovement(position, target, layout)
    assert.notDeepEqual(next, position)
    position = next
    if (isWreckPositionWalkable(position, layout)) break
  }
  assert.equal(isWreckPositionWalkable(position, layout), true)
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

test('gangway approach spawn is dry and collision-free across 50 seeds', () => {
  for (let seed = 0; seed < 50; seed += 1) {
    const coastline = generateIslandGeometry(seed)
    const [wreck, spawn] = serverStyleWreckAndSpawn(seed)
    const layout = createWreckLayout(seed, wreck)
    assert.equal(pointIsInsideIsland(spawn, coastline), true, `seed ${seed} is dry`)
    assert.equal(isWreckPositionWalkable(spawn, layout), true, `seed ${seed} is walkable`)
    assert.equal(Math.hypot(spawn.x - layout.entranceApproach.x, spawn.y - layout.entranceApproach.y), 0)
  }
})

test('wreck spawn math matches backend fixture values', () => {
  const fixtures = new Map([
    [0, [{ x: 4470.410566619449, y: 2430.5958188382133 }, { x: 4316.417661140205, y: 2547.8226940079485 }]],
    [1, [{ x: 4770.354924715217, y: 2531.624048712478 }, { x: 4596.583144744758, y: 2616.825713519561 }]],
    [42, [{ x: 1959.9712251534202, y: 4210.019904735874 }, { x: 1965.51926806239, y: 4016.5640327136466 }]],
  ])
  for (const [seed, expected] of fixtures) {
    const actual = serverStyleWreckAndSpawn(seed)
    assert.ok(Math.hypot(actual[0].x - expected[0].x, actual[0].y - expected[0].y) < 1e-9)
    assert.ok(Math.hypot(actual[1].x - expected[1].x, actual[1].y - expected[1].y) < 1e-9)
  }
})
