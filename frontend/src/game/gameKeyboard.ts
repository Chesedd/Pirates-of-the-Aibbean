import type { GameKeys } from '../python/pythonProtocol.js'

type KeyboardEventLike = { code: string }

export type KeyboardEventSource = {
  on(event: 'keydown' | 'keyup', listener: (event: KeyboardEventLike) => void): unknown
  off(event: 'keydown' | 'keyup', listener: (event: KeyboardEventLike) => void): unknown
}

const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('')
const DIGITS = '0123456789'.split('')
const NAMED_KEYS = ['up', 'down', 'left', 'right', 'space', 'shift', 'ctrl']
export const GAME_KEY_NAMES = [...LETTERS, ...DIGITS, ...NAMED_KEYS]

/** Convert a physical KeyboardEvent.code to the name exposed to player.py. */
export function gameKeyName(code: string): string | null {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3).toLowerCase()
  if (/^Digit[0-9]$/.test(code)) return code.slice(5)
  const names: Record<string, string> = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    Space: 'space', ShiftLeft: 'shift', ShiftRight: 'shift',
    ControlLeft: 'ctrl', ControlRight: 'ctrl',
  }
  return names[code] ?? null
}

/**
 * Tracks game input without adding browser captures. KeyboardEvent.code deliberately
 * makes letter controls independent of the user's active keyboard layout.
 */
export class GameKeyboardState {
  private enabled = true
  private readonly downCodes = new Set<string>()
  private readonly keydown = (event: KeyboardEventLike) => {
    if (this.enabled && gameKeyName(event.code)) this.downCodes.add(event.code)
  }
  private readonly keyup = (event: KeyboardEventLike) => {
    this.downCodes.delete(event.code)
  }

  constructor(private readonly source: KeyboardEventSource) {
    source.on('keydown', this.keydown)
    source.on('keyup', this.keyup)
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    if (!enabled) this.downCodes.clear()
  }

  snapshot(): GameKeys {
    const result: GameKeys = Object.fromEntries(GAME_KEY_NAMES.map((key) => [key, false]))
    for (const code of this.downCodes) {
      const key = gameKeyName(code)
      if (key) result[key] = true
    }
    return result
  }

  dispose(): void {
    this.downCodes.clear()
    this.source.off('keydown', this.keydown)
    this.source.off('keyup', this.keyup)
  }
}
