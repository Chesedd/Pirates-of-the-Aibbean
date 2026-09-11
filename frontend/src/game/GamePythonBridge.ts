import type { GameKeys, GamePosition } from '../python/pythonProtocol.js'
import type { PythonRunner } from '../python/PythonRunner.js'
import { pointIsInsideIsland, type Point } from './islandGeometry.js'

export const MAX_TICK_MOVE = 20

export class GamePythonBridge {
  private active = false
  private busy = false
  private disposed = false
  private coastline: Point[] | null = null
  constructor(private readonly runner: Pick<PythonRunner, 'apply' | 'tick'>,
    private readonly onOutput: (message: string) => void = () => undefined,
    private readonly onPosition: (position: GamePosition) => void = () => undefined) {}

  /** Uses the very same polygon that the scene renders; no collision shape is derived separately. */
  setIslandGeometry(coastline: Point[]): void {
    this.coastline = coastline
  }

  async apply(code: string) {
    if (this.disposed) return false
    this.active = false
    try {
      await this.runner.apply(code)
      if (this.disposed) return false
      this.active = true
      this.onOutput('')
      return true
    } catch (reason) {
      if (!this.disposed) this.onOutput((reason as Error).message)
      return false
    }
  }

  async tick(keys: GameKeys, position: GamePosition): Promise<GamePosition | null> {
    if (this.disposed || !this.active || this.busy) return null
    this.busy = true
    try {
      const result = await this.runner.tick(keys, position)
      if (this.disposed) return null
      if (result.stdout) this.onOutput(result.stdout)
      if (typeof result.x !== 'number' || typeof result.y !== 'number' ||
          !Number.isFinite(result.x) || !Number.isFinite(result.y)) throw new Error('player.py returned invalid coordinates.')
      const next = {
        x: position.x + Math.max(-MAX_TICK_MOVE, Math.min(MAX_TICK_MOVE, result.x - position.x)),
        y: position.y + Math.max(-MAX_TICK_MOVE, Math.min(MAX_TICK_MOVE, result.y - position.y)),
      }
      if (this.coastline && !pointIsInsideIsland(next, this.coastline)) return position
      this.onPosition(next)
      return next
    } catch (reason) {
      this.active = false
      this.onOutput((reason as Error).message)
      return null
    } finally { this.busy = false }
  }

  dispose(): void {
    this.disposed = true
    this.active = false
  }
}
