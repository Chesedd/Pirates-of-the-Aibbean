import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ExecutionTimeoutError,
  PythonRunner,
} from '../.test-dist/python/PythonRunner.js'

class MockWorker {
  onmessage = null
  onerror = null
  messages = []
  terminated = false

  postMessage(message) {
    this.messages.push(message)
  }

  terminate() {
    this.terminated = true
  }

  emit(data) {
    this.onmessage?.({ data })
  }
}

const setup = (timeout = 100) => {
  const workers = []
  const runner = new PythonRunner(() => {
    const worker = new MockWorker()
    workers.push(worker)
    return worker
  }, timeout)
  workers[0].emit({ type: 'ready' })
  return { runner, workers }
}

test('an initial fatal error is terminal until an explicit retry succeeds', () => {
  const workers = []
  const originalConsoleError = console.error
  const diagnostics = []
  console.error = (message) => diagnostics.push(message)
  const runner = new PythonRunner(() => {
    const worker = new MockWorker()
    workers.push(worker)
    return worker
  })

  try {
    workers[0].emit({ type: 'fatal', error: 'Failed to fetch pyodide.asm.wasm' })
    assert.equal(runner.runtimeState, 'error')
    assert.equal(runner.runtimeError, 'Failed to fetch pyodide.asm.wasm')
    assert.equal(workers[0].terminated, true)
    assert.equal(workers.length, 1, 'fatal must not automatically create another worker')
    assert.deepEqual(diagnostics, ['Python failed to load: Failed to fetch pyodide.asm.wasm'])
    assert.rejects(runner.run('print("unavailable")'), /not ready/)

    runner.retry()
    assert.equal(workers.length, 2)
    assert.equal(runner.runtimeState, 'loading')
    workers[1].emit({ type: 'ready' })
    assert.equal(runner.runtimeState, 'ready')
  } finally {
    console.error = originalConsoleError
    runner.dispose()
  }
})

test('retry is ignored unless initialization has failed', () => {
  const { runner, workers } = setup()
  runner.retry()
  assert.equal(workers.length, 1)
  runner.dispose()
})

test('initialization times out instead of remaining in loading state', async () => {
  const workers = []
  const originalConsoleError = console.error
  console.error = () => {}
  const runner = new PythonRunner(() => {
    const worker = new MockWorker()
    workers.push(worker)
    return worker
  }, 100, 10)

  try {
    assert.equal(runner.runtimeState, 'loading')
    await new Promise((resolve) => setTimeout(resolve, 20))
    assert.equal(runner.runtimeState, 'error')
    assert.equal(runner.runtimeError, 'Python initialization timed out.')
    assert.equal(workers[0].terminated, true)
  } finally {
    console.error = originalConsoleError
    runner.dispose()
  }
})

test('resolves a successful result and stdout', async () => {
  const { runner, workers } = setup()
  const execution = runner.run('print("Hello")\n2 + 3')
  const [{ runId }] = workers[0].messages
  workers[0].emit({ type: 'result', runId, stdout: 'Hello', result: '5' })

  assert.deepEqual(await execution, { stdout: 'Hello', result: '5' })
  runner.dispose()
})

test('rejects a Python error without breaking the runner', async () => {
  const { runner, workers } = setup()
  const execution = runner.run('print(test)')
  const [{ runId }] = workers[0].messages
  workers[0].emit({
    type: 'error',
    runId,
    stdout: '',
    error: "NameError: name 'test' is not defined",
  })

  await assert.rejects(execution, /NameError/)
  assert.equal(runner.runtimeState, 'ready')
  runner.dispose()
})

test('times out, terminates the worker, and runs successfully after restart', async () => {
  const { runner, workers } = setup(10)
  const timedOut = runner.run('while True: pass')
  const oldWorker = workers[0]
  const [{ runId: oldRunId }] = oldWorker.messages

  await assert.rejects(timedOut, ExecutionTimeoutError)
  assert.equal(oldWorker.terminated, true)
  assert.equal(workers.length, 2)
  assert.equal(runner.runtimeState, 'loading')

  // A queued response from the terminated worker must not make the new runtime ready.
  oldWorker.emit({ type: 'result', runId: oldRunId, stdout: 'stale', result: '' })
  assert.equal(runner.runtimeState, 'loading')

  const restartedWorker = workers[1]
  restartedWorker.emit({ type: 'ready' })
  const execution = runner.run('print("back")')
  const [{ runId }] = restartedWorker.messages
  restartedWorker.emit({ type: 'result', runId, stdout: 'back', result: '' })
  assert.deepEqual(await execution, { stdout: 'back', result: '' })
  runner.dispose()
})

test('ignores a response with an outdated run id', async () => {
  const { runner, workers } = setup()
  const execution = runner.run('print("new")')
  const [{ runId }] = workers[0].messages

  workers[0].emit({ type: 'result', runId: runId - 1, stdout: 'old', result: '' })
  workers[0].emit({ type: 'result', runId, stdout: 'new', result: '' })
  assert.deepEqual(await execution, { stdout: 'new', result: '' })
  runner.dispose()
})

test('StrictMode-style setup, cleanup, and setup owns fresh working workers', () => {
  const workers = []
  const createRunner = () => new PythonRunner(() => {
    const worker = new MockWorker()
    workers.push(worker)
    return worker
  })

  const firstRunner = createRunner()
  const firstWorker = workers[0]
  const firstStates = []
  firstRunner.subscribe((state) => firstStates.push(state))
  firstRunner.dispose()

  const secondRunner = createRunner()
  const secondWorker = workers[1]
  const secondStates = []
  secondRunner.subscribe((state) => secondStates.push(state))
  firstWorker.emit({ type: 'ready' })
  assert.deepEqual(secondStates, ['loading'], 'the old worker cannot update the new UI state')
  secondWorker.emit({ type: 'ready' })

  assert.equal(firstWorker.terminated, true)
  assert.equal(secondRunner.runtimeState, 'ready')
  assert.deepEqual(secondStates, ['loading', 'ready'])
  secondRunner.dispose()
  assert.equal(secondWorker.terminated, true)
})
