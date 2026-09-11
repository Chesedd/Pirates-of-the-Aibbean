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
  assert.match(scene, /setData\('role', 'tutorial-journal'\)/)
  assert.match(page, /<TutorialJournal/)
  assert.match(journal, /Судовой журнал/)
  assert.match(journal, /Проверить запасы/)
  assert.match(journal, /Восстановить координаты/)
  assert.match(journal, /Запас воды/)
  assert.match(journal, /Зажечь сигнальный фонарь/)
  assert.match(journal, /Ты снова чувствуешь ноги/)
  assert.match(journal, /key_pressed\(\"d\"\)/)
})

test('tutorial player starts inside the cabin while movement remains locked', () => {
  const cabinMatch = scene.match(/TUTORIAL_CABIN = \{ x: (\d+), y: (\d+), width: (\d+), height: (\d+) \}/)
  const spawnMatch = scene.match(/TUTORIAL_PLAYER_SPAWN = \{ x: (\d+), y: (\d+) \}/)
  assert.ok(cabinMatch)
  assert.ok(spawnMatch)

  const [, cabinX, cabinY, cabinWidth, cabinHeight] = cabinMatch.map(Number)
  const [, spawnX, spawnY] = spawnMatch.map(Number)
  assert.ok(spawnX > cabinX && spawnX < cabinX + cabinWidth)
  assert.ok(spawnY > cabinY && spawnY < cabinY + cabinHeight)
  assert.match(scene, /setMovementUnlocked\(false\)/)
})

test('tutorial cabin contains a future exit without a transition handler', () => {
  assert.match(scene, /setData\('role', 'tutorial-exit'\)/)
  assert.match(scene, /setData\('transitionImplemented', false\)/)
  assert.doesNotMatch(scene, /exit\.on\('pointerup'/)
})
