import type { TopDownCollider } from '../movement/TopDownMovementResolver.js'
import type { GameLocationId, SpawnId } from './gameLocations.js'
export type LocationTransition = { id: string; destination: GameLocationId; trigger: TopDownCollider; spawnId: SpawnId }

