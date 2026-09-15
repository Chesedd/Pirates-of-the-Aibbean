import type Phaser from 'phaser'
import { GAME_LOCATIONS, type GameLocationId, type SpawnId } from './gameLocations.js'

export class LocationController {
  current: GameLocationId
  constructor(initial: GameLocationId, private readonly notify: (location: GameLocationId) => void) { this.current = initial }
  enter(scene: Phaser.Scene, location: GameLocationId, spawnId: SpawnId = 'default', data: Record<string, unknown> = {}) {
    this.current = location
    this.notify(location)
    scene.scene.start(GAME_LOCATIONS[location].sceneKey, { ...data, spawnId })
  }
  sceneCreated(location: GameLocationId) { this.current = location; this.notify(location) }
}

