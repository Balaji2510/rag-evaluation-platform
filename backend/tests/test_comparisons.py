from unittest.mock import AsyncMock, patch
import uuid
import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.comparison_service import (
    compute_metric_comparison,
    generate_deterministic_summary,
)


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def get_auth_token(client: TestClient) -> str:
    email = f"user_{uuid.uuid4().hex[:8]}@example.com"
    res = client.post(
        "/api/auth/register",
        json={"email": email, "password": "Password123!", "name": "Compare Engineer"},
    )
    assert res.status_code == 201
    return res.json()["access_token"]


def test_metric_comparison_calculations():
    """Verify exact percentage and status calculations for quality metrics and latency."""
    # Example from spec: Faithfulness 0.88 -> 0.94 => +6.8%, Improved
    faith = compute_metric_comparison(
        key="faithfulness",
        name="Faithfulness",
        val_a=0.88,
        val_b=0.94,
        higher_is_better=True,
    )
    assert faith.status == "improved"
    assert faith.percentageDifference == 6.8
    assert faith.formattedChange == "+6.8%"
    assert faith.absoluteDifference == 0.06

    # Quality metric regression
    ans_corr = compute_metric_comparison(
        key="answerCorrectness",
        name="Answer Correctness",
        val_a=0.90,
        val_b=0.80,
        higher_is_better=True,
    )
    assert ans_corr.status == "regressed"
    assert ans_corr.percentageDifference == -11.1
    assert ans_corr.formattedChange == "-11.1%"

    # Quality metric unchanged
    relevance = compute_metric_comparison(
        key="answerRelevance",
        name="Answer Relevance",
        val_a=0.85,
        val_b=0.85,
        higher_is_better=True,
    )
    assert relevance.status == "no-change"
    assert relevance.percentageDifference == 0.0
    assert relevance.formattedChange == "0.0%"

    # Latency: Lower is better! 1000ms -> 1240ms (+24% latency is regressed / slower)
    lat_slower = compute_metric_comparison(
        key="latency",
        name="Latency",
        val_a=1000.0,
        val_b=1240.0,
        higher_is_better=False,
        unit="ms",
    )
    assert lat_slower.status == "regressed"
    assert lat_slower.percentageDifference == 24.0
    assert lat_slower.formattedChange == "+24.0%"

    # Latency: 1500ms -> 1200ms (-20% latency is improved / faster)
    lat_faster = compute_metric_comparison(
        key="latency",
        name="Latency",
        val_a=1500.0,
        val_b=1200.0,
        higher_is_better=False,
        unit="ms",
    )
    assert lat_faster.status == "improved"
    assert lat_faster.percentageDifference == -20.0
    assert lat_faster.formattedChange == "-20.0%"


def test_deterministic_summary_exact_prompt_example():
    """Verify the exact prompt summary example: Run B improved retrieval quality but increased average latency by 24%."""
    ctx_rel = compute_metric_comparison("contextRelevance", "Context Relevance", 0.70, 0.85, True)
    lat = compute_metric_comparison("latency", "Latency", 1000.0, 1240.0, False, "ms")
    faith = compute_metric_comparison("faithfulness", "Faithfulness", 0.85, 0.85, True)
    ans_corr = compute_metric_comparison("answerCorrectness", "Answer Correctness", 0.80, 0.80, True)
    ans_rel = compute_metric_comparison("answerRelevance", "Answer Relevance", 0.82, 0.82, True)

    metrics_map = {
        "contextRelevance": ctx_rel,
        "latency": lat,
        "faithfulness": faith,
        "answerCorrectness": ans_corr,
        "answerRelevance": ans_rel,
    }

    summary = generate_deterministic_summary(metrics_map, run_b_label="Run B")
    assert summary == "Run B improved retrieval quality but increased average latency by 24%."


def test_compare_runs_api_end_to_end(client):
    """Test POST /api/comparisons end-to-end with real runs created via the evaluation API."""
    token = get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create project
    proj = client.post("/api/projects", json={"name": "Comparison Project"}, headers=headers).json()
    proj_id = proj["id"]

    # 2. Create dataset + question
    ds = client.post(f"/api/projects/{proj_id}/datasets", json={"name": "Eval Dataset"}, headers=headers).json()
    ds_id = ds["id"]
    client.post(
        f"/api/datasets/{ds_id}/items",
        json={"question": "What is RAG?", "expectedAnswer": "Retrieval Augmented Generation"},
        headers=headers,
    )

    # 3. Create RAG configs A and B
    cfg_a = client.post(
        "/api/rag-configurations",
        json={"projectId": proj_id, "name": "Pipeline V1", "apiUrl": "https://api.v1.internal", "answerPath": "answer", "contextPath": "contexts"},
        headers=headers,
    ).json()

    cfg_b = client.post(
        "/api/rag-configurations",
        json={"projectId": proj_id, "name": "Pipeline V2", "apiUrl": "https://api.v2.internal", "answerPath": "answer", "contextPath": "contexts"},
        headers=headers,
    ).json()

    # 4. Trigger Run A and Run B with mocked HTTP request
    with patch("httpx.AsyncClient.request", new_callable=AsyncMock) as mock_req:
        mock_req.return_value = httpx.Response(
            status_code=200,
            json={"answer": "RAG combines retrieval with LLM generation.", "contexts": ["Passage 1"]},
            request=httpx.Request("POST", "https://api.internal/ask"),
        )
        run_a = client.post(
            "/api/evaluations",
            json={"projectId": proj_id, "datasetId": ds_id, "ragConfigurationId": cfg_a["id"]},
            headers=headers,
        ).json()

        run_b = client.post(
            "/api/evaluations",
            json={"projectId": proj_id, "datasetId": ds_id, "ragConfigurationId": cfg_b["id"]},
            headers=headers,
        ).json()

    # 5. Call POST /api/comparisons
    payload = {"runA": run_a["id"], "runB": run_b["id"]}
    res = client.post("/api/comparisons", json=payload, headers=headers)
    assert res.status_code == 200

    data = res.json()
    assert data["runA"]["id"] == run_a["id"]
    assert data["runA"]["projectName"] == "Comparison Project"
    assert data["runB"]["id"] == run_b["id"]
    assert len(data["metrics"]) == 7

    metric_keys = [m["key"] for m in data["metrics"]]
    assert "overallScore" in metric_keys
    assert "faithfulness" in metric_keys
    assert "answerRelevance" in metric_keys
    assert "contextRelevance" in metric_keys
    assert "contextRecall" in metric_keys
    assert "answerCorrectness" in metric_keys
    assert "latency" in metric_keys

    # Check summary exists and is deterministic string
    assert "Run B" in data["summary"]
    assert len(data["summary"]) > 10


