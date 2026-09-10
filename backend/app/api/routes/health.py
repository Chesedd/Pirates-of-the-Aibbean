from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.schemas.health import HealthResponse
from app.services.health import database_is_available

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health_check(db: Session = Depends(get_db)) -> HealthResponse:
    return HealthResponse(status="ok", database="ok" if database_is_available(db) else "unavailable")
