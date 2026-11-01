from typing import Any, Dict, List, Optional
from app.core.exceptions import AppException, EntityNotFoundError
from app.core.logging import get_logger
from app.models.evaluation import EvaluationRun
from app.repositories.dataset_repository import DatasetRepository
from app.repositories.evaluation_repository import EvaluationRunRepository
from app.repositories.project_repository import ProjectRepository
from app.repositories.rag_configuration_repository import RAGConfigurationRepository
from app.schemas.comparison import (
    ComparisonResponse,
    ComparisonRunMeta,
    MetricComparison,
)

logger = get_logger("comparison_service")


def compute_metric_comparison(
    key: str,
    name: str,
    val_a: Optional[float],
    val_b: Optional[float],
    higher_is_better: bool = True,
    unit: Optional[str] = None,
) -> MetricComparison:
    """Calculate absolute difference, percentage difference, and improvement status between two runs."""
    if val_a is None or val_b is None:
        return MetricComparison(
            key=key,
            name=name,
            runA=val_a,
            runB=val_b,
            absoluteDifference=None,
            percentageDifference=None,
            status="no-change",
            higherIsBetter=higher_is_better,
            formattedChange="N/A",
            unit=unit,
        )

    # Absolute difference B - A
    dec_places = 2 if unit == "ms" else 4
    abs_diff = round(val_b - val_a, dec_places)

    # Percentage difference ((B - A) / A) * 100
    if val_a == 0:
        if val_b == 0:
            pct_diff = 0.0
        elif val_b > 0:
            pct_diff = 100.0
        else:
            pct_diff = -100.0
    else:
        pct_diff = round(((val_b - val_a) / abs(val_a)) * 100.0, 1)

    # Format change string
    if abs(pct_diff) < 0.05 and abs(abs_diff) < 0.001:
        formatted_change = "0.0%"
    else:
        sign = "+" if pct_diff > 0 else ""
        formatted_change = f"{sign}{pct_diff:.1f}%"

    # Status determination
    if higher_is_better:
        if pct_diff >= 0.5 or abs_diff >= 0.005:
            status = "improved"
        elif pct_diff <= -0.5 or abs_diff <= -0.005:
            status = "regressed"
        else:
            status = "no-change"
    else:
        # Lower is better (e.g. latency)
        if pct_diff <= -1.0 or abs_diff <= -5.0:
            status = "improved"
        elif pct_diff >= 1.0 or abs_diff >= 5.0:
            status = "regressed"
        else:
            status = "no-change"

    return MetricComparison(
        key=key,
        name=name,
        runA=val_a,
        runB=val_b,
        absoluteDifference=abs_diff,
        percentageDifference=pct_diff,
        status=status,
        higherIsBetter=higher_is_better,
        formattedChange=formatted_change,
        unit=unit,
    )


