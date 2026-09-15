import { ISLAND_CENTER, pointIsInsideIsland, type Point } from './islandGeometry.js'
import { findBlockingCollider, resolveTopDownMovement, type TopDownCollider } from './movement/TopDownMovementResolver.js'
import { PLAYER_COLLISION_RADIUS } from './player/playerConfig.js'

export type WreckCollider = TopDownCollider

export type WreckLayout = {
  anchor: Point
  angle: number
  variant: number
  length: number
  width: number
  entrance: Point
  entranceApproach: Point
  companionwayEntry: Point
  companionwayReturn: Point
  colliders: readonly WreckCollider[]
}

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
    // The trigger sits just inside the collision boundary and is inspected on
    // raw intended movement; the return point remains safely on the deck.
    companionwayEntry: point(-132, 0),
    companionwayReturn: point(-155, 0),
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
      // The companionway itself is a transition sensor, not a solid obstacle.
      // Match the separately drawn crate and barrel instead of blocking the
      // otherwise empty strip of deck between them.
      rect('deck-crate', 212, 46, 22, 22),
      circle('deck-barrel', 259, 48, 20),
      circle('breach', 158, -70, 28),
      rect('shore-cargo', 408, 208, 53, 32),
    ],
  }
}

/** Detects a movement segment entering the small deck-side companionway trigger. */
export function entersCompanionway(previous: Point, target: Point, layout: WreckLayout): boolean {
  const dx = target.x - previous.x
  const dy = target.y - previous.y
  const lengthSquared = dx * dx + dy * dy
  const projection = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1,
    ((layout.companionwayEntry.x - previous.x) * dx + (layout.companionwayEntry.y - previous.y) * dy) / lengthSquared))
  const closestX = previous.x + dx * projection
  const closestY = previous.y + dy * projection
  return Math.hypot(closestX - layout.companionwayEntry.x, closestY - layout.companionwayEntry.y) <= 10
}

export function isWreckPositionWalkable(point: Point, layout: WreckLayout): boolean {
  return findBlockingWreckCollider(point, layout) === null
}

/** Returns the concrete obstacle responsible for a rejected position. */
export function findBlockingWreckCollider(point: Point, layout: WreckLayout): string | null {
  return findBlockingCollider(point, { colliders: layout.colliders }, PLAYER_COLLISION_RADIUS)
}

/** Finds the nearest dry, collision-free point while favouring small local corrections. */
export function recoverWreckPosition(point: Point, layout: WreckLayout, coastline: readonly Point[]): Point {
  if (isWreckPositionWalkable(point, layout) && pointIsInsideIsland(point, coastline as Point[])) return point
  for (let radius = 8; radius <= 192; radius += 8) {
    const directions = Math.max(16, Math.ceil(Math.PI * 2 * radius / 8))
    for (let index = 0; index < directions; index += 1) {
      const angle = index / directions * Math.PI * 2
      const candidate = { x: point.x + Math.cos(angle) * radius, y: point.y + Math.sin(angle) * radius }
      if (pointIsInsideIsland(candidate, coastline as Point[]) && isWreckPositionWalkable(candidate, layout)) return candidate
    }
  }
  // The approach is generated on dry land and is the safe deterministic fallback.
  return layout.entranceApproach
}

export function resolveWreckMovement(previous: Point, target: Point, layout: WreckLayout): Point {
  return resolveTopDownMovement(previous, target, { colliders: layout.colliders }, PLAYER_COLLISION_RADIUS)
}
