from typing import Any, Dict
from fastapi import APIRouter
from pydantic import BaseModel
from app.db.mongodb import mongodb_service

router = APIRouter(tags=["Health"])


class HealthResponse(BaseModel):
    status: str


class DetailedHealthResponse(BaseModel):
    status: str
    database: Dict[str, Any]


@router.get(
    "",
    response_model=HealthResponse,
    summary="Health check endpoint",
    description="Returns standard system health status",
)
async def health_check() -> Dict[str, str]:
    """Basic health check endpoint returning status ok."""
    return {"status": "ok"}


@router.get(
    "/details",
    response_model=DetailedHealthResponse,
    summary="Detailed health check",
    description="Returns system and database connectivity health status",
)
async def detailed_health_check() -> Dict[str, Any]:
    """Detailed health check including MongoDB connectivity."""
    db_health = await mongodb_service.check_health()
    overall_status = "ok" if db_health.get("connected") else "degraded"
    return {
        "status": overall_status,
        "database": db_health,
    }

