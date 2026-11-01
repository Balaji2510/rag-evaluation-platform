import uuid
import pytest
from fastapi.testclient import TestClient
from app.main import app


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def unique_email() -> str:
    return f"user_{uuid.uuid4().hex[:8]}@example.com"


def test_registration(client):
    """Test successful user registration."""
    email = unique_email()
    payload = {
        "email": email,
        "password": "Password123!",
        "name": "Test Developer",
    }

    response = client.post("/api/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()

    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert "user" in data
    assert data["user"]["email"] == email.lower()
    assert data["user"]["name"] == "Test Developer"
    assert "id" in data["user"]
    assert "createdAt" in data["user"]
    assert "updatedAt" in data["user"]
    # Ensure passwordHash is NOT returned in response
    assert "passwordHash" not in data["user"]


def test_duplicate_email_registration(client):
    """Test that registering duplicate email returns 409 Conflict."""
    email = unique_email()
    payload = {
        "email": email,
        "password": "Password123!",
        "name": "First User",
    }

    # First registration should succeed
    first_res = client.post("/api/auth/register", json=payload)
    assert first_res.status_code == 201

    # Second registration with duplicate email must fail
    second_res = client.post("/api/auth/register", json=payload)
    assert second_res.status_code == 409
    data = second_res.json()
    assert "error" in data
    assert "already exists" in data["error"]["message"].lower()


def test_login_successful(client):
    """Test login with valid email and password."""
    email = unique_email()
    password = "SecurePassword2026!"

    # Register user first
    reg_res = client.post(
        "/api/auth/register",
        json={"email": email, "password": password, "name": "Login Tester"},
    )
    assert reg_res.status_code == 201

    # Login
    login_res = client.post(
        "/api/auth/login",
        json={"email": email, "password": password},
    )
    assert login_res.status_code == 200
    data = login_res.json()

    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == email.lower()
    assert data["user"]["name"] == "Login Tester"


def test_login_invalid_password(client):
    """Test login with incorrect password returns 401 Unauthorized."""
    email = unique_email()
    password = "CorrectPassword123!"

    # Register user
    reg_res = client.post(
        "/api/auth/register",
        json={"email": email, "password": password, "name": "Password Tester"},
    )
    assert reg_res.status_code == 201

    # Login with wrong password
    login_res = client.post(
        "/api/auth/login",
        json={"email": email, "password": "WrongPassword456!"},
    )
    assert login_res.status_code == 401
    data = login_res.json()
    assert "error" in data
    assert "invalid" in data["error"]["message"].lower()


def test_protected_endpoint(client):
    """Test accessing protected /api/auth/me endpoint."""
    # 1. Accessing without token must return 401
    unauth_res = client.get("/api/auth/me")
    assert unauth_res.status_code == 401

    # 2. Accessing with invalid token must return 401
    invalid_token_res = client.get(
        "/api/auth/me",
        headers={"Authorization": "Bearer invalid.jwt.token.here"},
    )
    assert invalid_token_res.status_code == 401

    # 3. Accessing with valid token must return 200 and user profile
    email = unique_email()
    reg_res = client.post(
        "/api/auth/register",
        json={"email": email, "password": "SecretPassword123!", "name": "Protected Tester"},
    )
    assert reg_res.status_code == 201
    token = reg_res.json()["access_token"]

    auth_res = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert auth_res.status_code == 200
    user_data = auth_res.json()
    assert user_data["email"] == email.lower()
    assert user_data["name"] == "Protected Tester"
    assert "id" in user_data
