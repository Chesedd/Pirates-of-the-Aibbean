import assert from 'node:assert/strict'
import test from 'node:test'
import { generateIslandGeometry, ISLAND_CENTER, pointIsInsideIsland } from '../.test-dist/game/islandGeometry.js'
import { createWreckLayout } from '../.test-dist/game/wreckGeometry.js'
import { applyDebrisDrag, debrisPushVelocity, generateWreckDebris, isValidWreckDebrisPosition } from '../.test-dist/game/wreckDebris.js'

function fixture(seed) {
  const coastline = generateIslandGeometry(seed)
  const anchor = coastline.reduce((leftmost, point) => point.x < leftmost.x ? point : leftmost)
  const inwardX = ISLAND_CENTER - anchor.x
  const inwardY = ISLAND_CENTER - anchor.y
  const length = Math.hypot(inwardX, inwardY)
  const wreck = { x: anchor.x + inwardX / length * 95, y: anchor.y + inwardY / length * 95 }
  const spawn = { x: wreck.x + inwardX / length * 130, y: wreck.y + inwardY / length * 130 }
  const layout = createWreckLayout(seed, wreck)
  return { coastline, layout, spawn }
}

test('wreck debris is stable for a seed and differs between island seeds', () => {
  const firstFixture = fixture(12345)
  const first = generateWreckDebris(12345, firstFixture.layout, firstFixture.coastline, firstFixture.spawn)
  assert.deepEqual(first, generateWreckDebris(12345, firstFixture.layout, firstFixture.coastline, firstFixture.spawn))

  const secondFixture = fixture(54321)
  const second = generateWreckDebris(54321, secondFixture.layout, secondFixture.coastline, secondFixture.spawn)
  assert.notDeepEqual(first.items, second.items)
})

test('three islands keep every debris footprint in bounds and outside protected zones', () => {
  for (const seed of [7, 12345, 987654321]) {
    const { coastline, layout, spawn } = fixture(seed)
    const debris = generateWreckDebris(seed, layout, coastline, spawn)
    assert.ok(debris.items.length >= 9, `seed ${seed} generated enough varied debris`)
    for (const item of debris.items) {
      const radius = ['hull-section', 'spar', 'deck-section'].includes(item.kind) ? 58 : item.kind === 'plank-group' ? 38 : 28
      assert.equal(pointIsInsideIsland(item, coastline), true)
      assert.equal(isValidWreckDebrisPosition(item, radius, layout, coastline, spawn), true)
    }
  }
})

test('cargo and plank quantities stay within the requested ranges', () => {
  for (const seed of [1, 2, 3]) {
    const { coastline, layout, spawn } = fixture(seed)
    const items = generateWreckDebris(seed, layout, coastline, spawn).items
    const count = (kind) => items.filter((item) => item.kind === kind).length
    const large = items.filter((item) => ['hull-section', 'spar', 'deck-section'].includes(item.kind)).length
    assert.ok(count('crate') >= 3 && count('crate') <= 7)
    assert.ok(count('barrel') >= 3 && count('barrel') <= 6)
    assert.ok(count('plank-group') >= 2 && count('plank-group') <= 5)
    assert.ok(large >= 1 && large <= 3)
  }
})

test('procedural debris preserves the player exclusion radius', () => {
  const { coastline, layout, spawn } = fixture(42)
  for (const item of generateWreckDebris(42, layout, coastline, spawn).items) {
    const radius = ['hull-section', 'spar', 'deck-section'].includes(item.kind) ? 58 : item.kind === 'plank-group' ? 38 : 28
    assert.ok(Math.hypot(item.x - spawn.x, item.y - spawn.y) >= radius + 110)
  }
})

test('push resistance makes plank, crate, spar, and hull progressively harder to move', () => {
  const velocity = { x: 160, y: 0 }
  const plank = debrisPushVelocity('plank-group', velocity).x
  const crate = debrisPushVelocity('crate', velocity).x
  const spar = debrisPushVelocity('spar', velocity).x
  const hull = debrisPushVelocity('hull-section', velocity).x
  assert.ok(plank > crate && crate > spar && spar > hull)
  assert.equal(hull, 0)
})

test('debris drag decays motion cleanly to zero', () => {
  const slower = applyDebrisDrag({ x: 80, y: 0 }, 'plank-group', .1)
  const stopped = applyDebrisDrag(slower, 'plank-group', 1)
  assert.ok(slower.x > 0 && slower.x < 80)
  assert.deepEqual(stopped, { x: 0, y: 0 })
})
