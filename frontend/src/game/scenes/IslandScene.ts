import Phaser from 'phaser'
import type { Island } from '../../pages/UserPage'
import type { GamePythonBridge } from '../GamePythonBridge'
import type { SceneLifecycleCallbacks } from '../createGame'
import { GameKeyboardState } from '../gameKeyboard'
import { configureIslandCamera, generateIslandGeometry, ISLAND_CENTER } from '../islandGeometry'
import { debugSwitches, DevTiming, devCount, devDiagnosticsEnabled } from '../../devDiagnostics'

const updateTiming = new DevTiming('Phaser IslandScene update')
const islandTiming = new DevTiming('island generation/render')

export class IslandScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Container
  private keys!: GameKeyboardState
  private bridge!: GamePythonBridge
  private lastTick = 0
  private updateCount = 0
  constructor() {
    super('island')
  }

  create() {
    const islandStarted = devDiagnosticsEnabled ? performance.now() : 0
    const island = this.registry.get('island') as Island
    const coastline = generateIslandGeometry(island.generation_seed)

    this.cameras.main.setBackgroundColor(0x176b87)
    const graphics = this.add.graphics()
    graphics.fillStyle(0xe7c66b)
    graphics.fillPoints(coastline, true)
    const interior = coastline.map(({ x, y }) => ({
      x: ISLAND_CENTER + (x - ISLAND_CENTER) * 0.965,
      y: ISLAND_CENTER + (y - ISLAND_CENTER) * 0.965,
    }))
    graphics.fillStyle(0x4b9b58)
    graphics.fillPoints(interior, true)

    this.bridge = this.registry.get('pythonBridge') as GamePythonBridge
    this.bridge.setIslandGeometry(coastline)
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
    this.player.on('pointerup', () => (this.registry.get('onPlayerClick') as () => void)())
    configureIslandCamera(this.cameras.main, this.player)
    this.keys = new GameKeyboardState(this.input.keyboard!)
    const lifecycle = this.registry.get('sceneLifecycle') as SceneLifecycleCallbacks
    lifecycle.onReady(this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.keys.dispose()
      lifecycle.onShutdown(this)
    })
    if (devDiagnosticsEnabled) islandTiming.add(performance.now() - islandStarted)
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
    if (devDiagnosticsEnabled && (++this.updateCount === 1 || this.updateCount % 100 === 0)) devCount('Phaser IslandScene game tick', this.updateCount)
    if (time - this.lastTick >= 50) {
      this.lastTick = time
      const position = { x: this.player.x, y: this.player.y }
      void this.bridge.tick(this.keys.snapshot(), position).then((next) => {
        if (next) this.player.setPosition(next.x, next.y)
      })
    }
    if (devDiagnosticsEnabled) updateTiming.add(performance.now() - started)
  }
}
