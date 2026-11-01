from datetime import datetime, timezone
from typing import Any, Dict, Optional
from pydantic import BaseModel, ConfigDict, Field, field_serializer


class Project(BaseModel):
    """Project domain model."""

    id: str
    userId: str
    name: str
    description: Optional[str] = ""
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updatedAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = ConfigDict(populate_by_name=True)

    @field_serializer("createdAt", "updatedAt")
    def serialize_datetime(self, dt: datetime, _info: Any) -> str:
        return dt.isoformat()

    @classmethod
    def from_mongo(cls, data: Dict[str, Any]) -> "Project":
        """Convert MongoDB document to Project model instance."""
        if not data:
            raise ValueError("Document data cannot be empty")

        doc = dict(data)
        if "_id" in doc:
            doc["id"] = str(doc.pop("_id"))
        return cls(**doc)

    def to_mongo(self) -> Dict[str, Any]:
        """Convert Project model to MongoDB document."""
        data = self.model_dump()
        doc_id = data.pop("id")
        data["_id"] = doc_id
        return data

