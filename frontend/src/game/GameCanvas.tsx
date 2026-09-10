import { useEffect, useRef } from 'react'
import type Phaser from 'phaser'
import { createGame } from './createGame'
import type { Island } from '../pages/UserPage'
import type { GamePythonBridge } from './GamePythonBridge'
import { GameSceneLifecycle } from './GameSceneLifecycle'

type GameCanvasProps = {
  island: Island
  bridge: GamePythonBridge
  username: string
  keyboardEnabled: boolean
  onPlayerClick: () => void
}

export function GameCanvas({ island, bridge, username, keyboardEnabled, onPlayerClick }: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Phaser.Game | null>(null)
  const lifecycleRef = useRef<GameSceneLifecycle | null>(null)
  const keyboardEnabledRef = useRef(keyboardEnabled)
  keyboardEnabledRef.current = keyboardEnabled

  useEffect(() => {
    if (!containerRef.current) return

    const lifecycle = new GameSceneLifecycle(keyboardEnabledRef.current)
    lifecycleRef.current = lifecycle
    const game = createGame(containerRef.current, island, bridge, username, onPlayerClick, {
      onReady: (scene) => lifecycle.sceneReady(scene),
      onShutdown: (scene) => lifecycle.sceneShutdown(scene),
    })
    gameRef.current = game
    let cleanedUp = false
    return () => {
      if (cleanedUp) return
      cleanedUp = true
      lifecycle.dispose()
      if (lifecycleRef.current === lifecycle) lifecycleRef.current = null
      if (gameRef.current === game) gameRef.current = null
      game.destroy(true)
    }
  }, [island, bridge, username, onPlayerClick])

  useEffect(() => {
    lifecycleRef.current?.setKeyboardEnabled(keyboardEnabled)
  }, [keyboardEnabled])

  return <div className="game-canvas" ref={containerRef} aria-label="Your island game view" />
}

export type PhaserGame = Phaser.Game
