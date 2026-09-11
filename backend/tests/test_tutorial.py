import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import Island, UserProgress
from app.services.tutorial import (
    TUTORIAL_TASKS,
    TutorialCodeError,
    parse_and_validate,
    run_tutorial_code,
    validate_required_conditions,
    validate_required_variables,
)
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


def test_linear_allowlist_accepts_assignments_arithmetic_and_print() -> None:
    code = "a = 2\nb = 3\nc = a + b\nprint(c)"
    assert run_tutorial_code(code) == "5\n"


@pytest.mark.parametrize(
    ("code", "message"),
    [
        ("if a > 0:\n print(a)", "Конструкция if пока не изучена."),
        ("for i in range(3):\n print(i)", "Циклы пока не открыты."),
        ("def test():\n pass", "Создание функций пока не изучено."),
        ("print(sum([1, 2]))", "Функция sum пока недоступна в этом задании."),
    ],
)
def test_linear_allowlist_rejects_unlearned_syntax(code: str, message: str) -> None:
    with pytest.raises(TutorialCodeError, match=message):
        run_tutorial_code(code)


def test_if_allowlist_accepts_simple_comparison() -> None:
    assert run_tutorial_code('water = 6\nif water < 10:\n print("refill")', require_if=True) == "refill\n"


def test_required_condition_accepts_the_configured_comparison() -> None:
    task = TUTORIAL_TASKS[3]
    tree = parse_and_validate('water = 5\nif water < 10:\n print("refill")', task.capabilities)
    validate_required_conditions(tree, task)


@pytest.mark.parametrize(
    ("condition", "message"),
    [
        ("food < 10", "не тот запас"),
        ("water > 10", "работает наоборот"),
        ("water < 20", "Порог запаса выбран неправильно"),
        ("water < food", "Порог запаса выбран неправильно"),
    ],
)
def test_required_condition_rejects_wrong_semantics(condition: str, message: str) -> None:
    task = TUTORIAL_TASKS[3]
    tree = parse_and_validate(f'water = 5\nfood = 10\nif {condition}:\n print("refill")', task.capabilities)
    with pytest.raises(TutorialCodeError, match=message):
        validate_required_conditions(tree, task)


def test_required_condition_rejects_two_if_statements() -> None:
    task = TUTORIAL_TASKS[3]
    tree = parse_and_validate(
        'water = 5\nfuel = 3\nif water < 10:\n print("refill")\nif fuel < 5:\n print("fuel")',
        task.capabilities,
    )
    with pytest.raises(TutorialCodeError, match="один сигнал проверки"):
        validate_required_conditions(tree, task)


def test_if_allowlist_rejects_combined_conditions() -> None:
    task = TUTORIAL_TASKS[3]
    with pytest.raises(TutorialCodeError, match="and и or пока не изучены"):
        parse_and_validate(
            'water = 5\nfood = 1\nif water < 10 and food > 0:\n print("refill")',
            task.capabilities,
        )


@pytest.mark.parametrize(
    "code",
    [
        'water=6\nif water < 10:\n print("refill")\nelse:\n print("ok")',
        'water=6\nif water < 10:\n print("refill")\nelif water == 10:\n print("ok")',
    ],
)
def test_if_allowlist_rejects_else_and_elif(code: str) -> None:
    with pytest.raises(TutorialCodeError, match="Эта конструкция пока не изучена"):
        run_tutorial_code(code, require_if=True)


def test_if_allowlist_rejects_while() -> None:
    with pytest.raises(TutorialCodeError, match="Циклы пока не открыты"):
        run_tutorial_code("water=6\nwhile water < 10:\n water += 1", require_if=True)


def test_syntax_error_is_friendly() -> None:
    with pytest.raises(TutorialCodeError, match="В коде есть синтаксическая ошибка"):
        run_tutorial_code("if water < 10", require_if=True)


