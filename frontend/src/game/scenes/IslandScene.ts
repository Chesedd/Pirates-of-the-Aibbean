import Phaser from 'phaser'
import type { Island } from '../../pages/UserPage'
import type { GamePythonBridge } from '../GamePythonBridge'
import type { SceneLifecycleCallbacks } from '../createGame'
import { GameKeyboardState } from '../gameKeyboard'
import { configureIslandCamera, generateIslandGeometry, ISLAND_CENTER } from '../islandGeometry'
import { debugSwitches, DevTiming, devCount, devDiagnosticsEnabled, recordGameObjectMutation, recordPhaserUpdate } from '../../devDiagnostics'
import { SmoothPlayerPosition } from '../SmoothPlayerPosition'
import { createWreckLayout, resolveWreckMovement, type WreckLayout } from '../wreckGeometry'

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
  constructor() {
    super('island')
  }

  create() {
    const island = this.registry.get('island') as Island
    const coastline = generateIslandGeometry(island.generation_seed)
    this.wreckLayout = createWreckLayout(island.generation_seed, island.wreck)

    this.cameras.main.setBackgroundColor(0x176b87)
    if (!debugSwitches.hideIsland && !debugSwitches.hideAllGameObjects) this.drawIsland(coastline)
    if (!debugSwitches.hideIsland && !debugSwitches.hideAllGameObjects) this.drawWreck(this.wreckLayout)

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

  private drawWreck(layout: WreckLayout) {
    const g = this.add.graphics().setPosition(layout.anchor.x, layout.anchor.y).setRotation(layout.angle)
      .setData('role', 'island-wreck').setData('wreck-variant', layout.variant)

    // A broad, broken hull: dark outer timbers, inset deck, tapered bow and torn stern.
    g.fillStyle(0x2b1a12).fillPoints([
      { x: -218, y: -151 }, { x: 168, y: -151 }, { x: 213, y: -116 },
      { x: 202, y: -28 }, { x: 159, y: -18 }, { x: -183, y: -24 }, { x: -218, y: -55 },
    ], true)
    g.fillStyle(0x664023).fillPoints([
      { x: -197, y: -132 }, { x: 157, y: -132 }, { x: 190, y: -108 },
      { x: 181, y: -47 }, { x: 145, y: -39 }, { x: -173, y: -44 }, { x: -197, y: -67 },
    ], true)
    g.fillStyle(0x86552d).fillRect(-166, -119, 316, 58)
    for (let x = -148; x <= 135; x += 36) g.lineStyle(3, 0x4a2b19).lineBetween(x, -116, x, -63)
    g.lineStyle(8, 0xb0783e).lineBetween(-187, -46, 169, -43).lineBetween(-190, -137, 169, -137)

    // The jagged split interrupts the deck and makes the wreck unmistakably broken.
    g.fillStyle(0x17100c).fillPoints([
      { x: -22, y: -139 }, { x: 8, y: -111 }, { x: -13, y: -92 },
      { x: 17, y: -70 }, { x: -8, y: -40 }, { x: -38, y: -73 }, { x: -19, y: -96 }, { x: -45, y: -116 },
    ], true)
    g.lineStyle(5, 0xc18a4c).lineBetween(-24, -134, 4, -109).lineBetween(-39, -71, -15, -94)

    // Broken mast, deck fragments, crates and barrels establish the ship's scale.
    g.fillStyle(0x4b2c1a).fillCircle(66, -91, 25)
    g.lineStyle(7, 0x24160f).strokeCircle(66, -91, 25)
    g.lineStyle(15, 0x704322).lineBetween(67, -91, 243, -182)
    g.lineStyle(4, 0xa8733e).lineBetween(67, -91, 243, -182)
    g.fillStyle(0x7b4b28).fillRect(-263, -31, 52, 47).fillRect(198, -7, 49, 41)
    g.lineStyle(5, 0x2c1b12).strokeRect(-263, -31, 52, 47).strokeRect(198, -7, 49, 41)
    g.lineStyle(3, 0xc18a4c).lineBetween(-237, -28, -237, 13).lineBetween(222, -4, 222, 31)
    g.fillStyle(0x754624).fillCircle(231, 8, 22).fillCircle(-277, -91, 19)
    g.lineStyle(6, 0x291a12).strokeCircle(231, 8, 22).strokeCircle(-277, -91, 19)
    g.lineStyle(3, 0xb77b3e).lineBetween(210, 8, 252, 8).lineBetween(-295, -91, -259, -91)
    g.lineStyle(12, 0x68401f).lineBetween(-284, 55, -213, 24).lineBetween(263, -45, 310, -78)
      .lineBetween(188, 49, 275, 70).lineBetween(-112, 35, -48, 22)
    g.lineStyle(3, 0xb17a42).lineBetween(-284, 55, -213, 24).lineBetween(188, 49, 275, 70)

    // A dark framed opening and short plank landing face the player's inland spawn.
    const entrance = this.add.graphics().setPosition(layout.anchor.x, layout.anchor.y).setRotation(layout.angle)
      .setData('role', 'wreck-entrance').setData('interaction', 'return-later')
    entrance.fillStyle(0x100c0a).fillRoundedRect(-39, -35, 78, 39, 8)
    entrance.lineStyle(7, 0xc08a4b).strokeRoundedRect(-39, -35, 78, 39, 8)
    entrance.fillStyle(0x9a6938).fillRect(-48, 9, 96, 13).fillRect(-43, 29, 86, 11)
    entrance.lineStyle(3, 0x382318).lineBetween(0, 9, 0, 40)
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
