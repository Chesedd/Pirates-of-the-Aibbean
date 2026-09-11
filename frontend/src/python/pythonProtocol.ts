/** Serializable key state only; browser and Phaser event objects never cross into Python. */
export type GameKeys = Record<string, boolean>
export type GamePosition = { x: number; y: number }

export type PythonWorkerRequest =
  | { type: 'run'; runId: number; code: string }
  | { type: 'apply'; runId: number; code: string }
  | { type: 'tick'; runId: number; keys: GameKeys; position: GamePosition }

export type PythonWorkerResponse =
  | { type: 'ready' }
  | { type: 'result'; runId: number; stdout: string; result: string }
  | { type: 'applied'; runId: number }
  | { type: 'tickResult'; runId: number; x: unknown; y: unknown; stdout: string }
  | { type: 'error'; runId: number; stdout: string; error: string }
  | { type: 'fatal'; error: string }

export type PythonRunResult = { stdout: string; result: string }
export type PythonTickResult = { x: unknown; y: unknown; stdout: string }
export type PythonRuntimeState = 'loading' | 'ready' | 'error'
