from datetime import datetime, timezone
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.db.mongodb import mongodb_service
from app.models.document import InternalRAGConfig


class InternalRAGConfigRepository:
    """Repository managing Internal RAG and MongoDB Atlas Vector Search configuration per project."""

    def __init__(self, db: Optional[AsyncIOMotorDatabase] = None) -> None:
        self._db = db

    @property
    def collection(self):
        db = self._db or mongodb_service.db
        if db is None:
            raise RuntimeError("Database connection has not been initialized.")
        return db["internal_rag_configs"]

    async def get_or_create(self, project_id: str) -> InternalRAGConfig:
        """Fetch project Internal RAG configuration or initialize with defaults."""
        doc = await self.collection.find_one({"_id": project_id})
        if doc:
            return InternalRAGConfig.from_mongo(doc)

        # Default configuration
        default_config = InternalRAGConfig(
            projectId=project_id,
            chunkSize=1000,
            chunkOverlap=200,
            topK=4,
            indexName="vector_index",
            embeddingModel="text-embedding-004",
        )
        await self.collection.insert_one(default_config.to_mongo())
        return default_config

    async def update(self, config: InternalRAGConfig) -> InternalRAGConfig:
        """Update Internal RAG configuration."""
        config.updatedAt = datetime.now(timezone.utc)
        await self.collection.update_one(
            {"_id": config.projectId},
            {"$set": config.to_mongo()},
            upsert=True,
        )
        return config
