from app.api.v1.auth import router as auth_router
from app.api.v1.datasets import router as datasets_router
from app.api.v1.health import router as health_router
from app.api.v1.projects import router as projects_router
from app.api.v1.rag_configurations import router as rag_configurations_router
from app.api.v1.evaluations import router as evaluations_router

__all__ = [
    "auth_router",
    "health_router",
    "projects_router",
    "datasets_router",
    "rag_configurations_router",
    "evaluations_router",
]
