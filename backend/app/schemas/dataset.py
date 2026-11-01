from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field
from app.schemas.dataset_item import DatasetItemResponse


class DatasetCreate(BaseModel):
    """Payload for creating a dataset."""

    name: str = Field(..., min_length=1, max_length=120, description="Dataset name")
    description: Optional[str] = Field(default="", max_length=1000, description="Dataset description")


class DatasetUpdate(BaseModel):
    """Payload for updating a dataset."""

    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    description: Optional[str] = Field(default=None, max_length=1000)


class DatasetResponse(BaseModel):
    """Dataset basic response."""

    id: str
    projectId: str
    name: str
    description: Optional[str] = ""
    createdAt: datetime
    updatedAt: datetime
    itemCount: Optional[int] = 0

    model_config = ConfigDict(from_attributes=True)


class DatasetDetailResponse(DatasetResponse):
    """Dataset detailed response including evaluation items."""

    items: List[DatasetItemResponse] = Field(default_factory=list)

