from typing import Any, Dict, Optional
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.core.config import Settings, get_settings
from app.core.logging import get_logger

logger = get_logger("mongodb")


class MongoDB:
    """MongoDB connection manager and service."""

    def __init__(self) -> None:
        self.client: Optional[AsyncIOMotorClient] = None
        self.db: Optional[AsyncIOMotorDatabase] = None

    async def connect(self, settings: Optional[Settings] = None) -> None:
        """Initialize MongoDB client and connect to database."""
        if settings is None:
            settings = get_settings()

        try:
            logger.info("Connecting to MongoDB at %s...", settings.MONGODB_URI)
            self.client = AsyncIOMotorClient(
                settings.MONGODB_URI,
                serverSelectionTimeoutMS=5000,
            )
            self.db = self.client[settings.MONGODB_DATABASE]
            # Verify connectivity
            await self.client.admin.command("ping")
            logger.info("Successfully connected to MongoDB database: %s", settings.MONGODB_DATABASE)
        except Exception as exc:
            logger.warning(
                "Could not establish initial MongoDB connection: %s. "
                "The app will start, but database operations may fail until MongoDB is available.",
                exc,
            )

    async def disconnect(self) -> None:
        """Close MongoDB client connection."""
        if self.client:
            logger.info("Closing MongoDB connection...")
            self.client.close()
            self.client = None
            self.db = None
            logger.info("MongoDB connection closed.")

    async def check_health(self) -> Dict[str, Any]:
        """Check MongoDB database connectivity and status."""
        if not self.client:
            return {
                "status": "unhealthy",
                "connected": False,
                "error": "MongoDB client is not initialized",
            }
        try:
            # Send ping command with timeout
            await self.client.admin.command("ping")
            return {
                "status": "healthy",
                "connected": True,
                "database": self.db.name if self.db is not None else None,
            }
        except Exception as exc:
            logger.error("MongoDB health check failed: %s", exc)
            return {
                "status": "unhealthy",
                "connected": False,
                "error": str(exc),
            }


# Singleton instance
mongodb_service = MongoDB()


async def get_database() -> AsyncIOMotorDatabase:
    """Dependency for injecting MongoDB database instance into route handlers."""
    if mongodb_service.db is None:
        raise RuntimeError("Database connection has not been initialized.")
    return mongodb_service.db

