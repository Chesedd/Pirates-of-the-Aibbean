import Phaser from 'phaser'
import type { Island } from '../../pages/UserPage'
import type { GamePythonBridge } from '../GamePythonBridge'
import type { SceneLifecycleCallbacks } from '../createGame'
import { GameKeyboardState } from '../gameKeyboard'
import { configureIslandCamera, generateIslandGeometry, ISLAND_CENTER } from '../islandGeometry'
import { debugSwitches, DevTiming, devCount, devDiagnosticsEnabled, recordPhaserUpdate } from '../../devDiagnostics'
import {
  createCompanionwayPortal, createWreckLayout, findBlockingWreckCollider, isWreckPositionWalkable,
  recoverWreckPosition, type WreckLayout,
} from '../wreckGeometry'
import { drawWreck, drawWreckDebris } from '../wreckRenderer'
import { generateWreckDebris } from '../wreckDebris'
import { apiRequest } from '../../api/client'
import { createPlayerAvatar } from '../player/createPlayerAvatar'
import { GameMovementLoop, movementIntentVelocity } from '../movement/GameMovementLoop'
import { LocationController } from '../locations/LocationController'
import { createCollisionDebugView } from '../movement/CollisionDebugView'
import { PLAYER_COLLISION_OFFSET, PLAYER_COLLISION_RADIUS } from '../player/playerConfig'
import { createStaticColliders, PlayerMotor } from '../movement/PlayerMotor'
import { createPortalHint, portalActivates, type LocationPortal } from '../locations/LocationPortal'
import { pointIsInsideIsland, type Point } from '../islandGeometry'
import { DebrisPhysics } from '../DebrisPhysics'

const updateTiming = new DevTiming('Phaser IslandScene update')
const islandTiming = new DevTiming('island generation/render')

