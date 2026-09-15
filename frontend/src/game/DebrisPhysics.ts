import Phaser from 'phaser'
import { pointIsInsideIsland, type Point } from './islandGeometry'
import { portalContains, type LocationPortal } from './locations/LocationPortal'
import type { PlayerMotor } from './movement/PlayerMotor'
import { debrisAngularImpulse, debrisPushVelocity, type WreckDebris, type WreckDebrisLayout } from './wreckDebris'
import { debugSwitches } from '../devDiagnostics'

export const DEBRIS_SLEEP_SPEED = 3
export const DEBRIS_SLEEP_ANGULAR_SPEED = 3

export function constrainedDebrisPosition(previous: Point, next: Point, radius: number, coastline: readonly Point[], portal: LocationPortal): Point {
  const valid = (point: Point) => pointIsInsideIsland(point, coastline as Point[]) && !portalContains(portal, point, radius + 8)
  if (valid(next)) return next
  const xOnly = { x: next.x, y: previous.y }, yOnly = { x: previous.x, y: next.y }
  if (valid(xOnly)) return xOnly
  if (valid(yOnly)) return yOnly
  return previous
}

type PhysicalItem = { item: WreckDebris; object: Phaser.GameObjects.Graphics; body: Phaser.Physics.Arcade.Body; previous: Point; pushed: boolean; label?: Phaser.GameObjects.Text }

function approximateContact(entry: PhysicalItem, point: Point): Point {
  const { body, object, item } = entry
  if (item.physics.radius) {
    const dx = point.x - object.x, dy = point.y - object.y
    const length = Math.hypot(dx, dy) || 1
    const radius = item.physics.radius * item.scale
    return { x: object.x + dx / length * radius, y: object.y + dy / length * radius }
  }
  return {
    x: Phaser.Math.Clamp(point.x, body.left, body.right),
    y: Phaser.Math.Clamp(point.y, body.top, body.bottom),
  }
}

export function settleDebris(body: Phaser.Physics.Arcade.Body, pushed: boolean) {
  if (!pushed && body.speed < DEBRIS_SLEEP_SPEED) body.setVelocity(0, 0)
  if (!pushed && Math.abs(body.angularVelocity) < DEBRIS_SLEEP_ANGULAR_SPEED) body.setAngularVelocity(0)
}

export class DebrisPhysics {
  private readonly group: Phaser.Physics.Arcade.Group
  private readonly physical: PhysicalItem[]
  constructor(scene: Phaser.Scene, layout: WreckDebrisLayout, objects: Phaser.GameObjects.Graphics[], player: PlayerMotor,
    solids: Phaser.Physics.Arcade.StaticGroup, private readonly coastline: readonly Point[], private readonly portal: LocationPortal) {
    this.group = scene.physics.add.group()
    this.physical = layout.items.map((item, index) => {
      const object = objects[index]
      scene.physics.add.existing(object)
      const body = object.body as Phaser.Physics.Arcade.Body
      const config = item.physics
      if (config.radius) body.setCircle(config.radius * item.scale)
      else body.setSize((config.width ?? 20) * item.scale, (config.height ?? 20) * item.scale, true)
      body.setAllowGravity(false).setAcceleration(0, 0).setMass(config.mass).setDamping(true)
        .setDrag(config.damping, config.damping).setMaxSpeed(config.maxSpeed)
        .setBounce(0).setImmovable(!config.pushable).setSlideFactor(config.slideFactor)
        .setAllowRotation(config.rotationEnabled).setAngularDrag(config.angularDrag)
      body.maxAngular = config.maxAngularVelocity
      body.pushable = config.pushable
      this.group.add(object)
      const shape = config.radius ? 'circle' : 'rect'
      const label = debugSwitches.debugCollision ? scene.add.text(object.x, object.y - body.halfHeight - 14, '', {
        color: '#7dff9b', fontSize: '11px', backgroundColor: '#08150dcc', padding: { x: 3, y: 2 },
      }).setOrigin(.5).setDepth(6000) : undefined
      object.setData('body-shape', shape)
      return { item, object, body, previous: { x: object.x, y: object.y }, pushed: false, label }
    })
    scene.physics.add.collider(this.group, solids)
    scene.physics.add.collider(this.group, this.group, (first, second) => {
      const a = this.physical.find((entry) => entry.object === first)
      const b = this.physical.find((entry) => entry.object === second)
      if (!a || !b) return
      const relativeVelocity = { x: a.body.velocity.x - b.body.velocity.x, y: a.body.velocity.y - b.body.velocity.y }
      const contact = { x: (a.object.x + b.object.x) / 2, y: (a.object.y + b.object.y) / 2 }
      a.body.setAngularVelocity(Phaser.Math.Clamp(a.body.angularVelocity + debrisAngularImpulse(a.item.kind, a.object, contact, relativeVelocity, .22), -a.item.physics.maxAngularVelocity, a.item.physics.maxAngularVelocity))
      b.body.setAngularVelocity(Phaser.Math.Clamp(b.body.angularVelocity + debrisAngularImpulse(b.item.kind, b.object, contact, relativeVelocity, -.22), -b.item.physics.maxAngularVelocity, b.item.physics.maxAngularVelocity))
    })
    scene.physics.add.collider(player.object, this.group, (_player, debris) => {
      const entry = this.physical.find((candidate) => candidate.object === debris)
      if (!entry || !entry.item.physics.pushable) return
      entry.pushed = true
      const velocity = debrisPushVelocity(entry.item.kind, player.body.velocity)
      entry.body.setVelocity(velocity.x, velocity.y)
      entry.body.acceleration.set(0, 0)
      const contact = approximateContact(entry, player.object)
      const angularImpulse = debrisAngularImpulse(entry.item.kind, entry.object, contact, player.body.velocity)
      entry.body.setAngularVelocity(Phaser.Math.Clamp(entry.body.angularVelocity + angularImpulse,
        -entry.item.physics.maxAngularVelocity, entry.item.physics.maxAngularVelocity))
      player.body.velocity.scale(Math.max(.2, .9 - entry.item.physics.mass * .08))
    })
  }
  update() {
    for (const entry of this.physical) {
      const radius = Math.max(entry.body.halfWidth, entry.body.halfHeight)
      const next = constrainedDebrisPosition(entry.previous, entry.object, radius, this.coastline, this.portal)
      if (next.x !== entry.object.x || next.y !== entry.object.y) {
        entry.object.setPosition(next.x, next.y); entry.body.updateFromGameObject()
        if (next.x === entry.previous.x) entry.body.velocity.x = 0
        if (next.y === entry.previous.y) entry.body.velocity.y = 0
      }
      settleDebris(entry.body, entry.pushed)
      const state = `${entry.item.kind}\nspeed: ${entry.body.speed.toFixed(1)}\nangular: ${entry.body.angularVelocity.toFixed(1)}°\ndamping: ${entry.item.physics.damping}\nslide: ${entry.item.physics.slideFactor}\nmass: ${entry.item.physics.mass}\npushed: ${entry.pushed ? 'yes' : 'no'}`
      entry.object.setData('physics-debug', state)
      entry.label?.setPosition(entry.object.x, entry.object.y - entry.body.halfHeight - 14).setText(
        `${state}\nshape: ${entry.object.getData('body-shape')}`)
      entry.previous = { x: entry.object.x, y: entry.object.y }; entry.pushed = false
    }
  }
}
