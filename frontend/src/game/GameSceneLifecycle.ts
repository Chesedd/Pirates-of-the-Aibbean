export interface KeyboardScene {
  setKeyboardEnabled(enabled: boolean): void
}

/** Keeps React state changes away from scenes that are not ready (or are gone). */
export class GameSceneLifecycle {
  private scene: KeyboardScene | null = null
  private keyboardEnabled: boolean
  private disposed = false

  constructor(keyboardEnabled: boolean) {
    this.keyboardEnabled = keyboardEnabled
  }

  setKeyboardEnabled(enabled: boolean) {
    this.keyboardEnabled = enabled
    this.scene?.setKeyboardEnabled(enabled)
  }

  sceneReady(scene: KeyboardScene) {
    if (this.disposed) return
    this.scene = scene
    scene.setKeyboardEnabled(this.keyboardEnabled)
  }

  sceneShutdown(scene: KeyboardScene) {
    if (this.scene === scene) this.scene = null
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.scene = null
  }
}
