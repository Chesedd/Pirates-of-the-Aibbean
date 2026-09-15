import Phaser from 'phaser'

/** Canonical player artwork shared by every world and interior scene. */
export function createPlayerAvatar(scene: Phaser.Scene, position: { x: number; y: number }, username: string) {
  const body = scene.add.circle(0, 0, 17, 0xf4e4c1).setStrokeStyle(5, 0x7a352c)
  const hat = scene.add.triangle(0, -22, -15, 12, 0, -13, 15, 12, 0xc93f32)
  const name = scene.add.text(0, 29, username, {
    color: '#ffffff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: '13px',
    stroke: '#071a28', strokeThickness: 3,
  }).setOrigin(0.5, 0)
  const container = scene.add.container(position.x, position.y, [body, hat, name])
    .setSize(Math.max(54, name.width + 12), 66).setInteractive({ useHandCursor: true })
  return { container, body, hat, name }
}

