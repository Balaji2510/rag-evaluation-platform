import uuid
import pytest
from fastapi.testclient import TestClient
from app.main import app


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def get_auth_token(client: TestClient) -> str:
    email = f"user_{uuid.uuid4().hex[:8]}@example.com"
    res = client.post(
        "/api/auth/register",
        json={"email": email, "password": "Password123!", "name": "Project Dev"},
    )
    assert res.status_code == 201
    return res.json()["access_token"]


def test_project_crud_lifecycle(client):
    """Test full CRUD lifecycle for projects."""
    token = get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. List projects initially empty
    list_res = client.get("/api/projects", headers=headers)
    assert list_res.status_code == 200
    assert isinstance(list_res.json(), list)

    # 2. Create project
    create_payload = {
        "name": "Customer Support RAG",
        "description": "Evaluation benchmarks for customer FAQ bot",
    }
    create_res = client.post("/api/projects", json=create_payload, headers=headers)
    assert create_res.status_code == 201
    project = create_res.json()
    assert project["name"] == "Customer Support RAG"
    assert project["description"] == "Evaluation benchmarks for customer FAQ bot"
    project_id = project["id"]

    # 3. Get project by ID
    get_res = client.get(f"/api/projects/{project_id}", headers=headers)
    assert get_res.status_code == 200
    assert get_res.json()["id"] == project_id

    # 4. Update project
    update_res = client.put(
        f"/api/projects/{project_id}",
        json={"name": "Support Bot v2", "description": "Updated description"},
        headers=headers,
    )
    assert update_res.status_code == 200
    assert update_res.json()["name"] == "Support Bot v2"
    assert update_res.json()["description"] == "Updated description"

    # 5. Unauthorized access check from second user
    second_token = get_auth_token(client)
    second_headers = {"Authorization": f"Bearer {second_token}"}
    forbidden_res = client.get(f"/api/projects/{project_id}", headers=second_headers)
    assert forbidden_res.status_code == 403

    # 6. Delete project
    del_res = client.delete(f"/api/projects/{project_id}", headers=headers)
    assert del_res.status_code == 200
    assert del_res.json()["success"] is True

    # 7. Verify deletion
    verify_res = client.get(f"/api/projects/{project_id}", headers=headers)
    assert verify_res.status_code == 404

