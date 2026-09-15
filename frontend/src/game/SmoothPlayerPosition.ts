export type MutablePosition = { x: number; y: number; setPosition(x: number, y: number): unknown }

type Position = { x: number; y: number }
type PositionSample = { position: Position; timestamp: number }

export const PLAYER_VISUAL_BUFFER_MS = 80
const MAX_SAMPLES = 5
const TELEPORT_DISTANCE = 128

/**
 * Keeps authoritative simulation coordinates separate from the rendered player.
 * Rendering deliberately trails the logical samples so uneven Python completion
 * times can be interpolated instead of turning into a series of short tweens.
 */
export class SmoothPlayerPosition {
  readonly logical: Position
  private samples: PositionSample[]

  constructor(
    private readonly object: MutablePosition,
    initial: Position,
    private readonly visualBuffer = PLAYER_VISUAL_BUFFER_MS,
  ) {
    this.logical = { ...initial }
    this.samples = [{ position: { ...initial }, timestamp: 0 }]
    this.object.setPosition(initial.x, initial.y)
  }

  setLogicalTarget(target: Position, now: number): void {
    if (Math.hypot(target.x - this.logical.x, target.y - this.logical.y) > TELEPORT_DISTANCE) {
      this.reset(target, now)
      return
    }
    this.logical.x = target.x
    this.logical.y = target.y
    const timestamp = Math.max(now, this.samples.at(-1)?.timestamp ?? now)
    this.samples.push({ position: { ...target }, timestamp })
    if (this.samples.length > MAX_SAMPLES) this.samples.shift()
  }

  reset(position: Position, now = 0): void {
    this.logical.x = position.x
    this.logical.y = position.y
    this.samples = [{ position: { ...position }, timestamp: now }]
    this.object.setPosition(position.x, position.y)
  }

  update(now: number): void {
    const renderTime = now - this.visualBuffer
    let before = this.samples[0]
    let after = this.samples[0]
    for (const sample of this.samples) {
      if (sample.timestamp <= renderTime) before = sample
      if (sample.timestamp >= renderTime) {
        after = sample
        break
      }
      after = sample
    }
    const interval = after.timestamp - before.timestamp
    const t = interval > 0 ? Math.max(0, Math.min(1, (renderTime - before.timestamp) / interval)) : 0
    this.object.setPosition(
      before.position.x + (after.position.x - before.position.x) * t,
      before.position.y + (after.position.y - before.position.y) * t,
    )
  }
}