def generate_deterministic_summary(
    metrics_map: Dict[str, MetricComparison],
    run_b_label: str = "Run B",
) -> str:
    """Generate a high-level natural language summary comparing Run B to Run A deterministically."""
    # 1. Retrieval Quality (Context Relevance & Context Recall)
    ctx_rel = metrics_map.get("contextRelevance")
    ctx_rec = metrics_map.get("contextRecall")
    retrieval_improved = (
        (ctx_rel and ctx_rel.status == "improved") or (ctx_rec and ctx_rec.status == "improved")
    )
    retrieval_regressed = (
        (ctx_rel and ctx_rel.status == "regressed") or (ctx_rec and ctx_rec.status == "regressed")
    )

    # 2. Generation & Answer Quality (Faithfulness, Correctness, Relevance)
    faith = metrics_map.get("faithfulness")
    ans_corr = metrics_map.get("answerCorrectness")
    ans_rel = metrics_map.get("answerRelevance")

    answer_improved = (
        (faith and faith.status == "improved")
        or (ans_corr and ans_corr.status == "improved")
        or (ans_rel and ans_rel.status == "improved")
    )
    answer_regressed = (
        (faith and faith.status == "regressed")
        or (ans_corr and ans_corr.status == "regressed")
        or (ans_rel and ans_rel.status == "regressed")
    )

    # 3. Latency
    lat = metrics_map.get("latency")
    lat_pct = lat.percentageDifference if (lat and lat.percentageDifference is not None) else None

    latency_phrase = ""
    if lat_pct is not None:
        abs_lat = abs(round(lat_pct))
        if lat_pct >= 2.0:
            latency_phrase = f"increased average latency by {abs_lat}%"
        elif lat_pct <= -2.0:
            latency_phrase = f"reduced average latency by {abs_lat}%"
        else:
            latency_phrase = "maintained consistent latency"

    # Synthesis logic prioritizing clear impact descriptions
    # Exact scenario match: retrieval improved + latency increased
    if retrieval_improved and not retrieval_regressed:
        if answer_improved and not answer_regressed:
            if lat_pct is not None and lat_pct >= 2.0:
                return f"{run_b_label} improved overall answer and retrieval quality, but {latency_phrase}."
            elif lat_pct is not None and lat_pct <= -2.0:
                return f"{run_b_label} improved overall answer and retrieval quality while {latency_phrase}."
            else:
                return f"{run_b_label} improved overall answer and retrieval quality with comparable latency."
        elif not answer_regressed:
            if lat_pct is not None and lat_pct >= 2.0:
                return f"{run_b_label} improved retrieval quality but {latency_phrase}."
            elif lat_pct is not None and lat_pct <= -2.0:
                return f"{run_b_label} improved retrieval quality while {latency_phrase}."
            else:
                return f"{run_b_label} improved retrieval quality with comparable latency."
        else:
            if lat_pct is not None and lat_pct >= 2.0:
                return f"{run_b_label} improved retrieval quality but regressed on answer quality and {latency_phrase}."
            else:
                return f"{run_b_label} improved retrieval quality but regressed on answer generation quality."

    # Scenario: Answer quality improved
    if answer_improved and not answer_regressed:
        if not retrieval_regressed:
            if lat_pct is not None and lat_pct >= 2.0:
                return f"{run_b_label} improved answer quality but {latency_phrase}."
            elif lat_pct is not None and lat_pct <= -2.0:
                return f"{run_b_label} improved answer quality while {latency_phrase}."
            else:
                return f"{run_b_label} improved answer quality with comparable latency."
        else:
            if lat_pct is not None and lat_pct >= 2.0:
                return f"{run_b_label} improved answer quality but regressed on retrieval quality and {latency_phrase}."
            else:
                return f"{run_b_label} improved answer quality but regressed on context retrieval quality."

    # Scenario: Regressions
    if (retrieval_regressed or answer_regressed) and not (retrieval_improved or answer_improved):
        if lat_pct is not None and lat_pct >= 2.0:
            return f"{run_b_label} regressed across quality metrics and {latency_phrase}."
        elif lat_pct is not None and lat_pct <= -2.0:
            return f"{run_b_label} regressed across quality metrics despite {latency_phrase}."
        else:
            return f"{run_b_label} regressed across quality metrics with comparable latency."

    # Scenario: Only latency changed significantly
    if latency_phrase and latency_phrase != "maintained consistent latency":
        if lat_pct is not None and lat_pct >= 2.0:
            return f"{run_b_label} maintained comparable quality metrics but {latency_phrase}."
        else:
            return f"{run_b_label} maintained comparable quality metrics while {latency_phrase}."

    # Default: Steady performance
    return f"{run_b_label} showed no significant changes in quality or latency compared to Run A."


