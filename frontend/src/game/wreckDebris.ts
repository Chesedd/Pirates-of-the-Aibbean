import { pointIsInsideIsland, type Point } from './islandGeometry.js'
import type { WreckLayout } from './wreckGeometry.js'

export type WreckDebrisKind = 'crate' | 'barrel' | 'plank-group' | 'hull-section' | 'spar' | 'deck-section'

export type WreckDebris = Point & {
  kind: WreckDebrisKind
  rotation: number
  scale: number
  count: number
}

export type WreckDebrisLayout = {
  seed: number
  items: readonly WreckDebris[]
}

function hashSeed(seed: number, label: string): number {
  let hash = (seed ^ 0x811c9dc5) >>> 0
  for (let index = 0; index < label.length; index += 1) {
    hash ^= label.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash
}

function seededRandom(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let value = Math.imul(state ^ (state >>> 15), 1 | state)
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function distanceToSegment(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1,
    ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared))
  return Math.hypot(point.x - (start.x + dx * t), point.y - (start.y + dy * t))
}

function localPoint(layout: WreckLayout, x: number, y: number): Point {
  return {
    x: layout.anchor.x + x * Math.cos(layout.angle) - y * Math.sin(layout.angle),
    y: layout.anchor.y + x * Math.sin(layout.angle) + y * Math.cos(layout.angle),
  }
}

/** Shared validation keeps debris on dry land and away from the hull, spawn and gangway route. */
export function isValidWreckDebrisPosition(
  point: Point,
  radius: number,
  layout: WreckLayout,
  coastline: readonly Point[],
  playerSpawn: Point,
): boolean {
  const samples = [point, { x: point.x + radius, y: point.y }, { x: point.x - radius, y: point.y },
    { x: point.x, y: point.y + radius }, { x: point.x, y: point.y - radius }]
  if (!samples.every((sample) => pointIsInsideIsland(sample, coastline as Point[]))) return false
  if (Math.hypot(point.x - playerSpawn.x, point.y - playerSpawn.y) < radius + 110) return false

  const dx = point.x - layout.anchor.x
  const dy = point.y - layout.anchor.y
  const x = dx * Math.cos(layout.angle) + dy * Math.sin(layout.angle)
  const y = -dx * Math.sin(layout.angle) + dy * Math.cos(layout.angle)
  if (Math.abs(x) < layout.length / 2 + radius + 35 && Math.abs(y) < layout.width / 2 + radius + 35) return false

  const farApproach = localPoint(layout, 84, 390)
  return distanceToSegment(point, layout.entrance, farApproach) >= radius + 72
}

/** Generates only the environment around the fixed ship design. */
export function generateWreckDebris(
  generationSeed: number,
  layout: WreckLayout,
  coastline: readonly Point[],
  playerSpawn: Point,
): WreckDebrisLayout {
  const debrisSeed = hashSeed(generationSeed, 'wreck-debris')
  const random = seededRandom(debrisSeed)
  const items: WreckDebris[] = []
  const targets: Array<{ kind: WreckDebrisKind; total: number }> = [
    { kind: 'crate', total: 3 + Math.floor(random() * 5) },
    { kind: 'barrel', total: 3 + Math.floor(random() * 4) },
    { kind: 'plank-group', total: 2 + Math.floor(random() * 4) },
    { kind: 'hull-section', total: 1 + Math.floor(random() * 3) },
  ]
  const clusterCount = 2 + Math.floor(random() * 2)
  const clusters = Array.from({ length: clusterCount }, (_, index) => ({
    x: (index % 2 === 0 ? -1 : 1) * (150 + random() * 220),
    y: 175 + random() * 190,
  }))

  for (const target of targets) {
    for (let itemIndex = 0; itemIndex < target.total; itemIndex += 1) {
      const radius = target.kind === 'hull-section' ? 58 : target.kind === 'plank-group' ? 38 : 28
      for (let attempt = 0; attempt < 80; attempt += 1) {
        const clustered = target.kind === 'crate' || target.kind === 'barrel' || (target.kind === 'plank-group' && random() < .45)
        const cluster = clusters[itemIndex % clusters.length]
        const localX = clustered ? cluster.x + (random() - .5) * 105 : (random() < .5 ? -1 : 1) * (135 + random() * 310)
        const localY = clustered ? cluster.y + (random() - .5) * 85 : 145 + random() * 305
        const point = localPoint(layout, localX, localY)
        if (!isValidWreckDebrisPosition(point, radius, layout, coastline, playerSpawn)) continue
        if (items.some((item) => Math.hypot(item.x - point.x, item.y - point.y) < (clustered ? 28 : 54))) continue
        const largeKinds: WreckDebrisKind[] = ['hull-section', 'spar', 'deck-section']
        items.push({
          ...point,
          kind: target.kind === 'hull-section' ? largeKinds[Math.floor(random() * largeKinds.length)] : target.kind,
          rotation: layout.angle + (random() - .5) * 2.2,
          scale: .82 + random() * .42,
          count: target.kind === 'plank-group' ? 1 + Math.floor(random() * 3) : 1,
        })
        break
      }
    }
  }
  return { seed: debrisSeed, items }
}
