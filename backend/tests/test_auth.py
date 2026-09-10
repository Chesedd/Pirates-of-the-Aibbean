from fastapi.testclient import TestClient


def login(client: TestClient, username: str = "captain", password: str = "correct-horse"):
    return client.post("/auth/login", json={"username": username, "password": password})


def test_successful_login(client: TestClient, users) -> None:
    response = login(client)
    assert response.status_code == 200
    assert response.json()["role"] == "admin"
    assert "HttpOnly" in response.headers["set-cookie"]
    assert "SameSite=lax" in response.headers["set-cookie"]


def test_wrong_password(client: TestClient, users) -> None:
    assert login(client, password="wrong-password").status_code == 401


def test_unknown_user(client: TestClient, users) -> None:
    assert login(client, username="nobody").status_code == 401


def test_me_requires_authentication(client: TestClient) -> None:
    assert client.get("/auth/me").status_code == 401


def test_me_after_login_has_no_hash(client: TestClient, users) -> None:
    assert login(client).status_code == 200
    response = client.get("/auth/me")
    assert response.status_code == 200
    assert response.json() == {"id": users["admin"].id, "username": "captain", "role": "admin"}
    assert "password_hash" not in response.text


def test_logout_invalidates_session(client: TestClient, users) -> None:
    login(client)
    assert client.post("/auth/logout").status_code == 204
    assert client.get("/auth/me").status_code == 401


def test_user_cannot_list_users(client: TestClient, users) -> None:
    login(client, "student1")
    assert client.get("/admin/users").status_code == 403


def test_admin_can_list_users_without_hashes(client: TestClient, users) -> None:
    login(client)
    response = client.get("/admin/users")
    assert response.status_code == 200
    assert len(response.json()) == 2
    assert "password_hash" not in response.text


def test_admin_can_create_user(client: TestClient, users) -> None:
    login(client)
    response = client.post("/admin/users", json={"username": "student2", "password": "temporary-password", "role": "user"})
    assert response.status_code == 201
    assert response.json()["username"] == "student2"
    assert "password" not in response.text


def test_duplicate_username_is_rejected(client: TestClient, users) -> None:
    login(client)
    response = client.post("/admin/users", json={"username": "student1", "password": "temporary-password", "role": "user"})
    assert response.status_code == 409


def test_invalid_credentials_and_role_are_rejected(client: TestClient, users) -> None:
    login(client)
    assert client.post("/admin/users", json={"username": "x", "password": "short", "role": "pirate"}).status_code == 422
