from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class ProjectCreate(BaseModel):
    """Payload for creating a project."""

    name: str = Field(..., min_length=1, max_length=120, description="Project name")
    description: Optional[str] = Field(default="", max_length=1000, description="Project description")


class ProjectUpdate(BaseModel):
    """Payload for updating an existing project."""

    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    description: Optional[str] = Field(default=None, max_length=1000)


class ProjectResponse(BaseModel):
    """Project representation response."""

    id: str
    userId: str
    name: str
    description: Optional[str] = ""
    createdAt: datetime
    updatedAt: datetime
    datasetCount: Optional[int] = 0

    model_config = ConfigDict(from_attributes=True)

