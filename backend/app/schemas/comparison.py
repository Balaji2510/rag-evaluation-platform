from datetime import datetime
from typing import Any, List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_serializer


class ComparisonRequest(BaseModel):
    """Request payload to compare two evaluation runs."""

    runA: str = Field(..., min_length=1, description="ID of baseline evaluation run A")
    runB: str = Field(..., min_length=1, description="ID of candidate evaluation run B")


class ComparisonRunMeta(BaseModel):
    """Metadata describing an evaluation run participating in a comparison."""

    id: str
    projectId: str
    datasetId: str
    ragConfigurationId: str
    status: str
    totalQuestions: int = 0
    completedQuestions: int = 0
    failedQuestions: int = 0
    projectName: Optional[str] = None
    datasetName: Optional[str] = None
    ragConfigurationName: Optional[str] = None
    createdAt: datetime

    model_config = ConfigDict(populate_by_name=True)

    @field_serializer("createdAt")
    def serialize_datetime(self, dt: datetime, _info: Any) -> str:
        return dt.isoformat()


class MetricComparison(BaseModel):
    """Comparison result for a single evaluation metric."""

    key: str
    name: str
    runA: Optional[float] = None
    runB: Optional[float] = None
    absoluteDifference: Optional[float] = None
    percentageDifference: Optional[float] = None
    status: str  # "improved" | "regressed" | "no-change"
    higherIsBetter: bool = True
    formattedChange: str  # e.g. "+6.8%", "-12.4%", "0.0%", "N/A"
    unit: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)


class ComparisonResponse(BaseModel):
    """Complete response payload for evaluation run comparison."""

    runA: ComparisonRunMeta
    runB: ComparisonRunMeta
    metrics: List[MetricComparison]
    improvedCount: int
    regressedCount: int
    unchangedCount: int
    improvedMetrics: List[str]
    regressedMetrics: List[str]
    unchangedMetrics: List[str]
    summary: str

    model_config = ConfigDict(populate_by_name=True)