class ComparisonService:
    """Service handling multi-run evaluations comparison and deterministic impact synthesis."""

    def __init__(
        self,
        run_repo: Optional[EvaluationRunRepository] = None,
        project_repo: Optional[ProjectRepository] = None,
        dataset_repo: Optional[DatasetRepository] = None,
        rag_repo: Optional[RAGConfigurationRepository] = None,
    ) -> None:
        self.run_repo = run_repo or EvaluationRunRepository()
        self.project_repo = project_repo or ProjectRepository()
        self.dataset_repo = dataset_repo or DatasetRepository()
        self.rag_repo = rag_repo or RAGConfigurationRepository()

    async def _build_run_meta(self, run: EvaluationRun) -> ComparisonRunMeta:
        """Enrich run metadata with human-readable project, dataset, and pipeline names."""
        project = await self.project_repo.get_by_id(run.projectId)
        dataset = await self.dataset_repo.get_by_id(run.datasetId)
        rag_cfg = await self.rag_repo.get_by_id(run.ragConfigurationId)

        return ComparisonRunMeta(
            id=run.id,
            projectId=run.projectId,
            datasetId=run.datasetId,
            ragConfigurationId=run.ragConfigurationId,
            status=run.status,
            totalQuestions=run.totalQuestions,
            completedQuestions=run.completedQuestions,
            failedQuestions=run.failedQuestions,
            projectName=project.name if project else None,
            datasetName=dataset.name if dataset else None,
            ragConfigurationName=rag_cfg.name if rag_cfg else None,
            createdAt=run.createdAt,
        )

    async def compare_runs(
        self,
        user_id: str,
        run_a_id: str,
        run_b_id: str,
    ) -> ComparisonResponse:
        """Compare two evaluation runs belonging to the same project."""
        # 1. Fetch both runs
        run_a = await self.run_repo.get_by_id(run_a_id)
        if not run_a:
            raise EntityNotFoundError(
                f"Evaluation run A not found",
                details={"runA": run_a_id},
            )

        run_b = await self.run_repo.get_by_id(run_b_id)
        if not run_b:
            raise EntityNotFoundError(
                f"Evaluation run B not found",
                details={"runB": run_b_id},
            )

        # 2. Multi-tenant ownership verification
        if run_a.userId != user_id or run_b.userId != user_id:
            raise AppException(
                "You do not have access to these evaluation runs",
                status_code=403,
                details={"code": "FORBIDDEN"},
            )

        # 3. Same project check
        if run_a.projectId != run_b.projectId:
            raise AppException(
                "Both evaluation runs must belong to the same project",
                status_code=400,
                details={
                    "runA_projectId": run_a.projectId,
                    "runB_projectId": run_b.projectId,
                },
            )

        # 4. Enrich metadata
        meta_a = await self._build_run_meta(run_a)
        meta_b = await self._build_run_meta(run_b)

        # 5. Compute comparisons for all 7 metrics
        metric_definitions = [
            ("overallScore", "Overall Score", run_a.overallScore, run_b.overallScore, True, None),
            ("faithfulness", "Faithfulness", run_a.averageFaithfulness, run_b.averageFaithfulness, True, None),
            ("answerRelevance", "Answer Relevance", run_a.averageAnswerRelevance, run_b.averageAnswerRelevance, True, None),
            ("contextRelevance", "Context Relevance", run_a.averageContextRelevance, run_b.averageContextRelevance, True, None),
            ("contextRecall", "Context Recall", run_a.averageContextRecall, run_b.averageContextRecall, True, None),
            ("answerCorrectness", "Answer Correctness", run_a.averageAnswerCorrectness, run_b.averageAnswerCorrectness, True, None),
            ("latency", "Latency", run_a.averageLatency, run_b.averageLatency, False, "ms"),
        ]

        metrics: List[MetricComparison] = []
        metrics_map: Dict[str, MetricComparison] = {}

        for key, name, val_a, val_b, higher_better, unit in metric_definitions:
            comp = compute_metric_comparison(
                key=key,
                name=name,
                val_a=val_a,
                val_b=val_b,
                higher_is_better=higher_better,
                unit=unit,
            )
            metrics.append(comp)
            metrics_map[key] = comp

        # 6. Categorize improved, regressed, unchanged
        improved_metrics = [m.name for m in metrics if m.status == "improved"]
        regressed_metrics = [m.name for m in metrics if m.status == "regressed"]
        unchanged_metrics = [m.name for m in metrics if m.status == "no-change"]

        # 7. Generate deterministic natural language summary
        summary = generate_deterministic_summary(metrics_map, run_b_label="Run B")

        return ComparisonResponse(
            runA=meta_a,
            runB=meta_b,
            metrics=metrics,
            improvedCount=len(improved_metrics),
            regressedCount=len(regressed_metrics),
            unchangedCount=len(unchanged_metrics),
            improvedMetrics=improved_metrics,
            regressedMetrics=regressed_metrics,
            unchangedMetrics=unchanged_metrics,
            summary=summary,
        )