def test_compare_runs_cross_project_validation(client):
    """Verify that comparing runs from two different projects is rejected with 400 Bad Request."""
    token = get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # Project 1
    proj1 = client.post("/api/projects", json={"name": "Project 1"}, headers=headers).json()
    ds1 = client.post(f"/api/projects/{proj1['id']}/datasets", json={"name": "DS 1"}, headers=headers).json()
    client.post(f"/api/datasets/{ds1['id']}/items", json={"question": "Q1?", "expectedAnswer": "A1"}, headers=headers)
    cfg1 = client.post(
        "/api/rag-configurations",
        json={"projectId": proj1["id"], "name": "Cfg 1", "apiUrl": "https://api1.internal", "answerPath": "ans"},
        headers=headers,
    ).json()

    # Project 2
    proj2 = client.post("/api/projects", json={"name": "Project 2"}, headers=headers).json()
    ds2 = client.post(f"/api/projects/{proj2['id']}/datasets", json={"name": "DS 2"}, headers=headers).json()
    client.post(f"/api/datasets/{ds2['id']}/items", json={"question": "Q2?", "expectedAnswer": "A2"}, headers=headers)
    cfg2 = client.post(
        "/api/rag-configurations",
        json={"projectId": proj2["id"], "name": "Cfg 2", "apiUrl": "https://api2.internal", "answerPath": "ans"},
        headers=headers,
    ).json()

    with patch("httpx.AsyncClient.request", new_callable=AsyncMock) as mock_req:
        mock_req.return_value = httpx.Response(
            status_code=200,
            json={"ans": "Answer"},
            request=httpx.Request("POST", "https://api.internal"),
        )
        run1 = client.post(
            "/api/evaluations",
            json={"projectId": proj1["id"], "datasetId": ds1["id"], "ragConfigurationId": cfg1["id"]},
            headers=headers,
        ).json()
        run2 = client.post(
            "/api/evaluations",
            json={"projectId": proj2["id"], "datasetId": ds2["id"], "ragConfigurationId": cfg2["id"]},
            headers=headers,
        ).json()

    res = client.post(
        "/api/comparisons",
        json={"runA": run1["id"], "runB": run2["id"]},
        headers=headers,
    )
    assert res.status_code == 400
    assert "same project" in res.json()["error"]["message"].lower()


def test_compare_runs_unauthorized_access(client):
    """Verify that User B cannot compare User A's runs (403 Forbidden)."""
    user_a_token = get_auth_token(client)
    user_b_token = get_auth_token(client)

    headers_a = {"Authorization": f"Bearer {user_a_token}"}
    headers_b = {"Authorization": f"Bearer {user_b_token}"}

    proj = client.post("/api/projects", json={"name": "User A Project"}, headers=headers_a).json()
    ds = client.post(f"/api/projects/{proj['id']}/datasets", json={"name": "User A DS"}, headers=headers_a).json()
    client.post(f"/api/datasets/{ds['id']}/items", json={"question": "Q?", "expectedAnswer": "A"}, headers=headers_a)
    cfg = client.post(
        "/api/rag-configurations",
        json={"projectId": proj["id"], "name": "Cfg", "apiUrl": "https://api.internal", "answerPath": "ans"},
        headers=headers_a,
    ).json()

    with patch("httpx.AsyncClient.request", new_callable=AsyncMock) as mock_req:
        mock_req.return_value = httpx.Response(
            status_code=200,
            json={"ans": "Answer"},
            request=httpx.Request("POST", "https://api.internal"),
        )
        run = client.post(
            "/api/evaluations",
            json={"projectId": proj["id"], "datasetId": ds["id"], "ragConfigurationId": cfg["id"]},
            headers=headers_a,
        ).json()

    # User B attempts to compare Run A
    res = client.post(
        "/api/comparisons",
        json={"runA": run["id"], "runB": run["id"]},
        headers=headers_b,
    )
    assert res.status_code == 403


def test_compare_runs_not_found(client):
    """Verify that non-existent runs return 404 Not Found."""
    token = get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    res = client.post(
        "/api/comparisons",
        json={"runA": "non-existent-1", "runB": "non-existent-2"},
        headers=headers,
    )
    assert res.status_code == 404
