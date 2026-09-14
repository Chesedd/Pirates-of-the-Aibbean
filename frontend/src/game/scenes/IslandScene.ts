import Phaser from 'phaser'
import type { Island } from '../../pages/UserPage'
import type { GamePythonBridge } from '../GamePythonBridge'
import type { SceneLifecycleCallbacks } from '../createGame'
import { GameKeyboardState } from '../gameKeyboard'
import { configureIslandCamera, generateIslandGeometry, ISLAND_CENTER } from '../islandGeometry'
import { debugSwitches, DevTiming, devCount, devDiagnosticsEnabled, recordGameObjectMutation, recordPhaserUpdate } from '../../devDiagnostics'
import { SmoothPlayerPosition } from '../SmoothPlayerPosition'

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
  constructor() {
    super('island')
  }

  create() {
    const island = this.registry.get('island') as Island
    const coastline = generateIslandGeometry(island.generation_seed)

    this.cameras.main.setBackgroundColor(0x176b87)
    if (!debugSwitches.hideIsland && !debugSwitches.hideAllGameObjects) this.drawIsland(coastline)
    if (!debugSwitches.hideIsland && !debugSwitches.hideAllGameObjects) this.drawWreck(island.wreck)

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

  private drawWreck(wreck: { x: number; y: number }) {
    const g = this.add.graphics().setData('role', 'island-wreck')
    g.fillStyle(0x5b321d).fillTriangle(wreck.x - 58, wreck.y - 22, wreck.x + 45, wreck.y - 34, wreck.x + 30, wreck.y + 28)
    g.lineStyle(7, 0x2d1a12).lineBetween(wreck.x - 54, wreck.y - 20, wreck.x + 31, wreck.y + 25)
    g.lineStyle(6, 0x8b572f).lineBetween(wreck.x - 72, wreck.y + 38, wreck.x - 5, wreck.y + 12)
      .lineBetween(wreck.x + 18, wreck.y - 55, wreck.x + 62, wreck.y - 12)
    g.fillStyle(0x80502a).fillRect(wreck.x + 50, wreck.y + 24, 26, 24).fillRect(wreck.x - 42, wreck.y - 58, 28, 25)
    g.fillStyle(0x70401f).fillCircle(wreck.x + 83, wreck.y - 22, 14)
    g.lineStyle(4, 0x2b1b12).strokeCircle(wreck.x + 83, wreck.y - 22, 14)
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
        if (next) {
          recordGameObjectMutation('setPosition')
          this.smooth.setLogicalTarget(next, this.time.now)
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
