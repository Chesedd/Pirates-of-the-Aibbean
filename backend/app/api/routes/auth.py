from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.api.dependencies import current_user
from app.core.config import settings
from app.core.security import hash_session_token, new_session_token, verify_password
from app.database.session import get_db
from app.models.user import User, UserSession
from app.schemas.user import LoginRequest, UserPublic

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=UserPublic)
def login(credentials: LoginRequest, response: Response, db: Session = Depends(get_db)) -> User:
    user = db.scalar(select(User).where(User.username == credentials.username))
    if user is None or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid username or password")
    token = new_session_token()
    db.add(UserSession(token_hash=hash_session_token(token), user_id=user.id,
                       expires_at=datetime.now(timezone.utc) + timedelta(seconds=settings.session_lifetime_seconds)))
    db.commit()
    response.set_cookie(settings.session_cookie_name, token, httponly=True,
                        secure=settings.session_cookie_secure, samesite=settings.session_cookie_samesite,
                        max_age=settings.session_lifetime_seconds, path="/")
    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response, token: str | None = Cookie(default=None, alias=settings.session_cookie_name),
           db: Session = Depends(get_db)) -> None:
    if token:
        db.execute(delete(UserSession).where(UserSession.token_hash == hash_session_token(token)))
        db.commit()
    response.delete_cookie(settings.session_cookie_name, path="/", secure=settings.session_cookie_secure,
                           httponly=True, samesite=settings.session_cookie_samesite)


@router.get("/me", response_model=UserPublic)
def me(user: User = Depends(current_user)) -> User:
    return user
