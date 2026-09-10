import Phaser from 'phaser'
import type { Island } from '../../pages/UserPage'
import type { GamePythonBridge } from '../GamePythonBridge'

export class IslandScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Container
  private keys!: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>
  private bridge!: GamePythonBridge
  private lastTick = 0
  constructor() {
    super('island')
  }

  create() {
    const island = this.registry.get('island') as Island
    const centerX = 400
    const centerY = 300

    this.cameras.main.setBackgroundColor(0x176b87)
    const graphics = this.add.graphics()
    graphics.fillStyle(0xe7c66b).fillEllipse(centerX, centerY, 1120, 680)
    graphics.fillStyle(0x4b9b58).fillEllipse(centerX, centerY - 18, 1020, 590)
    graphics.fillStyle(0x397d49).fillCircle(centerX - 300, centerY - 145, 72)
    graphics.fillCircle(centerX + 325, centerY + 115, 65)

    this.bridge = this.registry.get('pythonBridge') as GamePythonBridge
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
    this.cameras.main.centerOn(centerX, centerY)
    const cursors = this.input.keyboard!.createCursorKeys()
    this.keys = { up: cursors.up, down: cursors.down, left: cursors.left, right: cursors.right }
  }

  update(time: number) {
    if (time - this.lastTick < 50) return
    this.lastTick = time
    const position = { x: this.player.x, y: this.player.y }
    const keys = { up: this.keys.up.isDown, down: this.keys.down.isDown,
      left: this.keys.left.isDown, right: this.keys.right.isDown }
    void this.bridge.tick(keys, position).then((next) => {
      if (next) this.player.setPosition(next.x, next.y)
    })
  }
}
