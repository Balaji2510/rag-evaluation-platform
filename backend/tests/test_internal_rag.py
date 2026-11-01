import asyncio
from datetime import datetime, timezone
import io
import json
import uuid
import pypdf
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.document_loader import DocumentLoaderService


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def get_auth_token(client: TestClient) -> str:
    email = f"user_{uuid.uuid4().hex[:8]}@example.com"
    res = client.post(
        "/api/auth/register",
        json={"email": email, "password": "Password123!", "name": "RAG Engineer"},
    )
    assert res.status_code == 201
    return res.json()["access_token"]


def test_document_loader_all_formats():
    """Verify document loader correctly parses PDF, TXT, Markdown, and JSON documents."""
    # 1. TXT
    txt_bytes = "This is a plain text document about FastAPI and LangChain.".encode("utf-8")
    txt_content, txt_meta = DocumentLoaderService.extract_text("readme.txt", "text/plain", txt_bytes)
    assert "FastAPI and LangChain" in txt_content
    assert txt_meta["format"] == "text"

    # 2. Markdown
    md_bytes = "# RAG Overview\n\nRetrieval-Augmented Generation enhances LLM responses with retrieved contexts.".encode("utf-8")
    md_content, md_meta = DocumentLoaderService.extract_text("guide.md", "text/markdown", md_bytes)
    assert "# RAG Overview" in md_content
    assert md_meta["format"] == "markdown"

    # 3. JSON
    json_data = [
        {"title": "MongoDB Atlas", "category": "Database", "features": "Vector Search"},
        {"title": "Gemini", "category": "LLM", "features": "Multimodal & Embeddings"},
    ]
    json_bytes = json.dumps(json_data).encode("utf-8")
    json_content, json_meta = DocumentLoaderService.extract_text("data.json", "application/json", json_bytes)
    assert "MongoDB Atlas" in json_content
    assert "Gemini" in json_content
    assert json_meta["itemCount"] == 2

    # 4. PDF (construct minimal valid PDF)
    writer = pypdf.PdfWriter()
    page = writer.add_blank_page(width=200, height=200)
    # pypdf allows creating synthetic pages or reading empty pages
    stream = io.BytesIO()
    writer.write(stream)
    pdf_bytes = stream.getvalue()

    # Empty pages will trigger "no extractable text" exception
    with pytest.raises(Exception):
        DocumentLoaderService.extract_text("empty.pdf", "application/pdf", pdf_bytes)


def test_internal_rag_crud_and_query_api(client):
    """Test document upload, vector search, settings update, and internal RAG query endpoint."""
    token = get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create a project
    proj = client.post("/api/projects", json={"name": "Internal RAG Project"}, headers=headers).json()
    proj_id = proj["id"]

    # 2. Get and update Internal RAG settings
    settings_res = client.get(f"/api/projects/{proj_id}/rag-settings", headers=headers)
    assert settings_res.status_code == 200
    cfg = settings_res.json()
    assert cfg["chunkSize"] == 1000
    assert cfg["topK"] == 4

    # Update settings
    up_res = client.put(
        f"/api/projects/{proj_id}/rag-settings",
        json={"chunkSize": 600, "chunkOverlap": 100, "topK": 3},
        headers=headers,
    )
    assert up_res.status_code == 200
    assert up_res.json()["chunkSize"] == 600
    assert up_res.json()["topK"] == 3

    # 3. Upload a document (Markdown)
    doc_text = (
        "# LangChain & MongoDB Vector Search\n\n"
        "LangChain provides composable components for retrieval augmented generation. "
        "MongoDB Atlas Vector Search allows storing high-dimensional vectors and querying them using cosine similarity. "
        "Google Gemini 1.5 Flash provides fast, grounded generation for enterprise internal RAG applications."
    )
    files = {"file": ("architecture.md", io.BytesIO(doc_text.encode("utf-8")), "text/markdown")}

    upload_res = client.post(f"/api/projects/{proj_id}/documents", files=files, headers=headers)
    assert upload_res.status_code == 201
    doc_data = upload_res.json()
    assert doc_data["filename"] == "architecture.md"
    assert doc_data["projectId"] == proj_id
    doc_id = doc_data["id"]

    # 4. List documents
    list_res = client.get(f"/api/projects/{proj_id}/documents", headers=headers)
    assert list_res.status_code == 200
    docs = list_res.json()
    assert len(docs) == 1
    assert docs[0]["id"] == doc_id
    assert docs[0]["chunkCount"] >= 1

    # 5. Query the internal RAG pipeline directly
    query_payload = {"question": "What does MongoDB Atlas Vector Search allow?"}
    query_res = client.post(f"/api/projects/{proj_id}/query", json=query_payload, headers=headers)
    assert query_res.status_code == 200
    q_data = query_res.json()
    assert "answer" in q_data
    assert "contexts" in q_data
    assert len(q_data["contexts"]) > 0
    assert any("cosine similarity" in ctx for ctx in q_data["contexts"])

    # 6. Delete document
    del_res = client.delete(f"/api/projects/{proj_id}/documents/{doc_id}", headers=headers)
    assert del_res.status_code == 204

    # Verify document is gone
    list_after = client.get(f"/api/projects/{proj_id}/documents", headers=headers).json()
    assert len(list_after) == 0


def test_internal_rag_evaluation_engine_integration(client):
    """Verify that the evaluation engine seamlessly runs against the Internal RAG pipeline."""
    token = get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create project
    proj = client.post("/api/projects", json={"name": "Internal RAG Evaluation Test"}, headers=headers).json()
    proj_id = proj["id"]

    # 2. Upload internal document containing the facts
    doc_text = "The speed of light in vacuum is approximately 299,792 kilometers per second."
    files = {"file": ("physics.txt", io.BytesIO(doc_text.encode("utf-8")), "text/plain")}
    client.post(f"/api/projects/{proj_id}/documents", files=files, headers=headers)

    # 3. Create dataset with evaluation question
    ds = client.post(f"/api/projects/{proj_id}/datasets", json={"name": "Physics Benchmark"}, headers=headers).json()
    ds_id = ds["id"]
    client.post(
        f"/api/datasets/{ds_id}/items",
        json={
            "question": "What is the speed of light in vacuum?",
            "expectedAnswer": "Approximately 299,792 km/s",
        },
        headers=headers,
    )

    # 4. Trigger evaluation with ragConfigurationId="internal"
    eval_res = client.post(
        "/api/evaluations",
        json={
            "projectId": proj_id,
            "datasetId": ds_id,
            "ragConfigurationId": "internal",
        },
        headers=headers,
    )
    assert eval_res.status_code == 201
    run_data = eval_res.json()
    assert run_data["ragConfigurationName"] == "Internal RAG (Atlas Vector Search)"
    run_id = run_data["id"]

    # 5. Verify run completed
    run_status = client.get(f"/api/evaluations/{run_id}", headers=headers).json()
    assert run_status["status"] == "completed"
    assert run_status["totalQuestions"] == 1
    assert run_status["completedQuestions"] == 1
    assert run_status["failedQuestions"] == 0

    # 6. Verify individual question result captured generated answer and contexts
    results = client.get(f"/api/evaluations/{run_id}/results", headers=headers).json()
    assert len(results) == 1
    res0 = results[0]
    assert res0["status"] == "completed"
    assert res0["generatedAnswer"] is not None
    assert len(res0["retrievedContexts"]) > 0
    assert "299,792" in res0["retrievedContexts"][0]
    assert res0["latencyMs"] is not None and res0["latencyMs"] >= 0

