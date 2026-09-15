import Phaser from 'phaser'
import type { GamePosition } from '../../python/pythonProtocol'
import { PLAYER_COLLISION_OFFSET, PLAYER_COLLISION_RADIUS } from '../player/playerConfig'
import type { TopDownCollider } from './TopDownMovementResolver'

/** Authoritative local-player body. Artwork follows it; it never interpolates snapshots. */
export class PlayerMotor {
  readonly object: Phaser.GameObjects.Zone
  readonly body: Phaser.Physics.Arcade.Body
  intent: GamePosition = { x: 0, y: 0 }
  constructor(private readonly scene: Phaser.Scene, readonly avatar: Phaser.GameObjects.Container, position: GamePosition) {
    const diameter = PLAYER_COLLISION_RADIUS * 2
    this.object = scene.add.zone(position.x, position.y, diameter, diameter + PLAYER_COLLISION_OFFSET.y * 2)
    scene.physics.add.existing(this.object)
    this.body = this.object.body as Phaser.Physics.Arcade.Body
    this.body.setCircle(PLAYER_COLLISION_RADIUS, 0, PLAYER_COLLISION_OFFSET.y)
    this.body.setAllowGravity(false).setCollideWorldBounds(false)
    this.follow()
  }
  get position(): GamePosition { return { x: this.object.x, y: this.object.y } }
  setVelocity(value: GamePosition) { this.intent = { ...value }; this.body.setVelocity(value.x, value.y) }
  stop() { this.setVelocity({ x: 0, y: 0 }) }
  follow() { this.avatar.setPosition(this.object.x, this.object.y) }
  destroy() { this.object.destroy() }
}

export function createStaticColliders(scene: Phaser.Scene, colliders: readonly TopDownCollider[]) {
  const group = scene.physics.add.staticGroup()
  const addRect = (x: number, y: number, width: number, height: number) => {
    const object = scene.add.zone(x, y, width, height); scene.physics.add.existing(object, true); group.add(object); return object
  }
  const addCircle = (x: number, y: number, radius: number) => {
    const object = scene.add.zone(x, y, radius * 2, radius * 2); scene.physics.add.existing(object, true)
    ;(object.body as Phaser.Physics.Arcade.StaticBody).setCircle(radius).updateFromGameObject(); group.add(object); return object
  }
  for (const collider of colliders) {
    if (collider.kind === 'rect') addRect(collider.x + collider.width / 2, collider.y + collider.height / 2, collider.width, collider.height)
    else if (collider.kind === 'circle') addCircle(collider.x, collider.y, collider.radius)
    else {
      // Arcade has no rotated boxes: closely-spaced circles trace the rail without a huge invisible AABB.
      const alongX = collider.halfWidth >= collider.halfHeight
      const halfLength = alongX ? collider.halfWidth : collider.halfHeight
      const radius = Math.max(3, alongX ? collider.halfHeight : collider.halfWidth)
      const count = Math.max(2, Math.ceil(halfLength * 2 / (radius * 1.5)))
      for (let i = 0; i < count; i++) {
        const along = -halfLength + i * halfLength * 2 / (count - 1)
        const lx = alongX ? along : 0, ly = alongX ? 0 : along
        addCircle(collider.x + lx * Math.cos(collider.angle) - ly * Math.sin(collider.angle),
          collider.y + lx * Math.sin(collider.angle) + ly * Math.cos(collider.angle), radius)
      }
    }
  }
  return group
}
