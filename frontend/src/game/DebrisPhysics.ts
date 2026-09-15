import Phaser from 'phaser'
import { pointIsInsideIsland, type Point } from './islandGeometry'
import { portalContains, type LocationPortal } from './locations/LocationPortal'
import type { PlayerMotor } from './movement/PlayerMotor'
import { angularApproachSpeed, debrisAngularImpulse, debrisPushVelocity, MIN_ANGULAR_IMPACT_SPEED, shouldApplyAngularImpact, type WreckDebris, type WreckDebrisLayout } from './wreckDebris'
import { debugSwitches, devDiagnosticsEnabled } from '../devDiagnostics'

export const DEBRIS_SLEEP_SPEED = 3
export const DEBRIS_SLEEP_ANGULAR_SPEED = 6

export function constrainedDebrisPosition(previous: Point, next: Point, radius: number, coastline: readonly Point[], portal: LocationPortal): Point {
  const valid = (point: Point) => pointIsInsideIsland(point, coastline as Point[]) && !portalContains(portal, point, radius + 8)
  if (valid(next)) return next
  const xOnly = { x: next.x, y: previous.y }, yOnly = { x: previous.x, y: next.y }
  if (valid(xOnly)) return xOnly
  if (valid(yOnly)) return yOnly
  return previous
}

type PhysicalItem = {
  id: number; item: WreckDebris; object: Phaser.GameObjects.Graphics; body: Phaser.Physics.Arcade.Body; previous: Point
  linearPushed: boolean; angularImpulseApplied: boolean; lastAngularImpactAt: number; spinStartedAt?: number
  collidingWith: Set<string>; label?: Phaser.GameObjects.Text
}
type ImpactContact = { lastSeenAt: number; lastImpactAt: number; strong: boolean }

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

export function settleDebris(body: Phaser.Physics.Arcade.Body, linearPushed: boolean, angularImpulseApplied: boolean) {
  if (!linearPushed && body.speed < DEBRIS_SLEEP_SPEED) body.setVelocity(0, 0)
  if (!angularImpulseApplied && Math.abs(body.angularVelocity) < DEBRIS_SLEEP_ANGULAR_SPEED) body.setAngularVelocity(0)
}

