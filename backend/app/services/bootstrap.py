from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.user import Role, User


def bootstrap_admin(db: Session, username: str, password: str) -> tuple[User, bool]:
    existing = db.scalar(select(User).where(User.username == username))
    if existing:
        return existing, False
    user = User(username=username, password_hash=hash_password(password), role=Role.ADMIN)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user, True
