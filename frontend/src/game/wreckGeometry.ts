import { ISLAND_CENTER, type Point } from './islandGeometry.js'

export type WreckCollider =
  | { kind: 'orientedRect'; id: string; x: number; y: number; halfWidth: number; halfHeight: number; angle: number }
  | { kind: 'circle'; id: string; x: number; y: number; radius: number }

export type WreckLayout = {
  anchor: Point
  angle: number
  variant: number
  length: number
  width: number
  entrance: Point
  entranceApproach: Point
  colliders: readonly WreckCollider[]
}

const PLAYER_RADIUS = 18

function worldPoint(anchor: Point, angle: number, localX: number, localY: number): Point {
  return {
    x: anchor.x + localX * Math.cos(angle) - localY * Math.sin(angle),
    y: anchor.y + localX * Math.sin(angle) + localY * Math.cos(angle),
  }
}

/** Builds a large ship tangent to the nearby shore, with its entrance facing inland. */
export function createWreckLayout(seed: number, anchor: Point): WreckLayout {
  const inwardAngle = Math.atan2(ISLAND_CENTER - anchor.y, ISLAND_CENTER - anchor.x)
  const jitter = ((((seed >>> 0) * 2654435761) >>> 0) / 0xffffffff - .5) * .22
  const angle = inwardAngle - Math.PI / 2 + jitter
  const variant = (seed >>> 0) % 3
  const hull = worldPoint(anchor, angle, 0, -85)
  const crate = worldPoint(anchor, angle, -238, -7)
  const barrel = worldPoint(anchor, angle, 231, 8)
  return {
    anchor, angle, variant, length: 520, width: 190,
    entrance: worldPoint(anchor, angle, 0, -18),
    entranceApproach: worldPoint(anchor, angle, 0, 55),
    colliders: [
      { kind: 'orientedRect', id: 'main-hull', x: hull.x, y: hull.y, halfWidth: 194, halfHeight: 61, angle },
      { kind: 'orientedRect', id: 'large-crate', x: crate.x, y: crate.y, halfWidth: 27, halfHeight: 24, angle: angle + .08 },
      { kind: 'circle', id: 'barrel', x: barrel.x, y: barrel.y, radius: 22 },
    ],
  }
}

export function isWreckPositionWalkable(point: Point, layout: WreckLayout): boolean {
  return !layout.colliders.some((collider) => {
    if (collider.kind === 'circle') {
      return Math.hypot(point.x - collider.x, point.y - collider.y) < collider.radius + PLAYER_RADIUS
    }
    const dx = point.x - collider.x
    const dy = point.y - collider.y
    const localX = dx * Math.cos(collider.angle) + dy * Math.sin(collider.angle)
    const localY = -dx * Math.sin(collider.angle) + dy * Math.cos(collider.angle)
    return Math.abs(localX) < collider.halfWidth + PLAYER_RADIUS
      && Math.abs(localY) < collider.halfHeight + PLAYER_RADIUS
  })
}

export function resolveWreckMovement(previous: Point, target: Point, layout: WreckLayout): Point {
  if (isWreckPositionWalkable(target, layout)) return target
  if (isWreckPositionWalkable({ x: target.x, y: previous.y }, layout)) return { x: target.x, y: previous.y }
  if (isWreckPositionWalkable({ x: previous.x, y: target.y }, layout)) return { x: previous.x, y: target.y }
  return previous
}
