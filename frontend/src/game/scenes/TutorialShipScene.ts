import Phaser from 'phaser'
import type { GamePythonBridge } from '../GamePythonBridge'
import type { SceneLifecycleCallbacks } from '../createGame'
import { debugSwitches, DevTiming, devCount, devDiagnosticsEnabled, recordGameObjectMutation, recordPhaserUpdate } from '../../devDiagnostics'

const updateTiming = new DevTiming('Phaser TutorialShipScene update')
import { GameKeyboardState } from '../gameKeyboard'

export const TUTORIAL_CABIN = { x: 50, y: 35, width: 800, height: 490 } as const
export const TUTORIAL_PLAYER_SPAWN = { x: 470, y: 300 } as const

export class TutorialShipScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Container
  private keys!: GameKeyboardState
  private bridge!: GamePythonBridge
  private lastTick = 0
  private updateCount = 0

  constructor() { super('tutorial-ship') }

  create() {
    this.cameras.main.setBackgroundColor(0x100b09)
    if (!debugSwitches.hideIsland && !debugSwitches.hideAllGameObjects) this.drawCabin()
    if (!debugSwitches.hideAllGameObjects) this.createJournal()
    this.createPlayer()
    if (!debugSwitches.hideAllGameObjects) this.createStoryText()

    if (debugSwitches.hidePlayer || debugSwitches.hideAllGameObjects) this.player.setVisible(false)
    if (debugSwitches.hideAllGameObjects) this.children.list.forEach((child) => {
      if ('setVisible' in child) (child as Phaser.GameObjects.GameObject & { setVisible: (visible: boolean) => void }).setVisible(false)
    })

    this.cameras.main.setBounds(0, 0, 900, 560).centerOn(450, 280)
    if (!debugSwitches.disableCameraFollow) {
      this.fitCabinToViewport()
      this.scale.on(Phaser.Scale.Events.RESIZE, this.fitCabinToViewport, this)
    }

    this.bridge = this.registry.get('pythonBridge') as GamePythonBridge
    this.bridge.setMovementUnlocked(false)
    this.keys = new GameKeyboardState(this.input.keyboard!)
    const lifecycle = this.registry.get('sceneLifecycle') as SceneLifecycleCallbacks
    lifecycle.onReady(this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (!debugSwitches.disableCameraFollow) this.scale.off(Phaser.Scale.Events.RESIZE, this.fitCabinToViewport, this)
      this.keys.dispose()
      lifecycle.onShutdown(this)
    })
  }

  private drawCabin() {
    const g = this.add.graphics()

    // Flat floor and walls: every silhouette is drawn directly from above.
    g.fillStyle(0x392216).fillRect(50, 35, 800, 490)
    for (let y = 55; y < 525; y += 34) {
      g.fillStyle(y % 68 === 55 ? 0x58351f : 0x4b2c1b).fillRect(64, y, 772, 31)
      g.lineStyle(2, 0x2d1a12).lineBetween(64, y + 31, 836, y + 31)
    }
    for (let y = 58; y < 510; y += 68) {
      g.lineStyle(2, 0x704629).lineBetween(220, y, 220, y + 25)
      g.lineBetween(610, y + 34, 610, y + 59)
    }
    g.fillStyle(0x19100c).fillRect(50, 35, 800, 22).fillRect(50, 503, 800, 22)
      .fillRect(50, 35, 22, 490).fillRect(828, 35, 22, 490)
    g.lineStyle(3, 0x80502d).strokeRect(72, 57, 756, 446)

    // Hammock: a cloth rectangle with ropes at both ends, seen from overhead.
    g.lineStyle(4, 0xb69a69).lineBetween(90, 91, 114, 107).lineBetween(294, 107, 318, 91)
      .lineBetween(90, 207, 114, 191).lineBetween(294, 191, 318, 207)
    g.fillStyle(0x8d7250).fillRoundedRect(110, 102, 188, 94, 28)
    g.lineStyle(4, 0xd0b889).strokeRoundedRect(110, 102, 188, 94, 28)
    for (let x = 135; x < 290; x += 28) g.lineStyle(2, 0x6c543a).lineBetween(x, 108, x, 190)

    // A round barrel top, including the lid rings.
    g.fillStyle(0x81502a).fillCircle(744, 130, 43)
    g.lineStyle(7, 0x2b1b12).strokeCircle(744, 130, 43)
    g.lineStyle(3, 0xc38a4a).strokeCircle(744, 130, 29).lineBetween(714, 130, 774, 130)
    g.fillStyle(0x372116).fillCircle(744, 130, 5)

    // Captain's table and its four square legs, all represented as top faces.
    g.fillStyle(0x27170f).fillRect(620, 239, 18, 18).fillRect(770, 239, 18, 18)
      .fillRect(620, 373, 18, 18).fillRect(770, 373, 18, 18)
    g.fillStyle(0x70401f).fillRoundedRect(610, 229, 188, 154, 8)
    g.lineStyle(5, 0x29170e).strokeRoundedRect(610, 229, 188, 154, 8)
    g.lineStyle(2, 0x9c6232).lineBetween(672, 234, 672, 378).lineBetween(735, 234, 735, 378)

    // Rolled chart and compass rest on the table beside the journal.
    g.fillStyle(0xd0b77c).fillRoundedRect(628, 323, 84, 38, 5)
    g.lineStyle(2, 0x6a4928).strokeRoundedRect(628, 323, 84, 38, 5)
      .lineBetween(640, 328, 640, 357).lineBetween(700, 328, 700, 357)
    g.fillStyle(0xc59a4d).fillCircle(755, 342, 23)
    g.lineStyle(3, 0x352417).strokeCircle(755, 342, 23)
    g.fillStyle(0x9d3028).fillTriangle(755, 323, 748, 344, 755, 340)
    g.fillStyle(0xe4d7ab).fillTriangle(755, 361, 762, 340, 755, 344)

    // Chest with lid bands and latch.
    g.fillStyle(0x74401f).fillRoundedRect(105, 364, 154, 91, 10)
    g.lineStyle(6, 0x21150f).strokeRoundedRect(105, 364, 154, 91, 10)
      .lineBetween(139, 368, 139, 451).lineBetween(225, 368, 225, 451)
    g.fillStyle(0xd29b3e).fillRect(173, 397, 19, 25)
    g.fillStyle(0x332016).fillCircle(182, 408, 4)

    // Damage, loose rope and a warm lantern make this a battered ship cabin.
    g.lineStyle(7, 0x21140e).lineBetween(322, 438, 376, 417).lineBetween(341, 465, 393, 446)
    g.lineStyle(4, 0xb0925b).beginPath().arc(298, 393, 28, .2, 5.8).strokePath()
      .beginPath().arc(300, 393, 17, .2, 5.8).strokePath()
    g.fillStyle(0xf0b84e, .2).fillCircle(548, 111, 36)
    g.fillStyle(0xe6a640).fillCircle(548, 111, 13)
    g.lineStyle(4, 0x392619).strokeCircle(548, 111, 19).lineBetween(536, 91, 560, 91)

    // The future exit is a closed hatch set into the lower wall; it has no handler yet.
    this.add.rectangle(470, 506, 136, 38, 0x54321f).setStrokeStyle(5, 0xc08a4b)
      .setData('role', 'tutorial-exit').setData('transitionImplemented', false)
    this.add.circle(514, 506, 5, 0xe2b85f)

    // Decorative porthole is mounted flat in the upper wall.
    g.fillStyle(0x235568).fillCircle(405, 48, 13)
    g.lineStyle(5, 0xb0803f).strokeCircle(405, 48, 16)
  }

  private createJournal() {
    const journal = this.add.rectangle(705, 277, 62, 48, 0x713e2a).setStrokeStyle(4, 0xc99c56)
      .setInteractive({ useHandCursor: true }).setData('role', 'tutorial-journal')
    const compass = this.add.graphics().setPosition(705, 277)
    compass.lineStyle(2, 0xe2c47f).strokeCircle(0, 0, 15)
    compass.lineStyle(1, 0xb78946).lineBetween(-18, 0, 18, 0).lineBetween(0, -18, 0, 18)
    compass.fillStyle(0xe8d392).fillTriangle(0, -15, -4, 3, 4, 3)
    compass.fillStyle(0xa96a3b).fillTriangle(0, 15, -4, -3, 4, -3)
    compass.fillStyle(0xe2c47f).fillCircle(0, 0, 2)
    journal.on('pointerover', () => journal.setStrokeStyle(6, 0xffe69a))
    journal.on('pointerout', () => journal.setStrokeStyle(4, 0xe3b861))
    journal.on('pointerup', () => (this.registry.get('onJournalClick') as () => void)())
  }

  private createPlayer() {
    const shadow = this.add.ellipse(0, 17, 44, 24, 0x0b0806, .4)
    const body = this.add.circle(0, 0, 18, 0x315f78).setStrokeStyle(4, 0x142c38)
    const head = this.add.circle(0, -9, 12, 0xf0d1a2).setStrokeStyle(3, 0x6f3928)
    const hat = this.add.triangle(0, -21, -19, 8, 0, -12, 19, 8, 0xbd392d)
    const facing = this.add.triangle(0, 11, -5, 0, 5, 0, 0, 10, 0xe7c96d)
    const name = this.add.text(0, 29, this.registry.get('username') as string, {
      color: '#fff', fontSize: '13px', stroke: '#071a28', strokeThickness: 3,
    }).setOrigin(.5, 0)
    this.player = this.add.container(TUTORIAL_PLAYER_SPAWN.x, TUTORIAL_PLAYER_SPAWN.y,
      [shadow, body, head, hat, facing, name]).setSize(70, 66).setData('role', 'tutorial-player')
      .setInteractive({ useHandCursor: true })
    this.player.on('pointerup', () => (this.registry.get('onPlayerClick') as () => void)())
  }

  private createStoryText() {
    this.add.text(450, 472, 'Ты приходишь в себя в каюте разбитого корабля.', {
      color: '#f1dfbd', fontSize: '18px', backgroundColor: '#17100ddd', padding: { x: 14, y: 9 },
    }).setOrigin(.5)
    this.time.delayedCall(2600, () => this.add.text(450, 416,
      'Кажется, тело тебя пока не слушается.\nНа столе лежит судовой журнал.', {
        align: 'center', color: '#f1dfbd', fontSize: '17px', backgroundColor: '#17100ddd', padding: { x: 14, y: 9 },
      }).setOrigin(.5))
  }

  private fitCabinToViewport() {
    const zoom = Math.min(this.scale.width / 900, this.scale.height / 560) * .96
    this.cameras.main.setZoom(Math.max(.72, Math.min(zoom, 1.35))).centerOn(450, 280)
  }

  setKeyboardEnabled(enabled: boolean) {
    if (!this.input.keyboard) return
    this.input.keyboard.enabled = enabled
    this.keys.setEnabled(enabled)
    if (!enabled) this.input.keyboard.resetKeys()
  }

  update(time: number) {
    const started = devDiagnosticsEnabled ? performance.now() : 0
    if (debugSwitches.disableGameLoop) return
    if (devDiagnosticsEnabled && (++this.updateCount === 1 || this.updateCount % 100 === 0)) devCount('Phaser TutorialShipScene game tick', this.updateCount)
    if (time - this.lastTick >= 50) {
      this.lastTick = time
      const position = { x: this.player.x, y: this.player.y }
      void this.bridge.tick(this.keys.snapshot(), position).then((next) => {
        if (next) {
          recordGameObjectMutation('setPosition')
          this.player.setPosition(next.x, next.y)
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
