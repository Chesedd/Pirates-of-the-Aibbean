import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
const page = readFileSync(new URL('../src/pages/UserPage.tsx', import.meta.url), 'utf8')
const island = readFileSync(new URL('../src/game/scenes/IslandScene.ts', import.meta.url), 'utf8')
const cabin = readFileSync(new URL('../src/game/scenes/ShipCabinScene.ts', import.meta.url), 'utf8')
const avatar = readFileSync(new URL('../src/game/player/createPlayerAvatar.ts', import.meta.url), 'utf8')
test('location title comes from current location rather than progression', () => {
  assert.match(page, /GAME_LOCATIONS\[currentLocation\]\.title/)
  assert.doesNotMatch(page, /shipExited \? 'Your island'/)
  assert.match(island, /sceneCreated\('island'\)/)
  assert.match(cabin, /sceneCreated\('wreck-cabin'\)/)
})
test('both scenes use the single canonical avatar factory', () => {
  assert.match(island, /createPlayerAvatar\(this,/)
  assert.match(cabin, /createPlayerAvatar\(this,/)
  assert.match(avatar, /scene\.add\.circle/)
  assert.doesNotMatch(island, /this\.add\.triangle\(0, -22/)
  assert.doesNotMatch(cabin, /this\.add\.triangle\(0, -22/)
})
test('revisit cabin exit transitions locally before persistence', () => {
  const transition = cabin.indexOf("location.enter(this, 'island'")
  const persistence = cabin.indexOf("apiRequest('/game/position'", transition)
  assert.ok(transition > 0 && persistence > transition)
})