def complete_linear_tasks(client: TestClient) -> None:
    supplies = "water=7\nfood=4\nrations=3\ntotal=water+food+rations\nprint(total)"
    assert submit(client, 1, supplies).json()["correct"] is True
    assert submit(client, 2, "x=12\ny=8\nx=x+5\ny=y-3\nprint(x)\nprint(y)").json()["correct"] is True


@pytest.mark.parametrize(
    ("code", "passes", "message"),
    [
        ("water = 5\nprint(water)", True, None),
        ("x = 5\nprint(x)", False, "Попробуй использовать переменную water"),
        ("print(water)", False, "Переменная water пока не получила значение"),
        ("water = 5", True, None),
        ("water = 5\npirate = 10", True, None),
    ],
)
def test_required_variable_validation(code: str, passes: bool, message: str | None) -> None:
    task = TUTORIAL_TASKS[3]
    tree = parse_and_validate(code, task.capabilities)
    if passes:
        validate_required_variables(tree, task)
    else:
        with pytest.raises(TutorialCodeError, match=message):
            validate_required_variables(tree, task)


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
    response = submit(client, 1, "water=7\nfood=4\nrations=3\ntotal=13\nprint(total)")
    assert response.json()["correct"] is False
    assert client.get("/game/tutorial").json() == {"current_task": 1, "completed": []}


def test_allowlist_failure_does_not_execute_or_advance(client: TestClient, users) -> None:
    tutorial_user(client)
    response = submit(client, 1, "if 1 > 0:\n print(14)")
    assert response.json()["correct"] is False
    assert response.json()["output"] == ""
    assert client.get("/game/tutorial").json() == {"current_task": 1, "completed": []}


def test_correct_output_without_required_variables_is_rejected(client: TestClient, users) -> None:
    tutorial_user(client)
    response = submit(client, 1, "bottles = 10\nspare = 4\nprint(bottles + spare)")
    assert response.json()["correct"] is False
    assert response.json()["output"] == ""
    assert "переменную water" in response.json()["error"]
    assert client.get("/game/tutorial").json() == {"current_task": 1, "completed": []}


def test_coordinates_task_and_progress_survive_refresh(client: TestClient, users) -> None:
    tutorial_user(client)
    submit(client, 1, "water=7\nfood=4\nrations=3\ntotal=water+food+rations\nprint(total)")
    assert client.get("/game/tutorial").json()["current_task"] == 2
    response = submit(client, 2, "x=12\ny=8\nx=x+5\ny=y-3\nprint(x)\nprint(y)")
    assert response.json()["correct"] is True
    assert response.json()["output"] == "17\n5\n"
    assert client.get("/game/tutorial").json() == {"current_task": 3, "completed": [1, 2]}


def test_completion_is_saved_server_side(client: TestClient, users, db: Session) -> None:
    created = tutorial_user(client)
    submit(client, 1, "water=7\nfood=4\nrations=3\ntotal=water+food+rations\nprint(total)")
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
    response = submit(client, 1, "water=7\nfood=4\nrations=3\ntotal=water+food+rations\nplayer_x=999\nplayer_y=999\nprint(total)")
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
    assert response.json()["output"] == ""
    assert "работает наоборот" in response.json()["error"]
    assert client.get("/game/tutorial").json()["current_task"] == 3


@pytest.mark.parametrize(
    ("condition", "message"),
    [
        ("food < 10", "не тот запас"),
        ("water < 20", "Порог запаса выбран неправильно"),
    ],
)
def test_semantically_wrong_if_is_not_executed_or_saved(
    client: TestClient, users, condition: str, message: str
) -> None:
    tutorial_user(client)
    complete_linear_tasks(client)
    response = submit(
        client,
        3,
        f'water=6\nfood=5\nif {condition}:\n print("refill")',
    )
    assert response.json()["correct"] is False
    assert response.json()["output"] == ""
    assert message in response.json()["error"]
    assert client.get("/game/tutorial").json() == {"current_task": 3, "completed": [1, 2]}


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
