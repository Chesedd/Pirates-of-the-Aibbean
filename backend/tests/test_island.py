import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.user import Island, User
from tests.test_auth import login


def create_regular_user(client: TestClient, username: str) -> dict:
    response = client.post(
        "/admin/users",
        json={"username": username, "password": "temporary-password", "role": "user"},
    )
    assert response.status_code == 201
    return response.json()


def test_regular_user_creation_creates_exactly_one_island(client: TestClient, users, db: Session) -> None:
    login(client)
    created = create_regular_user(client, "islander")
    islands = list(db.scalars(select(Island).where(Island.user_id == created["id"])))
    assert len(islands) == 1
    assert (islands[0].player_x, islands[0].player_y) == (400, 300)


def test_admin_creation_does_not_create_island(client: TestClient, users, db: Session) -> None:
    login(client)
    response = client.post(
        "/admin/users",
        json={"username": "admiral", "password": "temporary-password", "role": "admin"},
    )
    assert response.status_code == 201
    assert db.scalar(select(Island).where(Island.user_id == response.json()["id"])) is None


def test_island_requires_authentication(client: TestClient) -> None:
    assert client.get("/game/island").status_code == 401


def test_users_receive_only_their_own_distinct_islands(client: TestClient, users, db: Session) -> None:
    login(client)
    first = create_regular_user(client, "firstmate")
    second = create_regular_user(client, "secondmate")
    first_island = db.scalar(select(Island).where(Island.user_id == first["id"]))
    second_island = db.scalar(select(Island).where(Island.user_id == second["id"]))
    assert first_island is not None and second_island is not None
    assert first_island.id != second_island.id

    client.post("/auth/logout")
    login(client, "firstmate", "temporary-password")
    assert client.get("/game/island").json() == {
        "id": first_island.id,
        "player": {"x": 400, "y": 300},
    }
    # The API exposes no island id or user id selector; query parameters cannot change ownership.
    assert client.get(f"/game/island?user_id={second['id']}&island_id={second_island.id}").json()["id"] == first_island.id
    assert client.get(f"/game/islands/{second_island.id}").status_code == 404


def test_duplicate_island_is_rejected(users, db: Session) -> None:
    db.add(Island(user_id=users["user"].id))
    db.commit()
    db.add(Island(user_id=users["user"].id))
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_user_and_island_creation_is_atomic(client: TestClient, users, db: Session, monkeypatch) -> None:
    login(client)
    original_flush = db.flush

    def fail_when_island_is_pending(*args, **kwargs):
        if any(isinstance(value, Island) for value in db.new):
            raise IntegrityError("forced island failure", {}, RuntimeError())
        return original_flush(*args, **kwargs)

    monkeypatch.setattr(db, "flush", fail_when_island_is_pending)
    response = client.post(
        "/admin/users",
        json={"username": "castaway", "password": "temporary-password", "role": "user"},
    )
    assert response.status_code == 409
    assert db.scalar(select(func.count()).select_from(User).where(User.username == "castaway")) == 0
