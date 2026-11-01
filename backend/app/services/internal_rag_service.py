from datetime import datetime, timezone
import hashlib
import math
from typing import Any, Dict, List, Optional, Tuple
import uuid

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_text_splitters import RecursiveCharacterTextSplitter

from app.core.config import get_settings
from app.core.exceptions import AppException, EntityNotFoundError
from app.core.logging import get_logger
from app.models.document import Document, DocumentChunk, InternalRAGConfig
from app.repositories.document_chunk_repository import DocumentChunkRepository
from app.repositories.document_repository import DocumentRepository
from app.repositories.internal_rag_config_repository import InternalRAGConfigRepository
from app.repositories.project_repository import ProjectRepository
from app.services.document_loader import DocumentLoaderService

logger = get_logger("internal_rag_service")


def generate_deterministic_test_embedding(text: str, dim: int = 768) -> List[float]:
    """Generate a deterministic normalized unit vector for offline/test environments."""
    # Seeded hash-based vector
    vector = []
    base_hash = hashlib.sha256(text.encode("utf-8")).digest()
    for i in range(dim):
        byte_val = base_hash[i % len(base_hash)]
        val = (byte_val / 255.0) * 2.0 - 1.0 + (i * 0.001)
        vector.append(val)

    # Normalize vector to unit length
    norm = math.sqrt(sum(x * x for x in vector)) or 1.0
    return [x / norm for x in vector]


