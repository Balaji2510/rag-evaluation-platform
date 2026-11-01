from typing import List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.db.mongodb import mongodb_service
from app.models.dataset import Dataset


class DatasetRepository:
    """Repository handling persistence for datasets in MongoDB."""

    def __init__(self, db: Optional[AsyncIOMotorDatabase] = None) -> None:
        self._db = db

    @property
    def collection(self):
        db = self._db or mongodb_service.db
        if db is None:
            raise RuntimeError("Database connection has not been initialized.")
        return db["datasets"]

    async def ensure_indexes(self) -> None:
        """Create indexes on datasets collection."""
        await self.collection.create_index("projectId")

    async def get_by_id(self, dataset_id: str) -> Optional[Dataset]:
        """Find dataset by ID."""
        doc = await self.collection.find_one({"_id": dataset_id})
        if not doc:
            return None
        return Dataset.from_mongo(doc)

    async def list_by_project(self, project_id: str) -> List[Dataset]:
        """List all datasets in a project sorted by updatedAt descending."""
        cursor = self.collection.find({"projectId": project_id}).sort("updatedAt", -1)
        datasets = []
        async for doc in cursor:
            datasets.append(Dataset.from_mongo(doc))
        return datasets

    async def count_by_project(self, project_id: str) -> int:
        """Count datasets belonging to a project."""
        return await self.collection.count_documents({"projectId": project_id})

    async def create(self, dataset: Dataset) -> Dataset:
        """Insert a new dataset."""
        await self.collection.insert_one(dataset.to_mongo())
        return dataset

    async def update(self, dataset_id: str, updates: dict) -> Optional[Dataset]:
        """Update an existing dataset by ID."""
        res = await self.collection.find_one_and_update(
            {"_id": dataset_id},
            {"$set": updates},
            return_document=True,
        )
        if not res:
            return None
        return Dataset.from_mongo(res)

    async def delete(self, dataset_id: str) -> bool:
        """Delete dataset by ID."""
        result = await self.collection.delete_one({"_id": dataset_id})
        return result.deleted_count > 0

    async def delete_by_project(self, project_id: str) -> int:
        """Delete all datasets belonging to a project."""
        result = await self.collection.delete_many({"projectId": project_id})
        return result.deleted_count

