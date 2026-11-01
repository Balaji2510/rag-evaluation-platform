from unittest.mock import AsyncMock, patch
import uuid
import pytest
from fastapi.testclient import TestClient
from app.main import app


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def get_auth_token(client: TestClient) -> str:
    email = f"prod_user_{uuid.uuid4().hex[:8]}@example.com"
    res = client.post(
        "/api/auth/register",
        json={"email": email, "password": "Password123!", "name": "Prod Engineer"},
    )
    assert res.status_code == 201
    return res.json()["access_token"]


def create_test_project_and_dataset(client: TestClient, token: str):
    headers = {"Authorization": f"Bearer {token}"}
    p_res = client.post(
        "/api/projects",
        json={"name": f"Prod Project {uuid.uuid4().hex[:6]}", "description": "Phase 10 Test"},
        headers=headers,
    )
    assert p_res.status_code == 201
    project_id = p_res.json()["id"]

    d_res = client.post(
        f"/api/projects/{project_id}/datasets",
        json={"name": "Prod Dataset", "description": "Phase 10 Dataset"},
        headers=headers,
    )
    assert d_res.status_code == 201
    dataset_id = d_res.json()["id"]

    item_res = client.post(
        f"/api/datasets/{dataset_id}/items",
        json={
            "question": "What is Phase 10?",
            "expectedAnswer": "Production improvements and quality gates.",
            "expectedContexts": ["Phase 10 adds CI/CD and enterprise capabilities."],
        },
        headers=headers,
    )
    assert item_res.status_code == 201
    return project_id, dataset_id, item_res.json()["id"]


def test_api_key_lifecycle_and_authentication(client: TestClient):
    """Test generating, listing, using for auth, and revoking API keys."""
    token = get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create API key
    create_res = client.post(
        "/api/api-keys",
        json={"name": "GitHub Actions Key"},
        headers=headers,
    )
    assert create_res.status_code == 201
    data = create_res.json()
    assert "secretKey" in data
    assert data["secretKey"].startswith("rageval_")
    assert data["name"] == "GitHub Actions Key"
    key_id = data["id"]
    secret_key = data["secretKey"]

    # 2. List API keys (secretKey must NOT be returned after creation)
    list_res = client.get("/api/api-keys", headers=headers)
    assert list_res.status_code == 200
    keys = list_res.json()
    assert any(k["id"] == key_id for k in keys)
    created_key = next(k for k in keys if k["id"] == key_id)
    assert created_key["secretKey"] is None
    assert not created_key["isRevoked"]

    # 3. Authenticate using x-api-key header
    cli_headers = {"x-api-key": secret_key}
    auth_check_res = client.get("/api/projects", headers=cli_headers)
    assert auth_check_res.status_code == 200

    # 4. Revoke key
    del_res = client.delete(f"/api/api-keys/{key_id}", headers=headers)
    assert del_res.status_code == 204

    # 5. Revoked key must fail authentication
    revoked_check = client.get("/api/projects", headers=cli_headers)
    assert revoked_check.status_code == 401


