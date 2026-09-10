export type PythonWorkerRequest = {
  type: 'run'
  runId: number
  code: string
}

export type PythonWorkerResponse =
  | { type: 'ready' }
  | { type: 'result'; runId: number; stdout: string; result: string }
  | { type: 'error'; runId: number; stdout: string; error: string }
  | { type: 'fatal'; error: string }

export type PythonRunResult = {
  stdout: string
  result: string
}

export type PythonRuntimeState = 'loading' | 'ready'
