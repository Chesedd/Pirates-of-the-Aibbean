import assert from 'node:assert/strict'
import test from 'node:test'
import { applyAndPersistPlayerCode } from '../.test-dist/components/applyPlayerCode.js'

test('successful Apply activates and persists the exact editor snapshot', async () => {
  const calls = []
  const result = await applyAndPersistPlayerCode(
    'NEW_CODE',
    async (code) => { calls.push(['apply', code]); return true },
    async (code) => { calls.push(['put', code]) },
  )
  assert.deepEqual(calls, [['apply', 'NEW_CODE'], ['put', 'NEW_CODE']])
  assert.deepEqual(result, { applied: true, saved: true })
})

test('failed Apply does not overwrite persisted player.py', async () => {
  let putCalled = false
  const result = await applyAndPersistPlayerCode('BROKEN_CODE', async () => false, async () => { putCalled = true })
  assert.equal(putCalled, false)
  assert.deepEqual(result, { applied: false, saved: false })
})

test('a save failure reports unsaved while leaving the program applied', async () => {
  let activeCode = ''
  const result = await applyAndPersistPlayerCode(
    'NEW_CODE',
    async (code) => { activeCode = code; return true },
    async () => { throw new Error('network down') },
  )
  assert.equal(activeCode, 'NEW_CODE')
  assert.equal(result.applied, true)
  assert.equal(result.saved, false)
  assert.match(result.error.message, /network down/)
})

test('persisted Apply is returned by reload and can be auto-applied', async () => {
  let storedCode = 'OLD_CODE'
  await applyAndPersistPlayerCode('NEW_CODE', async () => true, async (code) => { storedCode = code })

  // Models the existing GET /game/code -> bridge.apply(initialCode) lifecycle.
  const loadedCode = storedCode
  let activeCode = ''
  await (async (code) => { activeCode = code })(loadedCode)
  assert.equal(loadedCode, 'NEW_CODE')
  assert.equal(activeCode, 'NEW_CODE')
})
