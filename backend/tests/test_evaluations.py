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
        json={"email": email, "password": "Password123!", "name": "Eval Engineer"},
    )
    assert res.status_code == 201
    return res.json()["access_token"]


def test_start_evaluation_validation_errors(client):
    """Test validation when starting evaluations with invalid or empty resources."""
    token = get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Project not found
    res = client.post(
        "/api/evaluations",
        json={
            "projectId": "non-existent-proj",
            "datasetId": "ds-1",
            "ragConfigurationId": "cfg-1",
        },
        headers=headers,
    )
    assert res.status_code == 404

    # 2. Create project
    proj_res = client.post(
        "/api/projects",
        json={"name": "Eval Test Project", "description": "Validation checks"},
        headers=headers,
    )
    assert proj_res.status_code == 201
    project_id = proj_res.json()["id"]

    # 3. Create dataset with NO items
    ds_res = client.post(
        f"/api/projects/{project_id}/datasets",
        json={"name": "Empty Dataset", "description": "No questions"},
        headers=headers,
    )
    assert ds_res.status_code == 201
    dataset_id = ds_res.json()["id"]

    # 4. Create RAG configuration
    cfg_res = client.post(
        "/api/rag-configurations",
        json={
            "projectId": project_id,
            "name": "Endpoint",
            "apiUrl": "https://api.example.com/query",
            "method": "POST",
            "answerPath": "answer",
            "contextPath": "contexts",
        },
        headers=headers,
    )
    assert cfg_res.status_code == 201
    config_id = cfg_res.json()["id"]

    # 5. Trigger evaluation on empty dataset -> should fail with 400
    res_empty = client.post(
        "/api/evaluations",
        json={
            "projectId": project_id,
            "datasetId": dataset_id,
            "ragConfigurationId": config_id,
        },
        headers=headers,
    )
    assert res_empty.status_code == 400
    assert "no questions" in res_empty.json()["error"]["message"].lower()


def test_evaluation_run_end_to_end_mocked(client):
    """Test full evaluation run lifecycle: dispatch, background execution, progress, and results."""
    token = get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # Setup Project
    proj_res = client.post(
        "/api/projects",
        json={"name": "Customer Support RAG", "description": "Bot evaluation suite"},
        headers=headers,
    )
    project_id = proj_res.json()["id"]

    # Setup Dataset with 2 questions
    ds_res = client.post(
        f"/api/projects/{project_id}/datasets",
        json={"name": "Support FAQ Test", "description": "Ground truth answers"},
        headers=headers,
    )
    dataset_id = ds_res.json()["id"]

    # Add Question 1
    client.post(
        f"/api/datasets/{dataset_id}/items",
        json={
            "question": "What is the return policy?",
            "expectedAnswer": "Customers can return within 30 days.",
            "expectedContexts": ["Returns are accepted within 30 days of purchase."],
        },
        headers=headers,
    )

    # Add Question 2
    client.post(
        f"/api/datasets/{dataset_id}/items",
        json={
            "question": "Where is the order tracking number?",
            "expectedAnswer": "In the shipping confirmation email.",
            "expectedContexts": ["Order tracking links are sent via email upon dispatch."],
        },
        headers=headers,
    )

    # Setup RAG Configuration
    cfg_res = client.post(
        "/api/rag-configurations",
        json={
            "projectId": project_id,
            "name": "FAQ RAG API",
            "apiUrl": "https://faq-rag.internal.net/ask",
            "method": "POST",
            "headers": {"Authorization": "Bearer secret-token-xyz"},
            "requestTemplate": {"query": "{{question}}"},
            "answerPath": "data.answer",
            "contextPath": "data.passages",
            "timeoutSeconds": 15,
        },
        headers=headers,
    )
    config_id = cfg_res.json()["id"]

    # Mock RAG endpoint response for each question
    async def mock_request(*args, **kwargs):
        json_data = kwargs.get("json", {})
        query = json_data.get("query", "")
        mock_resp = httpx.Response(
            status_code=200,
            json={
                "data": {
                    "answer": f"Generated answer for: {query}",
                    "passages": [f"Retrieved context passage for: {query}"],
                }
            },
            request=httpx.Request("POST", "https://faq-rag.internal.net/ask"),
        )
        return mock_resp

    with patch("httpx.AsyncClient.request", new_callable=AsyncMock) as mock_req:
        mock_req.side_effect = mock_request

        # Trigger Evaluation
        eval_res = client.post(
            "/api/evaluations",
            json={
                "projectId": project_id,
                "datasetId": dataset_id,
                "ragConfigurationId": config_id,
            },
            headers=headers,
        )
        assert eval_res.status_code == 201
        run_data = eval_res.json()
        run_id = run_data["id"]
        assert run_data["totalQuestions"] == 2
        assert run_data["projectName"] == "Customer Support RAG"
        assert run_data["datasetName"] == "Support FAQ Test"
        assert run_data["ragConfigurationName"] == "FAQ RAG API"

    # TestClient processes FastAPI background tasks synchronously before exiting the request context.
    # Therefore, the run should now be completed!
    get_res = client.get(f"/api/evaluations/{run_id}", headers=headers)
    assert get_res.status_code == 200
    finished_run = get_res.json()
    assert finished_run["status"] == "completed"
    assert finished_run["completedQuestions"] == 2
    assert finished_run["failedQuestions"] == 0
    assert finished_run["startedAt"] is not None
    assert finished_run["completedAt"] is not None

    # Verify Results endpoint
    results_res = client.get(f"/api/evaluations/{run_id}/results", headers=headers)
    assert results_res.status_code == 200
    results = results_res.json()
    assert len(results) == 2
    for r in results:
        assert r["status"] == "completed"
        assert "Generated answer for:" in r["generatedAnswer"]
        assert len(r["retrievedContexts"]) == 1
        assert r["latencyMs"] is not None
        assert r["error"] is None


