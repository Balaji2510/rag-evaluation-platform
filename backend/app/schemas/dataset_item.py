from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class DatasetItemCreate(BaseModel):
    """Payload for creating a dataset evaluation item."""

    question: str = Field(..., min_length=1, description="Evaluation prompt or question")
    expectedAnswer: str = Field(..., min_length=1, description="Ground truth answer")
    expectedContexts: List[str] = Field(default_factory=list, description="Ground truth reference passages")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Custom metadata tags or attributes")


class DatasetItemUpdate(BaseModel):
    """Payload for updating a dataset evaluation item."""

    question: Optional[str] = Field(default=None, min_length=1)
    expectedAnswer: Optional[str] = Field(default=None, min_length=1)
    expectedContexts: Optional[List[str]] = None
    metadata: Optional[Dict[str, Any]] = None


class DatasetItemResponse(BaseModel):
    """Dataset item representation response."""

    id: str
    datasetId: str
    question: str
    expectedAnswer: str
    expectedContexts: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    createdAt: datetime

    model_config = ConfigDict(from_attributes=True)


class DatasetImportRequest(BaseModel):
    """Payload for batch import of dataset items."""

    items: List[DatasetItemCreate] = Field(..., min_length=1)


class DatasetImportResponse(BaseModel):
    """Result of batch import."""

    importedCount: int
    datasetId: str

