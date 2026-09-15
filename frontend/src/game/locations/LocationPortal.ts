import type Phaser from 'phaser'
import type { GameLocationId, SpawnId } from './gameLocations'

export type PortalSensor = { x: number; y: number; width: number; height: number; angle?: number }
export type LocationPortal = {
  id: string; destination: GameLocationId; destinationSpawn: SpawnId; label: string
  sensor: PortalSensor; approachDirection?: { x: number; y: number }
}

export function portalContains(portal: LocationPortal, point: { x: number; y: number }, radius = 0) {
  const angle = -(portal.sensor.angle ?? 0), dx = point.x - portal.sensor.x, dy = point.y - portal.sensor.y
  const x = dx * Math.cos(angle) - dy * Math.sin(angle), y = dx * Math.sin(angle) + dy * Math.cos(angle)
  return Math.abs(x) <= portal.sensor.width / 2 + radius && Math.abs(y) <= portal.sensor.height / 2 + radius
}
export function portalActivates(portal: LocationPortal, point: { x: number; y: number }, velocity: { x: number; y: number }) {
  if (!portalContains(portal, point)) return false
  const direction = portal.approachDirection
  return !direction || velocity.x * direction.x + velocity.y * direction.y > 1
}
export function createPortalHint(scene: Phaser.Scene, portal: LocationPortal, distance = 90) {
  const text = scene.add.text(portal.sensor.x, portal.sensor.y - portal.sensor.height / 2 - 18, portal.label, {
    color: '#f8df9a', fontSize: '15px', backgroundColor: '#17100ddd', padding: { x: 9, y: 5 },
  }).setOrigin(.5).setDepth(5000).setVisible(false)
  return { update(point: { x: number; y: number }) { text.setVisible(Math.hypot(point.x - portal.sensor.x, point.y - portal.sensor.y) <= distance) }, destroy() { text.destroy() } }
}
