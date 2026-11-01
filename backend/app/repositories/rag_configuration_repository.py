from typing import List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.db.mongodb import mongodb_service
from app.models.rag_configuration import RAGConfiguration


class RAGConfigurationRepository:
    """Repository handling persistence for rag_configurations in MongoDB."""

    def __init__(self, db: Optional[AsyncIOMotorDatabase] = None) -> None:
        self._db = db

    @property
    def collection(self):
        db = self._db or mongodb_service.db
        if db is None:
            raise RuntimeError("Database connection has not been initialized.")
        return db["rag_configurations"]

    async def ensure_indexes(self) -> None:
        """Create indexes on rag_configurations collection."""
        await self.collection.create_index("projectId")

    async def get_by_id(self, config_id: str) -> Optional[RAGConfiguration]:
        """Find RAG configuration by ID."""
        doc = await self.collection.find_one({"_id": config_id})
        if not doc:
            return None
        return RAGConfiguration.from_mongo(doc)

    async def list_by_project(self, project_id: str) -> List[RAGConfiguration]:
        """List all configurations under a specific project."""
        cursor = self.collection.find({"projectId": project_id}).sort("updatedAt", -1)
        configs = []
        async for doc in cursor:
            configs.append(RAGConfiguration.from_mongo(doc))
        return configs

    async def list_by_projects(self, project_ids: List[str]) -> List[RAGConfiguration]:
        """List all configurations belonging to a list of project IDs."""
        if not project_ids:
            return []
        cursor = self.collection.find({"projectId": {"$in": project_ids}}).sort("updatedAt", -1)
        configs = []
        async for doc in cursor:
            configs.append(RAGConfiguration.from_mongo(doc))
        return configs

    async def create(self, config: RAGConfiguration) -> RAGConfiguration:
        """Insert new RAG configuration."""
        await self.collection.insert_one(config.to_mongo())
        return config

    async def update(self, config_id: str, updates: dict) -> Optional[RAGConfiguration]:
        """Update RAG configuration by ID."""
        res = await self.collection.find_one_and_update(
            {"_id": config_id},
            {"$set": updates},
            return_document=True,
        )
        if not res:
            return None
        return RAGConfiguration.from_mongo(res)

    async def delete(self, config_id: str) -> bool:
        """Delete configuration by ID."""
        result = await self.collection.delete_one({"_id": config_id})
        return result.deleted_count > 0

    async def delete_by_project(self, project_id: str) -> int:
        """Delete all configurations belonging to a project."""
        result = await self.collection.delete_many({"projectId": project_id})
        return result.deleted_count

