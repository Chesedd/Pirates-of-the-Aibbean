import { useEffect, useRef } from 'react'
import type Phaser from 'phaser'
import { createGame } from './createGame'
import type { Island } from '../pages/UserPage'

export function GameCanvas({ island }: { island: Island }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const game = createGame(containerRef.current, island)
    return () => game.destroy(true)
  }, [island])

  return <div className="game-canvas" ref={containerRef} aria-label="Your island game view" />
}

export type PhaserGame = Phaser.Game
