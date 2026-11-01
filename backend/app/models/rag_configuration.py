from datetime import datetime, timezone
from typing import Any, Dict, Optional
from pydantic import BaseModel, ConfigDict, Field, field_serializer


class RAGConfiguration(BaseModel):
    """Domain model for RAG external application configuration."""

    id: str
    projectId: str
    name: str
    apiUrl: str
    method: str = "POST"
    headers: Dict[str, str] = Field(default_factory=dict)
    requestTemplate: Dict[str, Any] = Field(default_factory=lambda: {"question": "{{question}}"})
    answerPath: str = "answer"
    contextPath: Optional[str] = "contexts"
    timeoutSeconds: int = Field(default=30, ge=1, le=300)
    isInternal: bool = Field(default=False, description="Whether this represents an internal Atlas Vector Search pipeline")
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updatedAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = ConfigDict(populate_by_name=True)

    @field_serializer("createdAt", "updatedAt")
    def serialize_datetime(self, dt: datetime, _info: Any) -> str:
        return dt.isoformat()

    @classmethod
    def from_mongo(cls, data: Dict[str, Any]) -> "RAGConfiguration":
        """Convert MongoDB document to RAGConfiguration model instance."""
        if not data:
            raise ValueError("Document data cannot be empty")

        doc = dict(data)
        if "_id" in doc:
            doc["id"] = str(doc.pop("_id"))
        return cls(**doc)

    def to_mongo(self) -> Dict[str, Any]:
        """Convert RAGConfiguration model to MongoDB document."""
        data = self.model_dump()
        doc_id = data.pop("id")
        data["_id"] = doc_id
        return data

