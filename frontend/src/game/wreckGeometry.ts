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
/** Scale used by both the v10 artwork and its collision model. */
export const WRECK_REFERENCE_SCALE = 0.72

/** Converts coordinates from the renderer's unscaled local space to world space. */
export function wreckLocalToWorld(anchor: Point, angle: number, localX: number, localY: number): Point {
  localX *= WRECK_REFERENCE_SCALE
  localY *= WRECK_REFERENCE_SCALE
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
  const point = (x: number, y: number) => wreckLocalToWorld(anchor, angle, x, y)
  const rect = (id: string, x: number, y: number, halfWidth: number, halfHeight: number, rotation = 0): WreckCollider => ({
    kind: 'orientedRect', id, ...point(x, y),
    halfWidth: halfWidth * WRECK_REFERENCE_SCALE,
    halfHeight: halfHeight * WRECK_REFERENCE_SCALE,
    angle: angle + rotation,
  })
  const circle = (id: string, x: number, y: number, radius: number): WreckCollider => ({
    kind: 'circle', id, ...point(x, y), radius: radius * WRECK_REFERENCE_SCALE,
  })
  return {
    anchor, angle, variant, length: 530, width: 220,
    entrance: point(117, 139),
    entranceApproach: point(117, 242),
    colliders: [
      // Thin rails follow the visible hull perimeter. The starboard rail is split
      // around the gangway, rather than turning the whole deck into an obstacle.
      rect('port-side-stern', -205, -125, 105, 8),
      rect('port-side-mid', -45, -120, 57, 8),
      rect('port-side-forward', 82, -111, 58, 8),
      rect('port-side-bow', 205, -91, 54, 8, .17),
      rect('starboard-side-stern', -205, 125, 105, 8),
      rect('starboard-side-mid', -47, 118, 58, 8),
      rect('starboard-side-forward', 211, 88, 55, 8, -.2),
      rect('stern', -324, 0, 9, 86),
      rect('bow-port', 304, -49, 55, 8, .58),
      rect('bow-starboard', 304, 49, 55, 8, -.58),

      // Only physical deck features are solid; raised deck planking remains walkable.
      circle('mast-stump', 8, -6, 27),
      rect('companionway-hole', -77, 0, 35, 18),
      rect('deck-cargo', 231, 40, 47, 25),
      circle('breach', 158, -70, 28),
      rect('shore-cargo', 408, 208, 53, 32),
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
