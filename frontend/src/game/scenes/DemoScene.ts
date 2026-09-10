import Phaser from 'phaser'

export class DemoScene extends Phaser.Scene {
  constructor() {
    super('demo')
  }

  create() {
    this.add.rectangle(0, 0, 4000, 4000, 0x102c44).setOrigin(0)
    this.add.circle(180, 120, 58, 0xf5c451)
    this.add.triangle(420, 155, 0, 100, 70, 0, 140, 100, 0x37b7a5)
    this.add.rectangle(650, 130, 130, 85, 0xe9795f).setRotation(0.12)
  }
}
