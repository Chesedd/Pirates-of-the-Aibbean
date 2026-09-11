import { memo, useEffect, useRef } from 'react'
import type Phaser from 'phaser'
import { createGame } from './createGame'
import type { Island } from '../pages/UserPage'
import type { GamePythonBridge } from './GamePythonBridge'
import { GameSceneLifecycle } from './GameSceneLifecycle'
import { devCount, devDiagnosticsEnabled, installPhaserDiagnostics, type PhaserDiagnostics } from '../devDiagnostics'

type GameCanvasProps = {
  island: Island
  bridge: GamePythonBridge
  username: string
  keyboardEnabled: boolean
  onPlayerClick: () => void
  movementUnlocked: boolean
  editorOpen: boolean
  onJournalClick: () => void
}

export const GameCanvas = memo(function GameCanvas({ island, bridge, username, keyboardEnabled, onPlayerClick, movementUnlocked, editorOpen, onJournalClick }: GameCanvasProps) {
  const renderCount = useRef(0)
  if (devDiagnosticsEnabled) devCount('GameCanvas container render', ++renderCount.current)
  const containerRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Phaser.Game | null>(null)
  const lifecycleRef = useRef<GameSceneLifecycle | null>(null)
  const diagnosticsRef = useRef<PhaserDiagnostics | null>(null)
  const keyboardEnabledRef = useRef(keyboardEnabled)
  keyboardEnabledRef.current = keyboardEnabled

  useEffect(() => {
    if (!containerRef.current) return

    const lifecycle = new GameSceneLifecycle(keyboardEnabledRef.current)
    lifecycleRef.current = lifecycle
    const game = createGame(containerRef.current, island, bridge, username, onPlayerClick, movementUnlocked, onJournalClick, {
      onReady: (scene) => lifecycle.sceneReady(scene),
      onShutdown: (scene) => lifecycle.sceneShutdown(scene),
    })
    gameRef.current = game
    const diagnostics = installPhaserDiagnostics(game, containerRef.current)
    diagnosticsRef.current = diagnostics
    let cleanedUp = false
    return () => {
      if (cleanedUp) return
      cleanedUp = true
      lifecycle.dispose()
      diagnostics.dispose()
      if (diagnosticsRef.current === diagnostics) diagnosticsRef.current = null
      if (lifecycleRef.current === lifecycle) lifecycleRef.current = null
      if (gameRef.current === game) gameRef.current = null
      game.destroy(true)
    }
  }, [island, bridge, username, onPlayerClick, movementUnlocked, onJournalClick])

  useEffect(() => diagnosticsRef.current?.setEditorOpen(editorOpen), [editorOpen])

  useEffect(() => {
    lifecycleRef.current?.setKeyboardEnabled(keyboardEnabled)
  }, [keyboardEnabled])

  return <div className="game-canvas" ref={containerRef} aria-label={movementUnlocked ? 'Your island game view' : 'Tutorial ship cabin'} />
})

export type PhaserGame = Phaser.Game
