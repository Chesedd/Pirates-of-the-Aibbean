import assert from 'node:assert/strict'
import test from 'node:test'
import { SmoothPlayerPosition } from '../.test-dist/game/SmoothPlayerPosition.js'

test('logical position changes immediately while visual position interpolates by time', () => {
  const object = { x: 0, y: 0, setPosition(x, y) { this.x = x; this.y = y } }
  const smooth = new SmoothPlayerPosition(object, { x: 0, y: 0 }, 50)
  smooth.setLogicalTarget({ x: 10, y: 20 }, 100)
  assert.deepEqual(smooth.logical, { x: 10, y: 20 })
  assert.deepEqual({ x: object.x, y: object.y }, { x: 0, y: 0 })
  smooth.update(125)
  assert.deepEqual({ x: object.x, y: object.y }, { x: 5, y: 10 })
  assert.deepEqual(smooth.logical, { x: 10, y: 20 })
  smooth.update(150)
  assert.deepEqual({ x: object.x, y: object.y }, { x: 10, y: 20 })
})
