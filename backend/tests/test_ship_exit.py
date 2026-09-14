from sqlalchemy import select

from app.game.island_geometry import position_is_on_island, wreck_and_spawn
from app.models.user import Island, UserProgress, UserUnlock
from tests.test_auth import login
from tests.test_island import create_regular_user


def test_exit_requires_completed_movement_tutorial(client, users):
    login(client)
    create_regular_user(client, "locked-exit")
    client.post("/auth/logout")
    login(client, "locked-exit", "temporary-password")
    assert client.post("/game/tutorial/exit-ship").status_code == 403


def test_first_exit_spawns_by_wreck_and_repeat_is_idempotent(client, users, db):
    login(client)
    created = create_regular_user(client, "physical-exit")
    progress = db.scalar(select(UserProgress).where(UserProgress.user_id == created["id"]))
    for key in ("tutorial_linear_1", "tutorial_linear_2", "tutorial_if_1", "tutorial_if_2", "movement"):
        db.add(UserUnlock(progress_id=progress.id, key=key))
    db.commit()
    client.post("/auth/logout")
    login(client, "physical-exit", "temporary-password")

    first = client.post("/game/tutorial/exit-ship")
    assert first.status_code == 200
    payload = first.json()
    assert "tutorial_ship_exited" in client.get("/game/progress").json()["unlocks"]
    assert position_is_on_island(payload["generation_seed"], **payload["wreck"])
    assert position_is_on_island(payload["generation_seed"], **payload["player"])
    moved = {"x": payload["player"]["x"] + 1, "y": payload["player"]["y"] + 1}
    assert client.put("/game/position", json=moved).status_code == 200
    assert client.post("/game/tutorial/exit-ship").json()["player"] == moved


def test_wreck_is_deterministic_and_inland():
    for seed in (1, 2, 42, 999999):
        first = wreck_and_spawn(seed)
        assert first == wreck_and_spawn(seed)
        assert all(position_is_on_island(seed, *point) for point in first)
    assert wreck_and_spawn(1) != wreck_and_spawn(2)
