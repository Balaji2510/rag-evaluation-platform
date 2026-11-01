from typing import List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.db.mongodb import mongodb_service
from app.models.document import Document


class DocumentRepository:
    """Repository handling CRUD operations for uploaded project documents in MongoDB."""

    def __init__(self, db: Optional[AsyncIOMotorDatabase] = None) -> None:
        self._db = db

    @property
    def collection(self):
        db = self._db or mongodb_service.db
        if db is None:
            raise RuntimeError("Database connection has not been initialized.")
        return db["documents"]

    async def create(self, document: Document) -> Document:
        """Insert a new document record."""
        await self.collection.insert_one(document.to_mongo())
        return document

    async def get_by_id(self, document_id: str) -> Optional[Document]:
        """Fetch document by ID."""
        doc = await self.collection.find_one({"_id": document_id})
        return Document.from_mongo(doc) if doc else None

    async def list_by_project(self, project_id: str) -> List[Document]:
        """List all documents belonging to a project."""
        cursor = self.collection.find({"projectId": project_id}).sort("createdAt", -1)
        documents = []
        async for doc in cursor:
            documents.append(Document.from_mongo(doc))
        return documents

    async def delete(self, document_id: str) -> bool:
        """Delete document by ID."""
        res = await self.collection.delete_one({"_id": document_id})
        return res.deleted_count > 0

    async def count_by_project(self, project_id: str) -> int:
        """Count total documents in a project."""
        return await self.collection.count_documents({"projectId": project_id})
