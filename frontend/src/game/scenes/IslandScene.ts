import Phaser from 'phaser'
import type { Island } from '../../pages/UserPage'
import type { GamePythonBridge } from '../GamePythonBridge'
import type { SceneLifecycleCallbacks } from '../createGame'
import { GameKeyboardState } from '../gameKeyboard'
import { configureIslandCamera, generateIslandGeometry, ISLAND_CENTER } from '../islandGeometry'
import { debugSwitches, DevTiming, devCount, devDiagnosticsEnabled, recordGameObjectMutation, recordPhaserUpdate } from '../../devDiagnostics'
import { SmoothPlayerPosition } from '../SmoothPlayerPosition'
import {
  createWreckLayout, entersCompanionway, findBlockingWreckCollider, isWreckPositionWalkable,
  recoverWreckPosition, resolveWreckMovement, type WreckLayout,
} from '../wreckGeometry'
import { drawWreck } from '../wreckRenderer'
import { generateWreckDebris } from '../wreckDebris'
import { apiRequest } from '../../api/client'

const updateTiming = new DevTiming('Phaser IslandScene update')
const islandTiming = new DevTiming('island generation/render')

export class IslandScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Container
  private keys!: GameKeyboardState
  private bridge!: GamePythonBridge
  private lastTick = 0
  private updateCount = 0
  private islandDrawn = false
  private smooth!: SmoothPlayerPosition
  private wreckLayout!: WreckLayout
  private transitioning = false
  constructor() {
    super('island')
  }

  create() {
    this.transitioning = false
    const island = this.registry.get('island') as Island
    const coastline = generateIslandGeometry(island.generation_seed)
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
    if (!debugSwitches.hideIsland && !debugSwitches.hideAllGameObjects) {
      drawWreck(this, this.wreckLayout, generateWreckDebris(island.generation_seed, this.wreckLayout, coastline, island.player))
    }

    this.bridge = this.registry.get('pythonBridge') as GamePythonBridge
    this.bridge.setIslandGeometry(coastline)
    this.bridge.setPositionPersistenceEnabled(true)
    const body = this.add.circle(0, 0, 17, 0xf4e4c1).setStrokeStyle(5, 0x7a352c)
    const hat = this.add.triangle(0, -22, -15, 12, 0, -13, 15, 12, 0xc93f32)
    const name = this.add.text(0, 29, this.registry.get('username') as string, {
      color: '#ffffff',
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: '13px',
      stroke: '#071a28',
      strokeThickness: 3,
    }).setOrigin(0.5, 0)
    this.player = this.add.container(island.player.x, island.player.y, [body, hat, name])
      .setSize(Math.max(54, name.width + 12), 66)
      .setInteractive({ useHandCursor: true })
    this.smooth = new SmoothPlayerPosition(this.player, island.player)
    this.player.on('pointerup', () => (this.registry.get('onPlayerClick') as () => void)())
    if (debugSwitches.hidePlayer || debugSwitches.hideAllGameObjects) this.player.setVisible(false)
    if (!debugSwitches.disableCameraFollow) configureIslandCamera(this.cameras.main, this.player)
    if (debugSwitches.hideAllGameObjects) this.children.list.forEach((child) => {
      if ('setVisible' in child) (child as Phaser.GameObjects.GameObject & { setVisible: (visible: boolean) => void }).setVisible(false)
    })
    this.keys = new GameKeyboardState(this.input.keyboard!)
    const lifecycle = this.registry.get('sceneLifecycle') as SceneLifecycleCallbacks
    lifecycle.onReady(this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.keys.dispose()
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

  update(time: number) {
    const started = devDiagnosticsEnabled ? performance.now() : 0
    if (debugSwitches.disableGameLoop) return
    this.smooth.update(time)
    if (devDiagnosticsEnabled && (++this.updateCount === 1 || this.updateCount % 100 === 0)) devCount('Phaser IslandScene game tick', this.updateCount)
    if (time - this.lastTick >= 50) {
      this.lastTick = time
      const position = { ...this.smooth.logical }
      void this.bridge.tick(this.keys.snapshot(), position).then((next) => {
        if (next && !this.transitioning) {
          // Inspect the authoritative intended segment before the companionway
          // hole collider has a chance to reject it.
          if (entersCompanionway(position, next, this.wreckLayout)) {
            this.transitioning = true
            this.scene.start('tutorial-ship', { mode: 'revisit' })
            return
          }
          const accepted = resolveWreckMovement(position, next, this.wreckLayout)
          recordGameObjectMutation('setPosition')
          this.smooth.setLogicalTarget(accepted, this.time.now)
        }
      })
    }
    if (devDiagnosticsEnabled) {
      const duration = performance.now() - started
      updateTiming.add(duration)
      recordPhaserUpdate(duration)
    }
  }
}
