from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_serializer


class Document(BaseModel):
    """Domain model representing an uploaded project document."""

    id: str
    projectId: str
    filename: str
    contentType: str
    metadata: Dict[str, Any] = Field(default_factory=dict)
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = ConfigDict(populate_by_name=True)

    @field_serializer("createdAt")
    def serialize_datetime(self, dt: datetime, _info: Any) -> str:
        return dt.isoformat()

    @classmethod
    def from_mongo(cls, data: Dict[str, Any]) -> "Document":
        """Convert MongoDB document to Document model."""
        if not data:
            raise ValueError("Document data cannot be empty")
        doc = dict(data)
        if "_id" in doc:
            doc["id"] = str(doc.pop("_id"))
        return cls(**doc)

    def to_mongo(self) -> Dict[str, Any]:
        """Convert Document model to MongoDB document."""
        data = self.model_dump()
        doc_id = data.pop("id")
        data["_id"] = doc_id
        return data


class DocumentChunk(BaseModel):
    """Domain model representing an indexed text chunk with vector embedding."""

    id: str
    documentId: str
    projectId: str
    content: str
    embedding: List[float] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = ConfigDict(populate_by_name=True)

    @field_serializer("createdAt")
    def serialize_datetime(self, dt: datetime, _info: Any) -> str:
        return dt.isoformat()

    @classmethod
    def from_mongo(cls, data: Dict[str, Any]) -> "DocumentChunk":
        """Convert MongoDB document to DocumentChunk model."""
        if not data:
            raise ValueError("Chunk data cannot be empty")
        doc = dict(data)
        if "_id" in doc:
            doc["id"] = str(doc.pop("_id"))
        return cls(**doc)

    def to_mongo(self) -> Dict[str, Any]:
        """Convert DocumentChunk model to MongoDB document."""
        data = self.model_dump()
        doc_id = data.pop("id")
        data["_id"] = doc_id
        return data


class InternalRAGConfig(BaseModel):
    """Configuration for MongoDB Atlas Vector Search and Internal RAG pipeline."""

    projectId: str
    chunkSize: int = Field(default=1000, ge=100, le=8000, description="Size of text chunks in characters")
    chunkOverlap: int = Field(default=200, ge=0, le=2000, description="Overlap between consecutive chunks")
    topK: int = Field(default=4, ge=1, le=50, description="Number of context passages to retrieve")
    indexName: str = Field(default="vector_index", description="Atlas Vector Search index name")
    embeddingModel: str = Field(default="text-embedding-004", description="Gemini embeddings model")
    updatedAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = ConfigDict(populate_by_name=True)

    @field_serializer("updatedAt")
    def serialize_datetime(self, dt: datetime, _info: Any) -> str:
        return dt.isoformat()

    @classmethod
    def from_mongo(cls, data: Dict[str, Any]) -> "InternalRAGConfig":
        if not data:
            raise ValueError("Config data cannot be empty")
        doc = dict(data)
        if "_id" in doc:
            doc["projectId"] = str(doc.pop("_id"))
        return cls(**doc)

    def to_mongo(self) -> Dict[str, Any]:
        data = self.model_dump()
        p_id = data.pop("projectId")
        data["_id"] = p_id
        return data