def test_quality_gate_evaluation(client: TestClient):
    """Test quality gate endpoint with threshold pass and fail scenarios."""
    token = get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    project_id, dataset_id, _ = create_test_project_and_dataset(client, token)

    mock_metrics = {
        "faithfulness": {"score": 0.95, "reason": "Accurate"},
        "answerRelevance": {"score": 0.90, "reason": "Relevant"},
        "contextRelevance": {"score": 0.88, "reason": "High relevance"},
        "contextRecall": {"score": 0.92, "reason": "Full recall"},
        "answerCorrectness": {"score": 0.94, "reason": "Correct"},
    }

    with patch("app.services.gemini_evaluator.GeminiEvaluatorService.evaluate_all", new_callable=AsyncMock) as mock_eval:
        from app.models.evaluation import EvaluationResultMetrics, MetricResult
        mock_eval.return_value = EvaluationResultMetrics(
            faithfulness=MetricResult(score=0.95, reason="Accurate"),
            answerRelevance=MetricResult(score=0.90, reason="Relevant"),
            contextRelevance=MetricResult(score=0.88, reason="High relevance"),
            contextRecall=MetricResult(score=0.92, reason="Full recall"),
            answerCorrectness=MetricResult(score=0.94, reason="Correct"),
        )

        with patch("httpx.AsyncClient.request") as mock_req:
            mock_resp = AsyncMock()
            mock_resp.status_code = 200
            mock_resp.json.return_value = {"answer": "Production improvements and quality gates.", "contexts": ["Phase 10"]}
            mock_req.return_value = mock_resp

            # Trigger evaluation
            eval_res = client.post(
                "/api/evaluations",
                json={
                    "projectId": project_id,
                    "datasetId": dataset_id,
                    "ragConfigurationId": "internal",
                    "promptVersion": "v1.2.0",
                    "gitCommit": "abc1234",
                },
                headers=headers,
            )
            assert eval_res.status_code == 201
            run_id = eval_res.json()["id"]

    # 1. Gate passes when score exceeds threshold
    gate_pass_res = client.post(
        f"/api/evaluations/{run_id}/quality-gate",
        json={"overallScore": 0.85, "faithfulness": 0.90},
        headers=headers,
    )
    assert gate_pass_res.status_code == 200
    gate_data = gate_pass_res.json()
    assert gate_data["passed"] is True
    assert gate_data["score"] >= 0.85
    assert len(gate_data["failures"]) == 0

    # 2. Gate fails when threshold is set higher than actual
    gate_fail_res = client.post(
        f"/api/evaluations/{run_id}/quality-gate",
        json={"overallScore": 0.99},
        headers=headers,
    )
    assert gate_fail_res.status_code == 200
    gate_fail_data = gate_fail_res.json()
    assert gate_fail_data["passed"] is False
    assert len(gate_fail_data["failures"]) > 0


def test_export_csv_and_json(client: TestClient):
    """Test downloading evaluation results as CSV and JSON."""
    token = get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    project_id, dataset_id, _ = create_test_project_and_dataset(client, token)

    with patch("app.services.gemini_evaluator.GeminiEvaluatorService.evaluate_all", new_callable=AsyncMock) as mock_eval:
        from app.models.evaluation import EvaluationResultMetrics, MetricResult
        mock_eval.return_value = EvaluationResultMetrics(
            faithfulness=MetricResult(score=0.90, reason="Good"),
            answerCorrectness=MetricResult(score=0.85, reason="Correct"),
        )
        with patch("httpx.AsyncClient.request") as mock_req:
            mock_resp = AsyncMock()
            mock_resp.status_code = 200
            mock_resp.json.return_value = {"answer": "Export test answer", "contexts": ["context"]}
            mock_req.return_value = mock_resp

            eval_res = client.post(
                "/api/evaluations",
                json={
                    "projectId": project_id,
                    "datasetId": dataset_id,
                    "ragConfigurationId": "internal",
                },
                headers=headers,
            )
            run_id = eval_res.json()["id"]

    # Export CSV
    csv_res = client.get(f"/api/evaluations/{run_id}/export/csv", headers=headers)
    assert csv_res.status_code == 200
    assert "text/csv" in csv_res.headers.get("content-type", "")
    assert "Question,ExpectedAnswer,GeneratedAnswer" in csv_res.text
    assert "What is Phase 10?" in csv_res.text

    # Export JSON
    json_res = client.get(f"/api/evaluations/{run_id}/export/json", headers=headers)
    assert json_res.status_code == 200
    export_obj = json_res.json()
    assert "evaluationRun" in export_obj
    assert "results" in export_obj
    assert len(export_obj["results"]) >= 1


