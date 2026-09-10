from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import current_user
from app.database.session import get_db
from app.models.user import Island, PlayerCode, User
from app.schemas.code import PlayerCodePayload, PlayerCodePublic
from app.schemas.island import IslandPublic, PlayerPositionUpdate

router = APIRouter(prefix="/game", tags=["game"])


@router.get("/island", response_model=IslandPublic)
def get_island(user: User = Depends(current_user), db: Session = Depends(get_db)) -> IslandPublic:
    island = db.scalar(select(Island).where(Island.user_id == user.id))
    if island is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Island not found")
    return IslandPublic.from_island(island)


@router.put("/position", response_model=IslandPublic)
def update_position(payload: PlayerPositionUpdate, user: User = Depends(current_user), db: Session = Depends(get_db)) -> IslandPublic:
    island = db.scalar(select(Island).where(Island.user_id == user.id))
    if island is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Island not found")
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
