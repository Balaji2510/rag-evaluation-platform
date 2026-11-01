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
        json={"email": email, "password": "Password123!", "name": "Dataset Dev"},
    )
    assert res.status_code == 201
    return res.json()["access_token"]


def test_datasets_and_items_lifecycle(client):
    """Test full lifecycle of datasets and evaluation question items."""
    token = get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create a parent project
    proj_res = client.post(
        "/api/projects",
        json={"name": "Financial QA RAG", "description": "10-K analysis"},
        headers=headers,
    )
    assert proj_res.status_code == 201
    project_id = proj_res.json()["id"]

    # 2. Create dataset under project
    ds_res = client.post(
        f"/api/projects/{project_id}/datasets",
        json={"name": "Q3 2026 Financial Reports", "description": "Benchmark questions"},
        headers=headers,
    )
    assert ds_res.status_code == 201
    dataset = ds_res.json()
    assert dataset["name"] == "Q3 2026 Financial Reports"
    dataset_id = dataset["id"]

    # 3. List datasets for project
    list_ds = client.get(f"/api/projects/{project_id}/datasets", headers=headers)
    assert list_ds.status_code == 200
    assert len(list_ds.json()) == 1

    # 4. Get dataset details (initially 0 items)
    detail_res = client.get(f"/api/datasets/{dataset_id}", headers=headers)
    assert detail_res.status_code == 200
    assert detail_res.json()["itemCount"] == 0
    assert detail_res.json()["items"] == []

    # 5. Add evaluation question item
    item_payload = {
        "question": "What was the total net revenue in Q3 2026?",
        "expectedAnswer": "$14.2 billion, reflecting a 12% YoY increase.",
        "expectedContexts": [
            "In Q3 2026, the company reported consolidated net revenue of $14.2B, up 12% compared to Q3 2025."
        ],
        "metadata": {"difficulty": "easy", "source": "10-Q"},
    }
    item_res = client.post(
        f"/api/datasets/{dataset_id}/items",
        json=item_payload,
        headers=headers,
    )
    assert item_res.status_code == 201
    created_item = item_res.json()
    assert created_item["question"] == item_payload["question"]
    assert created_item["expectedAnswer"] == item_payload["expectedAnswer"]
    assert len(created_item["expectedContexts"]) == 1
    assert created_item["metadata"]["difficulty"] == "easy"
    item_id = created_item["id"]

    # 6. Update item
    update_item_res = client.put(
        f"/api/datasets/{dataset_id}/items/{item_id}",
        json={"question": "What was the total net revenue for the third quarter of 2026?"},
        headers=headers,
    )
    assert update_item_res.status_code == 200
    assert update_item_res.json()["question"] == "What was the total net revenue for the third quarter of 2026?"

    # 7. Batch import items
    import_payload = {
        "items": [
            {
                "question": "What was the operating margin?",
                "expectedAnswer": "Operating margin reached 24.5%.",
                "expectedContexts": ["Operating income was $3.48B representing 24.5% margin."],
                "metadata": {"category": "profitability"},
            },
            {
                "question": "What were capital expenditures?",
                "expectedAnswer": "CapEx was $1.1 billion.",
                "expectedContexts": ["Capital expenditures for the quarter totaled $1.1B."],
                "metadata": {"category": "cash_flow"},
            },
        ]
    }
    import_res = client.post(
        f"/api/datasets/{dataset_id}/import",
        json=import_payload,
        headers=headers,
    )
    assert import_res.status_code == 201
    assert import_res.json()["importedCount"] == 2

    # 8. Verify dataset items count
    refreshed_detail = client.get(f"/api/datasets/{dataset_id}", headers=headers)
    assert refreshed_detail.status_code == 200
    assert refreshed_detail.json()["itemCount"] == 3

    # 9. Delete an item
    del_item_res = client.delete(
        f"/api/datasets/{dataset_id}/items/{item_id}",
        headers=headers,
    )
    assert del_item_res.status_code == 200
    assert del_item_res.json()["success"] is True

    # 10. Verify remaining count
    after_del_detail = client.get(f"/api/datasets/{dataset_id}", headers=headers)
    assert after_del_detail.status_code == 200
    assert after_del_detail.json()["itemCount"] == 2

