import { findBlockingCollider, resolveTopDownMovement, type Point, type TopDownCollider } from './movement/TopDownMovementResolver.js'
import { PLAYER_COLLISION_OFFSET, PLAYER_COLLISION_RADIUS } from './player/playerConfig.js'

export const CABIN_WALKABLE = { left: 90, right: 810, top: 78, bottom: 485, hatchLeft: 402, hatchRight: 538, exitY: 530 } as const
/** Insets follow the furniture bases rather than their decorative outlines. */
export const CABIN_OBSTACLES: readonly TopDownCollider[] = [
  { kind: 'rect', id: 'hammock', x: 112, y: 104, width: 184, height: 90 },
  { kind: 'circle', id: 'barrel', x: 744, y: 130, radius: 36 },
  { kind: 'rect', id: 'table', x: 616, y: 235, width: 176, height: 142 },
  { kind: 'rect', id: 'chest', x: 108, y: 367, width: 148, height: 85 },
] as const

export function isCabinPositionWalkable(x: number, y: number, movementUnlocked: boolean): boolean {
  const insideFloor = x >= CABIN_WALKABLE.left && x <= CABIN_WALKABLE.right && y >= CABIN_WALKABLE.top && y <= CABIN_WALKABLE.bottom
  const throughHatch = movementUnlocked && x >= CABIN_WALKABLE.hatchLeft && x <= CABIN_WALKABLE.hatchRight
    && y >= CABIN_WALKABLE.bottom && y <= CABIN_WALKABLE.exitY + 20
  return (insideFloor || throughHatch) && findBlockingCollider(
    { x: x + PLAYER_COLLISION_OFFSET.x, y: y + PLAYER_COLLISION_OFFSET.y },
    { colliders: CABIN_OBSTACLES }, PLAYER_COLLISION_RADIUS,
  ) === null
}

export function resolveCabinMovement(previous: Point, target: Point, movementUnlocked: boolean): Point {
  const offset = PLAYER_COLLISION_OFFSET
  const resolved = resolveTopDownMovement(
    { x: previous.x + offset.x, y: previous.y + offset.y },
    { x: target.x + offset.x, y: target.y + offset.y },
    { colliders: CABIN_OBSTACLES, isAllowed: (p) => {
      const x = p.x - offset.x, y = p.y - offset.y
      const insideFloor = x >= CABIN_WALKABLE.left && x <= CABIN_WALKABLE.right && y >= CABIN_WALKABLE.top && y <= CABIN_WALKABLE.bottom
      const hatch = movementUnlocked && x >= CABIN_WALKABLE.hatchLeft && x <= CABIN_WALKABLE.hatchRight && y >= CABIN_WALKABLE.bottom && y <= CABIN_WALKABLE.exitY + 20
      return insideFloor || hatch
    } },
    PLAYER_COLLISION_RADIUS,
  )
  return { x: resolved.x - offset.x, y: resolved.y - offset.y }
}
