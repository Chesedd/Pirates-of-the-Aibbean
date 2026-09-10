import type {
  PythonRunResult,
  PythonRuntimeState,
  PythonWorkerRequest,
  PythonWorkerResponse,
} from './pythonProtocol.js'

export interface WorkerLike {
  onmessage: ((event: MessageEvent<PythonWorkerResponse>) => void) | null
  onerror: ((event: ErrorEvent) => void) | null
  postMessage(message: PythonWorkerRequest): void
  terminate(): void
}

export type WorkerFactory = () => WorkerLike

export class ExecutionTimeoutError extends Error {
  constructor() {
    super('Execution timed out.')
    this.name = 'ExecutionTimeoutError'
  }
}

export class SupersededRunError extends Error {
  constructor() {
    super('Execution superseded by a newer Run.')
    this.name = 'SupersededRunError'
  }
}

type PendingRun = {
  id: number
  resolve: (result: PythonRunResult) => void
  reject: (reason: Error) => void
  timer: ReturnType<typeof setTimeout>
}

export class PythonRunner {
  private worker: WorkerLike | null = null
  private pending: PendingRun | null = null
  private nextId = 1
  private state: PythonRuntimeState = 'loading'
  private listeners = new Set<(state: PythonRuntimeState) => void>()

  constructor(
    private readonly createWorker: WorkerFactory,
    private readonly timeoutMs = 5_000,
  ) {
    this.startWorker()
  }

  get runtimeState() {
    return this.state
  }

  subscribe(listener: (state: PythonRuntimeState) => void) {
    this.listeners.add(listener)
    listener(this.state)
    return () => this.listeners.delete(listener)
  }

  run(code: string): Promise<PythonRunResult> {
    if (this.state !== 'ready' || !this.worker) {
      return Promise.reject(new Error('Python runtime is not ready.'))
    }

    if (this.pending) {
      this.rejectPending(new SupersededRunError())
      this.restartWorker()
      return Promise.reject(new Error('Python runtime is restarting.'))
    }

    const id = this.nextId++
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pending?.id !== id) return
        this.rejectPending(new ExecutionTimeoutError())
        this.restartWorker()
      }, this.timeoutMs)
      this.pending = { id, resolve, reject, timer }
      this.worker?.postMessage({ type: 'run', runId: id, code })
    })
  }

  dispose() {
    this.rejectPending(new Error('Python runner disposed.'))
    this.worker?.terminate()
    this.worker = null
  }

  private startWorker() {
    this.setState('loading')
    const worker = this.createWorker()
    this.worker = worker
    worker.onmessage = (event) => this.handleMessage(worker, event.data)
    worker.onerror = (event) => {
      if (worker !== this.worker) return
      this.rejectPending(new Error(event.message || 'Python worker failed.'))
      this.restartWorker()
    }
  }

  private handleMessage(worker: WorkerLike, message: PythonWorkerResponse) {
    // A terminated worker can still have an already queued event. Ignore it.
    if (worker !== this.worker) return
    if (message.type === 'ready') {
      this.setState('ready')
      return
    }
    if (message.type === 'fatal') {
      this.rejectPending(new Error(`Could not load Python: ${message.error}`))
      this.restartWorker()
      return
    }
    if (!this.pending || message.runId !== this.pending.id) return

    const pending = this.pending
    this.pending = null
    clearTimeout(pending.timer)
    if (message.type === 'result') {
      pending.resolve({ stdout: message.stdout, result: message.result })
    } else {
      const error = new Error(message.error)
      error.name = 'PythonError'
      ;(error as Error & { stdout?: string }).stdout = message.stdout
      pending.reject(error)
    }
  }

  private rejectPending(error: Error) {
    if (!this.pending) return
    const pending = this.pending
    this.pending = null
    clearTimeout(pending.timer)
    pending.reject(error)
  }

  private restartWorker() {
    this.worker?.terminate()
    this.worker = null
    this.startWorker()
  }

  private setState(state: PythonRuntimeState) {
    this.state = state
    this.listeners.forEach((listener) => listener(state))
  }
}

export const createBrowserPythonRunner = (timeoutMs?: number) => new PythonRunner(
  () => new Worker(new URL('./python.worker.ts', import.meta.url), { type: 'module' }),
  timeoutMs,
)
