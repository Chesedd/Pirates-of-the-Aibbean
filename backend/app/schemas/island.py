from pydantic import BaseModel, ConfigDict

from app.models.user import Island


class PlayerState(BaseModel):
    x: int
    y: int


class WreckState(BaseModel):
    x: int
    y: int


class PlayerPositionUpdate(BaseModel):
    x: int
    y: int


class IslandPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    generation_seed: int
    player: PlayerState
    wreck: WreckState

    @classmethod
    def from_island(cls, island: Island) -> "IslandPublic":
        from app.game.island_geometry import wreck_and_spawn
        wreck, _ = wreck_and_spawn(island.generation_seed)
        return cls(
            id=island.id,
            generation_seed=island.generation_seed,
            player=PlayerState(x=island.player_x, y=island.player_y),
            wreck=WreckState(x=round(wreck[0]), y=round(wreck[1])),
        )
