import Phaser from 'phaser'
import { pointIsInsideIsland, type Point } from './islandGeometry'
import { portalContains, type LocationPortal } from './locations/LocationPortal'
import type { PlayerMotor } from './movement/PlayerMotor'
import { debrisPushVelocity, type WreckDebris, type WreckDebrisLayout } from './wreckDebris'
import { debugSwitches } from '../devDiagnostics'

export const DEBRIS_SLEEP_SPEED = 3

export function constrainedDebrisPosition(previous: Point, next: Point, radius: number, coastline: readonly Point[], portal: LocationPortal): Point {
  const valid = (point: Point) => pointIsInsideIsland(point, coastline as Point[]) && !portalContains(portal, point, radius + 8)
  if (valid(next)) return next
  const xOnly = { x: next.x, y: previous.y }, yOnly = { x: previous.x, y: next.y }
  if (valid(xOnly)) return xOnly
  if (valid(yOnly)) return yOnly
  return previous
}

type PhysicalItem = { item: WreckDebris; object: Phaser.GameObjects.Graphics; body: Phaser.Physics.Arcade.Body; previous: Point; pushed: boolean; label?: Phaser.GameObjects.Text }

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
      body.setAllowGravity(false).setMass(config.mass).setDrag(config.drag, config.drag).setMaxVelocity(config.maxSpeed, config.maxSpeed)
        .setBounce(0).setImmovable(!config.pushable).setSlideFactor(config.slideFactor)
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
    scene.physics.add.collider(this.group, this.group)
    scene.physics.add.collider(player.object, this.group, (_player, debris) => {
      const entry = this.physical.find((candidate) => candidate.object === debris)
      if (!entry || !entry.item.physics.pushable) return
      entry.pushed = true
      const velocity = debrisPushVelocity(entry.item.kind, player.body.velocity)
      entry.body.setVelocity(velocity.x, velocity.y)
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
      if (!entry.pushed && entry.body.speed < DEBRIS_SLEEP_SPEED) entry.body.setVelocity(0, 0)
      entry.object.setData('physics-debug', `${entry.item.kind} · ${entry.item.physics.pushable ? entry.item.physics.mass : 'fixed'} · ${entry.body.speed < DEBRIS_SLEEP_SPEED ? 'sleep' : 'moving'}`)
      entry.label?.setPosition(entry.object.x, entry.object.y - entry.body.halfHeight - 14).setText(
        `${entry.item.kind} · ${entry.item.physics.pushable ? entry.item.physics.mass : 'fixed'}\n${entry.object.getData('body-shape')} · v ${entry.body.velocity.x.toFixed(0)},${entry.body.velocity.y.toFixed(0)} · ${entry.body.speed < DEBRIS_SLEEP_SPEED ? 'sleep' : 'moving'}`)
      entry.previous = { x: entry.object.x, y: entry.object.y }; entry.pushed = false
    }
  }
}
