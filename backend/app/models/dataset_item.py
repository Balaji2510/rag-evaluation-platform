from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_serializer


class DatasetItem(BaseModel):
    """Dataset item domain model representing an evaluation question."""

    id: str
    datasetId: str
    question: str
    expectedAnswer: str
    expectedContexts: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = ConfigDict(populate_by_name=True)

    @field_serializer("createdAt")
    def serialize_datetime(self, dt: datetime, _info: Any) -> str:
        return dt.isoformat()

    @classmethod
    def from_mongo(cls, data: Dict[str, Any]) -> "DatasetItem":
        """Convert MongoDB document to DatasetItem model instance."""
        if not data:
            raise ValueError("Document data cannot be empty")

        doc = dict(data)
        if "_id" in doc:
            doc["id"] = str(doc.pop("_id"))
        return cls(**doc)

    def to_mongo(self) -> Dict[str, Any]:
        """Convert DatasetItem model to MongoDB document."""
        data = self.model_dump()
        doc_id = data.pop("id")
        data["_id"] = doc_id
        return data

