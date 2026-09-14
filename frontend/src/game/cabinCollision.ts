export type CabinObstacle =
  | { kind: 'rect'; id: string; x: number; y: number; width: number; height: number }
  | { kind: 'circle'; id: string; x: number; y: number; radius: number }

export const CABIN_WALKABLE = {
  left: 90, right: 810, top: 78, bottom: 485, hatchLeft: 402, hatchRight: 538, exitY: 530,
} as const

/** The deliberately small, top-down collision map mirrors only substantial furniture. */
export const CABIN_OBSTACLES: readonly CabinObstacle[] = [
  { kind: 'rect', id: 'hammock', x: 100, y: 92, width: 208, height: 114 },
  { kind: 'circle', id: 'barrel', x: 744, y: 130, radius: 48 },
  { kind: 'rect', id: 'table', x: 600, y: 219, width: 208, height: 174 },
  { kind: 'rect', id: 'chest', x: 95, y: 354, width: 174, height: 111 },
] as const

export const CABIN_PLAYER_RADIUS = 18

function overlapsObstacle(x: number, y: number, obstacle: CabinObstacle): boolean {
  if (obstacle.kind === 'circle') {
    return Math.hypot(x - obstacle.x, y - obstacle.y) < obstacle.radius + CABIN_PLAYER_RADIUS
  }
  const nearestX = Math.max(obstacle.x, Math.min(x, obstacle.x + obstacle.width))
  const nearestY = Math.max(obstacle.y, Math.min(y, obstacle.y + obstacle.height))
  return Math.hypot(x - nearestX, y - nearestY) < CABIN_PLAYER_RADIUS
}

/** Validates logical coordinates before SmoothPlayerPosition receives a new target. */
export function isCabinPositionWalkable(x: number, y: number, movementUnlocked: boolean): boolean {
  const insideWidth = x >= CABIN_WALKABLE.left && x <= CABIN_WALKABLE.right
  const insideFloor = y >= CABIN_WALKABLE.top && y <= CABIN_WALKABLE.bottom
  const throughHatch = movementUnlocked
    && x >= CABIN_WALKABLE.hatchLeft && x <= CABIN_WALKABLE.hatchRight
    && y >= CABIN_WALKABLE.top && y <= CABIN_WALKABLE.exitY + 20
  return insideWidth && (insideFloor || throughHatch)
    && !CABIN_OBSTACLES.some((obstacle) => overlapsObstacle(x, y, obstacle))
}

export function resolveCabinMovement(
  previous: { x: number; y: number },
  target: { x: number; y: number },
  movementUnlocked: boolean,
) {
  if (isCabinPositionWalkable(target.x, target.y, movementUnlocked)) return target
  // Axis fallback lets the player slide along furniture instead of sticking to its corners.
  if (isCabinPositionWalkable(target.x, previous.y, movementUnlocked)) return { x: target.x, y: previous.y }
  if (isCabinPositionWalkable(previous.x, target.y, movementUnlocked)) return { x: previous.x, y: target.y }
  return previous
}
