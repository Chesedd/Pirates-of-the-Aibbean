export type DirectionKeys<Key> = Record<'up' | 'down' | 'left' | 'right', Key>

export const DIRECTION_KEY_CODES = { up: 'UP', down: 'DOWN', left: 'LEFT', right: 'RIGHT' } as const

/**
 * Do not use Phaser's createCursorKeys here: it also registers Space and Shift and
 * captures them globally with preventDefault(), even though the game never reads them.
 */
export function createDirectionKeys<Key>(keyboard: {
  addKeys(keys: typeof DIRECTION_KEY_CODES, enableCapture: boolean): unknown
}): DirectionKeys<Key> {
  return keyboard.addKeys(DIRECTION_KEY_CODES, false) as DirectionKeys<Key>
}
