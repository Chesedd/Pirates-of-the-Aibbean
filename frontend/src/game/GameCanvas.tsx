import { memo, useEffect, useRef } from 'react'
import type Phaser from 'phaser'
import { createGame } from './createGame'
import type { Island } from '../pages/UserPage'
import type { GamePythonBridge } from './GamePythonBridge'
import { GameSceneLifecycle } from './GameSceneLifecycle'
import { devCount, devDiagnosticsEnabled, installPhaserDiagnostics, type PhaserDiagnostics } from '../devDiagnostics'
import { GAME_LOCATIONS, type GameLocationId } from './locations/gameLocations'

type GameCanvasProps = {
  island: Island
  bridge: GamePythonBridge
  username: string
  keyboardEnabled: boolean
  onPlayerClick: () => void
  movementUnlocked: boolean
  shipExited: boolean
  onShipExited: (island: Island) => void
  editorOpen: boolean
  onJournalClick: () => void
  currentLocation: GameLocationId
  onLocationChange: (location: GameLocationId) => void
  onPersistenceError: (reason: Error) => void
}

export const GameCanvas = memo(function GameCanvas({ island, bridge, username, keyboardEnabled, onPlayerClick, movementUnlocked, shipExited, onShipExited, editorOpen, onJournalClick, currentLocation, onLocationChange, onPersistenceError }: GameCanvasProps) {
  const renderCount = useRef(0)
  if (devDiagnosticsEnabled) devCount('GameCanvas container render', ++renderCount.current)
  const containerRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Phaser.Game | null>(null)
  const lifecycleRef = useRef<GameSceneLifecycle | null>(null)
  const diagnosticsRef = useRef<PhaserDiagnostics | null>(null)
  const keyboardEnabledRef = useRef(keyboardEnabled)
  const initialState = useRef({ island, movementUnlocked, shipExited })
  const callbacks = useRef({ onPlayerClick, onJournalClick, onShipExited, onLocationChange, onPersistenceError })
  callbacks.current = { onPlayerClick, onJournalClick, onShipExited, onLocationChange, onPersistenceError }
  keyboardEnabledRef.current = keyboardEnabled

  useEffect(() => {
    if (!containerRef.current) return

    const lifecycle = new GameSceneLifecycle(keyboardEnabledRef.current)
    lifecycleRef.current = lifecycle
    const state = initialState.current
    const game = createGame(containerRef.current, state.island, bridge, username, () => callbacks.current.onPlayerClick(), state.movementUnlocked, state.shipExited, (value) => callbacks.current.onShipExited(value), () => callbacks.current.onJournalClick(), {
      onReady: (scene) => lifecycle.sceneReady(scene),
      onShutdown: (scene) => lifecycle.sceneShutdown(scene),
    }, (location) => callbacks.current.onLocationChange(location), (reason) => callbacks.current.onPersistenceError(reason))
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
  }, [bridge, username])

  useEffect(() => {
    const game = gameRef.current
    if (!game) return
    // Phaser's registry event updates the already-running cabin scene in place.
    game.registry.set('movementUnlocked', movementUnlocked)
    bridge.setMovementUnlocked(movementUnlocked)
  }, [bridge, movementUnlocked])

  useEffect(() => diagnosticsRef.current?.setEditorOpen(editorOpen), [editorOpen])

  useEffect(() => {
    lifecycleRef.current?.setKeyboardEnabled(keyboardEnabled)
  }, [keyboardEnabled])

  return <div className="game-canvas" ref={containerRef} aria-label={`${GAME_LOCATIONS[currentLocation].title} game view`} />
})

export type PhaserGame = Phaser.Game
