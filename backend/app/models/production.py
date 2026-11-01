from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_serializer


class ApiKey(BaseModel):
    """Domain model representing an API key for CI/CD and external CLI integration."""

    id: str
    userId: str
    projectId: Optional[str] = None
    name: str
    keyPrefix: str  # First 8 chars e.g. "rageval_a1b2..."
    hashedKey: str  # SHA-256 hash of the full secret key
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    lastUsedAt: Optional[datetime] = None
    isRevoked: bool = False

    model_config = ConfigDict(populate_by_name=True)

    @field_serializer("createdAt", "lastUsedAt")
    def serialize_datetime(self, dt: Optional[datetime], _info: Any) -> Optional[str]:
        return dt.isoformat() if dt else None

    @classmethod
    def from_mongo(cls, data: Dict[str, Any]) -> "ApiKey":
        doc = dict(data)
        if "_id" in doc:
            doc["id"] = str(doc.pop("_id"))
        return cls(**doc)

    def to_mongo(self) -> Dict[str, Any]:
        data = self.model_dump()
        doc_id = data.pop("id")
        data["_id"] = doc_id
        return data


class EvaluationThresholds(BaseModel):
    """Project-level or run-level quality gate thresholds."""

    overallScore: float = Field(default=0.80, ge=0.0, le=1.0)
    faithfulness: float = Field(default=0.85, ge=0.0, le=1.0)
    answerCorrectness: float = Field(default=0.80, ge=0.0, le=1.0)
    answerRelevance: float = Field(default=0.80, ge=0.0, le=1.0)
    contextRelevance: float = Field(default=0.75, ge=0.0, le=1.0)
    contextRecall: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    maxLatencyMs: Optional[float] = Field(default=30000.0, ge=50.0)

    model_config = ConfigDict(populate_by_name=True)


class WebhookConfig(BaseModel):
    """Webhook configuration for CI/CD and external event notifications."""

    id: str
    projectId: str
    url: str
    secret: Optional[str] = None
    events: List[str] = Field(default_factory=lambda: ["evaluation.completed", "gate.failed"])
    isActive: bool = True
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    lastTriggeredAt: Optional[datetime] = None

    model_config = ConfigDict(populate_by_name=True)

    @field_serializer("createdAt", "lastTriggeredAt")
    def serialize_datetime(self, dt: Optional[datetime], _info: Any) -> Optional[str]:
        return dt.isoformat() if dt else None

    @classmethod
    def from_mongo(cls, data: Dict[str, Any]) -> "WebhookConfig":
        doc = dict(data)
        if "_id" in doc:
            doc["id"] = str(doc.pop("_id"))
        return cls(**doc)

    def to_mongo(self) -> Dict[str, Any]:
        data = self.model_dump()
        doc_id = data.pop("id")
        data["_id"] = doc_id
        return data


class EvaluationSchedule(BaseModel):
    """Scheduled recurring evaluation job."""

    id: str
    projectId: str
    datasetId: str
    ragConfigurationId: str
    frequency: str = "daily"  # "hourly" | "daily" | "weekly"
    cronExpression: Optional[str] = "0 0 * * *"
    isActive: bool = True
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    lastRunAt: Optional[datetime] = None
    nextRunAt: Optional[datetime] = None

    model_config = ConfigDict(populate_by_name=True)

    @field_serializer("createdAt", "lastRunAt", "nextRunAt")
    def serialize_datetime(self, dt: Optional[datetime], _info: Any) -> Optional[str]:
        return dt.isoformat() if dt else None

    @classmethod
    def from_mongo(cls, data: Dict[str, Any]) -> "EvaluationSchedule":
        doc = dict(data)
        if "_id" in doc:
            doc["id"] = str(doc.pop("_id"))
        return cls(**doc)

    def to_mongo(self) -> Dict[str, Any]:
        data = self.model_dump()
        doc_id = data.pop("id")
        data["_id"] = doc_id
        return data


class Workspace(BaseModel):
    """Team/Organization workspace model."""

    id: str
    name: str
    ownerId: str
    members: List[Dict[str, str]] = Field(default_factory=list)  # [{"userId": "...", "role": "editor"}]
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = ConfigDict(populate_by_name=True)

    @field_serializer("createdAt")
    def serialize_datetime(self, dt: datetime, _info: Any) -> str:
        return dt.isoformat()

    @classmethod
    def from_mongo(cls, data: Dict[str, Any]) -> "Workspace":
        doc = dict(data)
        if "_id" in doc:
            doc["id"] = str(doc.pop("_id"))
        return cls(**doc)

    def to_mongo(self) -> Dict[str, Any]:
        data = self.model_dump()
        doc_id = data.pop("id")
        data["_id"] = doc_id
        return data


class AuditLog(BaseModel):
    """System audit trail for security and operational governance."""

    id: str
    userId: str
    action: str  # "create_project", "run_evaluation", "create_api_key", "update_thresholds", etc.
    entityType: str
    entityId: str
    details: Dict[str, Any] = Field(default_factory=dict)
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = ConfigDict(populate_by_name=True)

    @field_serializer("createdAt")
    def serialize_datetime(self, dt: datetime, _info: Any) -> str:
        return dt.isoformat()

    @classmethod
    def from_mongo(cls, data: Dict[str, Any]) -> "AuditLog":
        doc = dict(data)
        if "_id" in doc:
            doc["id"] = str(doc.pop("_id"))
        return cls(**doc)

    def to_mongo(self) -> Dict[str, Any]:
        data = self.model_dump()
        doc_id = data.pop("id")
        data["_id"] = doc_id
        return data

