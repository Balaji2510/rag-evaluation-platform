import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
import uuid
import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.gemini_evaluator import (
    GeminiEvaluatorService,
    parse_metric_json,
)


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def get_auth_token(client: TestClient) -> str:
    email = f"evaluator_{uuid.uuid4().hex[:8]}@example.com"
    res = client.post(
        "/api/auth/register",
        json={"email": email, "password": "Password123!", "name": "Gemini QA"},
    )
    assert res.status_code == 201
    return res.json()["access_token"]


def test_parse_metric_json():
    """Test parsing and clamping structured JSON from model responses."""
    # Standard JSON
    res1 = parse_metric_json('{"score": 0.92, "reason": "Factually accurate and well-grounded."}')
    assert res1["score"] == 0.92
    assert "Factually accurate" in res1["reason"]

    # Markdown block
    res2 = parse_metric_json('```json\n{"score": 0.45, "reason": "Partially relevant."}\n```')
    assert res2["score"] == 0.45

    # Clamping range [0.0, 1.0]
    res3 = parse_metric_json('{"score": 1.25, "reason": "Super accurate"}')
    assert res3["score"] == 1.0

    res4 = parse_metric_json('{"score": -0.5, "reason": "Terrible"}')
    assert res4["score"] == 0.0

    # Invalid JSON
    with pytest.raises(ValueError):
        parse_metric_json("Not a json string")


def test_gemini_evaluator_empty_contexts_handling():
    """Test that empty retrieved contexts are handled gracefully without unnecessary API calls."""
    evaluator = GeminiEvaluatorService(api_key="mock_key")

    async def run():
        # Faithfulness with empty context
        faith_res = await evaluator.evaluate_faithfulness(
            question="What is RAG?",
            generated_answer="RAG combines retrieval and generation.",
            retrieved_contexts=[],
        )
        assert faith_res.score == 0.0
        assert "No retrieved context" in faith_res.reason
        assert faith_res.error is None

        # Context relevance with empty context
        ctx_res = await evaluator.evaluate_context_relevance(
            question="What is RAG?",
            retrieved_contexts=[],
        )
        assert ctx_res.score == 0.0
        assert "No context passages" in ctx_res.reason

        # Context recall when no expected contexts provided -> should be None
        recall_res = await evaluator.evaluate_context_recall(
            question="What is RAG?",
            expected_contexts=[],
            retrieved_contexts=["Some passage"],
        )
        assert recall_res is None

    asyncio.run(run())


def test_gemini_evaluator_all_metrics_mocked():
    """Test evaluation of all 5 metrics using a mocked Gemini LLM."""
    mock_llm = MagicMock()

    # Mock LLM ainvoke returning structured JSON
    async def mock_ainvoke(messages):
        mock_response = MagicMock()
        mock_response.content = '{"score": 0.88, "reason": "Strong semantic alignment and grounded facts."}'
        return mock_response

    mock_llm.ainvoke = AsyncMock(side_effect=mock_ainvoke)

    evaluator = GeminiEvaluatorService(api_key="mock_api_key", llm=mock_llm)

    async def run():
        metrics = await evaluator.evaluate_all(
            question="What is MongoDB Atlas Vector Search?",
            expected_answer="Atlas Vector Search allows storing embeddings and querying vector similarity.",
            expected_contexts=["Atlas Vector Search indexes high-dimensional vectors for semantic search."],
            generated_answer="Atlas Vector Search supports vector embeddings and similarity queries.",
            retrieved_contexts=["Atlas Vector Search indexes high-dimensional vectors for semantic search."],
        )

        assert metrics.answerCorrectness is not None
        assert metrics.answerCorrectness.score == 0.88
        assert "Strong semantic alignment" in metrics.answerCorrectness.reason

        assert metrics.answerRelevance is not None
        assert metrics.answerRelevance.score == 0.88

        assert metrics.faithfulness is not None
        assert metrics.faithfulness.score == 0.88

        assert metrics.contextRelevance is not None
        assert metrics.contextRelevance.score == 0.88

        assert metrics.contextRecall is not None
        assert metrics.contextRecall.score == 0.88

    asyncio.run(run())


