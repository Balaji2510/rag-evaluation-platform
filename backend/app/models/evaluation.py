from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_serializer


class MetricResult(BaseModel):
    """Result of an individual Gemini RAG quality metric evaluation."""

    score: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    reason: Optional[str] = None
    error: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)


class EvaluationResultMetrics(BaseModel):
    """Set of RAG quality evaluation metrics evaluated by Google Gemini."""

    answerCorrectness: Optional[MetricResult] = None
    answerRelevance: Optional[MetricResult] = None
    faithfulness: Optional[MetricResult] = None
    contextRelevance: Optional[MetricResult] = None
    contextRecall: Optional[MetricResult] = None

    model_config = ConfigDict(populate_by_name=True)


class EvaluationRun(BaseModel):
    """Domain model representing a batch evaluation execution."""

    id: str
    userId: str
    projectId: str
    datasetId: str
    ragConfigurationId: str
    status: str = "pending"  # "pending" | "running" | "completed" | "failed" | "cancelled"
    totalQuestions: int = 0
    completedQuestions: int = 0
    failedQuestions: int = 0
    startedAt: Optional[datetime] = None
    completedAt: Optional[datetime] = None
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updatedAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    # Phase 6: Aggregate metrics across questions
    overallScore: Optional[float] = None
    averageFaithfulness: Optional[float] = None
    averageAnswerRelevance: Optional[float] = None
    averageContextRelevance: Optional[float] = None
    averageContextRecall: Optional[float] = None
    averageAnswerCorrectness: Optional[float] = None
    averageLatency: Optional[float] = None

    # Phase 10: Production improvements
    promptVersion: Optional[str] = None
    gitCommit: Optional[str] = None
    gitBranch: Optional[str] = None
    prNumber: Optional[int] = None
    tokenUsage: Optional[Dict[str, int]] = None  # {"inputTokens": X, "outputTokens": Y, "totalTokens": Z}
    estimatedCostUsd: Optional[float] = None
    qualityGatePassed: Optional[bool] = None
    regressionDetected: bool = False
    regressionDetails: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)

    @field_serializer("createdAt", "updatedAt", "startedAt", "completedAt")
    def serialize_datetime(self, dt: Optional[datetime], _info: Any) -> Optional[str]:
        return dt.isoformat() if dt else None

    @classmethod
    def from_mongo(cls, data: Dict[str, Any]) -> "EvaluationRun":
        """Convert MongoDB document to EvaluationRun instance."""
        if not data:
            raise ValueError("Document data cannot be empty")

        doc = dict(data)
        if "_id" in doc:
            doc["id"] = str(doc.pop("_id"))
        return cls(**doc)

    def to_mongo(self) -> Dict[str, Any]:
        """Convert EvaluationRun model to MongoDB document."""
        data = self.model_dump(by_alias=True)
        data["_id"] = data.pop("id", self.id)
        return data


class EvaluationResult(BaseModel):
    """Domain model representing the evaluation outcome of an individual question."""

    id: str
    runId: str
    question: str
    expectedAnswer: Optional[str] = None
    expectedContexts: List[str] = Field(default_factory=list)
    generatedAnswer: Optional[str] = None
    retrievedContexts: List[str] = Field(default_factory=list)
    latencyMs: Optional[float] = None
    status: str = "completed"  # "completed" | "failed"
    error: Optional[str] = None
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    # Phase 6: Granular Gemini evaluation metrics
    metrics: Optional[EvaluationResultMetrics] = None

    # Phase 10: Production improvements
    humanScore: Optional[float] = None  # 1.0 to 5.0
    humanFeedback: Optional[str] = None
    annotations: List[str] = Field(default_factory=list)
    tokenUsage: Optional[Dict[str, int]] = None
    estimatedCostUsd: Optional[float] = None
    latencyBreakdown: Optional[Dict[str, float]] = None

    model_config = ConfigDict(populate_by_name=True)

    @field_serializer("createdAt")
    def serialize_datetime(self, dt: datetime, _info: Any) -> str:
        return dt.isoformat()

    @classmethod
    def from_mongo(cls, data: Dict[str, Any]) -> "EvaluationResult":
        """Convert MongoDB document to EvaluationResult instance."""
        if not data:
            raise ValueError("Document data cannot be empty")

        doc = dict(data)
        if "_id" in doc:
            doc["id"] = str(doc.pop("_id"))
        return cls(**doc)

    def to_mongo(self) -> Dict[str, Any]:
        """Convert EvaluationResult model to MongoDB document."""
        data = self.model_dump(by_alias=True)
        data["_id"] = data.pop("id", self.id)
        return data