def test_evaluation_individual_question_failure_resilience(client):
    """Test that evaluation engine continues when individual questions fail (e.g. 500 error or timeout)."""
    token = get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # Setup Project & Dataset with 2 questions
    proj = client.post("/api/projects", json={"name": "Resilience Proj"}, headers=headers).json()
    ds = client.post(f"/api/projects/{proj['id']}/datasets", json={"name": "Mixed DS"}, headers=headers).json()

    client.post(
        f"/api/datasets/{ds['id']}/items",
        json={"question": "Question 1 that succeeds", "expectedAnswer": "Ans 1"},
        headers=headers,
    )
    client.post(
        f"/api/datasets/{ds['id']}/items",
        json={"question": "Question 2 that fails", "expectedAnswer": "Ans 2"},
        headers=headers,
    )

    cfg = client.post(
        "/api/rag-configurations",
        json={
            "projectId": proj["id"],
            "name": "Faulty API",
            "apiUrl": "https://api.flaky.internal/ask",
            "method": "POST",
            "answerPath": "answer",
            "contextPath": "contexts",
        },
        headers=headers,
    ).json()

    # Question 1 returns 200, Question 2 raises TimeoutException
    call_count = 0

    async def flaky_request(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return httpx.Response(
                status_code=200,
                json={"answer": "Success for Q1", "contexts": ["Passage 1"]},
                request=httpx.Request("POST", "https://api.flaky.internal/ask"),
            )
        else:
            raise httpx.TimeoutException("Upstream timeout on Q2")

    with patch("httpx.AsyncClient.request", new_callable=AsyncMock) as mock_req:
        mock_req.side_effect = flaky_request

        eval_res = client.post(
            "/api/evaluations",
            json={
                "projectId": proj["id"],
                "datasetId": ds["id"],
                "ragConfigurationId": cfg["id"],
            },
            headers=headers,
        )
        assert eval_res.status_code == 201
        run_id = eval_res.json()["id"]

    # Check run status
    run_status = client.get(f"/api/evaluations/{run_id}", headers=headers).json()
    assert run_status["status"] == "completed"
    assert run_status["totalQuestions"] == 2
    assert run_status["completedQuestions"] == 2
    assert run_status["failedQuestions"] == 1  # 1 succeeded, 1 failed

    # Inspect individual results
    results = client.get(f"/api/evaluations/{run_id}/results", headers=headers).json()
    assert len(results) == 2
    q1 = next(r for r in results if "Question 1" in r["question"])
    q2 = next(r for r in results if "Question 2" in r["question"])

    assert q1["status"] == "completed"
    assert q1["generatedAnswer"] == "Success for Q1"
    assert q1["error"] is None

    assert q2["status"] == "failed"
    assert q2["generatedAnswer"] is None
    assert "timed out" in q2["error"].lower()


def test_evaluation_cancellation(client):
    """Test cancelling an evaluation run."""
    token = get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    proj = client.post("/api/projects", json={"name": "Cancel Proj"}, headers=headers).json()
    ds = client.post(f"/api/projects/{proj['id']}/datasets", json={"name": "Cancel DS"}, headers=headers).json()
    client.post(
        f"/api/datasets/{ds['id']}/items",
        json={"question": "Test question?", "expectedAnswer": "Test answer"},
        headers=headers,
    )
    cfg = client.post(
        "/api/rag-configurations",
        json={
            "projectId": proj["id"],
            "name": "Cancel API",
            "apiUrl": "https://api.example.com",
            "answerPath": "answer",
        },
        headers=headers,
    ).json()

    # Cancel a run
    with patch("httpx.AsyncClient.request", new_callable=AsyncMock) as mock_req:
        mock_req.return_value = httpx.Response(
            status_code=200,
            json={"answer": "test"},
            request=httpx.Request("POST", "https://api.example.com"),
        )
        eval_run = client.post(
            "/api/evaluations",
            json={
                "projectId": proj["id"],
                "datasetId": ds["id"],
                "ragConfigurationId": cfg["id"],
            },
            headers=headers,
        ).json()

    cancel_res = client.post(f"/api/evaluations/{eval_run['id']}/cancel", headers=headers)
    assert cancel_res.status_code == 200


def test_get_single_evaluation_result(client):
    """Test retrieving a single evaluation result by ID (Phase 7 API)."""
    token = get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    proj = client.post("/api/projects", json={"name": "Single Result Proj"}, headers=headers).json()
    ds = client.post(f"/api/projects/{proj['id']}/datasets", json={"name": "Single Result DS"}, headers=headers).json()
    client.post(
        f"/api/datasets/{ds['id']}/items",
        json={"question": "What is Python?", "expectedAnswer": "A programming language"},
        headers=headers,
    )
    cfg = client.post(
        "/api/rag-configurations",
        json={
            "projectId": proj["id"],
            "name": "Python API",
            "apiUrl": "https://api.example.com",
            "answerPath": "answer",
        },
        headers=headers,
    ).json()

    with patch("httpx.AsyncClient.request", new_callable=AsyncMock) as mock_req:
        mock_req.return_value = httpx.Response(
            status_code=200,
            json={"answer": "Python is a dynamic programming language."},
            request=httpx.Request("POST", "https://api.example.com"),
        )
        eval_run = client.post(
            "/api/evaluations",
            json={
                "projectId": proj["id"],
                "datasetId": ds["id"],
                "ragConfigurationId": cfg["id"],
            },
            headers=headers,
        ).json()

    run_id = eval_run["id"]
    results = client.get(f"/api/evaluations/{run_id}/results", headers=headers).json()
    assert len(results) == 1
    result_id = results[0]["id"]

    # 1. Fetch single result
    single_res = client.get(f"/api/evaluations/{run_id}/results/{result_id}", headers=headers)
    assert single_res.status_code == 200
    data = single_res.json()
    assert data["id"] == result_id
    assert data["runId"] == run_id
    assert data["question"] == "What is Python?"
    assert data["generatedAnswer"] == "Python is a dynamic programming language."

    # 2. Non-existent result ID -> 404
    non_existent = client.get(f"/api/evaluations/{run_id}/results/non-existent-id", headers=headers)
    assert non_existent.status_code == 404

    # 3. Unauthorized access from another user -> 403 Forbidden
    other_token = get_auth_token(client)
    unauthorized_res = client.get(
        f"/api/evaluations/{run_id}/results/{result_id}",
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert unauthorized_res.status_code == 403

