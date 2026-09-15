import Phaser from 'phaser'
import { debugSwitches } from '../../devDiagnostics'
import type { TopDownCollider } from './TopDownMovementResolver'
import type { Point } from './TopDownMovementResolver'

export function createCollisionDebugView(scene: Phaser.Scene, colliders: readonly TopDownCollider[], transitions: readonly TopDownCollider[], spawns: readonly Point[]) {
  if (!debugSwitches.debugCollision) return { updatePlayer: (() => undefined) as (point: Point, radius: number) => void }
  const staticGraphics = scene.add.graphics().setDepth(10_000)
  const draw = (collider: TopDownCollider, color: number) => {
    staticGraphics.lineStyle(2, color, .9)
    if (collider.kind === 'circle') staticGraphics.strokeCircle(collider.x, collider.y, collider.radius)
    else if (collider.kind === 'rect') staticGraphics.strokeRect(collider.x, collider.y, collider.width, collider.height)
    else staticGraphics.save().translateCanvas(collider.x, collider.y).rotateCanvas(collider.angle)
      .strokeRect(-collider.halfWidth, -collider.halfHeight, collider.halfWidth * 2, collider.halfHeight * 2).restore()
  }
  colliders.forEach((collider) => draw(collider, 0xff4050)); transitions.forEach((trigger) => draw(trigger, 0x43d7ff))
  spawns.forEach((spawn) => staticGraphics.lineStyle(2, 0x67ff75).strokeCircle(spawn.x, spawn.y, 6))
  const player = scene.add.graphics().setDepth(10_001)
  return { updatePlayer: (point: Point, radius: number) => player.clear().lineStyle(2, 0xffff45).strokeCircle(point.x, point.y, radius) }
}