export class IslandScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Container
  private keys!: GameKeyboardState
  private bridge!: GamePythonBridge
  private movementLoop!: GameMovementLoop
  private debugPlayer!: (point: Point, radius: number, velocity?: Point, intent?: Point) => void
  private updateCount = 0
  private islandDrawn = false
  private motor!: PlayerMotor
  private coastline!: Point[]
  private lastPhysicsPosition!: Point
  private portal!: LocationPortal
  private portalHint!: ReturnType<typeof createPortalHint>
  private wreckLayout!: WreckLayout
  private transitioning = false
  private debrisPhysics?: DebrisPhysics
  constructor() {
    super('island')
  }

  create() {
    this.transitioning = false
    const island = this.registry.get('island') as Island
    const coastline = generateIslandGeometry(island.generation_seed)
    this.coastline = coastline
    this.wreckLayout = createWreckLayout(island.generation_seed, island.wreck)
    const initialPosition = { ...island.player }
    const blockingCollider = findBlockingWreckCollider(initialPosition, this.wreckLayout)
    const initialWalkable = isWreckPositionWalkable(initialPosition, this.wreckLayout)
    const recoveredPosition = recoverWreckPosition(initialPosition, this.wreckLayout, coastline)
    if (devDiagnosticsEnabled) console.info('Wreck initial position', {
      playerPosition: initialPosition,
      wreckAnchor: this.wreckLayout.anchor,
      playerWalkable: initialWalkable,
      blockingCollider,
    })
    if (recoveredPosition.x !== initialPosition.x || recoveredPosition.y !== initialPosition.y) {
      island.player = recoveredPosition
      void apiRequest('/game/position', { method: 'PUT', body: JSON.stringify(recoveredPosition) })
    }

    this.cameras.main.setBackgroundColor(0x176b87)
    if (!debugSwitches.hideIsland && !debugSwitches.hideAllGameObjects) this.drawIsland(coastline)
    const debrisLayout = generateWreckDebris(island.generation_seed, this.wreckLayout, coastline, island.player)
    if (!debugSwitches.hideIsland && !debugSwitches.hideAllGameObjects) drawWreck(this, this.wreckLayout)

    this.bridge = this.registry.get('pythonBridge') as GamePythonBridge
    this.bridge.setIslandGeometry(coastline)
    this.bridge.setPositionPersistenceEnabled(true)
    const avatar = createPlayerAvatar(this, island.player, this.registry.get('username') as string)
    this.player = avatar.container
    this.motor = new PlayerMotor(this, this.player, island.player)
    this.lastPhysicsPosition = this.motor.position
    const solids = createStaticColliders(this, this.wreckLayout.colliders)
    this.physics.add.collider(this.motor.object, solids)
    this.player.on('pointerup', () => (this.registry.get('onPlayerClick') as () => void)())
    const location = this.registry.get('locationController') as LocationController
    location.sceneCreated('island')
    this.portal = createCompanionwayPortal(this.wreckLayout)
    if (!debugSwitches.hideIsland && !debugSwitches.hideAllGameObjects) {
      const debrisObjects = drawWreckDebris(this, debrisLayout)
      this.debrisPhysics = new DebrisPhysics(this, debrisLayout, debrisObjects, this.motor, solids, coastline, this.portal)
    }
    this.portalHint = createPortalHint(this, this.portal)
    const debug = createCollisionDebugView(this, this.wreckLayout.colliders,
      [{ kind: 'orientedRect', id: this.portal.id, x: this.portal.sensor.x, y: this.portal.sensor.y,
        halfWidth: this.portal.sensor.width / 2, halfHeight: this.portal.sensor.height / 2, angle: this.portal.sensor.angle ?? 0 }],
      [this.wreckLayout.companionwayReturn, this.wreckLayout.entranceApproach])
    this.debugPlayer = (point, radius) => debug.updatePlayer(point, radius)
    this.movementLoop = new GameMovementLoop((keys, position) => this.bridge.tick(keys, position), (request, next) => {
      if (!next || this.transitioning) return
      this.motor.setVelocity(movementIntentVelocity(request.position, next, request.keys))
    })
    if (debugSwitches.hidePlayer || debugSwitches.hideAllGameObjects) this.player.setVisible(false)
    if (!debugSwitches.disableCameraFollow) configureIslandCamera(this.cameras.main, this.player)
    if (debugSwitches.hideAllGameObjects) this.children.list.forEach((child) => {
      if ('setVisible' in child) (child as Phaser.GameObjects.GameObject & { setVisible: (visible: boolean) => void }).setVisible(false)
    })
    this.keys = new GameKeyboardState(this.input.keyboard!, () => this.movementLoop.requestNow(this.time.now, this.keys.snapshot(), this.motor.position))
    const lifecycle = this.registry.get('sceneLifecycle') as SceneLifecycleCallbacks
    lifecycle.onReady(this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.keys.dispose()
      this.movementLoop.dispose()
      this.portalHint.destroy()
      lifecycle.onShutdown(this)
    })
  }

  private drawIsland(coastline: { x: number; y: number }[]) {
    if (debugSwitches.staticIsland && this.islandDrawn) return
    const islandStarted = devDiagnosticsEnabled ? performance.now() : 0
    if (devDiagnosticsEnabled) performance.mark('draw-island-start')
    const graphics = this.add.graphics()
    graphics.fillStyle(0xe7c66b)
    graphics.fillPoints(coastline, true)
    const interior = coastline.map(({ x, y }) => ({
      x: ISLAND_CENTER + (x - ISLAND_CENTER) * 0.965,
      y: ISLAND_CENTER + (y - ISLAND_CENTER) * 0.965,
    }))
    graphics.fillStyle(0x4b9b58)
    graphics.fillPoints(interior, true)
    this.islandDrawn = true
    if (devDiagnosticsEnabled) {
      performance.mark('draw-island-end')
      performance.measure('draw-island', 'draw-island-start', 'draw-island-end')
      islandTiming.add(performance.now() - islandStarted)
    }
  }

  setKeyboardEnabled(enabled: boolean) {
    const keyboard = this.input.keyboard
    if (!keyboard) return
    keyboard.enabled = enabled
    this.keys.setEnabled(enabled)
    if (!enabled) keyboard.resetKeys()
  }

  update(time: number, delta: number) {
    const started = devDiagnosticsEnabled ? performance.now() : 0
    if (debugSwitches.disableGameLoop) return
    this.motor.update(delta / 1000)
    this.debrisPhysics?.update()
    let position = this.motor.position
    if (!pointIsInsideIsland(position, this.coastline)) {
      const xOnly = { x: position.x, y: this.lastPhysicsPosition.y }
      const yOnly = { x: this.lastPhysicsPosition.x, y: position.y }
      if (pointIsInsideIsland(xOnly, this.coastline)) { this.motor.object.setPosition(xOnly.x, xOnly.y); this.motor.body.velocity.y = 0 }
      else if (pointIsInsideIsland(yOnly, this.coastline)) { this.motor.object.setPosition(yOnly.x, yOnly.y); this.motor.body.velocity.x = 0 }
      else this.motor.object.setPosition(this.lastPhysicsPosition.x, this.lastPhysicsPosition.y)
      this.motor.body.updateFromGameObject(); position = this.motor.position
    }
    this.lastPhysicsPosition = position
    this.motor.follow()
    this.portalHint.update(position)
    if (!this.transitioning && portalActivates(this.portal, position, this.motor.intent)) {
      this.transitioning = true; this.motor.stop()
      const island = this.registry.get('island') as Island
      island.player = { ...position }; this.registry.set('island', island)
      void apiRequest('/game/position', { method: 'PUT', body: JSON.stringify(position) })
      const location = this.registry.get('locationController') as LocationController
      location.enter(this, 'wreck-cabin', 'cabin-revisit', { mode: 'revisit' }); return
    }
    if (devDiagnosticsEnabled && (++this.updateCount === 1 || this.updateCount % 100 === 0)) devCount('Phaser IslandScene game tick', this.updateCount)
    this.movementLoop.update(time, this.keys.snapshot(), position)
    this.bridge.reportPosition(position)
    this.debugPlayer({ x: position.x + PLAYER_COLLISION_OFFSET.x, y: position.y + PLAYER_COLLISION_OFFSET.y }, PLAYER_COLLISION_RADIUS,
      this.motor.body.velocity, this.motor.intent)
    if (devDiagnosticsEnabled) {
      const duration = performance.now() - started
      updateTiming.add(duration)
      recordPhaserUpdate(duration)
    }
  }
}
