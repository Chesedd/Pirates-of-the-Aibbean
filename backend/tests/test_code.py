from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import PlayerCode
from tests.test_auth import login
from tests.test_island import create_regular_user


def create_two_users(client: TestClient) -> tuple[dict, dict]:
    login(client)
    first = create_regular_user(client, "coder-one")
    second = create_regular_user(client, "coder-two")
    client.post("/auth/logout")
    return first, second


def test_new_regular_user_has_own_empty_player_code(
    client: TestClient, users, db: Session
) -> None:
    login(client)
    created = create_regular_user(client, "new-coder")
    stored = list(db.scalars(select(PlayerCode).where(PlayerCode.user_id == created["id"])))
    assert len(stored) == 1
    assert stored[0].code == ""


def test_code_requires_authentication(client: TestClient) -> None:
    assert client.get("/game/code").status_code == 401
    assert client.put("/game/code", json={"code": "hello"}).status_code == 401


def test_user_gets_own_code(client: TestClient, users) -> None:
    create_two_users(client)
    login(client, "coder-one", "temporary-password")
    assert client.get("/game/code").json() == {"code": ""}


def test_user_can_save_code_and_get_it_again(client: TestClient, users) -> None:
    create_two_users(client)
    login(client, "coder-one", "temporary-password")
    source = "name = 'Anne Bonny'\n"
    response = client.put("/game/code", json={"code": source})
    assert response.status_code == 200
    assert response.json() == {"code": source}
    assert client.get("/game/code").json() == {"code": source}


def test_two_users_code_is_isolated(client: TestClient, users) -> None:
    create_two_users(client)
    login(client, "coder-one", "temporary-password")
    assert client.put("/game/code", json={"code": "first = True"}).status_code == 200
    client.post("/auth/logout")

    login(client, "coder-two", "temporary-password")
    assert client.get("/game/code").json() == {"code": ""}
    assert client.put("/game/code", json={"code": "second = True"}).status_code == 200
    client.post("/auth/logout")

    login(client, "coder-one", "temporary-password")
    assert client.get("/game/code").json() == {"code": "first = True"}


def test_api_cannot_select_another_user(client: TestClient, users) -> None:
    first, second = create_two_users(client)
    login(client, "coder-one", "temporary-password")

    # Query-string selectors are ignored because ownership comes from the session.
    response = client.get(f"/game/code?user_id={second['id']}")
    assert response.json() == {"code": ""}
    # Body selectors are explicitly forbidden rather than silently accepted.
    response = client.put(
        "/game/code", json={"code": "hijack", "user_id": second["id"]}
    )
    assert response.status_code == 422

    response = client.get(f"/game/codes/{second['id']}")
    assert response.status_code == 404
    assert first["id"] != second["id"]
