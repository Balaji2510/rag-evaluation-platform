import math
from typing import Any, Dict, List, Optional, Tuple
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo.errors import OperationFailure
from app.core.logging import get_logger
from app.db.mongodb import mongodb_service
from app.models.document import DocumentChunk

logger = get_logger("document_chunk_repository")


def cosine_similarity(v1: List[float], v2: List[float]) -> float:
    """Compute cosine similarity between two numeric vectors."""
    if not v1 or not v2 or len(v1) != len(v2):
        return 0.0

    dot = sum(a * b for a, b in zip(v1, v2))
    norm_a = math.sqrt(sum(a * a for a in v1))
    norm_b = math.sqrt(sum(b * b for b in v2))

    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0

    return dot / (norm_a * norm_b)


class DocumentChunkRepository:
    """Repository handling persistence, indexing, and vector similarity search for document chunks."""

    def __init__(self, db: Optional[AsyncIOMotorDatabase] = None) -> None:
        self._db = db

    @property
    def collection(self):
        db = self._db or mongodb_service.db
        if db is None:
            raise RuntimeError("Database connection has not been initialized.")
        return db["document_chunks"]

    async def create_many(self, chunks: List[DocumentChunk]) -> int:
        """Insert a batch of document chunks."""
        if not chunks:
            return 0
        docs = [c.to_mongo() for c in chunks]
        res = await self.collection.insert_many(docs)
        return len(res.inserted_ids)

    async def list_by_document(self, document_id: str) -> List[DocumentChunk]:
        """Retrieve all chunks belonging to a document."""
        cursor = self.collection.find({"documentId": document_id}).sort("metadata.chunkIndex", 1)
        chunks = []
        async for doc in cursor:
            chunks.append(DocumentChunk.from_mongo(doc))
        return chunks

    async def delete_by_document(self, document_id: str) -> int:
        """Delete all chunks belonging to a document."""
        res = await self.collection.delete_many({"documentId": document_id})
        return res.deleted_count

    async def delete_by_project(self, project_id: str) -> int:
        """Delete all chunks belonging to a project."""
        res = await self.collection.delete_many({"projectId": project_id})
        return res.deleted_count

    async def count_by_document(self, document_id: str) -> int:
        """Count chunks belonging to a document."""
        return await self.collection.count_documents({"documentId": document_id})

    async def count_by_project(self, project_id: str) -> int:
        """Count chunks belonging to a project."""
        return await self.collection.count_documents({"projectId": project_id})

    async def vector_search(
        self,
        project_id: str,
        query_embedding: List[float],
        top_k: int = 4,
        index_name: str = "vector_index",
    ) -> List[Tuple[DocumentChunk, float]]:
        """Perform vector search on MongoDB Atlas with local cosine similarity fallback."""
        if not query_embedding:
            return []

        # 1. Attempt MongoDB Atlas $vectorSearch pipeline
        try:
            pipeline = [
                {
                    "$vectorSearch": {
                        "index": index_name,
                        "path": "embedding",
                        "queryVector": query_embedding,
                        "numCandidates": max(top_k * 10, 20),
                        "limit": top_k,
                        "filter": {"projectId": project_id},
                    }
                },
                {
                    "$project": {
                        "_id": 1,
                        "documentId": 1,
                        "projectId": 1,
                        "content": 1,
                        "embedding": 1,
                        "metadata": 1,
                        "createdAt": 1,
                        "score": {"$meta": "vectorSearchScore"},
                    }
                },
            ]

            results: List[Tuple[DocumentChunk, float]] = []
            cursor = self.collection.aggregate(pipeline)
            async for doc in cursor:
                score = float(doc.get("score", 0.0))
                chunk = DocumentChunk.from_mongo(doc)
                results.append((chunk, score))

            if results:
                return results

        except OperationFailure as exc:
            logger.info(
                "MongoDB Atlas $vectorSearch not supported on this instance or index pending (%s). Falling back to in-memory cosine similarity.",
                exc,
            )
        except Exception as exc:
            logger.debug(
                "Vector search stage encountered %s. Proceeding with fallback.",
                exc,
            )

        # 2. Local Fallback: Fetch project chunks and calculate exact cosine similarity
        cursor = self.collection.find({"projectId": project_id})
        scored_chunks: List[Tuple[DocumentChunk, float]] = []

        async for doc in cursor:
            chunk = DocumentChunk.from_mongo(doc)
            if chunk.embedding:
                sim = cosine_similarity(query_embedding, chunk.embedding)
                scored_chunks.append((chunk, sim))

        # Sort descending by similarity score
        scored_chunks.sort(key=lambda item: item[1], reverse=True)
        return scored_chunks[:top_k]
