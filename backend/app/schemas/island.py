from pydantic import BaseModel, ConfigDict

from app.models.user import Island


class PlayerState(BaseModel):
    x: int
    y: int


class IslandPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    player: PlayerState

    @classmethod
    def from_island(cls, island: Island) -> "IslandPublic":
        return cls(id=island.id, player=PlayerState(x=island.player_x, y=island.player_y))
