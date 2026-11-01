from typing import Optional
from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from app.core.exceptions import AppException
from app.core.security import decode_access_token
from app.repositories.dataset_item_repository import DatasetItemRepository
from app.repositories.dataset_repository import DatasetRepository
from app.repositories.evaluation_repository import (
    EvaluationResultRepository,
    EvaluationRunRepository,
)
from app.repositories.project_repository import ProjectRepository
from app.repositories.rag_configuration_repository import RAGConfigurationRepository
from app.repositories.user_repository import UserRepository
from app.repositories.document_repository import DocumentRepository
from app.repositories.document_chunk_repository import DocumentChunkRepository
from app.repositories.internal_rag_config_repository import InternalRAGConfigRepository
from app.repositories.production_repository import (
    ApiKeyRepository,
    AuditLogRepository,
    ScheduleRepository,
    ThresholdRepository,
    WebhookRepository,
    WorkspaceRepository,
)
from app.schemas.auth import UserResponse
from app.services.auth_service import AuthService
from app.services.dataset_service import DatasetService
from app.services.evaluation_service import EvaluationService
from app.services.comparison_service import ComparisonService
from app.services.gemini_evaluator import GeminiEvaluatorService
from app.services.internal_rag_service import InternalRAGService
from app.services.production_service import ProductionService
from app.services.project_service import ProjectService
from app.services.rag_configuration_service import RAGConfigurationService

security_scheme = HTTPBearer(auto_error=False)


def get_user_repository() -> UserRepository:
    return UserRepository()


def get_project_repository() -> ProjectRepository:
    return ProjectRepository()


def get_dataset_repository() -> DatasetRepository:
    return DatasetRepository()


def get_dataset_item_repository() -> DatasetItemRepository:
    return DatasetItemRepository()


def get_rag_configuration_repository() -> RAGConfigurationRepository:
    return RAGConfigurationRepository()


def get_evaluation_run_repository() -> EvaluationRunRepository:
    return EvaluationRunRepository()


def get_evaluation_result_repository() -> EvaluationResultRepository:
    return EvaluationResultRepository()


def get_document_repository() -> DocumentRepository:
    return DocumentRepository()


def get_document_chunk_repository() -> DocumentChunkRepository:
    return DocumentChunkRepository()


def get_internal_rag_config_repository() -> InternalRAGConfigRepository:
    return InternalRAGConfigRepository()


def get_api_key_repository() -> ApiKeyRepository:
    return ApiKeyRepository()


def get_threshold_repository() -> ThresholdRepository:
    return ThresholdRepository()


def get_webhook_repository() -> WebhookRepository:
    return WebhookRepository()


def get_schedule_repository() -> ScheduleRepository:
    return ScheduleRepository()


def get_workspace_repository() -> WorkspaceRepository:
    return WorkspaceRepository()


def get_audit_log_repository() -> AuditLogRepository:
    return AuditLogRepository()


def get_production_service(
    api_key_repo: ApiKeyRepository = Depends(get_api_key_repository),
    threshold_repo: ThresholdRepository = Depends(get_threshold_repository),
    webhook_repo: WebhookRepository = Depends(get_webhook_repository),
    schedule_repo: ScheduleRepository = Depends(get_schedule_repository),
    workspace_repo: WorkspaceRepository = Depends(get_workspace_repository),
    audit_repo: AuditLogRepository = Depends(get_audit_log_repository),
    run_repo: EvaluationRunRepository = Depends(get_evaluation_run_repository),
    result_repo: EvaluationResultRepository = Depends(get_evaluation_result_repository),
    project_repo: ProjectRepository = Depends(get_project_repository),
) -> ProductionService:
    return ProductionService(
        api_key_repo=api_key_repo,
        threshold_repo=threshold_repo,
        webhook_repo=webhook_repo,
        schedule_repo=schedule_repo,
        workspace_repo=workspace_repo,
        audit_repo=audit_repo,
        run_repo=run_repo,
        result_repo=result_repo,
        project_repo=project_repo,
    )


def get_internal_rag_service(
    doc_repo: DocumentRepository = Depends(get_document_repository),
    chunk_repo: DocumentChunkRepository = Depends(get_document_chunk_repository),
    config_repo: InternalRAGConfigRepository = Depends(get_internal_rag_config_repository),
    project_repo: ProjectRepository = Depends(get_project_repository),
) -> InternalRAGService:
    return InternalRAGService(
        doc_repo=doc_repo,
        chunk_repo=chunk_repo,
        config_repo=config_repo,
        project_repo=project_repo,
    )


