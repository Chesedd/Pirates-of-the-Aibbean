export type GameLocationId = 'island' | 'wreck-cabin'
export type SpawnId = 'default' | 'companionway-return' | 'cabin-tutorial' | 'cabin-revisit'
export const GAME_LOCATIONS = {
  island: { title: 'Остров', kind: 'outdoor', sceneKey: 'island' },
  'wreck-cabin': { title: 'Каюта разбитого корабля', kind: 'interior', sceneKey: 'ship-cabin' },
} as const satisfies Record<GameLocationId, { title: string; kind: 'outdoor' | 'interior'; sceneKey: string }>