class InternalRAGService:
    """End-to-end Internal RAG pipeline orchestrator with LangChain, Gemini, and MongoDB Atlas Vector Search."""

    def __init__(
        self,
        doc_repo: Optional[DocumentRepository] = None,
        chunk_repo: Optional[DocumentChunkRepository] = None,
        config_repo: Optional[InternalRAGConfigRepository] = None,
        project_repo: Optional[ProjectRepository] = None,
    ) -> None:
        self.doc_repo = doc_repo or DocumentRepository()
        self.chunk_repo = chunk_repo or DocumentChunkRepository()
        self.config_repo = config_repo or InternalRAGConfigRepository()
        self.project_repo = project_repo or ProjectRepository()

    def _get_embeddings_model(self):
        """Retrieve LangChain GoogleGenerativeAIEmbeddings instance if API key is present."""
        settings = get_settings()
        api_key = settings.GEMINI_API_KEY
        if not api_key:
            return None

        try:
            from langchain_google_genai import GoogleGenerativeAIEmbeddings

            return GoogleGenerativeAIEmbeddings(
                model="models/gemini-embedding-001",
                google_api_key=api_key,
            )
        except Exception as exc:
            logger.warning("Could not initialize GoogleGenerativeAIEmbeddings: %s", exc)
            return None

    def _get_chat_llm(self):
        """Retrieve LangChain ChatGoogleGenerativeAI model instance if API key is present."""
        settings = get_settings()
        api_key = settings.GEMINI_API_KEY
        if not api_key:
            return None

        try:
            from langchain_google_genai import ChatGoogleGenerativeAI

            settings = get_settings()
            return ChatGoogleGenerativeAI(
                model=settings.GEMINI_MODEL or "gemini-3.5-flash-lite",
                google_api_key=api_key,
                temperature=0.0,
            )
        except Exception as exc:
            logger.warning("Could not initialize ChatGoogleGenerativeAI: %s", exc)
            return None

    async def generate_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Generate vector embeddings using Gemini API with deterministic fallback for tests."""
        if not texts:
            return []

        embeddings_model = self._get_embeddings_model()
        if embeddings_model:
            try:
                return await embeddings_model.aembed_documents(texts)
            except Exception as exc:
                logger.warning("Gemini embeddings API call failed (%s); using deterministic vector representation.", exc)

        # Fallback for offline testing or when API key is not configured
        return [generate_deterministic_test_embedding(t) for t in texts]

    async def generate_query_embedding(self, query: str) -> List[float]:
        """Generate embedding for a search query."""
        embeddings_model = self._get_embeddings_model()
        if embeddings_model:
            try:
                return await embeddings_model.aembed_query(query)
            except Exception as exc:
                logger.warning("Gemini query embedding call failed (%s); using fallback.", exc)

        return generate_deterministic_test_embedding(query)

    async def upload_and_process_document(
        self,
        user_id: str,
        project_id: str,
        filename: str,
        content_type: str,
        file_bytes: bytes,
    ) -> Document:
        """Process document through Loader -> Text Splitter -> Gemini Embeddings -> Vector Store."""
        # 1. Project ownership check
        project = await self.project_repo.get_by_id(project_id)
        if not project:
            raise EntityNotFoundError(f"Project not found", details={"projectId": project_id})
        if project.userId != user_id:
            raise AppException("You do not have access to this project", status_code=403)

        # 2. Extract text with DocumentLoaderService
        extracted_text, metadata = DocumentLoaderService.extract_text(
            filename=filename,
            content_type=content_type,
            file_bytes=file_bytes,
        )

        if not extracted_text.strip():
            raise AppException("Document contains no text content", status_code=400)

        # 3. Retrieve internal RAG configuration for chunking parameters
        config = await self.config_repo.get_or_create(project_id)

        # 4. Split text into chunks using LangChain RecursiveCharacterTextSplitter
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=config.chunkSize,
            chunk_overlap=config.chunkOverlap,
            length_function=len,
            is_separator_regex=False,
        )
        text_chunks = splitter.split_text(extracted_text)

        if not text_chunks:
            text_chunks = [extracted_text]

        # 5. Generate embeddings with Gemini
        chunk_embeddings = await self.generate_embeddings(text_chunks)

        # 6. Save Document metadata record
        doc_id = str(uuid.uuid4())
        doc_metadata = {
            **metadata,
            "chunkCount": len(text_chunks),
            "charLength": len(extracted_text),
            "chunkSize": config.chunkSize,
            "chunkOverlap": config.chunkOverlap,
        }

        document = Document(
            id=doc_id,
            projectId=project_id,
            filename=filename,
            contentType=content_type,
            metadata=doc_metadata,
            createdAt=datetime.now(timezone.utc),
        )
        await self.doc_repo.create(document)

        # 7. Persist DocumentChunk records in MongoDB
        chunks: List[DocumentChunk] = []
        for idx, (chunk_text, embedding) in enumerate(zip(text_chunks, chunk_embeddings)):
            chunk = DocumentChunk(
                id=str(uuid.uuid4()),
                documentId=doc_id,
                projectId=project_id,
                content=chunk_text,
                embedding=embedding,
                metadata={
                    "filename": filename,
                    "chunkIndex": idx,
                    "totalChunks": len(text_chunks),
                },
                createdAt=datetime.now(timezone.utc),
            )
            chunks.append(chunk)

        await self.chunk_repo.create_many(chunks)
        logger.info(
            "Successfully indexed document %s (ID: %s) into %d chunks for project %s",
            filename,
            doc_id,
            len(chunks),
            project_id,
        )
        return document

    async def list_documents(self, user_id: str, project_id: str) -> List[Document]:
        """List documents in a project."""
        project = await self.project_repo.get_by_id(project_id)
        if not project:
            raise EntityNotFoundError("Project not found", details={"projectId": project_id})
        if project.userId != user_id:
            raise AppException("You do not have access to this project", status_code=403)

        return await self.doc_repo.list_by_project(project_id)

    async def get_document(self, user_id: str, project_id: str, document_id: str) -> Document:
        """Get single document details."""
        doc = await self.doc_repo.get_by_id(document_id)
        if not doc or doc.projectId != project_id:
            raise EntityNotFoundError("Document not found", details={"documentId": document_id})

        project = await self.project_repo.get_by_id(project_id)
        if not project or project.userId != user_id:
            raise AppException("You do not have access to this document", status_code=403)

        return doc

    async def delete_document(self, user_id: str, project_id: str, document_id: str) -> bool:
        """Delete document and all associated chunks."""
        doc = await self.get_document(user_id, project_id, document_id)
        # Delete chunks first
        await self.chunk_repo.delete_by_document(document_id)
        # Delete document record
        return await self.doc_repo.delete(document_id)

    async def get_rag_settings(self, user_id: str, project_id: str) -> InternalRAGConfig:
        """Fetch project-level internal RAG configuration."""
        project = await self.project_repo.get_by_id(project_id)
        if not project:
            raise EntityNotFoundError("Project not found")
        if project.userId != user_id:
            raise AppException("You do not have access to this project", status_code=403)

        return await self.config_repo.get_or_create(project_id)

    async def update_rag_settings(
        self,
        user_id: str,
        project_id: str,
        chunk_size: Optional[int] = None,
        chunk_overlap: Optional[int] = None,
        top_k: Optional[int] = None,
    ) -> InternalRAGConfig:
        """Update internal RAG settings for a project."""
        config = await self.get_rag_settings(user_id, project_id)
        if chunk_size is not None:
            config.chunkSize = chunk_size
        if chunk_overlap is not None:
            config.chunkOverlap = chunk_overlap
        if top_k is not None:
            config.topK = top_k

        return await self.config_repo.update(config)

    async def query(
        self,
        project_id: str,
        question: str,
        top_k: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Execute full internal RAG pipeline: Embedding -> Vector Search -> Context Assembly -> Gemini LLM."""
        # 1. Fetch project configuration
        config = await self.config_repo.get_or_create(project_id)
        effective_top_k = top_k or config.topK

        # 2. Embed the search query
        query_vector = await self.generate_query_embedding(question)

        # 3. Vector search over MongoDB chunks
        scored_chunks = await self.chunk_repo.vector_search(
            project_id=project_id,
            query_embedding=query_vector,
            top_k=effective_top_k,
            index_name=config.indexName,
        )

        contexts: List[str] = [chunk.content for chunk, score in scored_chunks]

        if not contexts:
            return {
                "answer": "I don't have enough information in the provided documents to answer that reliably.",
                "contexts": [],
            }

        # 4. Assemble context block
        context_block = "\n\n---\n\n".join(contexts)

        # 5. Invoke Gemini LLM with context-grounded prompt
        llm = self._get_chat_llm()
        if llm:
            try:
                system_prompt = (
                    "You are a factual assistant. Answer the user's question based strictly on the provided context passages. "
                    "If the answer cannot be determined from the context, state: 'I don't have enough information in the provided documents to answer that reliably.' "
                    "Do not make up facts or extrapolate beyond what is stated."
                )
                user_prompt = f"Context passages:\n{context_block}\n\nQuestion:\n{question}"

                messages = [
                    SystemMessage(content=system_prompt),
                    HumanMessage(content=user_prompt),
                ]
                response = await llm.ainvoke(messages)
                raw_content = response.content
                if isinstance(raw_content, str):
                    answer = raw_content.strip()
                elif isinstance(raw_content, list):
                    text_parts = []
                    for block in raw_content:
                        if isinstance(block, dict) and "text" in block:
                            text_parts.append(str(block["text"]))
                        elif isinstance(block, str):
                            text_parts.append(block)
                        else:
                            text_parts.append(str(block))
                    answer = "\n".join(text_parts).strip()
                else:
                    answer = str(raw_content).strip()

                return {
                    "answer": answer,
                    "contexts": contexts,
                }
            except Exception as exc:
                logger.warning("Gemini LLM invocation failed (%s); providing grounded fallback answer.", exc)

        # Deterministic context-grounded fallback for test environments
        best_passage = contexts[0].strip()
        answer = f"Based on the project documents: {best_passage[:240]}"
        if len(best_passage) > 240:
            answer += "..."

        return {
            "answer": answer,
            "contexts": contexts,
        }

