from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from app.api.deps import get_current_user, get_rag_configuration_service
from app.schemas.auth import UserResponse
from app.schemas.rag_configuration import (
    RAGConfigurationCreate,
    RAGConfigurationResponse,
    RAGConfigurationUpdate,
    RAGTestRequest,
    RAGTestResponse,
)
from app.services.rag_configuration_service import RAGConfigurationService

router = APIRouter(tags=["RAG Configurations"])


@router.post(
    "",
    response_model=RAGConfigurationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create RAG application configuration",
    description="Register an external RAG endpoint to benchmark.",
)
async def create_rag_configuration(
    payload: RAGConfigurationCreate,
    current_user: UserResponse = Depends(get_current_user),
    rag_service: RAGConfigurationService = Depends(get_rag_configuration_service),
) -> RAGConfigurationResponse:
    """Create RAG configuration."""
    return await rag_service.create_configuration(current_user.id, payload)


@router.get(
    "",
    response_model=List[RAGConfigurationResponse],
    summary="List RAG configurations",
    description="List all RAG configurations for user, optionally filtered by projectId.",
)
async def list_rag_configurations(
    projectId: Optional[str] = Query(default=None, description="Filter by project ID"),
    current_user: UserResponse = Depends(get_current_user),
    rag_service: RAGConfigurationService = Depends(get_rag_configuration_service),
) -> List[RAGConfigurationResponse]:
    """List RAG configurations."""
    return await rag_service.list_configurations(current_user.id, projectId)


@router.get(
    "/{config_id}",
    response_model=RAGConfigurationResponse,
    summary="Get RAG configuration by ID",
    description="Retrieve configuration details with masked sensitive headers.",
)
async def get_rag_configuration(
    config_id: str,
    current_user: UserResponse = Depends(get_current_user),
    rag_service: RAGConfigurationService = Depends(get_rag_configuration_service),
) -> RAGConfigurationResponse:
    """Get single RAG configuration."""
    return await rag_service.get_configuration(config_id, current_user.id)


@router.put(
    "/{config_id}",
    response_model=RAGConfigurationResponse,
    summary="Update RAG configuration",
    description="Update endpoint URL, headers, JSON template, or extraction paths.",
)
async def update_rag_configuration(
    config_id: str,
    payload: RAGConfigurationUpdate,
    current_user: UserResponse = Depends(get_current_user),
    rag_service: RAGConfigurationService = Depends(get_rag_configuration_service),
) -> RAGConfigurationResponse:
    """Update RAG configuration."""
    return await rag_service.update_configuration(config_id, current_user.id, payload)


@router.delete(
    "/{config_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete RAG configuration",
    description="Remove RAG configuration from the platform.",
)
async def delete_rag_configuration(
    config_id: str,
    current_user: UserResponse = Depends(get_current_user),
    rag_service: RAGConfigurationService = Depends(get_rag_configuration_service),
) -> dict:
    """Delete RAG configuration."""
    success = await rag_service.delete_configuration(config_id, current_user.id)
    return {"success": success, "message": "RAG configuration deleted successfully"}


@router.post(
    "/{config_id}/test",
    response_model=RAGTestResponse,
    status_code=status.HTTP_200_OK,
    summary="Test RAG application connection",
    description="Send a sample question to verify that the external RAG API responds with an answer.",
)
async def test_rag_configuration(
    config_id: str,
    payload: Optional[RAGTestRequest] = None,
    current_user: UserResponse = Depends(get_current_user),
    rag_service: RAGConfigurationService = Depends(get_rag_configuration_service),
) -> RAGTestResponse:
    """Test external RAG application connection."""
    sample_q = payload.sampleQuestion if payload else "What is Retrieval-Augmented Generation?"
    return await rag_service.test_configuration(config_id, current_user.id, sample_q)

