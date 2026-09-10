import { useEffect, useRef } from 'react'
import type Phaser from 'phaser'
import { createGame } from './createGame'
import type { Island } from '../pages/UserPage'
import type { GamePythonBridge } from './GamePythonBridge'

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

  useEffect(() => {
    if (!containerRef.current) return

    const game = createGame(containerRef.current, island, bridge, username, onPlayerClick)
    gameRef.current = game
    return () => {
      gameRef.current = null
      game.destroy(true)
    }
  }, [island, bridge, username, onPlayerClick])

  useEffect(() => {
    const keyboard = gameRef.current?.input.keyboard
    if (!keyboard) return
    keyboard.enabled = keyboardEnabled
    const sceneKeyboard = gameRef.current?.scene.getScene('island').input.keyboard
    if (sceneKeyboard) {
      sceneKeyboard.enabled = keyboardEnabled
      if (!keyboardEnabled) sceneKeyboard.resetKeys()
    }
  }, [keyboardEnabled])

  return <div className="game-canvas" ref={containerRef} aria-label="Your island game view" />
}

export type PhaserGame = Phaser.Game