def get_auth_service(
    user_repo: UserRepository = Depends(get_user_repository),
) -> AuthService:
    return AuthService(user_repo=user_repo)


def get_project_service(
    project_repo: ProjectRepository = Depends(get_project_repository),
    dataset_repo: DatasetRepository = Depends(get_dataset_repository),
    item_repo: DatasetItemRepository = Depends(get_dataset_item_repository),
) -> ProjectService:
    return ProjectService(
        project_repo=project_repo,
        dataset_repo=dataset_repo,
        item_repo=item_repo,
    )


def get_dataset_service(
    dataset_repo: DatasetRepository = Depends(get_dataset_repository),
    item_repo: DatasetItemRepository = Depends(get_dataset_item_repository),
    project_repo: ProjectRepository = Depends(get_project_repository),
) -> DatasetService:
    return DatasetService(
        dataset_repo=dataset_repo,
        item_repo=item_repo,
        project_repo=project_repo,
    )


def get_rag_configuration_service(
    rag_repo: RAGConfigurationRepository = Depends(get_rag_configuration_repository),
    project_repo: ProjectRepository = Depends(get_project_repository),
) -> RAGConfigurationService:
    return RAGConfigurationService(
        rag_repo=rag_repo,
        project_repo=project_repo,
    )


def get_gemini_evaluator_service() -> GeminiEvaluatorService:
    return GeminiEvaluatorService()


def get_evaluation_service(
    run_repo: EvaluationRunRepository = Depends(get_evaluation_run_repository),
    result_repo: EvaluationResultRepository = Depends(get_evaluation_result_repository),
    project_repo: ProjectRepository = Depends(get_project_repository),
    dataset_repo: DatasetRepository = Depends(get_dataset_repository),
    dataset_item_repo: DatasetItemRepository = Depends(get_dataset_item_repository),
    rag_repo: RAGConfigurationRepository = Depends(get_rag_configuration_repository),
    evaluator_service: GeminiEvaluatorService = Depends(get_gemini_evaluator_service),
    internal_rag_service: InternalRAGService = Depends(get_internal_rag_service),
) -> EvaluationService:
    return EvaluationService(
        run_repo=run_repo,
        result_repo=result_repo,
        project_repo=project_repo,
        dataset_repo=dataset_repo,
        dataset_item_repo=dataset_item_repo,
        rag_repo=rag_repo,
        evaluator_service=evaluator_service,
        internal_rag_service=internal_rag_service,
    )


def get_comparison_service(
    run_repo: EvaluationRunRepository = Depends(get_evaluation_run_repository),
    project_repo: ProjectRepository = Depends(get_project_repository),
    dataset_repo: DatasetRepository = Depends(get_dataset_repository),
    rag_repo: RAGConfigurationRepository = Depends(get_rag_configuration_repository),
) -> ComparisonService:
    return ComparisonService(
        run_repo=run_repo,
        project_repo=project_repo,
        dataset_repo=dataset_repo,
        rag_repo=rag_repo,
    )


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    auth_service: AuthService = Depends(get_auth_service),
    prod_service: ProductionService = Depends(get_production_service),
) -> UserResponse:
    # 1. Check for X-API-Key header
    api_key_header = request.headers.get("x-api-key")
    if api_key_header:
        key_record = await prod_service.authenticate_raw_key(api_key_header)
        if not key_record:
            raise AppException(
                message="Invalid or revoked API key",
                status_code=401,
                details={"code": "INVALID_API_KEY"},
            )
        return await auth_service.get_current_user(key_record.userId)

    # 2. Check for Authorization Bearer token (could be JWT or API key)
    if credentials and credentials.credentials:
        token = credentials.credentials
        if token.startswith("rageval_"):
            key_record = await prod_service.authenticate_raw_key(token)
            if not key_record:
                raise AppException(
                    message="Invalid or revoked API key",
                    status_code=401,
                    details={"code": "INVALID_API_KEY"},
                )
            return await auth_service.get_current_user(key_record.userId)

        payload = decode_access_token(token)
        user_id = payload.get("sub")
        if not user_id:
            raise AppException(
                message="Invalid authentication payload",
                status_code=401,
                details={"code": "INVALID_TOKEN_SUBJECT"},
            )
        return await auth_service.get_current_user(user_id)

    raise AppException(
        message="Authentication credentials were not provided",
        status_code=401,
        details={"code": "NOT_AUTHENTICATED"},
    )
