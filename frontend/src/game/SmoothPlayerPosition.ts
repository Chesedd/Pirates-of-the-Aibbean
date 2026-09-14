export type MutablePosition = { x: number; y: number; setPosition(x: number, y: number): unknown }

/** Keeps simulation coordinates independent from a time-based visual interpolation. */
export class SmoothPlayerPosition {
  readonly logical: { x: number; y: number }
  private start: { x: number; y: number }
  private target: { x: number; y: number }
  private startTime = 0

  constructor(private readonly object: MutablePosition, initial: { x: number; y: number }, private readonly duration = 50) {
    this.logical = { ...initial }
    this.start = { ...initial }
    this.target = { ...initial }
  }

  setLogicalTarget(target: { x: number; y: number }, now: number): void {
    this.start = { x: this.object.x, y: this.object.y }
    this.target = { ...target }
    this.logical.x = target.x
    this.logical.y = target.y
    this.startTime = now
  }

  update(now: number): void {
    const t = Math.max(0, Math.min(1, (now - this.startTime) / this.duration))
    this.object.setPosition(
      this.start.x + (this.target.x - this.start.x) * t,
      this.start.y + (this.target.y - this.start.y) * t,
    )
  }
}
