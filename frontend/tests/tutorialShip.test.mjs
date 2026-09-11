import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const scene = readFileSync(new URL('../src/game/scenes/TutorialShipScene.ts', import.meta.url), 'utf8')
const page = readFileSync(new URL('../src/pages/UserPage.tsx', import.meta.url), 'utf8')
const journal = readFileSync(new URL('../src/components/TutorialJournal.tsx', import.meta.url), 'utf8')

test('locked users receive the tutorial ship scene', () => {
  const createGame = readFileSync(new URL('../src/game/createGame.ts', import.meta.url), 'utf8')
  assert.match(createGame, /movementUnlocked \? IslandScene : TutorialShipScene/)
  assert.match(page, /progress\?\.unlocks\.includes\('movement'\)/)
})

test('ship journal is interactive and opens the tutorial book', () => {
  assert.match(scene, /journal\.on\('pointerup'/)
  assert.match(page, /<TutorialJournal/)
  assert.match(journal, /Судовой журнал/)
  assert.match(journal, /Проверить запасы/)
  assert.match(journal, /Восстановить координаты/)
})
