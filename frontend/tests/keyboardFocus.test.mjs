import assert from 'node:assert/strict'
import test from 'node:test'
import { bindEditorKeyboardFocus } from '../.test-dist/components/editorKeyboardFocus.js'
import { GameKeyboardState, gameKeyName } from '../.test-dist/game/gameKeyboard.js'

function keyboardHarness() {
  const listeners = { keydown: new Set(), keyup: new Set() }
  const source = {
    on(type, listener) { listeners[type].add(listener) },
    off(type, listener) { listeners[type].delete(listener) },
  }
  return {
    state: new GameKeyboardState(source),
    fire(type, code) { for (const listener of listeners[type]) listener({ code }) },
  }
}

test('physical codes normalize to Python key names', () => {
  assert.equal(gameKeyName('KeyW'), 'w')
  assert.equal(gameKeyName('KeyQ'), 'q')
  assert.equal(gameKeyName('Digit7'), '7')
  assert.equal(gameKeyName('ArrowUp'), 'up')
  assert.equal(gameKeyName('ArrowDown'), 'down')
  assert.equal(gameKeyName('ArrowLeft'), 'left')
  assert.equal(gameKeyName('ArrowRight'), 'right')
  assert.equal(gameKeyName('ShiftLeft'), 'shift')
  assert.equal(gameKeyName('Space'), 'space')
})

test('tracks WASD, arbitrary keys, simultaneous keys, and key release', () => {
  const keyboard = keyboardHarness()
  for (const code of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'Digit7', 'ShiftLeft', 'Space']) {
    keyboard.fire('keydown', code)
  }
  const keys = keyboard.state.snapshot()
  for (const key of ['w', 'a', 's', 'd', 'q', '7', 'shift', 'space']) assert.equal(keys[key], true)
  keyboard.fire('keyup', 'KeyW')
  assert.equal(keyboard.state.snapshot().w, false)
  assert.equal(keyboard.state.snapshot().shift, true)
})

test('keeps the old arrow aliases working', () => {
  const keyboard = keyboardHarness()
  for (const code of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) keyboard.fire('keydown', code)
  assert.deepEqual(
    Object.fromEntries(['up', 'down', 'left', 'right'].map((key) => [key, keyboard.state.snapshot()[key]])),
    { up: true, down: true, left: true, right: true },
  )
})

test('Monaco focus disables and clears game input, and blur enables it again', async () => {
  const keyboard = keyboardHarness()
  const listeners = {}
  const editor = {
    text: false, widget: false,
    hasTextFocus() { return this.text }, hasWidgetFocus() { return this.widget },
    onDidFocusEditorText(fn) { listeners.textFocus = fn; return { dispose() {} } },
    onDidBlurEditorText(fn) { listeners.textBlur = fn; return { dispose() {} } },
    onDidFocusEditorWidget(fn) { listeners.widgetFocus = fn; return { dispose() {} } },
    onDidBlurEditorWidget(fn) { listeners.widgetBlur = fn; return { dispose() {} } },
  }
  bindEditorKeyboardFocus(editor, (focused) => keyboard.state.setEnabled(!focused))
  keyboard.fire('keydown', 'KeyW')
  assert.equal(keyboard.state.snapshot().w, true)
  editor.text = true; listeners.textFocus()
  keyboard.fire('keydown', 'KeyA')
  assert.equal(keyboard.state.snapshot().w, false)
  assert.equal(keyboard.state.snapshot().a, false)
  editor.text = false; listeners.textBlur()
  await Promise.resolve()
  keyboard.fire('keydown', 'KeyA')
  assert.equal(keyboard.state.snapshot().a, true)
})
