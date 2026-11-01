from typing import List, Optional
from fastapi import APIRouter, BackgroundTasks, Depends, Query, status

from app.api.deps import get_current_user, get_evaluation_service
from app.schemas.auth import UserResponse
from app.schemas.evaluation import (
    EvaluationCreate,
    EvaluationResultResponse,
    EvaluationRunResponse,
)
from app.services.evaluation_service import EvaluationService

router = APIRouter(tags=["Evaluations"])


@router.post(
    "",
    response_model=EvaluationRunResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Start a new RAG evaluation run",
)
async def start_evaluation(
    payload: EvaluationCreate,
    background_tasks: BackgroundTasks,
    current_user: UserResponse = Depends(get_current_user),
    service: EvaluationService = Depends(get_evaluation_service),
) -> EvaluationRunResponse:
    """Validate project resources, initialize evaluation run, and dispatch background worker."""
    run = await service.start_evaluation(user_id=current_user.id, payload=payload)
    # Dispatch worker to process questions asynchronously in background without blocking HTTP response
    background_tasks.add_task(service.execute_evaluation_worker, run.id)
    return await service._enrich_run_response(run)


@router.get(
    "",
    response_model=List[EvaluationRunResponse],
    status_code=status.HTTP_200_OK,
    summary="List all evaluation runs",
)
async def list_evaluations(
    projectId: Optional[str] = Query(None, description="Filter by project ID"),
    current_user: UserResponse = Depends(get_current_user),
    service: EvaluationService = Depends(get_evaluation_service),
) -> List[EvaluationRunResponse]:
    """Retrieve all evaluation runs belonging to the user."""
    return await service.list_evaluations(user_id=current_user.id, project_id=projectId)


@router.get(
    "/{id}",
    response_model=EvaluationRunResponse,
    status_code=status.HTTP_200_OK,
    summary="Get single evaluation run details and progress",
)
async def get_evaluation(
    id: str,
    current_user: UserResponse = Depends(get_current_user),
    service: EvaluationService = Depends(get_evaluation_service),
) -> EvaluationRunResponse:
    """Retrieve evaluation run status, execution timestamps, and question progress counters."""
    return await service.get_evaluation(user_id=current_user.id, evaluation_id=id)


@router.get(
    "/{id}/results",
    response_model=List[EvaluationResultResponse],
    status_code=status.HTTP_200_OK,
    summary="Get detailed evaluation question results",
)
async def get_evaluation_results(
    id: str,
    current_user: UserResponse = Depends(get_current_user),
    service: EvaluationService = Depends(get_evaluation_service),
) -> List[EvaluationResultResponse]:
    """Retrieve individual question outcomes, generated answers, retrieved contexts, and latency."""
    return await service.get_evaluation_results(user_id=current_user.id, evaluation_id=id)


@router.get(
    "/{id}/results/{resultId}",
    response_model=EvaluationResultResponse,
    status_code=status.HTTP_200_OK,
    summary="Get single evaluation question outcome and Gemini rationale",
)
async def get_single_evaluation_result(
    id: str,
    resultId: str,
    current_user: UserResponse = Depends(get_current_user),
    service: EvaluationService = Depends(get_evaluation_service),
) -> EvaluationResultResponse:
    """Retrieve deep result view for a question including expected/generated answers, contexts, and metrics."""
    return await service.get_evaluation_result(
        user_id=current_user.id, evaluation_id=id, result_id=resultId
    )


@router.post(
    "/{id}/cancel",
    response_model=EvaluationRunResponse,
    status_code=status.HTTP_200_OK,
    summary="Cancel an in-progress evaluation run",
)
async def cancel_evaluation(
    id: str,
    current_user: UserResponse = Depends(get_current_user),
    service: EvaluationService = Depends(get_evaluation_service),
) -> EvaluationRunResponse:
    """Stop further question execution for a pending or running evaluation."""
    return await service.cancel_evaluation(user_id=current_user.id, evaluation_id=id)
