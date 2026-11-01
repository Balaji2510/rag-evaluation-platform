from typing import Any, Dict, List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.db.mongodb import mongodb_service
from app.models.evaluation import EvaluationResult, EvaluationRun


class EvaluationRunRepository:
    """Repository handling persistence for evaluation_runs in MongoDB."""

    def __init__(self, db: Optional[AsyncIOMotorDatabase] = None) -> None:
        self._db = db

    @property
    def collection(self):
        db = self._db or mongodb_service.db
        if db is None:
            raise RuntimeError("Database connection has not been initialized.")
        return db["evaluation_runs"]

    async def ensure_indexes(self) -> None:
        """Create indexes on evaluation_runs collection."""
        await self.collection.create_index("userId")
        await self.collection.create_index("projectId")
        await self.collection.create_index("status")
        await self.collection.create_index("createdAt")

    async def get_by_id(self, run_id: str) -> Optional[EvaluationRun]:
        """Find evaluation run by ID."""
        doc = await self.collection.find_one({"_id": run_id})
        if not doc:
            return None
        return EvaluationRun.from_mongo(doc)

    async def list_by_user(
        self, user_id: str, project_id: Optional[str] = None
    ) -> List[EvaluationRun]:
        """List evaluation runs for a user, optionally filtered by project."""
        query: Dict[str, Any] = {"userId": user_id}
        if project_id:
            query["projectId"] = project_id

        cursor = self.collection.find(query).sort("createdAt", -1)
        runs = []
        async for doc in cursor:
            runs.append(EvaluationRun.from_mongo(doc))
        return runs

    async def create(self, run: EvaluationRun) -> EvaluationRun:
        """Insert new evaluation run."""
        await self.collection.insert_one(run.to_mongo())
        return run

    async def update(self, run_id: str, updates: Dict[str, Any]) -> Optional[EvaluationRun]:
        """Update evaluation run by ID."""
        res = await self.collection.find_one_and_update(
            {"_id": run_id},
            {"$set": updates},
            return_document=True,
        )
        if not res:
            return None
        return EvaluationRun.from_mongo(res)

    async def delete(self, run_id: str) -> bool:
        """Delete an evaluation run."""
        result = await self.collection.delete_one({"_id": run_id})
        return result.deleted_count > 0


class EvaluationResultRepository:
    """Repository handling persistence for evaluation_results in MongoDB."""

    def __init__(self, db: Optional[AsyncIOMotorDatabase] = None) -> None:
        self._db = db

    @property
    def collection(self):
        db = self._db or mongodb_service.db
        if db is None:
            raise RuntimeError("Database connection has not been initialized.")
        return db["evaluation_results"]

    async def ensure_indexes(self) -> None:
        """Create indexes on evaluation_results collection."""
        await self.collection.create_index("runId")
        await self.collection.create_index("createdAt")

    async def create(self, result: EvaluationResult) -> EvaluationResult:
        """Insert new evaluation question result."""
        await self.collection.insert_one(result.to_mongo())
        return result

    async def get_by_id(self, result_id: str) -> Optional[EvaluationResult]:
        """Find evaluation result by ID."""
        doc = await self.collection.find_one({"_id": result_id})
        if not doc:
            return None
        return EvaluationResult.from_mongo(doc)

    async def list_by_run_id(self, run_id: str) -> List[EvaluationResult]:
        """List all question results for an evaluation run in chronological order."""
        cursor = self.collection.find({"runId": run_id}).sort("createdAt", 1)
        results = []
        async for doc in cursor:
            results.append(EvaluationResult.from_mongo(doc))
        return results

    async def delete_by_run_id(self, run_id: str) -> int:
        """Delete all evaluation results associated with a run."""
        result = await self.collection.delete_many({"runId": run_id})
        return result.deleted_count

