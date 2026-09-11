import Phaser from 'phaser'
import { IslandScene } from './scenes/IslandScene'
import { TutorialShipScene } from './scenes/TutorialShipScene'
import type { Island } from '../pages/UserPage'
import type { GamePythonBridge } from './GamePythonBridge'
import type { KeyboardScene } from './GameSceneLifecycle'
import { debugSwitches } from '../devDiagnostics'

export type SceneLifecycleCallbacks = {
  onReady: (scene: KeyboardScene) => void
  onShutdown: (scene: KeyboardScene) => void
}

export function createGame(
  parent: HTMLElement,
  island: Island,
  pythonBridge: GamePythonBridge,
  username: string,
  onPlayerClick: () => void,
  movementUnlocked: boolean,
  onJournalClick: () => void,
  sceneLifecycle: SceneLifecycleCallbacks,
): Phaser.Game {
  return new Phaser.Game({
    // HEADLESS preserves scene creation and updates while removing the renderer.
    type: debugSwitches.disablePhaserRenderer ? Phaser.HEADLESS : debugSwitches.disableWebGLPostFX ? Phaser.CANVAS : Phaser.AUTO,
    // Explicitly opaque: no alpha compositing is requested in any normal mode.
    transparent: false,
    parent,
    backgroundColor: '#176b87',
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: '100%',
      height: '100%',
    },
    scene: movementUnlocked ? IslandScene : TutorialShipScene,
    callbacks: {
      preBoot: (game) => {
        game.registry.set('island', island)
        game.registry.set('pythonBridge', pythonBridge)
        game.registry.set('username', username)
        game.registry.set('onPlayerClick', onPlayerClick)
        game.registry.set('onJournalClick', onJournalClick)
        game.registry.set('sceneLifecycle', sceneLifecycle)
      },
    },
  })
}
