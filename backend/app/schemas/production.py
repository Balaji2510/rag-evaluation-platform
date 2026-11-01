from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_serializer


class ApiKeyCreate(BaseModel):
    """Payload to generate a new external API key."""

    name: str = Field(..., min_length=2, max_length=100, description="Descriptive name for the API key")
    projectId: Optional[str] = Field(default=None, description="Optional scoping to a specific project")


class ApiKeyResponse(BaseModel):
    """API key response representation."""

    id: str
    name: str
    keyPrefix: str
    secretKey: Optional[str] = None  # Only populated once on creation
    projectId: Optional[str] = None
    createdAt: datetime
    lastUsedAt: Optional[datetime] = None
    isRevoked: bool

    model_config = ConfigDict(populate_by_name=True)

    @field_serializer("createdAt", "lastUsedAt")
    def serialize_datetime(self, dt: Optional[datetime], _info: Any) -> Optional[str]:
        return dt.isoformat() if dt else None


class ThresholdsUpdate(BaseModel):
    """Quality gate threshold configurations for a project."""

    overallScore: float = Field(default=0.80, ge=0.0, le=1.0)
    faithfulness: float = Field(default=0.85, ge=0.0, le=1.0)
    answerCorrectness: float = Field(default=0.80, ge=0.0, le=1.0)
    answerRelevance: float = Field(default=0.80, ge=0.0, le=1.0)
    contextRelevance: float = Field(default=0.75, ge=0.0, le=1.0)
    contextRecall: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    maxLatencyMs: Optional[float] = Field(default=30000.0, ge=50.0)


class QualityGateRequest(BaseModel):
    """Optional overrides when checking quality gate for an evaluation run."""

    overallScore: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    faithfulness: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    answerCorrectness: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    answerRelevance: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    contextRelevance: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    contextRecall: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    maxLatencyMs: Optional[float] = Field(default=None, ge=50.0)


class QualityGateResponse(BaseModel):
    """Quality gate decision response."""

    passed: bool
    score: float
    thresholds: Dict[str, Any]
    actuals: Dict[str, Any]
    failures: List[str]
    runId: str
    status: str


class WebhookCreate(BaseModel):
    """Payload to register a project webhook."""

    url: str = Field(..., description="Target HTTPS webhook URL")
    secret: Optional[str] = Field(default=None, description="Optional HMAC signing secret")
    events: List[str] = Field(default_factory=lambda: ["evaluation.completed", "gate.failed"])


class WebhookResponse(BaseModel):
    """Webhook configuration response."""

    id: str
    projectId: str
    url: str
    events: List[str]
    isActive: bool
    createdAt: datetime
    lastTriggeredAt: Optional[datetime] = None

    model_config = ConfigDict(populate_by_name=True)

    @field_serializer("createdAt", "lastTriggeredAt")
    def serialize_datetime(self, dt: Optional[datetime], _info: Any) -> Optional[str]:
        return dt.isoformat() if dt else None


class ScheduleCreate(BaseModel):
    """Payload to create an automated evaluation schedule."""

    projectId: str
    datasetId: str
    ragConfigurationId: str
    frequency: str = Field(default="daily", description="hourly, daily, or weekly")
    cronExpression: Optional[str] = Field(default="0 0 * * *")


class ScheduleResponse(BaseModel):
    """Automated evaluation schedule response."""

    id: str
    projectId: str
    datasetId: str
    ragConfigurationId: str
    frequency: str
    cronExpression: Optional[str] = None
    isActive: bool
    createdAt: datetime
    lastRunAt: Optional[datetime] = None
    nextRunAt: Optional[datetime] = None

    model_config = ConfigDict(populate_by_name=True)

    @field_serializer("createdAt", "lastRunAt", "nextRunAt")
    def serialize_datetime(self, dt: Optional[datetime], _info: Any) -> Optional[str]:
        return dt.isoformat() if dt else None


class HumanEvalRequest(BaseModel):
    """Payload for human reviewer scoring and feedback."""

    humanScore: float = Field(..., ge=1.0, le=5.0, description="Reviewer rating from 1 to 5")
    humanFeedback: Optional[str] = Field(default=None, max_length=2000, description="Reviewer notes or comments")


class AnnotationRequest(BaseModel):
    """Payload to set annotations/tags on an evaluation result."""

    annotations: List[str] = Field(..., description="Tags such as ['needs_review', 'hallucination', 'verified']")


class WorkspaceCreate(BaseModel):
    """Payload to create a workspace team."""

    name: str = Field(..., min_length=2, max_length=100)
    members: List[Dict[str, str]] = Field(default_factory=list)


class WorkspaceResponse(BaseModel):
    """Workspace representation."""

    id: str
    name: str
    ownerId: str
    members: List[Dict[str, str]]
    createdAt: datetime

    model_config = ConfigDict(populate_by_name=True)

    @field_serializer("createdAt")
    def serialize_datetime(self, dt: datetime, _info: Any) -> str:
        return dt.isoformat()


class AuditLogResponse(BaseModel):
    """Audit log entry."""

    id: str
    userId: str
    action: str
    entityType: str
    entityId: str
    details: Dict[str, Any]
    createdAt: datetime

    model_config = ConfigDict(populate_by_name=True)

    @field_serializer("createdAt")
    def serialize_datetime(self, dt: datetime, _info: Any) -> str:
        return dt.isoformat()


class TrendPoint(BaseModel):
    """Point in time for evaluation historical trends."""

    runId: str
    createdAt: str
    overallScore: Optional[float]
    faithfulness: Optional[float]
    answerCorrectness: Optional[float]
    averageLatency: Optional[float]
    status: str
    promptVersion: Optional[str] = None


class ProjectTrendsResponse(BaseModel):
    """Historical evaluation trend dataset for charting."""

    projectId: str
    totalRuns: int
    trends: List[TrendPoint]

