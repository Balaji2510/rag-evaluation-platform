from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_serializer


class DocumentResponse(BaseModel):
    """API response model for an uploaded document."""

    id: str
    projectId: str
    filename: str
    contentType: str
    metadata: Dict[str, Any] = Field(default_factory=dict)
    createdAt: datetime

    model_config = ConfigDict(populate_by_name=True)

    @field_serializer("createdAt")
    def serialize_datetime(self, dt: datetime, _info: Any) -> str:
        return dt.isoformat()


class DocumentDetailResponse(DocumentResponse):
    """API response including chunk count and status."""

    chunkCount: int = 0


class DocumentChunkResponse(BaseModel):
    """API response model for an individual document chunk."""

    id: str
    documentId: str
    content: str
    metadata: Dict[str, Any] = Field(default_factory=dict)


class InternalRAGConfigResponse(BaseModel):
    """API response model for Internal RAG vector search configuration."""

    projectId: str
    chunkSize: int
    chunkOverlap: int
    topK: int
    indexName: str
    embeddingModel: str

    model_config = ConfigDict(populate_by_name=True)


class InternalRAGConfigUpdate(BaseModel):
    """Payload to update Internal RAG vector search configuration."""

    chunkSize: Optional[int] = Field(default=None, ge=100, le=8000)
    chunkOverlap: Optional[int] = Field(default=None, ge=0, le=2000)
    topK: Optional[int] = Field(default=None, ge=1, le=50)


class InternalRAGQueryRequest(BaseModel):
    """Query payload for direct internal RAG execution."""

    question: str = Field(..., min_length=1, description="Question or prompt to query against indexed documents")


class InternalRAGQueryResponse(BaseModel):
    """Standardized response from the internal RAG pipeline."""

    answer: str
    contexts: List[str] = Field(default_factory=list)

