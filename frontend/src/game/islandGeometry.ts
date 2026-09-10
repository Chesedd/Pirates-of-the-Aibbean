export const ISLAND_SIZE = 5200
export const ISLAND_CENTER = ISLAND_SIZE / 2
export const ISLAND_VERTEX_COUNT = 144

export type Point = { x: number; y: number }

export function configureIslandCamera(camera: {
  setBounds(x: number, y: number, width: number, height: number): unknown
  startFollow(target: unknown, roundPixels: boolean, lerpX: number, lerpY: number): unknown
}, player: unknown): void {
  camera.setBounds(0, 0, ISLAND_SIZE, ISLAND_SIZE)
  camera.startFollow(player, true, 0.12, 0.12)
}

function seededRandom(seed: number) {
  let state = (seed ^ Math.floor(seed / 0x100000000)) >>> 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let value = Math.imul(state ^ (state >>> 15), 1 | state)
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

/** A star-shaped coastline stays connected while layered harmonics make coves and headlands. */
export function generateIslandGeometry(seed: number): Point[] {
  const random = seededRandom(seed)
  const harmonics = Array.from({ length: 9 }, (_, index) => ({
    frequency: index + 2,
    amplitude: (index < 3 ? 0.075 : 0.035) * (0.7 + random() * 0.6),
    phase: random() * Math.PI * 2,
  }))
  const stretchX = 0.9 + random() * 0.13
  const stretchY = 0.84 + random() * 0.14
  const rotation = (random() - 0.5) * 0.35
  const baseRadius = 2200

  return Array.from({ length: ISLAND_VERTEX_COUNT }, (_, index) => {
    const angle = index / ISLAND_VERTEX_COUNT * Math.PI * 2
    const variation = harmonics.reduce(
      (sum, wave) => sum + Math.sin(angle * wave.frequency + wave.phase) * wave.amplitude,
      0,
    )
    const radius = baseRadius * Math.max(0.68, Math.min(1.16, 1 + variation))
    const localX = Math.cos(angle) * radius * stretchX
    const localY = Math.sin(angle) * radius * stretchY
    return {
      x: ISLAND_CENTER + localX * Math.cos(rotation) - localY * Math.sin(rotation),
      y: ISLAND_CENTER + localX * Math.sin(rotation) + localY * Math.cos(rotation),
    }
  })
}

export function pointIsInsideIsland(point: Point, coastline: Point[]): boolean {
  let inside = false
  for (let current = 0, previous = coastline.length - 1; current < coastline.length; previous = current++) {
    const a = coastline[current]
    const b = coastline[previous]
    if ((a.y > point.y) !== (b.y > point.y)
      && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}
