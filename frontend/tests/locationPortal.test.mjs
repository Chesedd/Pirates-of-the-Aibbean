import assert from 'node:assert/strict'
import test from 'node:test'
import { portalActivates, portalContains } from '../.test-dist/game/locations/LocationPortal.js'
import { CABIN_EXIT_PORTAL, CABIN_REENTRY_SPAWN } from '../.test-dist/game/cabinCollision.js'

test('portal requires sensor overlap and inward movement', () => {
  assert.equal(portalActivates(CABIN_EXIT_PORTAL, {x:470,y:450}, {x:0,y:100}), false)
  assert.equal(portalActivates(CABIN_EXIT_PORTAL, {x:470,y:500}, {x:0,y:100}), true)
  assert.equal(portalActivates(CABIN_EXIT_PORTAL, {x:470,y:500}, {x:0,y:-100}), false)
})
test('cabin reentry spawn is outside the enlarged exit sensor with player clearance', () => {
  assert.equal(portalContains(CABIN_EXIT_PORTAL, CABIN_REENTRY_SPAWN, 12), false)
})
