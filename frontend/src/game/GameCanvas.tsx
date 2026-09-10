import { useEffect, useRef } from 'react'
import type Phaser from 'phaser'
import { createGame } from './createGame'

export function GameCanvas() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const game = createGame(containerRef.current)
    return () => game.destroy(true)
  }, [])

  return <div className="game-canvas" ref={containerRef} aria-label="Phaser game canvas" />
}

export type PhaserGame = Phaser.Game
