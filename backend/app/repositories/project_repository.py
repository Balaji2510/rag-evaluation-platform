from typing import List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.db.mongodb import mongodb_service
from app.models.project import Project


class ProjectRepository:
    """Repository handling persistence for projects in MongoDB."""

    def __init__(self, db: Optional[AsyncIOMotorDatabase] = None) -> None:
        self._db = db

    @property
    def collection(self):
        db = self._db or mongodb_service.db
        if db is None:
            raise RuntimeError("Database connection has not been initialized.")
        return db["projects"]

    async def ensure_indexes(self) -> None:
        """Create indexes on projects collection."""
        await self.collection.create_index("userId")

    async def get_by_id(self, project_id: str) -> Optional[Project]:
        """Find project by ID."""
        doc = await self.collection.find_one({"_id": project_id})
        if not doc:
            return None
        return Project.from_mongo(doc)

    async def list_by_user(self, user_id: str) -> List[Project]:
        """List all projects belonging to user sorted by updatedAt descending."""
        cursor = self.collection.find({"userId": user_id}).sort("updatedAt", -1)
        projects = []
        async for doc in cursor:
            projects.append(Project.from_mongo(doc))
        return projects

    async def create(self, project: Project) -> Project:
        """Insert a new project."""
        await self.collection.insert_one(project.to_mongo())
        return project

    async def update(self, project_id: str, updates: dict) -> Optional[Project]:
        """Update an existing project by ID."""
        res = await self.collection.find_one_and_update(
            {"_id": project_id},
            {"$set": updates},
            return_document=True,
        )
        if not res:
            return None
        return Project.from_mongo(res)

    async def delete(self, project_id: str) -> bool:
        """Delete project by ID."""
        result = await self.collection.delete_one({"_id": project_id})
        return result.deleted_count > 0

