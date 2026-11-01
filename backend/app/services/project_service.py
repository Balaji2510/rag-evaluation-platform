from datetime import datetime, timezone
from typing import List, Optional
import uuid
from app.core.exceptions import AppException, EntityNotFoundError
from app.models.project import Project
from app.repositories.dataset_item_repository import DatasetItemRepository
from app.repositories.dataset_repository import DatasetRepository
from app.repositories.project_repository import ProjectRepository
from app.schemas.project import ProjectCreate, ProjectResponse, ProjectUpdate


class ProjectService:
    """Service handling project management business logic."""

    def __init__(
        self,
        project_repo: Optional[ProjectRepository] = None,
        dataset_repo: Optional[DatasetRepository] = None,
        item_repo: Optional[DatasetItemRepository] = None,
    ) -> None:
        self.project_repo = project_repo or ProjectRepository()
        self.dataset_repo = dataset_repo or DatasetRepository()
        self.item_repo = item_repo or DatasetItemRepository()

    async def list_projects(self, user_id: str) -> List[ProjectResponse]:
        """List all projects for a user with dataset counts."""
        projects = await self.project_repo.list_by_user(user_id)
        results = []
        for p in projects:
            count = await self.dataset_repo.count_by_project(p.id)
            results.append(
                ProjectResponse(
                    id=p.id,
                    userId=p.userId,
                    name=p.name,
                    description=p.description or "",
                    createdAt=p.createdAt,
                    updatedAt=p.updatedAt,
                    datasetCount=count,
                )
            )
        return results

    async def create_project(self, user_id: str, data: ProjectCreate) -> ProjectResponse:
        """Create a new project for user."""
        now = datetime.now(timezone.utc)
        project_id = str(uuid.uuid4())

        project = Project(
            id=project_id,
            userId=user_id,
            name=data.name.strip(),
            description=data.description.strip() if data.description else "",
            createdAt=now,
            updatedAt=now,
        )

        created = await self.project_repo.create(project)
        return ProjectResponse(
            id=created.id,
            userId=created.userId,
            name=created.name,
            description=created.description,
            createdAt=created.createdAt,
            updatedAt=created.updatedAt,
            datasetCount=0,
        )

    async def get_project(self, project_id: str, user_id: str) -> ProjectResponse:
        """Get project by ID, verifying user ownership."""
        project = await self.project_repo.get_by_id(project_id)
        if not project:
            raise EntityNotFoundError(
                message="Project not found",
                details={"project_id": project_id},
            )

        if project.userId != user_id:
            raise AppException(
                message="You do not have access to this project",
                status_code=403,
                details={"code": "FORBIDDEN"},
            )

        count = await self.dataset_repo.count_by_project(project.id)
        return ProjectResponse(
            id=project.id,
            userId=project.userId,
            name=project.name,
            description=project.description or "",
            createdAt=project.createdAt,
            updatedAt=project.updatedAt,
            datasetCount=count,
        )

    async def update_project(
        self,
        project_id: str,
        user_id: str,
        data: ProjectUpdate,
    ) -> ProjectResponse:
        """Update an existing project."""
        project = await self.project_repo.get_by_id(project_id)
        if not project:
            raise EntityNotFoundError(
                message="Project not found",
                details={"project_id": project_id},
            )

        if project.userId != user_id:
            raise AppException(
                message="You do not have access to this project",
                status_code=403,
                details={"code": "FORBIDDEN"},
            )

        updates: dict = {"updatedAt": datetime.now(timezone.utc)}
        if data.name is not None:
            updates["name"] = data.name.strip()
        if data.description is not None:
            updates["description"] = data.description.strip()

        updated = await self.project_repo.update(project_id, updates)
        if not updated:
            raise EntityNotFoundError("Project could not be updated")

        count = await self.dataset_repo.count_by_project(project_id)
        return ProjectResponse(
            id=updated.id,
            userId=updated.userId,
            name=updated.name,
            description=updated.description,
            createdAt=updated.createdAt,
            updatedAt=updated.updatedAt,
            datasetCount=count,
        )

    async def delete_project(self, project_id: str, user_id: str) -> bool:
        """Delete project and cascade delete all its datasets and dataset items."""
        project = await self.project_repo.get_by_id(project_id)
        if not project:
            raise EntityNotFoundError(
                message="Project not found",
                details={"project_id": project_id},
            )

        if project.userId != user_id:
            raise AppException(
                message="You do not have access to this project",
                status_code=403,
                details={"code": "FORBIDDEN"},
            )

        # Find all datasets to delete their items
        datasets = await self.dataset_repo.list_by_project(project_id)
        for ds in datasets:
            await self.item_repo.delete_by_dataset(ds.id)

        # Delete all datasets
        await self.dataset_repo.delete_by_project(project_id)

        # Delete project
        return await self.project_repo.delete(project_id)

