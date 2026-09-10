from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.dependencies import admin_user
from app.core.security import hash_password
from app.database.session import get_db
from app.models.user import Island, PlayerCode, Role, User
from app.schemas.user import UserCreate, UserListItem, UserPublic

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(admin_user)])


@router.get("/users", response_model=list[UserListItem])
def list_users(db: Session = Depends(get_db)) -> list[User]:
    return list(db.scalars(select(User).order_by(User.id)))


@router.post("/users", response_model=UserPublic, status_code=status.HTTP_201_CREATED)
def create_user(payload: UserCreate, db: Session = Depends(get_db)) -> User:
    user = User(username=payload.username, password_hash=hash_password(payload.password), role=payload.role)
    db.add(user)
    try:
        db.flush()
        if user.role == Role.USER:
            db.add(Island(user_id=user.id))
            db.add(PlayerCode(user_id=user.id))
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Username already exists") from None
    db.refresh(user)
    return user
