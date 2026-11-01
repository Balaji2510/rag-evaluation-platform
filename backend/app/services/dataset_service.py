from datetime import datetime, timezone
from typing import List, Optional
import uuid
from app.core.exceptions import AppException, EntityNotFoundError
from app.models.dataset import Dataset
from app.models.dataset_item import DatasetItem
from app.repositories.dataset_item_repository import DatasetItemRepository
from app.repositories.dataset_repository import DatasetRepository
from app.repositories.project_repository import ProjectRepository
from app.schemas.dataset import (
    DatasetCreate,
    DatasetDetailResponse,
    DatasetResponse,
    DatasetUpdate,
)
from app.schemas.dataset_item import (
    DatasetImportRequest,
    DatasetImportResponse,
    DatasetItemCreate,
    DatasetItemResponse,
    DatasetItemUpdate,
)


class DatasetService:
    """Service handling dataset and evaluation items business logic."""

    def __init__(
        self,
        dataset_repo: Optional[DatasetRepository] = None,
        item_repo: Optional[DatasetItemRepository] = None,
        project_repo: Optional[ProjectRepository] = None,
    ) -> None:
        self.dataset_repo = dataset_repo or DatasetRepository()
        self.item_repo = item_repo or DatasetItemRepository()
        self.project_repo = project_repo or ProjectRepository()

    async def _verify_project_access(self, project_id: str, user_id: str) -> None:
        """Verify project exists and belongs to user."""
        project = await self.project_repo.get_by_id(project_id)
        if not project:
            raise EntityNotFoundError(
                message="Parent project not found",
                details={"project_id": project_id},
            )
        if project.userId != user_id:
            raise AppException(
                message="You do not have access to this project",
                status_code=403,
                details={"code": "FORBIDDEN"},
            )

    async def _verify_dataset_access(self, dataset_id: str, user_id: str) -> Dataset:
        """Verify dataset exists and user owns parent project."""
        dataset = await self.dataset_repo.get_by_id(dataset_id)
        if not dataset:
            raise EntityNotFoundError(
                message="Dataset not found",
                details={"dataset_id": dataset_id},
            )
        await self._verify_project_access(dataset.projectId, user_id)
        return dataset

    async def list_datasets_for_project(
        self,
        project_id: str,
        user_id: str,
    ) -> List[DatasetResponse]:
        """List all datasets in a project with item counts."""
        await self._verify_project_access(project_id, user_id)
        datasets = await self.dataset_repo.list_by_project(project_id)

        results = []
        for ds in datasets:
            count = await self.item_repo.count_by_dataset(ds.id)
            results.append(
                DatasetResponse(
                    id=ds.id,
                    projectId=ds.projectId,
                    name=ds.name,
                    description=ds.description or "",
                    createdAt=ds.createdAt,
                    updatedAt=ds.updatedAt,
                    itemCount=count,
                )
            )
        return results

    async def create_dataset(
        self,
        project_id: str,
        user_id: str,
        data: DatasetCreate,
    ) -> DatasetResponse:
        """Create a new dataset inside a project."""
        await self._verify_project_access(project_id, user_id)
        now = datetime.now(timezone.utc)
        dataset_id = str(uuid.uuid4())

        dataset = Dataset(
            id=dataset_id,
            projectId=project_id,
            name=data.name.strip(),
            description=data.description.strip() if data.description else "",
            createdAt=now,
            updatedAt=now,
        )

        created = await self.dataset_repo.create(dataset)
        return DatasetResponse(
            id=created.id,
            projectId=created.projectId,
            name=created.name,
            description=created.description,
            createdAt=created.createdAt,
            updatedAt=created.updatedAt,
            itemCount=0,
        )

    async def get_dataset_detail(
        self,
        dataset_id: str,
        user_id: str,
    ) -> DatasetDetailResponse:
        """Retrieve dataset details along with all evaluation items."""
        dataset = await self._verify_dataset_access(dataset_id, user_id)
        items = await self.item_repo.list_by_dataset(dataset_id)

        item_responses = [
            DatasetItemResponse(
                id=item.id,
                datasetId=item.datasetId,
                question=item.question,
                expectedAnswer=item.expectedAnswer,
                expectedContexts=item.expectedContexts or [],
                metadata=item.metadata or {},
                createdAt=item.createdAt,
            )
            for item in items
        ]

        return DatasetDetailResponse(
            id=dataset.id,
            projectId=dataset.projectId,
            name=dataset.name,
            description=dataset.description or "",
            createdAt=dataset.createdAt,
            updatedAt=dataset.updatedAt,
            itemCount=len(item_responses),
            items=item_responses,
        )

    async def add_item(
        self,
        dataset_id: str,
        user_id: str,
        data: DatasetItemCreate,
    ) -> DatasetItemResponse:
        """Add an evaluation question to a dataset."""
        dataset = await self._verify_dataset_access(dataset_id, user_id)
        now = datetime.now(timezone.utc)
        item_id = str(uuid.uuid4())

        item = DatasetItem(
            id=item_id,
            datasetId=dataset.id,
            question=data.question.strip(),
            expectedAnswer=data.expectedAnswer.strip(),
            expectedContexts=data.expectedContexts or [],
            metadata=data.metadata or {},
            createdAt=now,
        )

        created = await self.item_repo.create(item)
        # Touch dataset updatedAt
        await self.dataset_repo.update(dataset.id, {"updatedAt": now})

        return DatasetItemResponse(
            id=created.id,
            datasetId=created.datasetId,
            question=created.question,
            expectedAnswer=created.expectedAnswer,
            expectedContexts=created.expectedContexts,
            metadata=created.metadata,
            createdAt=created.createdAt,
        )

    async def update_item(
        self,
        dataset_id: str,
        item_id: str,
        user_id: str,
        data: DatasetItemUpdate,
    ) -> DatasetItemResponse:
        """Update an evaluation question item."""
        await self._verify_dataset_access(dataset_id, user_id)
        item = await self.item_repo.get_by_id(item_id)

        if not item or item.datasetId != dataset_id:
            raise EntityNotFoundError(
                message="Dataset item not found",
                details={"item_id": item_id, "dataset_id": dataset_id},
            )

        updates: dict = {}
        if data.question is not None:
            updates["question"] = data.question.strip()
        if data.expectedAnswer is not None:
            updates["expectedAnswer"] = data.expectedAnswer.strip()
        if data.expectedContexts is not None:
            updates["expectedContexts"] = data.expectedContexts
        if data.metadata is not None:
            updates["metadata"] = data.metadata

        updated = await self.item_repo.update(item_id, updates)
        if not updated:
            raise EntityNotFoundError("Dataset item could not be updated")

        # Touch dataset updatedAt
        await self.dataset_repo.update(dataset_id, {"updatedAt": datetime.now(timezone.utc)})

        return DatasetItemResponse(
            id=updated.id,
            datasetId=updated.datasetId,
            question=updated.question,
            expectedAnswer=updated.expectedAnswer,
            expectedContexts=updated.expectedContexts,
            metadata=updated.metadata,
            createdAt=updated.createdAt,
        )

    async def delete_item(
        self,
        dataset_id: str,
        item_id: str,
        user_id: str,
    ) -> bool:
        """Delete an evaluation question item."""
        await self._verify_dataset_access(dataset_id, user_id)
        item = await self.item_repo.get_by_id(item_id)

        if not item or item.datasetId != dataset_id:
            raise EntityNotFoundError(
                message="Dataset item not found",
                details={"item_id": item_id, "dataset_id": dataset_id},
            )

        deleted = await self.item_repo.delete(item_id)
        if deleted:
            await self.dataset_repo.update(dataset_id, {"updatedAt": datetime.now(timezone.utc)})
        return deleted

    async def import_items(
        self,
        dataset_id: str,
        user_id: str,
        payload: DatasetImportRequest,
    ) -> DatasetImportResponse:
        """Batch import dataset items."""
        await self._verify_dataset_access(dataset_id, user_id)
        now = datetime.now(timezone.utc)

        new_items = [
            DatasetItem(
                id=str(uuid.uuid4()),
                datasetId=dataset_id,
                question=item.question.strip(),
                expectedAnswer=item.expectedAnswer.strip(),
                expectedContexts=item.expectedContexts or [],
                metadata=item.metadata or {},
                createdAt=now,
            )
            for item in payload.items
        ]

        count = await self.item_repo.create_many(new_items)
        await self.dataset_repo.update(dataset_id, {"updatedAt": now})

        return DatasetImportResponse(
            importedCount=count,
            datasetId=dataset_id,
        )

