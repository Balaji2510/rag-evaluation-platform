from unittest.mock import AsyncMock, patch
import uuid
import httpx
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
        json={"email": email, "password": "Password123!", "name": "RAG Dev"},
    )
    assert res.status_code == 201
    return res.json()["access_token"]


def test_rag_configuration_crud_and_secret_masking(client):
    """Test creating, listing, getting, updating, and deleting RAG configurations with secret masking."""
    token = get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create a parent project
    proj_res = client.post(
        "/api/projects",
        json={"name": "Medical RAG Project", "description": "Clinical guidelines QA"},
        headers=headers,
    )
    assert proj_res.status_code == 201
    project_id = proj_res.json()["id"]

    # 2. Create RAG configuration with sensitive API key in headers
    config_payload = {
        "projectId": project_id,
        "name": "Production Clinical LLM",
        "apiUrl": "https://rag.company.internal/api/query",
        "method": "POST",
        "headers": {
            "Authorization": "Bearer super-secret-production-token-12345",
            "X-API-Key": "live_apikey_987654321",
            "Content-Type": "application/json",
            "X-Client": "RAG-Eval-v1",
        },
        "requestTemplate": {
            "query": "{{question}}",
            "max_tokens": 512,
        },
        "answerPath": "data.output.answer",
        "contextPath": "data.contexts",
        "timeoutSeconds": 45,
    }

    create_res = client.post("/api/rag-configurations", json=config_payload, headers=headers)
    assert create_res.status_code == 201
    created_data = create_res.json()
    config_id = created_data["id"]

    # CRITICAL SECURITY CHECK: Sensitive headers MUST be masked and never returned
    assert created_data["headers"]["Authorization"] == "********"
    assert created_data["headers"]["X-API-Key"] == "********"
    # Non-sensitive header remains visible
    assert created_data["headers"]["Content-Type"] == "application/json"
    assert created_data["headers"]["X-Client"] == "RAG-Eval-v1"

    # 3. List configurations
    list_res = client.get(f"/api/rag-configurations?projectId={project_id}", headers=headers)
    assert list_res.status_code == 200
    configs = list_res.json()
    assert len(configs) >= 1
    assert any(c["id"] == config_id for c in configs)
    # Ensure masked in list view too
    for c in configs:
        if c["id"] == config_id:
            assert c["headers"]["Authorization"] == "********"

    # 4. Get single configuration
    get_res = client.get(f"/api/rag-configurations/{config_id}", headers=headers)
    assert get_res.status_code == 200
    single_config = get_res.json()
    assert single_config["id"] == config_id
    assert single_config["headers"]["Authorization"] == "********"

    # 5. Update configuration without changing the masked secret
    # Client sends '********' back — backend must retain the original secret in DB
    update_res = client.put(
        f"/api/rag-configurations/{config_id}",
        json={
            "name": "Production Clinical LLM v2",
            "timeoutSeconds": 60,
            "headers": {
                "Authorization": "********",
                "X-API-Key": "********",
                "Content-Type": "application/json",
                "X-Client": "RAG-Eval-v2",
            },
        },
        headers=headers,
    )
    assert update_res.status_code == 200
    updated_data = update_res.json()
    assert updated_data["name"] == "Production Clinical LLM v2"
    assert updated_data["timeoutSeconds"] == 60
    assert updated_data["headers"]["Authorization"] == "********"
    assert updated_data["headers"]["X-Client"] == "RAG-Eval-v2"

    # 6. Delete configuration
    del_res = client.delete(f"/api/rag-configurations/{config_id}", headers=headers)
    assert del_res.status_code == 200
    assert del_res.json()["success"] is True

    # 7. Verify deletion
    verify_res = client.get(f"/api/rag-configurations/{config_id}", headers=headers)
    assert verify_res.status_code == 404


def test_rag_configuration_test_endpoint_mocked(client):
    """Test the POST /api/rag-configurations/{id}/test endpoint with mocked external HTTP response."""
    token = get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create project & config
    proj_res = client.post("/api/projects", json={"name": "Test Project"}, headers=headers)
    project_id = proj_res.json()["id"]

    config_res = client.post(
        "/api/rag-configurations",
        json={
            "projectId": project_id,
            "name": "Mock Test Bot",
            "apiUrl": "https://api.mockrag.internal/v1/chat",
            "method": "POST",
            "headers": {"Authorization": "Bearer test-key"},
            "requestTemplate": {"question": "{{question}}"},
            "answerPath": "answer",
            "contextPath": "contexts",
            "timeoutSeconds": 15,
        },
        headers=headers,
    )
    config_id = config_res.json()["id"]

    # 2. Mock httpx.AsyncClient.request to simulate successful RAG endpoint
    mock_response = httpx.Response(
        status_code=200,
        json={
            "answer": "Retrieval-Augmented Generation enhances LLMs with external knowledge.",
            "contexts": [
                "RAG paper by Lewis et al. introduces combining parametric and non-parametric memory.",
                "Vector retrieval fetches relevant document chunks."
            ],
        },
        request=httpx.Request("POST", "https://api.mockrag.internal/v1/chat"),
    )

    with patch("httpx.AsyncClient.request", new_callable=AsyncMock) as mock_request:
        mock_request.return_value = mock_response

        test_res = client.post(
            f"/api/rag-configurations/{config_id}/test",
            json={"sampleQuestion": "Explain RAG benefits"},
            headers=headers,
        )
        assert test_res.status_code == 200
        result = test_res.json()

        assert result["success"] is True
        assert result["statusCode"] == 200
        assert "enhances LLMs" in result["answer"]
        assert len(result["contexts"]) == 2
        assert result["latencyMs"] is not None


def test_rag_configuration_test_endpoint_error_handling(client):
    """Test error reporting when external RAG endpoint fails or returns error."""
    token = get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    proj_res = client.post("/api/projects", json={"name": "Test Project Error"}, headers=headers)
    project_id = proj_res.json()["id"]

    config_res = client.post(
        "/api/rag-configurations",
        json={
            "projectId": project_id,
            "name": "Failing Bot",
            "apiUrl": "https://api.failing.internal/ask",
            "method": "POST",
            "requestTemplate": {"question": "{{question}}"},
            "answerPath": "output.text",
        },
        headers=headers,
    )
    config_id = config_res.json()["id"]

    # Mock 500 error from external server
    mock_error_response = httpx.Response(
        status_code=502,
        text="Bad Gateway",
        request=httpx.Request("POST", "https://api.failing.internal/ask"),
    )

    with patch("httpx.AsyncClient.request", new_callable=AsyncMock) as mock_request:
        mock_request.return_value = mock_error_response

        test_res = client.post(
            f"/api/rag-configurations/{config_id}/test",
            headers=headers,
        )
        assert test_res.status_code == 200
        result = test_res.json()
        assert result["success"] is False
        assert result["statusCode"] == 502
        assert "error" in result

