import assert from 'node:assert/strict'
import test from 'node:test'
import { bindEditorKeyboardFocus } from '../.test-dist/components/editorKeyboardFocus.js'
import { createDirectionKeys, DIRECTION_KEY_CODES } from '../.test-dist/game/gameKeyboard.js'

test('game registers only direction keys and never globally captures browser keys', () => {
  let registration
  const result = createDirectionKeys({ addKeys(keys, capture) { registration = { keys, capture }; return keys } })
  assert.deepEqual(result, DIRECTION_KEY_CODES)
  assert.deepEqual(registration, { keys: DIRECTION_KEY_CODES, capture: false })
  assert.equal(Object.values(registration.keys).includes('SPACE'), false)
})

test('Monaco text and widgets disable game input until all editor focus is lost', async () => {
  const listeners = {}
  const states = []
  const editor = {
    text: false, widget: false,
    hasTextFocus() { return this.text }, hasWidgetFocus() { return this.widget },
    onDidFocusEditorText(fn) { listeners.textFocus = fn; return { dispose() {} } },
    onDidBlurEditorText(fn) { listeners.textBlur = fn; return { dispose() {} } },
    onDidFocusEditorWidget(fn) { listeners.widgetFocus = fn; return { dispose() {} } },
    onDidBlurEditorWidget(fn) { listeners.widgetBlur = fn; return { dispose() {} } },
  }
  bindEditorKeyboardFocus(editor, (focused) => states.push(focused))
  editor.text = true; listeners.textFocus()
  editor.text = false; editor.widget = true; listeners.textBlur(); listeners.widgetFocus()
  await Promise.resolve()
  editor.widget = false; listeners.widgetBlur()
  await Promise.resolve()
  assert.deepEqual(states, [true, true, true, false])
})
