import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.user import Island, User, UserProgress, UserUnlock
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
    assert (islands[0].player_x, islands[0].player_y) == (2600, 2600)
    assert isinstance(islands[0].generation_seed, int)


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
    assert first_island.generation_seed != second_island.generation_seed

    client.post("/auth/logout")
    login(client, "firstmate", "temporary-password")
    assert client.get("/game/island").json() == {
        "id": first_island.id,
        "generation_seed": first_island.generation_seed,
        "player": {"x": 2600, "y": 2600},
    }
    # The API exposes no island id or user id selector; query parameters cannot change ownership.
    assert client.get(f"/game/island?user_id={second['id']}&island_id={second_island.id}").json()["id"] == first_island.id
    assert client.get(f"/game/islands/{second_island.id}").status_code == 404


def test_duplicate_island_is_rejected(users, db: Session) -> None:
    db.add(Island(user_id=users["user"].id, generation_seed=1))
    db.commit()
    db.add(Island(user_id=users["user"].id, generation_seed=2))
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_user_can_update_only_their_own_position(client: TestClient, users, db: Session) -> None:
    login(client)
    owner = create_regular_user(client, "moving-player")
    other = create_regular_user(client, "position-owner")
    owner_island = db.scalar(select(Island).where(Island.user_id == owner["id"]))
    other_island = db.scalar(select(Island).where(Island.user_id == other["id"]))
    owner_progress = db.scalar(select(UserProgress).where(UserProgress.user_id == owner["id"]))
    assert owner_progress is not None
    db.add(UserUnlock(progress_id=owner_progress.id, key="movement"))
    db.commit()
    client.post("/auth/logout")
    login(client, "moving-player", "temporary-password")
    response = client.put(f"/game/position?user_id={other['id']}&island_id={other_island.id}", json={"x": 2610, "y": 2610})
    assert response.status_code == 200
    db.refresh(owner_island)
    db.refresh(other_island)
    assert (owner_island.player_x, owner_island.player_y) == (2610, 2610)
    assert (other_island.player_x, other_island.player_y) == (2600, 2600)


def test_position_is_unchanged_without_movement_unlock_even_after_refresh(
    client: TestClient, users, db: Session
) -> None:
    login(client)
    created = create_regular_user(client, "tutorial-player")
    client.post("/auth/logout")
    login(client, "tutorial-player", "temporary-password")

    first_attempt = client.put("/game/position", json={"x": 2620, "y": 2610})
    assert first_attempt.status_code == 200
    assert first_attempt.json()["player"] == {"x": 2600, "y": 2600}
    assert client.get("/game/island").json()["player"] == {"x": 2600, "y": 2600}
    island = db.scalar(select(Island).where(Island.user_id == created["id"]))
    assert island is not None and (island.player_x, island.player_y) == (2600, 2600)


def test_position_changes_after_movement_unlock(client: TestClient, users, db: Session) -> None:
    login(client)
    created = create_regular_user(client, "unlocked-player")
    progress = db.scalar(select(UserProgress).where(UserProgress.user_id == created["id"]))
    assert progress is not None
    db.add(UserUnlock(progress_id=progress.id, key="movement"))
    db.commit()
    client.post("/auth/logout")
    login(client, "unlocked-player", "temporary-password")

    response = client.put("/game/position", json={"x": 2620, "y": 2610})
    assert response.status_code == 200
    assert response.json()["player"] == {"x": 2620, "y": 2610}


def test_island_seed_is_stable_across_repeated_requests(client: TestClient, users, db: Session) -> None:
    login(client)
    created = create_regular_user(client, "seeded-player")
    client.post("/auth/logout")
    login(client, "seeded-player", "temporary-password")
    first = client.get("/game/island").json()
    second = client.get("/game/island").json()
    assert first["generation_seed"] == second["generation_seed"]
    stored = db.scalar(select(Island).where(Island.user_id == created["id"]))
    assert stored is not None and stored.generation_seed == first["generation_seed"]


def test_position_outside_island_is_not_saved(client: TestClient, users, db: Session) -> None:
    login(client)
    created = create_regular_user(client, "bounded-player")
    progress = db.scalar(select(UserProgress).where(UserProgress.user_id == created["id"]))
    assert progress is not None
    db.add(UserUnlock(progress_id=progress.id, key="movement"))
    db.commit()
    client.post("/auth/logout")
    login(client, "bounded-player", "temporary-password")
    response = client.put("/game/position", json={"x": -10000, "y": -10000})
    assert response.status_code == 422
    island = db.scalar(select(Island).where(Island.user_id == created["id"]))
    assert island is not None
    assert (island.player_x, island.player_y) == (2600, 2600)


def test_invalid_saved_position_is_restored_to_safe_spawn(client: TestClient, users, db: Session) -> None:
    login(client)
    created = create_regular_user(client, "restored-player")
    island = db.scalar(select(Island).where(Island.user_id == created["id"]))
    assert island is not None
    island.player_x, island.player_y = -10000, -10000
    db.commit()

    client.post("/auth/logout")
    login(client, "restored-player", "temporary-password")
    response = client.get("/game/island")
    assert response.status_code == 200
    assert response.json()["player"] == {"x": 2600, "y": 2600}
    db.refresh(island)
    assert (island.player_x, island.player_y) == (2600, 2600)


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
