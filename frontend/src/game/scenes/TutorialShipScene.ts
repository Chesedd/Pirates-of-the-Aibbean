import Phaser from 'phaser'
import type { GamePythonBridge } from '../GamePythonBridge'
import type { SceneLifecycleCallbacks } from '../createGame'
import { GameKeyboardState } from '../gameKeyboard'

const ROOM = { width: 900, height: 560 }
const SPAWN = { x: 455, y: 340 }

export class TutorialShipScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Container
  private keys!: GameKeyboardState
  private bridge!: GamePythonBridge
  private lastTick = 0

  constructor() { super('tutorial-ship') }

  create() {
    this.cameras.main.setBackgroundColor(0x130e0b)
    const graphics = this.add.graphics()
    graphics.fillStyle(0x2b1a12).fillRect(50, 45, 800, 470)
    for (let y = 85; y < 515; y += 44) graphics.lineStyle(2, 0x543421).lineBetween(50, y, 850, y)
    graphics.lineStyle(18, 0x17100d).strokeRect(50, 45, 800, 470)
    // Closed door, hammock and table keep the scene deliberately geometric.
    graphics.fillStyle(0x17100d).fillRect(375, 45, 150, 28).fillRect(390, 45, 120, 110)
    graphics.lineStyle(7, 0xb9aa87).lineBetween(105, 155, 310, 215).lineBetween(105, 205, 310, 265)
    graphics.fillStyle(0x6b4025).fillRect(630, 265, 155, 90).fillRect(650, 355, 16, 85).fillRect(750, 355, 16, 85)

    const journal = this.add.rectangle(705, 300, 58, 42, 0x8f321f).setStrokeStyle(4, 0xd2a85e)
      .setInteractive({ useHandCursor: true })
    this.add.text(705, 300, '☠', { color: '#f1d892', fontSize: '20px' }).setOrigin(0.5)
    journal.on('pointerup', () => (this.registry.get('onJournalClick') as () => void)())

    const body = this.add.circle(0, 0, 17, 0xf4e4c1).setStrokeStyle(5, 0x7a352c)
    const hat = this.add.triangle(0, -22, -15, 12, 0, -13, 15, 12, 0xc93f32)
    const name = this.add.text(0, 29, this.registry.get('username') as string, { color: '#fff', fontSize: '13px', stroke: '#071a28', strokeThickness: 3 }).setOrigin(.5, 0)
    this.player = this.add.container(SPAWN.x, SPAWN.y, [body, hat, name]).setSize(70, 66)
      .setInteractive({ useHandCursor: true })
    this.player.on('pointerup', () => (this.registry.get('onPlayerClick') as () => void)())

    this.add.text(ROOM.width / 2, 475, 'Ты приходишь в себя в каюте разбитого корабля.', {
      color: '#f1dfbd', fontSize: '18px', backgroundColor: '#17100dcc', padding: { x: 14, y: 9 },
    }).setOrigin(.5)
    this.time.delayedCall(2600, () => this.add.text(ROOM.width / 2, 420,
      'Кажется, тело тебя пока не слушается.\nНа столе лежит судовой журнал.', {
        align: 'center', color: '#f1dfbd', fontSize: '17px', backgroundColor: '#17100dcc', padding: { x: 14, y: 9 },
      }).setOrigin(.5))

    this.cameras.main.setBounds(0, 0, ROOM.width, ROOM.height).centerOn(ROOM.width / 2, ROOM.height / 2)
    this.bridge = this.registry.get('pythonBridge') as GamePythonBridge
    this.bridge.setMovementUnlocked(false)
    this.keys = new GameKeyboardState(this.input.keyboard!)
    const lifecycle = this.registry.get('sceneLifecycle') as SceneLifecycleCallbacks
    lifecycle.onReady(this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.keys.dispose(); lifecycle.onShutdown(this) })
  }

  setKeyboardEnabled(enabled: boolean) {
    if (!this.input.keyboard) return
    this.input.keyboard.enabled = enabled
    this.keys.setEnabled(enabled)
    if (!enabled) this.input.keyboard.resetKeys()
  }

  update(time: number) {
    if (time - this.lastTick < 50) return
    this.lastTick = time
    const position = { x: this.player.x, y: this.player.y }
    void this.bridge.tick(this.keys.snapshot(), position).then((next) => { if (next) this.player.setPosition(next.x, next.y) })
  }
}
