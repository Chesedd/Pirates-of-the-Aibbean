import Phaser from 'phaser'
import type { WreckLayout } from './wreckGeometry'

const REFERENCE_SCALE = 0.72

function addCrate(g: Phaser.GameObjects.Graphics, x: number, y: number, size: number) {
  g.fillStyle(0x74401f).fillRoundedRect(x, y, size, size, 5)
  g.lineStyle(5, 0x21150f).strokeRoundedRect(x, y, size, size, 5)
  g.lineStyle(4, 0x2d1a12)
    .lineBetween(x + 6, y + 6, x + size - 6, y + size - 6)
    .lineBetween(x + size - 6, y + 6, x + 6, y + size - 6)
}

function addBarrel(g: Phaser.GameObjects.Graphics, x: number, y: number, radius: number) {
  g.fillStyle(0x81502a).fillCircle(x, y, radius)
  g.lineStyle(5, 0x21150f).strokeCircle(x, y, radius)
  g.lineStyle(3, 0xc38a4a).strokeCircle(x, y, radius * 0.5)
}

/** Draws the v10 technical reference as one deterministic, top-down Graphics landmark. */
export function drawWreck(scene: Phaser.Scene, layout: WreckLayout) {
  const g = scene.add.graphics()
    .setPosition(layout.anchor.x, layout.anchor.y)
    .setRotation(layout.angle)
    .setScale(REFERENCE_SCALE)
    .setData('role', 'island-wreck')
    .setData('wreck-variant', layout.variant)

  // Flat transom at the stern, curved sides and a single pointed bow.
  g.fillStyle(0x392216).fillPoints([
    { x: -350, y: -98 }, { x: -350, y: 98 }, { x: -322, y: 118 },
    { x: -250, y: 143 }, { x: -130, y: 152 }, { x: -28, y: 142 },
    { x: 78, y: 132 }, { x: 186, y: 126 }, { x: 262, y: 94 },
    { x: 314, y: 72 }, { x: 348, y: 40 }, { x: 386, y: 0 },
    { x: 348, y: -40 }, { x: 314, y: -72 }, { x: 262, y: -94 },
    { x: 186, y: -126 }, { x: 78, y: -132 }, { x: -28, y: -142 },
    { x: -130, y: -152 }, { x: -250, y: -143 }, { x: -322, y: -118 },
  ], true)
  g.lineStyle(8, 0x21150f).strokePoints([
    { x: -350, y: -98 }, { x: -350, y: 98 }, { x: -322, y: 118 },
    { x: -250, y: 143 }, { x: -28, y: 142 }, { x: 186, y: 126 },
    { x: 262, y: 94 }, { x: 348, y: 40 }, { x: 386, y: 0 },
    { x: 348, y: -40 }, { x: 262, y: -94 }, { x: 186, y: -126 },
    { x: -28, y: -142 }, { x: -250, y: -143 }, { x: -322, y: -118 },
  ], true)

  g.fillStyle(0x70401f).fillPoints([
    { x: -314, y: -72 }, { x: -314, y: 72 }, { x: -250, y: 112 },
    { x: -142, y: 118 }, { x: -36, y: 108 }, { x: 72, y: 98 },
    { x: 170, y: 92 }, { x: 238, y: 68 }, { x: 288, y: 50 },
    { x: 340, y: 0 }, { x: 288, y: -50 }, { x: 238, y: -68 },
    { x: 170, y: -92 }, { x: 72, y: -98 }, { x: -36, y: -108 },
    { x: -142, y: -118 }, { x: -250, y: -112 },
  ], true)
  g.lineStyle(5, 0x9c6232).strokePoints([
    { x: -314, y: -72 }, { x: -314, y: 72 }, { x: -250, y: 112 },
    { x: -36, y: 108 }, { x: 170, y: 92 }, { x: 238, y: 68 },
    { x: 340, y: 0 }, { x: 238, y: -68 }, { x: 170, y: -92 },
    { x: -36, y: -108 }, { x: -250, y: -112 },
  ], true)

  // Raised quarterdeck ends before the companionway.
  g.fillStyle(0x5a341d).fillPoints([
    { x: -314, y: -70 }, { x: -314, y: 70 }, { x: -278, y: 92 },
    { x: -228, y: 99 }, { x: -174, y: 94 }, { x: -150, y: 62 },
    { x: -150, y: -62 }, { x: -174, y: -94 }, { x: -228, y: -99 },
  ], true)
  g.lineStyle(5, 0x21150f).strokePoints([
    { x: -314, y: -70 }, { x: -314, y: 70 }, { x: -278, y: 92 },
    { x: -228, y: 99 }, { x: -174, y: 94 }, { x: -150, y: 62 },
    { x: -150, y: -62 }, { x: -174, y: -94 }, { x: -228, y: -99 },
  ], true)
  g.lineStyle(4, 0x9c6232)
    .lineBetween(-286, -44, -176, -44)
    .lineBetween(-290, -8, -170, -8)
    .lineBetween(-286, 28, -176, 28)

  // Recessed companionway: framed deck cut-out with treads descending toward the bow.
  g.fillStyle(0x4a2b18).fillRect(-126, -28, 96, 56)
  g.lineStyle(6, 0x21150f).strokeRect(-126, -28, 96, 56)
  g.fillStyle(0x130c08).fillRect(-112, -18, 70, 36)
  g.fillStyle(0x58351f).fillPoints([
    { x: -126, y: -28 }, { x: -112, y: -18 }, { x: -112, y: 18 }, { x: -126, y: 28 },
  ], true).fillPoints([
    { x: -30, y: -28 }, { x: -42, y: -18 }, { x: -42, y: 18 }, { x: -30, y: 28 },
  ], true)
  g.lineStyle(5, 0xc08a4b).lineBetween(-118, -22, -38, -22)
  for (const x of [-100, -86, -72, -58]) g.lineBetween(x, -14, x, 14)

  // Broken mast stump.
  g.fillStyle(0x58351f).fillCircle(8, -6, 27)
  g.lineStyle(7, 0x21150f).strokeCircle(8, -6, 27)
  g.fillStyle(0x704629).fillCircle(8, -6, 16)
  g.lineStyle(4, 0x9c6232).strokeCircle(8, -6, 16)
  g.lineStyle(3, 0x392216).lineBetween(3, -17, 8, 3).lineBetween(16, -16, 18, 3)

  // A clean starboard breach: damaged beams stay on its rim.
  g.fillStyle(0x100b09).fillPoints([
    { x: 104, y: -104 }, { x: 150, y: -110 }, { x: 196, y: -98 },
    { x: 220, y: -78 }, { x: 202, y: -62 }, { x: 214, y: -42 },
    { x: 188, y: -24 }, { x: 158, y: -34 }, { x: 132, y: -58 },
    { x: 98, y: -68 }, { x: 90, y: -88 },
  ], true)
  g.lineStyle(6, 0x21150f).strokePoints([
    { x: 104, y: -104 }, { x: 150, y: -110 }, { x: 196, y: -98 },
    { x: 220, y: -78 }, { x: 202, y: -62 }, { x: 214, y: -42 },
    { x: 188, y: -24 }, { x: 158, y: -34 }, { x: 132, y: -58 },
    { x: 98, y: -68 }, { x: 90, y: -88 },
  ], true)
  g.lineStyle(8, 0x58351f).lineBetween(102, -100, 84, -80).lineBetween(204, -88, 224, -66)

  // Bow reinforcement and the only on-deck cargo group.
  g.fillStyle(0x58351f).fillPoints([
    { x: 264, y: -62 }, { x: 300, y: -46 }, { x: 342, y: 0 },
    { x: 300, y: 46 }, { x: 264, y: 62 }, { x: 286, y: 28 },
    { x: 298, y: 0 }, { x: 286, y: -28 },
  ], true)
  g.lineStyle(5, 0x21150f).strokePoints([
    { x: 264, y: -62 }, { x: 300, y: -46 }, { x: 342, y: 0 },
    { x: 300, y: 46 }, { x: 264, y: 62 }, { x: 286, y: 28 },
    { x: 298, y: 0 }, { x: 286, y: -28 },
  ], true)
  addCrate(g, 190, 24, 44)
  addBarrel(g, 259, 48, 20)

  // Gangway begins inside a visible rail gap and projects toward dry land.
  g.fillStyle(0x100b09).fillPoints([
    { x: 78, y: 118 }, { x: 142, y: 110 }, { x: 154, y: 136 }, { x: 88, y: 146 },
  ], true)
  g.lineStyle(5, 0x21150f).strokePoints([
    { x: 78, y: 118 }, { x: 142, y: 110 }, { x: 154, y: 136 }, { x: 88, y: 146 },
  ], true)
  g.fillStyle(0x58351f).fillPoints([
    { x: 86, y: 128 }, { x: 148, y: 128 }, { x: 155, y: 220 }, { x: 79, y: 220 },
  ], true)
  g.lineStyle(6, 0x21150f).strokePoints([
    { x: 86, y: 128 }, { x: 148, y: 128 }, { x: 155, y: 220 }, { x: 79, y: 220 },
  ], true)
  g.lineStyle(5, 0xc08a4b)
  for (const y of [144, 163, 182, 201]) g.lineBetween(91, y, 143, y)

  // Four restrained, identifiable debris groups around the hull.
  g.lineStyle(14, 0x58351f).lineBetween(300, -190, 470, -166)
  g.lineStyle(7, 0x704629).lineBetween(300, -190, 470, -166)
  g.lineStyle(14, 0x58351f).lineBetween(365, -220, 354, -142)
  g.fillStyle(0x392216).fillPoints([
    { x: -420, y: 178 }, { x: -272, y: 168 }, { x: -252, y: 202 }, { x: -402, y: 220 },
  ], true)
  g.lineStyle(7, 0x21150f).strokePoints([
    { x: -420, y: 178 }, { x: -272, y: 168 }, { x: -252, y: 202 }, { x: -402, y: 220 },
  ], true)
  g.lineStyle(4, 0x9c6232).lineBetween(-390, 187, -280, 179).lineBetween(-384, 204, -270, 192)
  g.lineStyle(18, 0x21150f).lineBetween(-220, 235, -112, 246).lineBetween(-205, 270, -117, 265)
  g.lineStyle(10, 0x70401f).lineBetween(-220, 235, -112, 246).lineBetween(-205, 270, -117, 265)
  addCrate(g, 360, 174, 54)
  addBarrel(g, 457, 208, 25)

  return g
}
