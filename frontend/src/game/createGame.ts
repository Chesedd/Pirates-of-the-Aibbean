import Phaser from 'phaser'
import { IslandScene } from './scenes/IslandScene'
import type { Island } from '../pages/UserPage'
import type { GamePythonBridge } from './GamePythonBridge'

export function createGame(parent: HTMLElement, island: Island, pythonBridge: GamePythonBridge): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#176b87',
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: '100%',
      height: '100%',
    },
    scene: IslandScene,
    callbacks: {
      preBoot: (game) => { game.registry.set('island', island); game.registry.set('pythonBridge', pythonBridge) },
    },
  })
}
