from typing import List
from fastapi import APIRouter, Depends, status
from app.api.deps import get_current_user, get_dataset_service, get_project_service
from app.schemas.auth import UserResponse
from app.schemas.dataset import DatasetCreate, DatasetResponse
from app.schemas.project import ProjectCreate, ProjectResponse, ProjectUpdate
from app.services.dataset_service import DatasetService
from app.services.project_service import ProjectService

router = APIRouter(tags=["Projects"])


@router.get(
    "",
    response_model=List[ProjectResponse],
    summary="List all user projects",
    description="Retrieve all evaluation projects created by the authenticated user.",
)
async def list_projects(
    current_user: UserResponse = Depends(get_current_user),
    project_service: ProjectService = Depends(get_project_service),
) -> List[ProjectResponse]:
    """List projects belonging to authenticated user."""
    return await project_service.list_projects(current_user.id)


@router.post(
    "",
    response_model=ProjectResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new project",
    description="Create a project to group benchmarks and datasets.",
)
async def create_project(
    payload: ProjectCreate,
    current_user: UserResponse = Depends(get_current_user),
    project_service: ProjectService = Depends(get_project_service),
) -> ProjectResponse:
    """Create a new evaluation project."""
    return await project_service.create_project(current_user.id, payload)


@router.get(
    "/{project_id}",
    response_model=ProjectResponse,
    summary="Get project details",
    description="Retrieve specific project metadata and dataset count.",
)
async def get_project(
    project_id: str,
    current_user: UserResponse = Depends(get_current_user),
    project_service: ProjectService = Depends(get_project_service),
) -> ProjectResponse:
    """Get project by ID."""
    return await project_service.get_project(project_id, current_user.id)


@router.put(
    "/{project_id}",
    response_model=ProjectResponse,
    summary="Update project",
    description="Update an existing project's name or description.",
)
async def update_project(
    project_id: str,
    payload: ProjectUpdate,
    current_user: UserResponse = Depends(get_current_user),
    project_service: ProjectService = Depends(get_project_service),
) -> ProjectResponse:
    """Update project metadata."""
    return await project_service.update_project(project_id, current_user.id, payload)


@router.delete(
    "/{project_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete project",
    description="Delete project and cascade delete all its associated datasets and items.",
)
async def delete_project(
    project_id: str,
    current_user: UserResponse = Depends(get_current_user),
    project_service: ProjectService = Depends(get_project_service),
) -> dict:
    """Delete project."""
    success = await project_service.delete_project(project_id, current_user.id)
    return {"success": success, "message": "Project deleted successfully"}


@router.get(
    "/{project_id}/datasets",
    response_model=List[DatasetResponse],
    summary="List project datasets",
    description="Retrieve all datasets associated with the project.",
)
async def list_project_datasets(
    project_id: str,
    current_user: UserResponse = Depends(get_current_user),
    dataset_service: DatasetService = Depends(get_dataset_service),
) -> List[DatasetResponse]:
    """List datasets in a project."""
    return await dataset_service.list_datasets_for_project(project_id, current_user.id)


@router.post(
    "/{project_id}/datasets",
    response_model=DatasetResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create dataset in project",
    description="Create a new evaluation dataset inside the specified project.",
)
async def create_project_dataset(
    project_id: str,
    payload: DatasetCreate,
    current_user: UserResponse = Depends(get_current_user),
    dataset_service: DatasetService = Depends(get_dataset_service),
) -> DatasetResponse:
    """Create dataset in a project."""
    return await dataset_service.create_dataset(project_id, current_user.id, payload)

