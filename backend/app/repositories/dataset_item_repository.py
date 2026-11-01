from typing import List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.db.mongodb import mongodb_service
from app.models.dataset_item import DatasetItem


class DatasetItemRepository:
    """Repository handling persistence for dataset evaluation items in MongoDB."""

    def __init__(self, db: Optional[AsyncIOMotorDatabase] = None) -> None:
        self._db = db

    @property
    def collection(self):
        db = self._db or mongodb_service.db
        if db is None:
            raise RuntimeError("Database connection has not been initialized.")
        return db["dataset_items"]

    async def ensure_indexes(self) -> None:
        """Create indexes on dataset_items collection."""
        await self.collection.create_index("datasetId")

    async def get_by_id(self, item_id: str) -> Optional[DatasetItem]:
        """Find dataset item by ID."""
        doc = await self.collection.find_one({"_id": item_id})
        if not doc:
            return None
        return DatasetItem.from_mongo(doc)

    async def list_by_dataset(self, dataset_id: str) -> List[DatasetItem]:
        """List all items in a dataset sorted by createdAt ascending."""
        cursor = self.collection.find({"datasetId": dataset_id}).sort("createdAt", 1)
        items = []
        async for doc in cursor:
            items.append(DatasetItem.from_mongo(doc))
        return items

    async def count_by_dataset(self, dataset_id: str) -> int:
        """Count evaluation items in a dataset."""
        return await self.collection.count_documents({"datasetId": dataset_id})

    async def create(self, item: DatasetItem) -> DatasetItem:
        """Insert a single evaluation question item."""
        await self.collection.insert_one(item.to_mongo())
        return item

    async def create_many(self, items: List[DatasetItem]) -> int:
        """Insert multiple dataset items in batch."""
        if not items:
            return 0
        docs = [item.to_mongo() for item in items]
        res = await self.collection.insert_many(docs)
        return len(res.inserted_ids)

    async def update(self, item_id: str, updates: dict) -> Optional[DatasetItem]:
        """Update an evaluation item by ID."""
        res = await self.collection.find_one_and_update(
            {"_id": item_id},
            {"$set": updates},
            return_document=True,
        )
        if not res:
            return None
        return DatasetItem.from_mongo(res)

    async def delete(self, item_id: str) -> bool:
        """Delete an item by ID."""
        result = await self.collection.delete_one({"_id": item_id})
        return result.deleted_count > 0

    async def delete_by_dataset(self, dataset_id: str) -> int:
        """Delete all items belonging to a dataset."""
        result = await self.collection.delete_many({"datasetId": dataset_id})
        return result.deleted_count

