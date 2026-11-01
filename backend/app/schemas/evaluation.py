from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_serializer
from app.models.evaluation import EvaluationResultMetrics, MetricResult


class EvaluationCreate(BaseModel):
    """Payload to trigger an evaluation run."""

    projectId: str = Field(..., min_length=1, description="ID of the parent project")
    datasetId: str = Field(..., min_length=1, description="ID of the dataset containing test questions")
    ragConfigurationId: str = Field(..., min_length=1, description="ID of the RAG endpoint configuration")
    promptVersion: Optional[str] = Field(default=None, description="Prompt version or template name")
    gitCommit: Optional[str] = Field(default=None, description="Git commit SHA")
    gitBranch: Optional[str] = Field(default=None, description="Git branch name")
    prNumber: Optional[int] = Field(default=None, description="GitHub Pull Request number")


class EvaluationRunResponse(BaseModel):
    """API response model for an evaluation run."""

    id: str
    projectId: str
    datasetId: str
    ragConfigurationId: str
    status: str
    totalQuestions: int
    completedQuestions: int
    failedQuestions: int
    startedAt: Optional[datetime] = None
    completedAt: Optional[datetime] = None
    createdAt: datetime
    projectName: Optional[str] = None
    datasetName: Optional[str] = None
    ragConfigurationName: Optional[str] = None

    # Phase 6: Aggregate quality metrics
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
    tokenUsage: Optional[Dict[str, int]] = None
    estimatedCostUsd: Optional[float] = None
    qualityGatePassed: Optional[bool] = None
    regressionDetected: bool = False
    regressionDetails: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)

    @field_serializer("createdAt", "startedAt", "completedAt")
    def serialize_datetime(self, dt: Optional[datetime], _info: Any) -> Optional[str]:
        return dt.isoformat() if dt else None


class EvaluationResultResponse(BaseModel):
    """API response model for an individual question evaluation result."""

    id: str
    runId: str
    question: str
    expectedAnswer: Optional[str] = None
    expectedContexts: List[str] = Field(default_factory=list)
    generatedAnswer: Optional[str] = None
    retrievedContexts: List[str] = Field(default_factory=list)
    latencyMs: Optional[float] = None
    status: str
    error: Optional[str] = None
    createdAt: datetime

    # Phase 6: Granular evaluation metrics
    metrics: Optional[EvaluationResultMetrics] = None

    # Phase 10: Production improvements
    humanScore: Optional[float] = None
    humanFeedback: Optional[str] = None
    annotations: List[str] = Field(default_factory=list)
    tokenUsage: Optional[Dict[str, int]] = None
    estimatedCostUsd: Optional[float] = None
    latencyBreakdown: Optional[Dict[str, float]] = None

    model_config = ConfigDict(populate_by_name=True)

    @field_serializer("createdAt")
    def serialize_datetime(self, dt: datetime, _info: Any) -> str:
        return dt.isoformat()
