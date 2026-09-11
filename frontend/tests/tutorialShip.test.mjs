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
  assert.match(journal, /Проверка запасов/)
  assert.match(journal, /Восстановление координат/)
  assert.match(journal, /Запас воды/)
  assert.match(journal, /Сигнальный фонарь/)
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


test('journal uses sequential task tabs and progressive theory', () => {
  assert.match(journal, /state\.completed\.includes\(tab\) \|\| currentTask === tab/)
  assert.match(journal, /disabled={!available}/)
  assert.match(journal, /reachedStage >= 2/)
  assert.match(journal, /reachedStage >= 3/)
})

test('tutorial uses the existing Monaco Python editor with Python indentation', () => {
  assert.match(journal, /from '@monaco-editor\/react'/)
  assert.match(journal, /language="python"/)
  assert.match(journal, /tabSize: 4/)
  assert.match(journal, /insertSpaces: true/)
  assert.match(journal, /tabFocusMode: false/)
  assert.match(journal, /autoIndent: 'full'/)
  assert.match(journal, /minimap: \{ enabled: false \}/)
  assert.match(journal, /bindEditorKeyboardFocus/)
  assert.match(page, /onEditorFocusChange=\{setIsEditorFocused\}/)
  assert.match(page, /keyboardEnabled=\{!isEditorFocused\}/)
})

test('tutorial drafts survive theory navigation without controlled Monaco rewrites', () => {
  assert.match(journal, /const drafts = useRef/)
  assert.match(journal, /drafts\.current\[taskNumber\]/)
  assert.match(journal, /defaultValue=\{initialCode\}/)
  assert.doesNotMatch(journal, /<Editor[^>]*\svalue=\{/)
})

test('typing only updates the local draft and checking alone calls the evaluator', () => {
  const editorComponent = journal.slice(journal.indexOf('function TutorialCodeEditor'))
  const changeHandler = editorComponent.match(/onChange=\{\(value\) => \{([\s\S]*?)\n      \}\}/)?.[1] ?? ''
  assert.match(changeHandler, /onChange\(code\)/)
  assert.doesNotMatch(changeHandler, /apiRequest|check\(/)
  assert.match(journal, /async function check\(\)/)
  assert.match(journal, /apiRequest<TutorialResult>\('\/game\/tutorial\/check'/)
  assert.match(journal, /onClick=\{\(\) => void check\(\)\}/)
})

test('requested theory wording is shown without an extra knowledge caption', () => {
  assert.doesNotMatch(journal, /Открытые знания/)
  assert.match(journal, /Переменная хранит какое-то значение\./)
})

test('cabin object labels and pirate journal emblem are removed', () => {
  assert.doesNotMatch(scene, /'ГАМАК'|'ЖУРНАЛ'|'ВЫХОД'|☠/)
  assert.match(scene, /compass\.lineStyle/)
})
