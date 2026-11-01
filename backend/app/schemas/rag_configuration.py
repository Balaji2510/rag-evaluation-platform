from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator


SENSITIVE_HEADER_KEYS = {
    "authorization",
    "api-key",
    "apikey",
    "x-api-key",
    "token",
    "secret",
    "x-auth-token",
}


def mask_headers(headers: Dict[str, str]) -> Dict[str, str]:
    """Mask sensitive header values to prevent secret leakage to client."""
    masked: Dict[str, str] = {}
    for k, v in headers.items():
        key_lower = k.lower().strip()
        if any(secret_key in key_lower for secret_key in SENSITIVE_HEADER_KEYS):
            masked[k] = "********"
        else:
            masked[k] = v
    return masked


class RAGConfigurationCreate(BaseModel):
    """Payload to create a new RAG configuration."""

    projectId: str = Field(..., description="Parent project ID")
    name: str = Field(..., min_length=1, max_length=120, description="Configuration name")
    apiUrl: str = Field(..., description="External endpoint URL")
    method: str = Field(default="POST", description="HTTP method (POST, GET, etc.)")
    headers: Dict[str, str] = Field(default_factory=dict, description="Custom request headers")
    requestTemplate: Dict[str, Any] = Field(
        default_factory=lambda: {"question": "{{question}}"},
        description="JSON request body template with {{question}} placeholder",
    )
    answerPath: str = Field(default="answer", description="JSON path to extract answer string")
    contextPath: Optional[str] = Field(default="contexts", description="JSON path to extract context passages")
    timeoutSeconds: int = Field(default=30, ge=1, le=300, description="Request timeout in seconds")

    @field_validator("method")
    @classmethod
    def validate_method(cls, v: str) -> str:
        method = v.upper().strip()
        if method not in ("GET", "POST", "PUT", "PATCH"):
            raise ValueError("Method must be GET, POST, PUT, or PATCH")
        return method


class RAGConfigurationUpdate(BaseModel):
    """Payload to update an existing RAG configuration."""

    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    apiUrl: Optional[str] = None
    method: Optional[str] = None
    headers: Optional[Dict[str, str]] = None
    requestTemplate: Optional[Dict[str, Any]] = None
    answerPath: Optional[str] = None
    contextPath: Optional[str] = None
    timeoutSeconds: Optional[int] = Field(default=None, ge=1, le=300)

    @field_validator("method")
    @classmethod
    def validate_method(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        method = v.upper().strip()
        if method not in ("GET", "POST", "PUT", "PATCH"):
            raise ValueError("Method must be GET, POST, PUT, or PATCH")
        return method


class RAGConfigurationResponse(BaseModel):
    """RAG configuration representation returned to client with masked secrets."""

    id: str
    projectId: str
    name: str
    apiUrl: str
    method: str
    headers: Dict[str, str] = Field(default_factory=dict)
    requestTemplate: Dict[str, Any]
    answerPath: str
    contextPath: Optional[str] = None
    timeoutSeconds: int
    isInternal: bool = False
    createdAt: datetime
    updatedAt: datetime

    model_config = ConfigDict(from_attributes=True)


class RAGTestRequest(BaseModel):
    """Payload to test external RAG configuration."""

    sampleQuestion: str = Field(
        default="What is Retrieval-Augmented Generation?",
        description="Sample question to test RAG endpoint",
    )


class RAGTestResponse(BaseModel):
    """Result of external RAG connection test."""

    success: bool
    statusCode: Optional[int] = None
    answer: Optional[str] = None
    contexts: List[str] = Field(default_factory=list)
    latencyMs: Optional[int] = None
    rawResponse: Optional[Any] = None
    error: Optional[str] = None

