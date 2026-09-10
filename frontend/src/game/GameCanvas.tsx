import { useEffect, useRef } from 'react'
import type Phaser from 'phaser'
import { createGame } from './createGame'
import type { Island } from '../pages/UserPage'
import type { GamePythonBridge } from './GamePythonBridge'

export function GameCanvas({ island, bridge }: { island: Island; bridge: GamePythonBridge }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const game = createGame(containerRef.current, island, bridge)
    return () => game.destroy(true)
  }, [island, bridge])

  return <div className="game-canvas" ref={containerRef} aria-label="Your island game view" />
}

export type PhaserGame = Phaser.Game
