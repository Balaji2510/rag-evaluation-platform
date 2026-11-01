from typing import List
from fastapi import APIRouter, Depends, File, UploadFile, status

from app.api.deps import get_current_user, get_internal_rag_service
from app.core.exceptions import AppException
from app.schemas.auth import UserResponse
from app.schemas.document import (
    DocumentDetailResponse,
    DocumentResponse,
    InternalRAGConfigResponse,
    InternalRAGConfigUpdate,
    InternalRAGQueryRequest,
    InternalRAGQueryResponse,
)
from app.services.internal_rag_service import InternalRAGService

router = APIRouter(tags=["internal-rag"])


@router.post(
    "/{projectId}/documents",
    response_model=DocumentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload and index a document into MongoDB Atlas Vector Search",
)
async def upload_document(
    projectId: str,
    file: UploadFile = File(...),
    current_user: UserResponse = Depends(get_current_user),
    rag_service: InternalRAGService = Depends(get_internal_rag_service),
) -> DocumentResponse:
    """Upload PDF, TXT, Markdown, or JSON file, chunk it, generate Gemini embeddings, and index into Atlas Vector Search."""
    filename = file.filename or "uploaded_document"
    content_type = file.content_type or "application/octet-stream"

    # Read binary bytes
    file_bytes = await file.read()
    if not file_bytes:
        raise AppException("Uploaded file is empty", status_code=400)

    # Process and index
    doc = await rag_service.upload_and_process_document(
        user_id=current_user.id,
        project_id=projectId,
        filename=filename,
        content_type=content_type,
        file_bytes=file_bytes,
    )
    return DocumentResponse(
        id=doc.id,
        projectId=doc.projectId,
        filename=doc.filename,
        contentType=doc.contentType,
        metadata=doc.metadata,
        createdAt=doc.createdAt,
    )


@router.get(
    "/{projectId}/documents",
    response_model=List[DocumentDetailResponse],
    status_code=status.HTTP_200_OK,
    summary="List all documents uploaded to a project",
)
async def list_documents(
    projectId: str,
    current_user: UserResponse = Depends(get_current_user),
    rag_service: InternalRAGService = Depends(get_internal_rag_service),
) -> List[DocumentDetailResponse]:
    """List documents in project with chunk counts and parsing metadata."""
    docs = await rag_service.list_documents(user_id=current_user.id, project_id=projectId)
    return [
        DocumentDetailResponse(
            id=d.id,
            projectId=d.projectId,
            filename=d.filename,
            contentType=d.contentType,
            metadata=d.metadata,
            createdAt=d.createdAt,
            chunkCount=int(d.metadata.get("chunkCount", 0)),
        )
        for d in docs
    ]


@router.get(
    "/{projectId}/documents/{documentId}",
    response_model=DocumentDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Get single document details",
)
async def get_document(
    projectId: str,
    documentId: str,
    current_user: UserResponse = Depends(get_current_user),
    rag_service: InternalRAGService = Depends(get_internal_rag_service),
) -> DocumentDetailResponse:
    """Get single document details by ID."""
    doc = await rag_service.get_document(
        user_id=current_user.id,
        project_id=projectId,
        document_id=documentId,
    )
    return DocumentDetailResponse(
        id=doc.id,
        projectId=doc.projectId,
        filename=doc.filename,
        contentType=doc.contentType,
        metadata=doc.metadata,
        createdAt=doc.createdAt,
        chunkCount=int(doc.metadata.get("chunkCount", 0)),
    )


@router.delete(
    "/{projectId}/documents/{documentId}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete document and its indexed vector chunks",
)
async def delete_document(
    projectId: str,
    documentId: str,
    current_user: UserResponse = Depends(get_current_user),
    rag_service: InternalRAGService = Depends(get_internal_rag_service),
) -> None:
    """Delete document and all its chunks from MongoDB."""
    await rag_service.delete_document(
        user_id=current_user.id,
        project_id=projectId,
        document_id=documentId,
    )


@router.get(
    "/{projectId}/rag-settings",
    response_model=InternalRAGConfigResponse,
    status_code=status.HTTP_200_OK,
    summary="Get project Internal RAG & Atlas Vector Search settings",
)
async def get_rag_settings(
    projectId: str,
    current_user: UserResponse = Depends(get_current_user),
    rag_service: InternalRAGService = Depends(get_internal_rag_service),
) -> InternalRAGConfigResponse:
    """Get chunkSize, chunkOverlap, and topK configuration."""
    cfg = await rag_service.get_rag_settings(user_id=current_user.id, project_id=projectId)
    return InternalRAGConfigResponse(
        projectId=cfg.projectId,
        chunkSize=cfg.chunkSize,
        chunkOverlap=cfg.chunkOverlap,
        topK=cfg.topK,
        indexName=cfg.indexName,
        embeddingModel=cfg.embeddingModel,
    )


@router.put(
    "/{projectId}/rag-settings",
    response_model=InternalRAGConfigResponse,
    status_code=status.HTTP_200_OK,
    summary="Update project Internal RAG settings (chunkSize, chunkOverlap, topK)",
)
async def update_rag_settings(
    projectId: str,
    payload: InternalRAGConfigUpdate,
    current_user: UserResponse = Depends(get_current_user),
    rag_service: InternalRAGService = Depends(get_internal_rag_service),
) -> InternalRAGConfigResponse:
    """Update internal RAG parameters."""
    cfg = await rag_service.update_rag_settings(
        user_id=current_user.id,
        project_id=projectId,
        chunk_size=payload.chunkSize,
        chunk_overlap=payload.chunkOverlap,
        top_k=payload.topK,
    )
    return InternalRAGConfigResponse(
        projectId=cfg.projectId,
        chunkSize=cfg.chunkSize,
        chunkOverlap=cfg.chunkOverlap,
        topK=cfg.topK,
        indexName=cfg.indexName,
        embeddingModel=cfg.embeddingModel,
    )


@router.post(
    "/{projectId}/query",
    response_model=InternalRAGQueryResponse,
    status_code=status.HTTP_200_OK,
    summary="Query the internal RAG pipeline directly",
)
async def query_internal_rag(
    projectId: str,
    payload: InternalRAGQueryRequest,
    current_user: UserResponse = Depends(get_current_user),
    rag_service: InternalRAGService = Depends(get_internal_rag_service),
) -> InternalRAGQueryResponse:
    """Execute vector retrieval and generate grounded response using Gemini."""
    # Verify user has access to project
    await rag_service.get_rag_settings(user_id=current_user.id, project_id=projectId)

    result = await rag_service.query(
        project_id=projectId,
        question=payload.question,
    )
    return InternalRAGQueryResponse(
        answer=result.get("answer", ""),
        contexts=result.get("contexts", []),
    )

