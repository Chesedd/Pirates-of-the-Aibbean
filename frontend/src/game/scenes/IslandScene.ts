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
    const width = this.scale.width
    const height = this.scale.height

    this.add.rectangle(0, 0, width, height, 0x176b87).setOrigin(0)
    const graphics = this.add.graphics()
    graphics.fillStyle(0xe7c66b).fillEllipse(width / 2, height / 2, 520, 330)
    graphics.fillStyle(0x4b9b58).fillEllipse(width / 2, height / 2 - 12, 460, 275)
    graphics.fillStyle(0x397d49).fillCircle(width / 2 - 125, height / 2 - 60, 46)
    graphics.fillCircle(width / 2 + 145, height / 2 + 35, 38)

    this.bridge = this.registry.get('pythonBridge') as GamePythonBridge
    const body = this.add.circle(0, 0, 17, 0xf4e4c1).setStrokeStyle(5, 0x7a352c)
    const hat = this.add.triangle(0, -22, -15, 12, 0, -13, 15, 12, 0xc93f32)
    this.player = this.add.container(island.player.x, island.player.y, [body, hat])
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
