import type { GameKeys, GamePosition } from './pythonProtocol.js'

/** Build Python source without treating JSON booleans as Python literals. */
export function buildGamePrelude(keys: GameKeys, position: GamePosition): string {
  const keysJson = JSON.stringify(keys)
  return [
    'import json',
    `x=${JSON.stringify(position.x)}`,
    `y=${JSON.stringify(position.y)}`,
    `_keys=json.loads(${JSON.stringify(keysJson)})`,
    'def key_pressed(key):',
    '    return bool(_keys.get(key, False))',
  ].join('\n')
}
