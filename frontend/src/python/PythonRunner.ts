import type {
  PythonRunResult,
  PythonTickResult,
  GameKeys,
  GamePosition,
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
  resolve: (result: PythonRunResult | PythonTickResult | void) => void
  reject: (reason: Error) => void
  timer: ReturnType<typeof setTimeout>
}
type WorkerRequestWithoutId = PythonWorkerRequest extends infer Request
  ? Request extends { runId: number } ? Omit<Request, 'runId'> : never
  : never

export class PythonRunner {
  private worker: WorkerLike | null = null
  private pending: PendingRun | null = null
  private nextId = 1
  private state: PythonRuntimeState = 'loading'
  private initializationError = ''
  private initializationTimer: ReturnType<typeof setTimeout> | null = null
  private listeners = new Set<(state: PythonRuntimeState) => void>()

  constructor(
    private readonly createWorker: WorkerFactory,
    private readonly timeoutMs = 5_000,
    private readonly initializationTimeoutMs = 20_000,
  ) {
    this.startWorker()
  }

  get runtimeState() {
    return this.state
  }

  get runtimeError() {
    return this.initializationError
  }

  retry() {
    if (this.state !== 'error') return
    this.startWorker()
  }

  subscribe(listener: (state: PythonRuntimeState) => void) {
    this.listeners.add(listener)
    listener(this.state)
    return () => this.listeners.delete(listener)
  }

  run(code: string): Promise<PythonRunResult> {
    return this.request<PythonRunResult>({ type: 'run', code })
  }

  apply(code: string): Promise<void> {
    return this.request<void>({ type: 'apply', code })
  }

  tick(keys: GameKeys, position: GamePosition): Promise<PythonTickResult> {
    return this.request<PythonTickResult>({ type: 'tick', keys, position })
  }

  private request<T>(request: WorkerRequestWithoutId): Promise<T> {
    if (this.state !== 'ready' || !this.worker) {
      return Promise.reject(new Error('Python runtime is not ready.'))
    }

    if (this.pending) {
      return Promise.reject(new SupersededRunError())
    }

    const id = this.nextId++
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pending?.id !== id) return
        this.rejectPending(new ExecutionTimeoutError())
        this.restartWorker()
      }, this.timeoutMs)
      this.pending = { id, resolve: resolve as PendingRun['resolve'], reject, timer }
      this.worker?.postMessage({ ...request, runId: id } as PythonWorkerRequest)
    })
  }

  dispose() {
    this.clearInitializationTimer()
    this.rejectPending(new Error('Python runner disposed.'))
    this.worker?.terminate()
    this.worker = null
  }

  private startWorker() {
    this.initializationError = ''
    this.setState('loading')
    const worker = this.createWorker()
    this.worker = worker
    worker.onmessage = (event) => this.handleMessage(worker, event.data)
    worker.onerror = (event) => {
      if (worker !== this.worker) return
      const error = new Error(event.message || 'Python worker failed.')
      this.rejectPending(error)
      if (this.state === 'loading') this.failInitialization(worker, error.message)
      else this.restartWorker()
    }
    this.initializationTimer = setTimeout(() => {
      this.failInitialization(worker, 'Python initialization timed out.')
    }, this.initializationTimeoutMs)
  }

  private handleMessage(worker: WorkerLike, message: PythonWorkerResponse) {
    // A terminated worker can still have an already queued event. Ignore it.
    if (worker !== this.worker) return
    if (message.type === 'ready') {
      this.clearInitializationTimer()
      this.setState('ready')
      return
    }
    if (message.type === 'fatal') {
      this.rejectPending(new Error(`Python failed to load: ${message.error}`))
      this.failInitialization(worker, message.error)
      return
    }
    if (!this.pending || message.runId !== this.pending.id) return

    const pending = this.pending
    this.pending = null
    clearTimeout(pending.timer)
    if (message.type === 'result') {
      pending.resolve({ stdout: message.stdout, result: message.result })
    } else if (message.type === 'applied') {
      pending.resolve()
    } else if (message.type === 'tickResult') {
      pending.resolve({ x: message.x, y: message.y, stdout: message.stdout })
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

  private failInitialization(worker: WorkerLike, reason: string) {
    if (worker !== this.worker) return
    this.clearInitializationTimer()
    this.initializationError = reason
    console.error(`Python failed to load: ${reason}`)
    worker.terminate()
    this.worker = null
    this.setState('error')
  }

  private clearInitializationTimer() {
    if (this.initializationTimer === null) return
    clearTimeout(this.initializationTimer)
    this.initializationTimer = null
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