def test_end_to_end_evaluation_with_gemini_metrics(client):
    """Test complete evaluation run executing external RAG queries and Gemini quality evaluation."""
    token = get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Project & Dataset setup
    proj = client.post("/api/projects", json={"name": "Gemini Eval Project"}, headers=headers).json()
    ds = client.post(f"/api/projects/{proj['id']}/datasets", json={"name": "Gold Dataset"}, headers=headers).json()

    client.post(
        f"/api/datasets/{ds['id']}/items",
        json={
            "question": "What is hybrid retrieval?",
            "expectedAnswer": "Hybrid retrieval combines dense vector search with sparse keyword search like BM25.",
            "expectedContexts": ["Hybrid retrieval joins BM25 and vector search."],
        },
        headers=headers,
    )

    # 2. RAG Config setup
    cfg = client.post(
        "/api/rag-configurations",
        json={
            "projectId": proj["id"],
            "name": "Hybrid RAG Pipeline",
            "apiUrl": "https://rag.hybrid.internal/query",
            "method": "POST",
            "answerPath": "answer",
            "contextPath": "contexts",
        },
        headers=headers,
    ).json()

    # 3. Mock external RAG API
    async def mock_rag_request(*args, **kwargs):
        return httpx.Response(
            status_code=200,
            json={
                "answer": "Hybrid search blends BM25 keyword matching with dense vector similarity.",
                "contexts": ["Hybrid retrieval joins BM25 and vector search using reciprocal rank fusion."],
            },
            request=httpx.Request("POST", "https://rag.hybrid.internal/query"),
        )

    # 4. Mock Gemini LLM call
    mock_llm = MagicMock()
    mock_llm_response = MagicMock()
    mock_llm_response.content = '{"score": 0.95, "reason": "Accurate, grounded, and concise answer."}'
    mock_llm.ainvoke = AsyncMock(return_value=mock_llm_response)

    with patch("httpx.AsyncClient.request", new_callable=AsyncMock) as mock_req, \
         patch.object(GeminiEvaluatorService, "_get_llm", return_value=mock_llm):
        mock_req.side_effect = mock_rag_request

        # Start evaluation
        start_res = client.post(
            "/api/evaluations",
            json={
                "projectId": proj["id"],
                "datasetId": ds["id"],
                "ragConfigurationId": cfg["id"],
            },
            headers=headers,
        )
        assert start_res.status_code == 201
        run_id = start_res.json()["id"]

    # 5. Verify run completion and aggregate metrics
    run_res = client.get(f"/api/evaluations/{run_id}", headers=headers)
    assert run_res.status_code == 200
    run_data = run_res.json()

    assert run_data["status"] == "completed"
    assert run_data["completedQuestions"] == 1
    assert run_data["failedQuestions"] == 0
    assert run_data["overallScore"] == 0.95
    assert run_data["averageFaithfulness"] == 0.95
    assert run_data["averageAnswerRelevance"] == 0.95
    assert run_data["averageContextRelevance"] == 0.95
    assert run_data["averageContextRecall"] == 0.95
    assert run_data["averageAnswerCorrectness"] == 0.95
    assert run_data["averageLatency"] is not None

    # 6. Verify granular results with Gemini metrics
    results_res = client.get(f"/api/evaluations/{run_id}/results", headers=headers)
    assert results_res.status_code == 200
    items = results_res.json()
    assert len(items) == 1
    item = items[0]

    assert item["metrics"] is not None
    assert item["metrics"]["answerCorrectness"]["score"] == 0.95
    assert "Accurate" in item["metrics"]["answerCorrectness"]["reason"]
    assert item["metrics"]["faithfulness"]["score"] == 0.95
    assert item["metrics"]["answerRelevance"]["score"] == 0.95
    assert item["metrics"]["contextRelevance"]["score"] == 0.95
    assert item["metrics"]["contextRecall"]["score"] == 0.95


def test_gemini_error_resilience(client):
    """Test that if Gemini throws rate limit or error, the evaluation run does NOT crash and continues."""
    token = get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    proj = client.post("/api/projects", json={"name": "Resilience Gemini Project"}, headers=headers).json()
    ds = client.post(f"/api/projects/{proj['id']}/datasets", json={"name": "Resilience DS"}, headers=headers).json()

    client.post(
        f"/api/datasets/{ds['id']}/items",
        json={"question": "Test question?", "expectedAnswer": "Test answer"},
        headers=headers,
    )

    cfg = client.post(
        "/api/rag-configurations",
        json={"projectId": proj["id"], "name": "API", "apiUrl": "https://api.test/ask", "answerPath": "answer"},
        headers=headers,
    ).json()

    mock_llm = MagicMock()
    # Gemini throws a rate limit 429
    mock_llm.ainvoke = AsyncMock(side_effect=Exception("ResourceExhausted: 429 Rate limit exceeded"))

    with patch("httpx.AsyncClient.request", new_callable=AsyncMock) as mock_req, \
         patch.object(GeminiEvaluatorService, "_get_llm", return_value=mock_llm):
        mock_req.return_value = httpx.Response(
            status_code=200,
            json={"answer": "Some answer", "contexts": ["Some context"]},
            request=httpx.Request("POST", "https://api.test/ask"),
        )

        start_res = client.post(
            "/api/evaluations",
            json={
                "projectId": proj["id"],
                "datasetId": ds["id"],
                "ragConfigurationId": cfg["id"],
            },
            headers=headers,
        )
        assert start_res.status_code == 201
        run_id = start_res.json()["id"]

    run_res = client.get(f"/api/evaluations/{run_id}", headers=headers).json()
    # The run must still complete successfully and not crash
    assert run_res["status"] == "completed"
    assert run_res["completedQuestions"] == 1

    results = client.get(f"/api/evaluations/{run_id}/results", headers=headers).json()
    assert len(results) == 1
    # Metrics should reflect error without crashing
    metrics = results[0]["metrics"]
    assert metrics is not None
    assert metrics["answerCorrectness"]["error"] is not None
    assert "Rate limit" in metrics["answerCorrectness"]["error"]
