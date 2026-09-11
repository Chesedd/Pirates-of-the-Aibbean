/// <reference lib="webworker" />

import { loadPyodide } from 'pyodide'
import type { PythonWorkerRequest, PythonWorkerResponse } from './pythonProtocol'
import { buildGamePrelude } from './pythonPrelude'

// Vite serves the npm package's core WASM, stdlib and lock file at this same-origin
// base path. Optional ML package artifacts can be self-hosted alongside them later.
const PYODIDE_BASE_URL = new URL(import.meta.env.BASE_URL, self.location.origin).href

type PyProxy = {
  destroy?: () => void
  toString: () => string
  set?: (name: string, value: unknown) => void
  toJs?: () => unknown[]
}

type Pyodide = {
  globals: { get: (name: string) => (...args: unknown[]) => PyProxy }
  runPythonAsync: (code: string, options: { globals: PyProxy }) => Promise<unknown>
  setStdout: (options: { batched: (text: string) => void }) => void
  setStderr: (options: { batched: (text: string) => void }) => void
}

const send = (message: PythonWorkerResponse) => self.postMessage(message)

let pyodide: Pyodide
let gameCode: PyProxy | null = null

async function initialise() {
  pyodide = await loadPyodide({ indexURL: PYODIDE_BASE_URL }) as unknown as Pyodide
  send({ type: 'ready' })
}

self.onmessage = async (event: MessageEvent<PythonWorkerRequest>) => {
  const { runId } = event.data
  const stdout: string[] = []
  const stderr: string[] = []
  pyodide.setStdout({ batched: (text) => stdout.push(text) })
  pyodide.setStderr({ batched: (text) => stderr.push(text) })

  const globals = pyodide.globals.get('dict')()
  try {
    if (event.data.type === 'apply') {
      const compiled = await pyodide.runPythonAsync(
        `compile(${JSON.stringify(event.data.code)}, "player.py", "exec")`, { globals },
      ) as PyProxy
      gameCode?.destroy?.()
      gameCode = compiled
      send({ type: 'applied', runId })
      return
    }
    if (event.data.type === 'tick') {
      if (!gameCode) throw new Error('No game program has been applied.')
      const { keys, position } = event.data
      const prelude = buildGamePrelude(keys, position)
      await pyodide.runPythonAsync(prelude, { globals })
      globals.set?.('__game_code', gameCode)
      await pyodide.runPythonAsync('exec(__game_code)', { globals })
      const value = await pyodide.runPythonAsync('(x, y)', { globals }) as PyProxy & { toJs?: () => unknown[] }
      const [x, y] = value.toJs?.() ?? []
      value.destroy?.()
      send({ type: 'tickResult', runId, x, y, stdout: stdout.join('\n') })
      return
    }
    // A new dictionary gives every ordinary Run a clean set of Python globals.
    const value = await pyodide.runPythonAsync(event.data.code, { globals })
    const result = value == null ? '' : String(value)
    if (typeof value === 'object' && value && 'destroy' in value) {
      (value as PyProxy).destroy?.()
    }
    send({ type: 'result', runId, stdout: stdout.join('\n'), result })
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : String(reason)
    const details = [...stderr, message].filter(Boolean).join('\n')
    send({ type: 'error', runId, stdout: stdout.join('\n'), error: details })
  } finally {
    globals.destroy?.()
  }
}

initialise().catch((reason: unknown) => {
  send({
    type: 'fatal',
    error: reason instanceof Error ? reason.message : String(reason),
  })
})

export {}
