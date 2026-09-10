/// <reference lib="webworker" />

import type { PythonWorkerRequest, PythonWorkerResponse } from './pythonProtocol'

const PYODIDE_VERSION = '0.28.2'
const PYODIDE_BASE_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`

type PyProxy = {
  destroy?: () => void
  toString: () => string
}

type Pyodide = {
  globals: { get: (name: string) => (...args: unknown[]) => PyProxy }
  runPythonAsync: (code: string, options: { globals: PyProxy }) => Promise<unknown>
  setStdout: (options: { batched: (text: string) => void }) => void
  setStderr: (options: { batched: (text: string) => void }) => void
}

type PyodideModule = {
  loadPyodide: (options: { indexURL: string }) => Promise<Pyodide>
}

const send = (message: PythonWorkerResponse) => self.postMessage(message)

let pyodide: Pyodide

async function initialise() {
  // The URL is fixed and never contains user input. @vite-ignore keeps Pyodide and
  // its large WASM assets out of the application bundle and loads them in this worker.
  const module = await import(/* @vite-ignore */ `${PYODIDE_BASE_URL}pyodide.mjs`) as PyodideModule
  pyodide = await module.loadPyodide({ indexURL: PYODIDE_BASE_URL })
  send({ type: 'ready' })
}

self.onmessage = async (event: MessageEvent<PythonWorkerRequest>) => {
  if (event.data.type !== 'run') return

  const { code, runId } = event.data
  const stdout: string[] = []
  const stderr: string[] = []
  pyodide.setStdout({ batched: (text) => stdout.push(text) })
  pyodide.setStderr({ batched: (text) => stderr.push(text) })

  // A new dictionary gives every ordinary Run a clean set of Python globals.
  const globals = pyodide.globals.get('dict')()
  try {
    const value = await pyodide.runPythonAsync(code, { globals })
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
