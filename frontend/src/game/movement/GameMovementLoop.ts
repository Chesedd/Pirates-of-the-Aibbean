import type { GameKeys, GamePosition } from '../../python/pythonProtocol.js'

export type MovementRequest = { keys: GameKeys; position: GamePosition; time: number }
export const PYTHON_COMMAND_INTERVAL_MS = 50
export const MAX_TICK_MOVE = 20
export function normalizeKeyboardDiagonal(previous: GamePosition, target: GamePosition, keys: GameKeys): GamePosition {
  const horizontal = Number(Boolean(keys.d || keys.right)) - Number(Boolean(keys.a || keys.left))
  const vertical = Number(Boolean(keys.s || keys.down)) - Number(Boolean(keys.w || keys.up))
  const dx = target.x - previous.x, dy = target.y - previous.y
  if (!horizontal || !vertical || !dx || !dy || Math.sign(dx) !== Math.sign(horizontal) || Math.sign(dy) !== Math.sign(vertical)) return target
  const cardinal = Math.max(Math.abs(dx), Math.abs(dy)), length = Math.hypot(dx, dy)
  return { x: previous.x + dx / length * cardinal, y: previous.y + dy / length * cardinal }
}

/** 20Hz single-flight scheduler: one active request and one replaceable latest snapshot. */
export class GameMovementLoop {
  private lastDue = -Infinity
  private inFlight = false
  private pending: MovementRequest | null = null
  private disposed = false
  constructor(private readonly tick: (keys: GameKeys, position: GamePosition) => Promise<GamePosition | null>,
    private readonly complete: (request: MovementRequest, next: GamePosition | null) => void,
    readonly cadenceMs = PYTHON_COMMAND_INTERVAL_MS) {}
  get diagnostics() { return { inFlight: this.inFlight, pending: Boolean(this.pending) } }
  update(time: number, keys: GameKeys, position: GamePosition) {
    if (time - this.lastDue < this.cadenceMs || this.disposed) return
    this.lastDue = time
    const request = { time, keys, position: { ...position } }
    if (this.inFlight) this.pending = request
    else this.run(request)
  }
  /** Input edges bypass the heartbeat wait, but retain the single-flight/latest-pending rule. */
  requestNow(time: number, keys: GameKeys, position: GamePosition) {
    if (this.disposed) return
    this.lastDue = time
    const request = { time, keys, position: { ...position } }
    if (this.inFlight) this.pending = request
    else this.run(request)
  }
  private run(request: MovementRequest) {
    this.inFlight = true
    void this.tick(request.keys, request.position).then((next) => {
      if (!this.disposed) this.complete(request, next && normalizeKeyboardDiagonal(request.position, next, request.keys))
    }).finally(() => {
      this.inFlight = false
      const latest = this.pending
      this.pending = null
      if (latest && !this.disposed) this.run(latest)
    })
  }
  dispose() { this.disposed = true; this.pending = null }
}

export function movementIntentVelocity(input: GamePosition, result: GamePosition, keys: GameKeys,
  intervalMs = PYTHON_COMMAND_INTERVAL_MS): GamePosition {
  const normalized = normalizeKeyboardDiagonal(input, result, keys)
  let dx = normalized.x - input.x, dy = normalized.y - input.y
  const length = Math.hypot(dx, dy)
  if (length > MAX_TICK_MOVE) { dx *= MAX_TICK_MOVE / length; dy *= MAX_TICK_MOVE / length }
  const seconds = intervalMs / 1000
  return { x: dx / seconds, y: dy / seconds }
}
