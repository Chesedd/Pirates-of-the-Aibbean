import sys

from app.core.config import settings
from app.database.session import SessionLocal
from app.services.bootstrap import bootstrap_admin


def main() -> int:
    username = settings.bootstrap_admin_username
    password = settings.bootstrap_admin_password
    if not username or not password or len(username) < 3 or len(password) < 12:
        print("Set BOOTSTRAP_ADMIN_USERNAME and BOOTSTRAP_ADMIN_PASSWORD (at least 12 characters).", file=sys.stderr)
        return 1
    with SessionLocal() as db:
        user, created = bootstrap_admin(db, username, password)
    print(f"Admin {user.username!r} {'created' if created else 'already exists'}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
