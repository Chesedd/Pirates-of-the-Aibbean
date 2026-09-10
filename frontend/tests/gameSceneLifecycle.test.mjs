import assert from 'node:assert/strict'
import test from 'node:test'
import { GameSceneLifecycle } from '../.test-dist/game/GameSceneLifecycle.js'

const scene = () => ({
  states: [],
  setKeyboardEnabled(enabled) { this.states.push(enabled) },
})

test('defers keyboard state until the scene is ready', () => {
  const lifecycle = new GameSceneLifecycle(true)
  lifecycle.setKeyboardEnabled(false)
  const readyScene = scene()
  lifecycle.sceneReady(readyScene)
  assert.deepEqual(readyScene.states, [false])

  lifecycle.setKeyboardEnabled(true)
  assert.deepEqual(readyScene.states, [false, true])
})

test('does not access a scene after shutdown or an idempotent dispose', () => {
  const lifecycle = new GameSceneLifecycle(true)
  const oldScene = scene()
  lifecycle.sceneReady(oldScene)
  lifecycle.sceneShutdown(oldScene)
  lifecycle.setKeyboardEnabled(false)
  assert.deepEqual(oldScene.states, [true])

  lifecycle.dispose()
  lifecycle.dispose()
  const lateScene = scene()
  lifecycle.sceneReady(lateScene)
  lifecycle.setKeyboardEnabled(true)
  assert.deepEqual(lateScene.states, [])
})

test('ignores shutdown from a stale scene after a replacement is ready', () => {
  const lifecycle = new GameSceneLifecycle(false)
  const first = scene()
  const replacement = scene()
  lifecycle.sceneReady(first)
  lifecycle.sceneReady(replacement)
  lifecycle.sceneShutdown(first)
  lifecycle.setKeyboardEnabled(true)
  assert.deepEqual(replacement.states, [false, true])
})
