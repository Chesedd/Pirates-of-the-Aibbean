import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import Island, UserProgress
from tests.test_auth import login
from tests.test_island import create_regular_user


def tutorial_user(client: TestClient) -> dict:
    login(client)
    user = create_regular_user(client, "journal-student")
    client.post("/auth/logout")
    login(client, "journal-student", "temporary-password")
    return user


def submit(client: TestClient, task: int, code: str):
    return client.post("/game/tutorial/check", json={"task": task, "code": code})


def complete_linear_tasks(client: TestClient) -> None:
    assert submit(client, 1, "print(14)").json()["correct"] is True
    assert submit(client, 2, "print(17)\nprint(5)").json()["correct"] is True


def test_first_task_accepts_correct_result(client: TestClient, users) -> None:
    tutorial_user(client)
    response = submit(client, 1, "water=7\nfood=4\nrations=3\ntotal=water+food+rations\nprint(total)")
    assert response.status_code == 200
    assert response.json() == {
        "correct": True, "output": "14\n", "error": None,
        "current_task": 2, "completed": [1],
    }


def test_wrong_result_does_not_advance(client: TestClient, users) -> None:
    tutorial_user(client)
    response = submit(client, 1, "print(13)")
    assert response.json()["correct"] is False
    assert client.get("/game/tutorial").json() == {"current_task": 1, "completed": []}


def test_alternative_correct_code_is_accepted(client: TestClient, users) -> None:
    tutorial_user(client)
    response = submit(client, 1, "bottles = 10\nspare = 4\nprint(bottles + spare)")
    assert response.json()["correct"] is True


def test_coordinates_task_and_progress_survive_refresh(client: TestClient, users) -> None:
    tutorial_user(client)
    submit(client, 1, "print(7 + 4 + 3)")
    assert client.get("/game/tutorial").json()["current_task"] == 2
    response = submit(client, 2, "x=12\ny=8\nx=x+5\ny=y-3\nprint(x)\nprint(y)")
    assert response.json()["correct"] is True
    assert response.json()["output"] == "17\n5\n"
    assert client.get("/game/tutorial").json() == {"current_task": 3, "completed": [1, 2]}


def test_completion_is_saved_server_side(client: TestClient, users, db: Session) -> None:
    created = tutorial_user(client)
    submit(client, 1, "print(14)")
    progress = db.scalar(select(UserProgress).where(UserProgress.user_id == created["id"]))
    assert progress is not None
    assert {unlock.key for unlock in progress.unlocks} == {"tutorial_linear_1"}


def test_tutorial_cannot_skip_a_task(client: TestClient, users) -> None:
    tutorial_user(client)
    assert submit(client, 2, "print(17)\nprint(5)").status_code == 409


def test_tutorial_execution_cannot_change_player_position(client: TestClient, users, db: Session) -> None:
    created = tutorial_user(client)
    island = db.scalar(select(Island).where(Island.user_id == created["id"]))
    assert island is not None
    original = (island.player_x, island.player_y)
    response = submit(client, 1, "player_x=999\nplayer_y=999\nprint(14)")
    db.refresh(island)
    assert response.json()["correct"] is True
    assert (island.player_x, island.player_y) == original


def test_tutorial_rejects_access_to_python_globals(client: TestClient, users) -> None:
    tutorial_user(client)
    response = submit(client, 1, "import os\nprint(14)")
    assert response.json()["correct"] is False
    assert response.json()["output"] == ""


def test_water_task_accepts_a_simple_if(client: TestClient, users) -> None:
    tutorial_user(client)
    complete_linear_tasks(client)
    response = submit(client, 3, 'water = 6\nif water < 10:\n    print("refill")')
    assert response.json() == {
        "correct": True, "output": "refill\n", "error": None,
        "current_task": 4, "completed": [1, 2, 3],
    }


def test_lantern_task_accepts_a_simple_if_and_unlocks_movement(client: TestClient, users) -> None:
    tutorial_user(client)
    complete_linear_tasks(client)
    submit(client, 3, 'water=6\nif water < 10:\n print("refill")')
    response = submit(client, 4, 'fuel=3\nif fuel > 0:\n print("light")')
    assert response.json()["correct"] is True
    assert response.json()["current_task"] is None
    assert set(client.get("/game/progress").json()["unlocks"]) >= {"movement", "tutorial_if_2"}


def test_wrong_if_condition_does_not_advance(client: TestClient, users) -> None:
    tutorial_user(client)
    complete_linear_tasks(client)
    response = submit(client, 3, 'water=6\nif water > 10:\n print("refill")')
    assert response.json()["correct"] is False
    assert client.get("/game/tutorial").json()["current_task"] == 3


@pytest.mark.parametrize("branch", ["else:\n print(\"wait\")", "elif water == 6:\n print(\"refill\")"])
def test_unlearned_branches_are_rejected(client: TestClient, users, branch: str) -> None:
    tutorial_user(client)
    complete_linear_tasks(client)
    response = submit(client, 3, f'water=6\nif water < 10:\n print("refill")\n{branch}')
    assert response.json()["correct"] is False
    assert response.json()["error"] == "Эта конструкция пока не изучена.\nПопробуй решить задачу только с помощью if."


def test_three_of_four_tasks_do_not_unlock_movement(client: TestClient, users) -> None:
    tutorial_user(client)
    complete_linear_tasks(client)
    submit(client, 3, 'water=6\nif water < 10:\n print("refill")')
    assert "movement" not in client.get("/game/progress").json()["unlocks"]


def test_client_cannot_request_movement_unlock(client: TestClient, users) -> None:
    tutorial_user(client)
    response = client.post("/game/tutorial/check", json={"task": 4, "code": 'if True:\n print("light")', "unlock": "movement"})
    assert response.status_code == 409
    assert "movement" not in client.get("/game/progress").json()["unlocks"]


def test_completed_tutorial_survives_refresh_and_position_updates_work(client: TestClient, users) -> None:
    tutorial_user(client)
    complete_linear_tasks(client)
    submit(client, 3, 'water=6\nif water < 10:\n print("refill")')
    submit(client, 4, 'fuel=3\nif fuel > 0:\n print("light")')
    assert client.get("/game/tutorial").json() == {"current_task": None, "completed": [1, 2, 3, 4]}
    response = client.put("/game/position", json={"x": 2620, "y": 2610})
    assert response.json()["player"] == {"x": 2620, "y": 2610}
