from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.user import User
from app.services.bootstrap import bootstrap_admin


def test_bootstrap_admin_is_idempotent(db: Session) -> None:
    first, created = bootstrap_admin(db, "firstadmin", "long-safe-password")
    second, created_again = bootstrap_admin(db, "firstadmin", "different-password")
    assert created is True
    assert created_again is False
    assert first.id == second.id
    assert db.scalar(select(func.count()).select_from(User)) == 1
