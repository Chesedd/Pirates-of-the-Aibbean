export type Point = { x: number; y: number }
export type CircleCollider = { kind: 'circle'; id: string; x: number; y: number; radius: number }
export type RectCollider = { kind: 'rect'; id: string; x: number; y: number; width: number; height: number }
export type OrientedRectCollider = { kind: 'orientedRect'; id: string; x: number; y: number; halfWidth: number; halfHeight: number; angle: number }
export type TopDownCollider = CircleCollider | RectCollider | OrientedRectCollider
export type CollisionWorld = { colliders: readonly TopDownCollider[]; isAllowed?: (point: Point) => boolean }
export const MAX_MOVEMENT_SUBSTEP = 3

type Contact = { normal: Point; depth: number; id: string }
function contact(point: Point, radius: number, collider: TopDownCollider, motion?: Point): Contact | null {
  if (collider.kind === 'circle') {
    const dx = point.x - collider.x, dy = point.y - collider.y
    const distance = Math.hypot(dx, dy), depth = radius + collider.radius - distance
    if (depth <= 0) return null
    return { id: collider.id, depth, normal: distance ? { x: dx / distance, y: dy / distance } : { x: 1, y: 0 } }
  }
  const angle = collider.kind === 'orientedRect' ? collider.angle : 0
  const halfWidth = collider.kind === 'orientedRect' ? collider.halfWidth : collider.width / 2
  const halfHeight = collider.kind === 'orientedRect' ? collider.halfHeight : collider.height / 2
  const cx = collider.kind === 'orientedRect' ? collider.x : collider.x + halfWidth
  const cy = collider.kind === 'orientedRect' ? collider.y : collider.y + halfHeight
  const cos = Math.cos(angle), sin = Math.sin(angle), dx = point.x - cx, dy = point.y - cy
  const lx = dx * cos + dy * sin, ly = -dx * sin + dy * cos
  const qx = Math.max(-halfWidth, Math.min(lx, halfWidth)), qy = Math.max(-halfHeight, Math.min(ly, halfHeight))
  const ox = lx - qx, oy = ly - qy, distance = Math.hypot(ox, oy)
  if (distance >= radius) return null
  let nx: number, ny: number, depth: number
  if (distance > 1e-6) { nx = ox / distance; ny = oy / distance; depth = radius - distance }
  else {
    const px = halfWidth + radius - Math.abs(lx), py = halfHeight + radius - Math.abs(ly)
    const localMotion = motion ? { x: motion.x * cos + motion.y * sin, y: -motion.x * sin + motion.y * cos } : null
    if (px < py) { nx = localMotion?.x ? -Math.sign(localMotion.x) : Math.sign(lx) || 1; ny = 0; depth = px }
    else { nx = 0; ny = localMotion?.y ? -Math.sign(localMotion.y) : Math.sign(ly) || 1; depth = py }
  }
  return { id: collider.id, depth, normal: { x: nx * cos - ny * sin, y: nx * sin + ny * cos } }
}

export function findBlockingCollider(point: Point, world: CollisionWorld, radius: number): string | null {
  return world.colliders.map((c) => contact(point, radius, c)).filter((c): c is Contact => Boolean(c))
    .sort((a, b) => b.depth - a.depth)[0]?.id ?? null
}

/** Sub-stepped move-and-slide using minimum-translation collision normals. */
export function resolveTopDownMovement(previous: Point, target: Point, world: CollisionWorld, radius: number): Point {
  const dx = target.x - previous.x, dy = target.y - previous.y
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / MAX_MOVEMENT_SUBSTEP))
  let position = { ...previous }
  let collided = false
  for (let step = 0; step < steps; step += 1) {
    const intended = { x: position.x + dx / steps, y: position.y + dy / steps }
    let candidate = intended
    for (let pass = 0; pass < 4; pass += 1) {
      let changed = false
      for (const collider of world.colliders) {
        const hit = contact(candidate, radius, collider, { x: dx / steps, y: dy / steps })
        if (!hit) continue
        collided = true
        candidate = {
          x: candidate.x + hit.normal.x * (hit.depth + 1e-4),
          y: candidate.y + hit.normal.y * (hit.depth + 1e-4),
        }
        changed = true
      }
      if (!changed) break
    }
    if (!world.isAllowed || world.isAllowed(candidate)) position = candidate
  }
  return !collided && (!world.isAllowed || world.isAllowed(target)) ? { ...target } : position
}
