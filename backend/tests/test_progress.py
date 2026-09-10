from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import UserProgress, UserUnlock
from tests.test_auth import login
from tests.test_island import create_regular_user


def create_two_users(client: TestClient) -> tuple[dict, dict]:
    login(client)
    first = create_regular_user(client, "learner-one")
    second = create_regular_user(client, "learner-two")
    client.post("/auth/logout")
    return first, second


def test_new_user_has_empty_progress(client: TestClient, users, db: Session) -> None:
    login(client)
    created = create_regular_user(client, "new-learner")
    progress = db.scalar(select(UserProgress).where(UserProgress.user_id == created["id"]))
    assert progress is not None
    assert progress.unlocks == []


def test_progress_requires_authentication(client: TestClient) -> None:
    assert client.get("/game/progress").status_code == 401


def test_user_gets_own_empty_progress(client: TestClient, users) -> None:
    create_two_users(client)
    login(client, "learner-one", "temporary-password")
    assert client.get("/game/progress").json() == {"unlocks": []}


def test_two_users_have_independent_progress(client: TestClient, users, db: Session) -> None:
    first, _ = create_two_users(client)
    first_progress = db.scalar(select(UserProgress).where(UserProgress.user_id == first["id"]))
    assert first_progress is not None
    db.add(UserUnlock(progress_id=first_progress.id, key="movement"))
    db.commit()

    login(client, "learner-two", "temporary-password")
    assert client.get("/game/progress").json() == {"unlocks": []}
    client.post("/auth/logout")
    login(client, "learner-one", "temporary-password")
    assert client.get("/game/progress").json() == {"unlocks": ["movement"]}


def test_api_cannot_select_another_users_progress(client: TestClient, users) -> None:
    _, second = create_two_users(client)
    login(client, "learner-one", "temporary-password")
    assert client.get(f"/game/progress?user_id={second['id']}").json() == {"unlocks": []}
    assert client.get(f"/game/progress/{second['id']}").status_code == 404
