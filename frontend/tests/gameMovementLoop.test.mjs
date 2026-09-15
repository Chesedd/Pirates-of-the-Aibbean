import assert from 'node:assert/strict'
import test from 'node:test'
import { GameMovementLoop, normalizeKeyboardDiagonal } from '../.test-dist/game/movement/GameMovementLoop.js'
const keys = (values = {}) => ({ w:false,a:false,s:false,d:false,up:false,down:false,left:false,right:false,...values })
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
test('a due tick becomes pending and runs after the active tick', async () => {
  const first = deferred(), calls = [], completed = []
  const loop = new GameMovementLoop((k,p) => { calls.push(p); return calls.length === 1 ? first.promise : Promise.resolve(p) }, (r) => completed.push(r))
  loop.update(0, keys({w:true}), {x:0,y:0}); loop.update(50, keys({w:true}), {x:0,y:-8})
  assert.deepEqual(loop.diagnostics, {inFlight:true,pending:true}); first.resolve({x:0,y:-8}); await new Promise(r => setTimeout(r, 0))
  assert.equal(calls.length, 2); assert.equal(completed.length, 2)
})
test('latest request replaces the single pending snapshot', async () => {
  const first = deferred(), calls=[]
  const loop = new GameMovementLoop((k,p) => { calls.push(p); return calls.length === 1 ? first.promise : Promise.resolve(p) }, () => {})
  loop.update(0, keys(), {x:0,y:0}); loop.update(50, keys(), {x:1,y:0}); loop.update(100, keys(), {x:2,y:0})
  first.resolve({x:0,y:0}); await new Promise(r => setTimeout(r, 0)); assert.deepEqual(calls[1], {x:2,y:0})
})
test('keyboard diagonal has the same magnitude as cardinal movement', () => {
  const next = normalizeKeyboardDiagonal({x:0,y:0},{x:8,y:-8},keys({w:true,d:true}))
  assert.ok(Math.abs(Math.hypot(next.x,next.y)-8) < 1e-9)
  assert.deepEqual(normalizeKeyboardDiagonal({x:0,y:0},{x:8,y:8},keys()), {x:8,y:8})
})