def test_human_evaluation_and_annotations(client: TestClient):
    """Test reviewer rating, notes, and question annotation tags."""
    token = get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    project_id, dataset_id, _ = create_test_project_and_dataset(client, token)

    with patch("app.services.gemini_evaluator.GeminiEvaluatorService.evaluate_all", new_callable=AsyncMock) as mock_eval:
        mock_eval.return_value = None
        with patch("httpx.AsyncClient.request") as mock_req:
            mock_resp = AsyncMock()
            mock_resp.status_code = 200
            mock_resp.json.return_value = {"answer": "Human test", "contexts": []}
            mock_req.return_value = mock_resp

            eval_res = client.post(
                "/api/evaluations",
                json={"projectId": project_id, "datasetId": dataset_id, "ragConfigurationId": "internal"},
                headers=headers,
            )
            run_id = eval_res.json()["id"]

    results_res = client.get(f"/api/evaluations/{run_id}/results", headers=headers)
    assert results_res.status_code == 200
    result_id = results_res.json()[0]["id"]

    # 1. Submit Human Evaluation
    he_res = client.post(
        f"/api/evaluations/{run_id}/results/{result_id}/human-eval",
        json={"humanScore": 4.5, "humanFeedback": "Accurate response with slight brevity."},
        headers=headers,
    )
    assert he_res.status_code == 200

    # 2. Submit Annotations
    ann_res = client.post(
        f"/api/evaluations/{run_id}/results/{result_id}/annotations",
        json={"annotations": ["needs_review", "gold_standard"]},
        headers=headers,
    )
    assert ann_res.status_code == 200

    # Verify updated fields in result fetch
    detail_res = client.get(f"/api/evaluations/{run_id}/results/{result_id}", headers=headers)
    assert detail_res.status_code == 200
    detail_data = detail_res.json()
    assert detail_data["humanScore"] == 4.5
    assert detail_data["humanFeedback"] == "Accurate response with slight brevity."
    assert "needs_review" in detail_data["annotations"]
    assert "gold_standard" in detail_data["annotations"]


def test_project_thresholds_webhooks_and_schedules(client: TestClient):
    """Test thresholds persistence, webhook registration, and evaluation schedules."""
    token = get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    project_id, dataset_id, _ = create_test_project_and_dataset(client, token)

    # 1. Project Thresholds
    th_update = client.put(
        f"/api/projects/{project_id}/thresholds",
        json={"overallScore": 0.88, "faithfulness": 0.90, "maxLatencyMs": 1800.0},
        headers=headers,
    )
    assert th_update.status_code == 200
    assert th_update.json()["overallScore"] == 0.88

    th_get = client.get(f"/api/projects/{project_id}/thresholds", headers=headers)
    assert th_get.status_code == 200
    assert th_get.json()["faithfulness"] == 0.90

    # 2. Webhooks
    wh_create = client.post(
        f"/api/projects/{project_id}/webhooks",
        json={"url": "https://ci.example.com/webhook", "events": ["evaluation.completed"]},
        headers=headers,
    )
    assert wh_create.status_code == 201
    wh_id = wh_create.json()["id"]

    wh_list = client.get(f"/api/projects/{project_id}/webhooks", headers=headers)
    assert wh_list.status_code == 200
    assert any(h["id"] == wh_id for h in wh_list.json())

    wh_del = client.delete(f"/api/projects/{project_id}/webhooks/{wh_id}", headers=headers)
    assert wh_del.status_code == 204

    # 3. Schedules
    sch_create = client.post(
        f"/api/projects/{project_id}/schedules",
        json={
            "projectId": project_id,
            "datasetId": dataset_id,
            "ragConfigurationId": "internal",
            "frequency": "daily",
            "cronExpression": "0 2 * * *",
        },
        headers=headers,
    )
    assert sch_create.status_code == 201
    sch_id = sch_create.json()["id"]

    sch_list = client.get(f"/api/projects/{project_id}/schedules", headers=headers)
    assert sch_list.status_code == 200
    assert any(s["id"] == sch_id for s in sch_list.json())

    sch_del = client.delete(f"/api/projects/{project_id}/schedules/{sch_id}", headers=headers)
    assert sch_del.status_code == 204


def test_workspaces_and_trends(client: TestClient):
    """Test workspace creation and project historical trend endpoint."""
    token = get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    project_id, _, _ = create_test_project_and_dataset(client, token)

    # 1. Workspaces
    ws_create = client.post(
        "/api/workspaces",
        json={"name": "Evaluation Core Team"},
        headers=headers,
    )
    assert ws_create.status_code == 201
    assert ws_create.json()["name"] == "Evaluation Core Team"

    ws_list = client.get("/api/workspaces", headers=headers)
    assert ws_list.status_code == 200
    assert len(ws_list.json()) >= 1

    # 2. Historical Trends
    trends_res = client.get(f"/api/projects/{project_id}/trends", headers=headers)
    assert trends_res.status_code == 200
    trends_data = trends_res.json()
    assert trends_data["projectId"] == project_id
    assert "trends" in trends_data
