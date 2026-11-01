from contextlib import asynccontextmanager
from typing import AsyncGenerator
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import Settings, get_settings
from app.core.exceptions import (
    AppException,
    app_exception_handler,
    unhandled_exception_handler,
)
from app.core.logging import get_logger, setup_logging
from app.db.mongodb import mongodb_service
from app.repositories.dataset_item_repository import DatasetItemRepository
from app.repositories.dataset_repository import DatasetRepository
from app.repositories.project_repository import ProjectRepository
from app.repositories.rag_configuration_repository import RAGConfigurationRepository
from app.repositories.evaluation_repository import (
    EvaluationResultRepository,
    EvaluationRunRepository,
)
from app.repositories.user_repository import UserRepository

logger = get_logger("main")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan manager for startup and shutdown events."""
    settings: Settings = get_settings()

    # Startup
    setup_logging(debug=settings.DEBUG)
    logger.info("Starting %s in %s mode...", settings.APP_NAME, settings.APP_ENV)
    await mongodb_service.connect(settings)

    if mongodb_service.client is not None:
        try:
            await UserRepository().ensure_indexes()
            await ProjectRepository().ensure_indexes()
            await DatasetRepository().ensure_indexes()
            await DatasetItemRepository().ensure_indexes()
            await RAGConfigurationRepository().ensure_indexes()
            await EvaluationRunRepository().ensure_indexes()
            await EvaluationResultRepository().ensure_indexes()
            logger.info("Database collections and indexes ensured successfully.")
        except Exception as exc:
            logger.warning("Could not ensure database indexes: %s", exc)

    yield

    # Shutdown
    logger.info("Shutting down %s...", settings.APP_NAME)
    await mongodb_service.disconnect()


def create_app() -> FastAPI:
    """Application factory for RAG Evaluation Platform API."""
    settings: Settings = get_settings()

    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        debug=settings.DEBUG,
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
    )

    # Configure CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Register Exception Handlers
    app.add_exception_handler(AppException, app_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)

    # Register API Routers
    app.include_router(api_router, prefix=settings.API_PREFIX)

    @app.get("/", tags=["Root"])
    async def root():
        return {
            "name": settings.APP_NAME,
            "version": settings.APP_VERSION,
            "environment": settings.APP_ENV,
            "docs": "/docs",
            "health": f"{settings.API_PREFIX}/health",
            "auth": {
                "register": f"{settings.API_PREFIX}/auth/register",
                "login": f"{settings.API_PREFIX}/auth/login",
                "me": f"{settings.API_PREFIX}/auth/me",
            },
            "projects": f"{settings.API_PREFIX}/projects",
            "ragConfigurations": f"{settings.API_PREFIX}/rag-configurations",
        }

    return app


app = create_app()

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
