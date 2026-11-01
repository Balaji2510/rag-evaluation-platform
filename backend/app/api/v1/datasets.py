from fastapi import APIRouter, Depends, status
from app.api.deps import get_current_user, get_dataset_service
from app.schemas.auth import UserResponse
from app.schemas.dataset import DatasetDetailResponse
from app.schemas.dataset_item import (
    DatasetImportRequest,
    DatasetImportResponse,
    DatasetItemCreate,
    DatasetItemResponse,
    DatasetItemUpdate,
)
from app.services.dataset_service import DatasetService

router = APIRouter(tags=["Datasets"])


@router.get(
    "/{dataset_id}",
    response_model=DatasetDetailResponse,
    summary="Get dataset details",
    description="Retrieve dataset metadata and all its evaluation question items.",
)
async def get_dataset(
    dataset_id: str,
    current_user: UserResponse = Depends(get_current_user),
    dataset_service: DatasetService = Depends(get_dataset_service),
) -> DatasetDetailResponse:
    """Get dataset detail and items."""
    return await dataset_service.get_dataset_detail(dataset_id, current_user.id)


@router.post(
    "/{dataset_id}/items",
    response_model=DatasetItemResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add evaluation question item",
    description="Add an evaluation question with expected ground truth answer and contexts.",
)
async def add_dataset_item(
    dataset_id: str,
    payload: DatasetItemCreate,
    current_user: UserResponse = Depends(get_current_user),
    dataset_service: DatasetService = Depends(get_dataset_service),
) -> DatasetItemResponse:
    """Add evaluation item to dataset."""
    return await dataset_service.add_item(dataset_id, current_user.id, payload)


@router.put(
    "/{dataset_id}/items/{item_id}",
    response_model=DatasetItemResponse,
    summary="Update evaluation question item",
    description="Update question, expected answer, contexts, or metadata.",
)
async def update_dataset_item(
    dataset_id: str,
    item_id: str,
    payload: DatasetItemUpdate,
    current_user: UserResponse = Depends(get_current_user),
    dataset_service: DatasetService = Depends(get_dataset_service),
) -> DatasetItemResponse:
    """Update evaluation question item."""
    return await dataset_service.update_item(dataset_id, item_id, current_user.id, payload)


@router.delete(
    "/{dataset_id}/items/{item_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete evaluation question item",
    description="Delete a question from the dataset.",
)
async def delete_dataset_item(
    dataset_id: str,
    item_id: str,
    current_user: UserResponse = Depends(get_current_user),
    dataset_service: DatasetService = Depends(get_dataset_service),
) -> dict:
    """Delete evaluation item."""
    success = await dataset_service.delete_item(dataset_id, item_id, current_user.id)
    return {"success": success, "message": "Evaluation question deleted successfully"}


@router.post(
    "/{dataset_id}/import",
    response_model=DatasetImportResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Import evaluation dataset items",
    description="Batch import evaluation questions and ground truth contexts.",
)
async def import_dataset_items(
    dataset_id: str,
    payload: DatasetImportRequest,
    current_user: UserResponse = Depends(get_current_user),
    dataset_service: DatasetService = Depends(get_dataset_service),
) -> DatasetImportResponse:
    """Batch import evaluation items."""
    return await dataset_service.import_items(dataset_id, current_user.id, payload)

