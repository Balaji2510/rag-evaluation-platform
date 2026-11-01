from fastapi import APIRouter, Depends, status
from app.api.deps import get_comparison_service, get_current_user
from app.schemas.auth import UserResponse
from app.schemas.comparison import ComparisonRequest, ComparisonResponse
from app.services.comparison_service import ComparisonService

router = APIRouter(tags=["comparisons"])


@router.post(
    "",
    response_model=ComparisonResponse,
    status_code=status.HTTP_200_OK,
    summary="Compare two evaluation runs from the same project",
)
async def compare_evaluation_runs(
    payload: ComparisonRequest,
    current_user: UserResponse = Depends(get_current_user),
    comparison_service: ComparisonService = Depends(get_comparison_service),
) -> ComparisonResponse:
    """Compare performance, latency, and quality metrics between two evaluation runs."""
    return await comparison_service.compare_runs(
        user_id=current_user.id,
        run_a_id=payload.runA,
        run_b_id=payload.runB,
    )

