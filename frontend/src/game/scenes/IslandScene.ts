import Phaser from 'phaser'
import type { Island } from '../../pages/UserPage'

export class IslandScene extends Phaser.Scene {
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

    // The player is deliberately only a display object: no input handlers, velocity, or physics.
    this.add.circle(island.player.x, island.player.y, 17, 0xf4e4c1).setStrokeStyle(5, 0x7a352c)
    this.add.triangle(island.player.x, island.player.y - 22, -15, 12, 0, -13, 15, 12, 0xc93f32)
  }
}
