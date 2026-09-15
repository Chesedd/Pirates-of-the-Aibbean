export type Velocity = { x: number; y: number }
export const PLAYER_MAX_SPEED = 160
export const PLAYER_ACCELERATION = 1100
export const PLAYER_BRAKING = 1800
export const PLAYER_TURN_ACCELERATION = 2200

export function moveTowardsVelocity(current: Velocity, target: Velocity, maximumDelta: number): Velocity {
  const dx = target.x - current.x, dy = target.y - current.y
  const distance = Math.hypot(dx, dy)
  if (distance === 0 || distance <= maximumDelta) return { ...target }
  return { x: current.x + dx / distance * maximumDelta, y: current.y + dy / distance * maximumDelta }
}

/** Converts Python's target velocity into a responsive, continuous motor velocity. */
export function stepPlayerVelocity(current: Velocity, target: Velocity, deltaSeconds: number): Velocity {
  const targetLength = Math.hypot(target.x, target.y)
  const cappedTarget = targetLength > PLAYER_MAX_SPEED
    ? { x: target.x / targetLength * PLAYER_MAX_SPEED, y: target.y / targetLength * PLAYER_MAX_SPEED }
    : target
  const stopped = Math.hypot(cappedTarget.x, cappedTarget.y) < .001
  const reversing = current.x * cappedTarget.x + current.y * cappedTarget.y < 0
  const rate = stopped ? PLAYER_BRAKING : reversing ? PLAYER_TURN_ACCELERATION : PLAYER_ACCELERATION
  return moveTowardsVelocity(current, cappedTarget, rate * Math.min(deltaSeconds, .05))
}
