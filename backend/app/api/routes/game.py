from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import current_user
from app.database.session import get_db
from app.game.island_geometry import SAFE_SPAWN, position_is_on_island
from app.models.user import Island, PlayerCode, User, UserProgress
from app.schemas.code import PlayerCodePayload, PlayerCodePublic
from app.schemas.island import IslandPublic, PlayerPositionUpdate
from app.schemas.progress import ProgressPublic

router = APIRouter(prefix="/game", tags=["game"])


@router.get("/progress", response_model=ProgressPublic)
def get_progress(
    user: User = Depends(current_user), db: Session = Depends(get_db)
) -> ProgressPublic:
    progress = db.scalar(select(UserProgress).where(UserProgress.user_id == user.id))
    if progress is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Progress not found")
    return ProgressPublic(unlocks=sorted(unlock.key for unlock in progress.unlocks))


@router.get("/island", response_model=IslandPublic)
def get_island(user: User = Depends(current_user), db: Session = Depends(get_db)) -> IslandPublic:
    island = db.scalar(select(Island).where(Island.user_id == user.id))
    if island is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Island not found")
    if not position_is_on_island(island.generation_seed, island.player_x, island.player_y):
        island.player_x, island.player_y = SAFE_SPAWN
        db.commit()
        db.refresh(island)
    return IslandPublic.from_island(island)


@router.put("/position", response_model=IslandPublic)
def update_position(payload: PlayerPositionUpdate, user: User = Depends(current_user), db: Session = Depends(get_db)) -> IslandPublic:
    island = db.scalar(select(Island).where(Island.user_id == user.id))
    if island is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Island not found")
    progress = db.scalar(select(UserProgress).where(UserProgress.user_id == user.id))
    if progress is None or not any(unlock.key == "movement" for unlock in progress.unlocks):
        # Coordinates are server-owned. Running arbitrary player.py remains allowed, but
        # it cannot use this endpoint to escape the tutorial before the unlock exists.
        return IslandPublic.from_island(island)
    if not position_is_on_island(island.generation_seed, payload.x, payload.y):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Position is outside the island")
    island.player_x, island.player_y = payload.x, payload.y
    db.commit()
    db.refresh(island)
    return IslandPublic.from_island(island)


@router.get("/code", response_model=PlayerCodePublic)
def get_code(user: User = Depends(current_user), db: Session = Depends(get_db)) -> PlayerCode:
    player_code = db.scalar(select(PlayerCode).where(PlayerCode.user_id == user.id))
    if player_code is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Player code not found")
    return player_code


@router.put("/code", response_model=PlayerCodePublic)
def save_code(
    payload: PlayerCodePayload,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> PlayerCode:
    player_code = db.scalar(select(PlayerCode).where(PlayerCode.user_id == user.id))
    if player_code is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Player code not found")
    player_code.code = payload.code
    db.commit()
    db.refresh(player_code)
    return player_code
