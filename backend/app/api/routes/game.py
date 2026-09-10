from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import current_user
from app.database.session import get_db
from app.models.user import Island, User
from app.schemas.island import IslandPublic

router = APIRouter(prefix="/game", tags=["game"])


@router.get("/island", response_model=IslandPublic)
def get_island(user: User = Depends(current_user), db: Session = Depends(get_db)) -> IslandPublic:
    island = db.scalar(select(Island).where(Island.user_id == user.id))
    if island is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Island not found")
    return IslandPublic.from_island(island)