export class DebrisPhysics {
  private readonly group: Phaser.Physics.Arcade.Group
  private readonly physical: PhysicalItem[]
  private readonly impacts = new Map<string, ImpactContact>()
  private stuckSince?: { at: number; position: Point }
  private lastStuckReportAt = -Infinity
  constructor(private readonly scene: Phaser.Scene, layout: WreckDebrisLayout, objects: Phaser.GameObjects.Graphics[], private readonly player: PlayerMotor,
    private readonly solids: Phaser.Physics.Arcade.StaticGroup, private readonly coastline: readonly Point[], private readonly portal: LocationPortal) {
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
      return { id: index, item, object, body, previous: { x: object.x, y: object.y }, linearPushed: false,
        angularImpulseApplied: false, lastAngularImpactAt: -Infinity, collidingWith: new Set(), label }
    })
    scene.physics.add.collider(this.group, solids)
    scene.physics.add.collider(this.group, this.group, (first, second) => {
      const a = this.physical.find((entry) => entry.object === first)
      const b = this.physical.find((entry) => entry.object === second)
      if (!a || !b) return
      a.collidingWith.add(`${b.id}:${b.item.kind}`); b.collidingWith.add(`${a.id}:${a.item.kind}`)
      const now = scene.time.now
      const key = a.id < b.id ? `${a.id}:${b.id}` : `${b.id}:${a.id}`
      const contactState = this.impacts.get(key) ?? { lastSeenAt: -Infinity, lastImpactAt: -Infinity, strong: false }
      if (now - contactState.lastSeenAt > 50) contactState.strong = false
      contactState.lastSeenAt = now
      const relativeVelocity = { x: b.body.velocity.x - a.body.velocity.x, y: b.body.velocity.y - a.body.velocity.y }
      const normal = { x: b.object.x - a.object.x, y: b.object.y - a.object.y }
      const strong = angularApproachSpeed(relativeVelocity, normal) >= MIN_ANGULAR_IMPACT_SPEED
      const newImpact = shouldApplyAngularImpact(angularApproachSpeed(relativeVelocity, normal), contactState.strong, now - contactState.lastImpactAt)
      contactState.strong = strong; this.impacts.set(key, contactState)
      if (!newImpact) return
      contactState.lastImpactAt = now
      const contact = { x: (a.object.x + b.object.x) / 2, y: (a.object.y + b.object.y) / 2 }
      const impactVelocity = { x: -relativeVelocity.x, y: -relativeVelocity.y }
      a.body.setAngularVelocity(Phaser.Math.Clamp(a.body.angularVelocity + debrisAngularImpulse(a.item.kind, a.object, contact, impactVelocity, .22, a.item.physics), -a.item.physics.maxAngularVelocity, a.item.physics.maxAngularVelocity))
      b.body.setAngularVelocity(Phaser.Math.Clamp(b.body.angularVelocity + debrisAngularImpulse(b.item.kind, b.object, contact, impactVelocity, -.22, b.item.physics), -b.item.physics.maxAngularVelocity, b.item.physics.maxAngularVelocity))
      for (const entry of [a, b]) { entry.angularImpulseApplied = true; entry.lastAngularImpactAt = now }
    })
    scene.physics.add.collider(player.object, this.group, (_player, debris) => {
      const entry = this.physical.find((candidate) => candidate.object === debris)
      if (!entry || !entry.item.physics.pushable) return
      entry.linearPushed = true; entry.collidingWith.add('player')
      const velocity = debrisPushVelocity(entry.item.kind, player.body.velocity, entry.item.physics)
      entry.body.setVelocity(velocity.x, velocity.y)
      entry.body.acceleration.set(0, 0)
      const now = scene.time.now
      const key = `player:${entry.id}`
      const state = this.impacts.get(key) ?? { lastSeenAt: -Infinity, lastImpactAt: -Infinity, strong: false }
      if (now - state.lastSeenAt > 50) state.strong = false
      state.lastSeenAt = now
      const normal = { x: entry.object.x - player.object.x, y: entry.object.y - player.object.y }
      const relative = { x: entry.body.velocity.x - player.body.velocity.x, y: entry.body.velocity.y - player.body.velocity.y }
      const strong = angularApproachSpeed(relative, normal) >= MIN_ANGULAR_IMPACT_SPEED
      const newImpact = shouldApplyAngularImpact(angularApproachSpeed(relative, normal), state.strong, now - state.lastImpactAt)
      state.strong = strong; this.impacts.set(key, state)
      if (!newImpact) return
      state.lastImpactAt = now
      const contact = approximateContact(entry, player.object)
      const angularImpulse = debrisAngularImpulse(entry.item.kind, entry.object, contact, player.body.velocity, 1, entry.item.physics)
      entry.body.setAngularVelocity(Phaser.Math.Clamp(entry.body.angularVelocity + angularImpulse,
        -entry.item.physics.maxAngularVelocity, entry.item.physics.maxAngularVelocity))
      entry.angularImpulseApplied = true; entry.lastAngularImpactAt = now
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
      settleDebris(entry.body, entry.linearPushed, entry.angularImpulseApplied)
      this.checkSpinDiagnostic(entry)
      const state = `${entry.item.kind} #${entry.id}\nspeed: ${entry.body.speed.toFixed(1)}\nangular: ${entry.body.angularVelocity.toFixed(1)}°\ndamping: ${entry.item.physics.damping}\nslide: ${entry.item.physics.slideFactor}\nmass: ${entry.item.physics.mass.toFixed(2)}\npushed: ${entry.linearPushed ? 'yes' : 'no'}`
      entry.object.setData('physics-debug', state)
      entry.label?.setPosition(entry.object.x, entry.object.y - entry.body.halfHeight - 14).setText(
        `${state}\nshape: ${entry.object.getData('body-shape')}`)
      entry.previous = { x: entry.object.x, y: entry.object.y }; entry.linearPushed = false; entry.angularImpulseApplied = false
      entry.collidingWith.clear()
    }
    this.checkPlayerStuck(this.player, this.solids, this.scene.time.now)
    for (const [key, state] of this.impacts) if (this.scene.time.now - state.lastSeenAt > 1000) this.impacts.delete(key)
  }

  private checkSpinDiagnostic(entry: PhysicalItem) {
    if (!devDiagnosticsEnabled) return
    const now = performance.now()
    if (entry.body.angularVelocity === 0 || entry.angularImpulseApplied) entry.spinStartedAt = entry.body.angularVelocity === 0 ? undefined : now
    else entry.spinStartedAt ??= now
    if (entry.spinStartedAt !== undefined && now - entry.spinStartedAt > 5000) {
      console.warn('DEBRIS SPIN DIAGNOSTIC', { kind: entry.item.kind, angularVelocity: entry.body.angularVelocity,
        angularDrag: entry.item.physics.angularDrag, lastAngularImpactAt: entry.lastAngularImpactAt,
        currentlyCollidingWith: [...entry.collidingWith] })
      entry.spinStartedAt = now
    }
  }

  private checkPlayerStuck(player: PlayerMotor, solids: Phaser.Physics.Arcade.StaticGroup, now: number) {
    if (!devDiagnosticsEnabled) return
    if (Math.hypot(player.intent.x, player.intent.y) <= 20) { this.stuckSince = undefined; return }
    this.stuckSince ??= { at: now, position: player.position }
    const moved = Math.hypot(player.position.x - this.stuckSince.position.x, player.position.y - this.stuckSince.position.y)
    if (moved >= 1) { this.stuckSince = { at: now, position: player.position }; return }
    if (now - this.stuckSince.at < 300 || now - this.lastStuckReportAt < 1000) return
    this.lastStuckReportAt = now
    const overlaps = (a: Phaser.Physics.Arcade.Body, b: Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody) =>
      a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
    const overlapping = this.physical.filter((entry) => overlaps(player.body, entry.body))
    const nearbyStaticBodies = solids.getChildren().filter((child) => {
      const body = (child as Phaser.GameObjects.GameObject & { body?: Phaser.Physics.Arcade.StaticBody }).body
      return body && overlaps(player.body, body)
    }).length
    console.warn('PLAYER STUCK DIAGNOSTIC', { position: player.position, intent: player.intent,
      velocity: { x: player.body.velocity.x, y: player.body.velocity.y }, touching: { ...player.body.touching },
      blocked: { ...player.body.blocked }, overlappingDebris: overlapping.map(({ id, item }) => `${id}:${item.kind}`),
      nearbyStaticBodies, currentLocation: portalContains(this.portal, player.position) ? this.portal.id : 'island' })
  }
}
