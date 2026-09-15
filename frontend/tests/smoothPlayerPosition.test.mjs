import assert from 'node:assert/strict'
import test from 'node:test'
import { PLAYER_VISUAL_BUFFER_MS, SmoothPlayerPosition } from '../.test-dist/game/SmoothPlayerPosition.js'

function subject(initial = { x: 0, y: 0 }) {
  const object = { ...initial, setPosition(x, y) { this.x = x; this.y = y } }
  return { object, smooth: new SmoothPlayerPosition(object, initial) }
}

function sampleVisuals(timestamps) {
  const { object, smooth } = subject()
  timestamps.slice(1).forEach((timestamp, index) => smooth.setLogicalTarget({ x: (index + 1) * 8, y: 0 }, timestamp))
  const values = []
  for (let now = PLAYER_VISUAL_BUFFER_MS; now <= timestamps.at(-1) + PLAYER_VISUAL_BUFFER_MS; now += 4) {
    smooth.update(now)
    values.push(object.x)
  }
  smooth.update(timestamps.at(-1) + PLAYER_VISUAL_BUFFER_MS)
  values.push(object.x)
  return values
}

test('sequential logical samples render monotonically through the visual buffer', () => {
  const values = sampleVisuals([0, 50, 100, 150])
  assert.ok(values.every((value, index) => index === 0 || value >= values[index - 1]))
  assert.ok(values.some((value) => value > 0 && value < 8))
  assert.equal(values.at(-1), 24)
})

test('irregular logical samples still render monotonically and smoothly', () => {
  const values = sampleVisuals([0, 48, 113, 169, 247])
  assert.ok(values.every((value, index) => index === 0 || value >= values[index - 1]))
  assert.ok(values.filter((value, index) => index && value !== values[index - 1]).length > 30)
  assert.equal(values.at(-1), 32)
})

test('logical state is authoritative immediately and reset snaps both positions', () => {
  const { object, smooth } = subject()
  smooth.setLogicalTarget({ x: 10, y: 20 }, 100)
  assert.deepEqual(smooth.logical, { x: 10, y: 20 })
  assert.deepEqual({ x: object.x, y: object.y }, { x: 0, y: 0 })
  smooth.reset({ x: 500, y: 500 }, 110)
  assert.deepEqual(smooth.logical, { x: 500, y: 500 })
  assert.deepEqual({ x: object.x, y: object.y }, { x: 500, y: 500 })
})

test('large logical jumps snap instead of interpolating across a map', () => {
  const { object, smooth } = subject()
  smooth.setLogicalTarget({ x: 500, y: 500 }, 100)
  assert.deepEqual({ x: object.x, y: object.y }, { x: 500, y: 500 })
})
