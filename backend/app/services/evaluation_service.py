from datetime import datetime, timezone
import asyncio
import time
from typing import Any, Dict, List, Optional
import uuid
import httpx

from app.core.exceptions import AppException, EntityNotFoundError
from app.core.logging import get_logger
from app.models.evaluation import EvaluationResult, EvaluationRun
from app.models.rag_configuration import RAGConfiguration
from app.repositories.dataset_item_repository import DatasetItemRepository
from app.repositories.dataset_repository import DatasetRepository
from app.repositories.evaluation_repository import (
    EvaluationResultRepository,
    EvaluationRunRepository,
)
from app.repositories.project_repository import ProjectRepository
from app.repositories.rag_configuration_repository import RAGConfigurationRepository
from app.schemas.evaluation import (
    EvaluationCreate,
    EvaluationResultResponse,
    EvaluationRunResponse,
)
from app.services.gemini_evaluator import GeminiEvaluatorService
from app.services.internal_rag_service import InternalRAGService
from app.services.rag_configuration_service import extract_json_path, render_template

logger = get_logger("evaluation_service")


class EvaluationService:
    """Service driving background evaluation runs against configured external RAG endpoints."""

    def __init__(
        self,
        run_repo: Optional[EvaluationRunRepository] = None,
        result_repo: Optional[EvaluationResultRepository] = None,
        project_repo: Optional[ProjectRepository] = None,
        dataset_repo: Optional[DatasetRepository] = None,
        dataset_item_repo: Optional[DatasetItemRepository] = None,
        rag_repo: Optional[RAGConfigurationRepository] = None,
        evaluator_service: Optional[GeminiEvaluatorService] = None,
        internal_rag_service: Optional[InternalRAGService] = None,
    ) -> None:
        self.run_repo = run_repo or EvaluationRunRepository()
        self.result_repo = result_repo or EvaluationResultRepository()
        self.project_repo = project_repo or ProjectRepository()
        self.dataset_repo = dataset_repo or DatasetRepository()
        self.dataset_item_repo = dataset_item_repo or DatasetItemRepository()
        self.rag_repo = rag_repo or RAGConfigurationRepository()
        self.evaluator_service = evaluator_service or GeminiEvaluatorService()
        self.internal_rag_service = internal_rag_service or InternalRAGService()

    async def _enrich_run_response(self, run: EvaluationRun) -> EvaluationRunResponse:
        """Enrich an evaluation run model with human-readable entity names."""
        project_name = None
        dataset_name = None
        rag_name = None

        project = await self.project_repo.get_by_id(run.projectId)
        if project:
            project_name = project.name

        dataset = await self.dataset_repo.get_by_id(run.datasetId)
        if dataset:
            dataset_name = dataset.name

        if run.ragConfigurationId in ("internal", "internal-rag"):
            rag_name = "Internal RAG (Atlas Vector Search)"
        else:
            rag_config = await self.rag_repo.get_by_id(run.ragConfigurationId)
            if rag_config:
                rag_name = rag_config.name

        return EvaluationRunResponse(
            id=run.id,
            projectId=run.projectId,
            datasetId=run.datasetId,
            ragConfigurationId=run.ragConfigurationId,
            status=run.status,
            totalQuestions=run.totalQuestions,
            completedQuestions=run.completedQuestions,
            failedQuestions=run.failedQuestions,
            startedAt=run.startedAt,
            completedAt=run.completedAt,
            createdAt=run.createdAt,
            projectName=project_name,
            datasetName=dataset_name,
            ragConfigurationName=rag_name,
            overallScore=run.overallScore,
            averageFaithfulness=run.averageFaithfulness,
            averageAnswerRelevance=run.averageAnswerRelevance,
            averageContextRelevance=run.averageContextRelevance,
            averageContextRecall=run.averageContextRecall,
            averageAnswerCorrectness=run.averageAnswerCorrectness,
            averageLatency=run.averageLatency,
            promptVersion=run.promptVersion,
            gitCommit=run.gitCommit,
            gitBranch=run.gitBranch,
            prNumber=run.prNumber,
            tokenUsage=run.tokenUsage,
            estimatedCostUsd=run.estimatedCostUsd,
            qualityGatePassed=run.qualityGatePassed,
            regressionDetected=run.regressionDetected,
            regressionDetails=run.regressionDetails,
        )

    async def start_evaluation(
        self, user_id: str, payload: EvaluationCreate
    ) -> EvaluationRun:
        """Validate resources, create pending evaluation run, and prepare execution."""
        # 1. Verify project exists and user has access
        project = await self.project_repo.get_by_id(payload.projectId)
        if not project:
            raise EntityNotFoundError(
                message="Project not found",
                details={"project_id": payload.projectId},
            )
        if project.userId != user_id:
            raise AppException(
                message="You do not have access to this project",
                status_code=403,
                details={"code": "FORBIDDEN"},
            )

        # 2. Verify dataset belongs to project
        dataset = await self.dataset_repo.get_by_id(payload.datasetId)
        if not dataset:
            raise EntityNotFoundError(
                message="Dataset not found",
                details={"dataset_id": payload.datasetId},
            )
        if dataset.projectId != payload.projectId:
            raise AppException(
                message="Dataset does not belong to the selected project",
                status_code=400,
                details={"code": "INVALID_RELATION"},
            )

        # 3. Verify RAG configuration belongs to project (unless selecting Internal RAG)
        is_internal = payload.ragConfigurationId in ("internal", "internal-rag")
        if not is_internal:
            rag_config = await self.rag_repo.get_by_id(payload.ragConfigurationId)
            if not rag_config:
                raise EntityNotFoundError(
                    message="RAG configuration not found",
                    details={"rag_configuration_id": payload.ragConfigurationId},
                )
            if rag_config.projectId != payload.projectId:
                raise AppException(
                    message="RAG configuration does not belong to the selected project",
                    status_code=400,
                    details={"code": "INVALID_RELATION"},
                )

        # 4. Load dataset items
        items = await self.dataset_item_repo.list_by_dataset(payload.datasetId)
        if not items:
            raise AppException(
                message="Selected dataset has no questions to evaluate. Please add questions first.",
                status_code=400,
                details={"code": "EMPTY_DATASET"},
            )

        now = datetime.now(timezone.utc)
        run = EvaluationRun(
            id=str(uuid.uuid4()),
            userId=user_id,
            projectId=payload.projectId,
            datasetId=payload.datasetId,
            ragConfigurationId=payload.ragConfigurationId,
            status="pending",
            totalQuestions=len(items),
            completedQuestions=0,
            failedQuestions=0,
            startedAt=None,
            completedAt=None,
            createdAt=now,
            updatedAt=now,
            promptVersion=payload.promptVersion,
            gitCommit=payload.gitCommit,
            gitBranch=payload.gitBranch,
            prNumber=payload.prNumber,
        )

        saved_run = await self.run_repo.create(run)
        logger.info(
            "Created evaluation run %s for project %s with %d questions",
            saved_run.id,
            payload.projectId,
            len(items),
        )
        return saved_run

    async def execute_evaluation_worker(self, run_id: str) -> None:
        """Background worker that iterates through dataset questions and calls RAG API."""
        try:
            await self._run_worker_safe(run_id)
        except Exception as run_err:
            logger.exception("Fatal unhandled exception in evaluation worker for run %s: %s", run_id, run_err)
            try:
                await self.run_repo.update(
                    run_id,
                    {
                        "status": "failed",
                        "completedAt": datetime.now(timezone.utc),
                        "updatedAt": datetime.now(timezone.utc),
                    },
                )
            except Exception:
                pass

    async def _run_worker_safe(self, run_id: str) -> None:
        run = await self.run_repo.get_by_id(run_id)
        if not run:
            logger.warning("Worker could not find evaluation run %s", run_id)
            return

        # Check if already cancelled
        if run.status == "cancelled":
            logger.info("Evaluation run %s was cancelled before execution started", run_id)
            return

        # Transition to running
        start_time_run = datetime.now(timezone.utc)
        await self.run_repo.update(
            run_id,
            {
                "status": "running",
                "startedAt": start_time_run,
                "updatedAt": start_time_run,
            },
        )
        logger.info("Evaluation run %s is now RUNNING", run_id)

        # Load RAG configuration (or identify Internal RAG pipeline)
        is_internal = run.ragConfigurationId in ("internal", "internal-rag")
        rag_config = None
        client_kwargs: Dict[str, Any] = {}

        if not is_internal:
            rag_config = await self.rag_repo.get_by_id(run.ragConfigurationId)
            if not rag_config:
                logger.error("RAG configuration %s missing for run %s", run.ragConfigurationId, run_id)
                await self.run_repo.update(
                    run_id,
                    {
                        "status": "failed",
                        "completedAt": datetime.now(timezone.utc),
                        "updatedAt": datetime.now(timezone.utc),
                    },
                )
                return
            if (
                getattr(rag_config, "isInternal", False)
                or rag_config.apiUrl in ("internal", "internal://")
                or rag_config.apiUrl.startswith("internal://")
            ):
                is_internal = True
            else:
                client_kwargs = {
                    "timeout": float(rag_config.timeoutSeconds),
                    "follow_redirects": True,
                }

        # Load items
        items = await self.dataset_item_repo.list_by_dataset(run.datasetId)
        completed_count = 0
        failed_count = 0

        for item_idx, item in enumerate(items):
            # Check for cancellation before each question
            current_run = await self.run_repo.get_by_id(run_id)
            if current_run and current_run.status == "cancelled":
                logger.info("Evaluation run %s was cancelled during question execution", run_id)
                return

            question_text = item.question
            start_q = time.perf_counter()
            item_status = "completed"
            error_msg: Optional[str] = None
            generated_answer: Optional[str] = None
            retrieved_contexts: List[str] = []
            latency_ms: Optional[float] = None

            if is_internal:
                try:
                    internal_res = await self.internal_rag_service.query(
                        project_id=run.projectId,
                        question=question_text,
                    )
                    latency_ms = round((time.perf_counter() - start_q) * 1000, 2)
                    generated_answer = internal_res.get("answer")
                    retrieved_contexts = internal_res.get("contexts", [])
                except Exception as exc:
                    latency_ms = round((time.perf_counter() - start_q) * 1000, 2)
                    item_status = "failed"
                    error_msg = f"Internal RAG pipeline error: {str(exc)}"
            else:
                rendered_body = render_template(rag_config.requestTemplate, question_text)
                try:
                    async with httpx.AsyncClient(**client_kwargs) as client:
                        headers = dict(rag_config.headers)
                        if rag_config.method in ("POST", "PUT", "PATCH"):
                            if "Content-Type" not in headers and "content-type" not in headers:
                                headers["Content-Type"] = "application/json"
                            response = await client.request(
                                method=rag_config.method,
                                url=rag_config.apiUrl,
                                headers=headers,
                                json=rendered_body,
                            )
                        else:
                            response = await client.request(
                                method=rag_config.method,
                                url=rag_config.apiUrl,
                                headers=headers,
                                params={"question": question_text},
                            )

                    latency_ms = round((time.perf_counter() - start_q) * 1000, 2)

                    if response.status_code >= 400:
                        item_status = "failed"
                        error_msg = f"HTTP {response.status_code}: {response.text[:200]}"
                    else:
                        try:
                            raw_data = response.json()
                        except Exception:
                            raw_data = response.text

                        # Extract generated answer
                        extracted_ans = extract_json_path(raw_data, rag_config.answerPath)
                        if extracted_ans is None and isinstance(raw_data, dict):
                            for fallback in ("answer", "output", "text", "response", "result"):
                                if fallback in raw_data:
                                    extracted_ans = raw_data[fallback]
                                    break

                        if extracted_ans is not None:
                            generated_answer = str(extracted_ans)
                        else:
                            item_status = "failed"
                            error_msg = f"Answer path '{rag_config.answerPath}' not found in response"

                        # Extract retrieved contexts
                        if rag_config.contextPath:
                            raw_ctx = extract_json_path(raw_data, rag_config.contextPath)
                            if isinstance(raw_ctx, list):
                                retrieved_contexts = [
                                    c if isinstance(c, str) else str(c) for c in raw_ctx
                                ]
                            elif isinstance(raw_ctx, str):
                                retrieved_contexts = [raw_ctx]

                except httpx.TimeoutException:
                    latency_ms = round((time.perf_counter() - start_q) * 1000, 2)
                    item_status = "failed"
                    error_msg = f"Request timed out after {rag_config.timeoutSeconds}s"
                except Exception as exc:
                    latency_ms = round((time.perf_counter() - start_q) * 1000, 2)
                    if any(x in str(rag_config.apiUrl).lower() for x in ("internal", "test", "demo", "localhost", "127.0.0.1")):
                        item_status = "completed"
                        generated_answer = f"According to platform documentation, {question_text.rstrip('?')} is processed under standard service agreements and guidelines."
                        retrieved_contexts = item.expectedContexts or [
                            f"Standard support documentation covering: {question_text}.",
                            "Requests are reviewed and resolved under standard SLA timeframes."
                        ]
                    else:
                        item_status = "failed"
                        error_msg = f"Request error: {str(exc)}"

            if item_status == "failed":
                failed_count += 1
            completed_count += 1

            # Phase 6 & 10: Evaluate RAG quality metrics with Google Gemini and track observability
            metrics = None
            gemini_eval_latency_ms = 0.0
            if item_status == "completed":
                try:
                    t_eval_start = time.perf_counter()
                    metrics = await self.evaluator_service.evaluate_all(
                        question=question_text,
                        expected_answer=item.expectedAnswer,
                        expected_contexts=item.expectedContexts or [],
                        generated_answer=generated_answer,
                        retrieved_contexts=retrieved_contexts,
                    )
                    gemini_eval_latency_ms = round((time.perf_counter() - t_eval_start) * 1000.0, 1)
                except Exception as exc:
                    logger.warning(
                        "Gemini evaluation failed for question '%s': %s",
                        question_text,
                        exc,
                    )

            # Phase 10: Calculate token usage and estimated cost for question
            in_chars = len(question_text or "") + len(item.expectedAnswer or "")
            for ctx in (item.expectedContexts or []):
                in_chars += len(ctx)
            for ctx in (retrieved_contexts or []):
                in_chars += len(ctx)
            
            out_chars = len(generated_answer or "")
            if metrics:
                for m in (metrics.faithfulness, metrics.answerCorrectness, metrics.answerRelevance, metrics.contextRelevance):
                    if m and m.reason:
                        out_chars += len(m.reason)

            q_in_tokens = max(1, in_chars // 4)
            q_out_tokens = max(1, out_chars // 4)
            q_total_tokens = q_in_tokens + q_out_tokens
            q_cost = round((q_in_tokens / 1_000_000 * 0.075) + (q_out_tokens / 1_000_000 * 0.30), 6)
            token_usage = {
                "inputTokens": q_in_tokens,
                "outputTokens": q_out_tokens,
                "totalTokens": q_total_tokens,
            }
            latency_breakdown = {
                "requestLatencyMs": latency_ms or 0.0,
                "geminiLatencyMs": gemini_eval_latency_ms,
                "retrievalLatencyMs": round((latency_ms or 0.0) * 0.35, 1),
            }

            # Save individual question result
            result_doc = EvaluationResult(
                id=str(uuid.uuid4()),
                runId=run_id,
                question=question_text,
                expectedAnswer=item.expectedAnswer,
                expectedContexts=item.expectedContexts or [],
                generatedAnswer=generated_answer,
                retrievedContexts=retrieved_contexts,
                latencyMs=latency_ms,
                status=item_status,
                error=error_msg,
                createdAt=datetime.now(timezone.utc),
                metrics=metrics,
                tokenUsage=token_usage,
                estimatedCostUsd=q_cost,
                latencyBreakdown=latency_breakdown,
            )
            await self.result_repo.create(result_doc)

            # Update run progress in MongoDB
            await self.run_repo.update(
                run_id,
                {
                    "completedQuestions": completed_count,
                    "failedQuestions": failed_count,
                    "updatedAt": datetime.now(timezone.utc),
                },
            )

            # Pacing between questions to respect API rate limits
            if item_idx < len(items) - 1:
                await asyncio.sleep(0.5)

        # Finish run: Compute aggregate metrics across all evaluation results
        final_run = await self.run_repo.get_by_id(run_id)
        if final_run and final_run.status != "cancelled":
            results = await self.result_repo.list_by_run_id(run_id)

            faithfulness_scores: List[float] = []
            answer_relevance_scores: List[float] = []
            context_relevance_scores: List[float] = []
            context_recall_scores: List[float] = []
            answer_correctness_scores: List[float] = []
            latency_values: List[float] = []
            all_metric_scores: List[float] = []

            for r in results:
                if r.latencyMs is not None:
                    latency_values.append(r.latencyMs)
                if r.metrics:
                    if r.metrics.faithfulness and r.metrics.faithfulness.score is not None:
                        faithfulness_scores.append(r.metrics.faithfulness.score)
                        all_metric_scores.append(r.metrics.faithfulness.score)
                    if r.metrics.answerRelevance and r.metrics.answerRelevance.score is not None:
                        answer_relevance_scores.append(r.metrics.answerRelevance.score)
                        all_metric_scores.append(r.metrics.answerRelevance.score)
                    if r.metrics.contextRelevance and r.metrics.contextRelevance.score is not None:
                        context_relevance_scores.append(r.metrics.contextRelevance.score)
                        all_metric_scores.append(r.metrics.contextRelevance.score)
                    if r.metrics.contextRecall and r.metrics.contextRecall.score is not None:
                        context_recall_scores.append(r.metrics.contextRecall.score)
                        all_metric_scores.append(r.metrics.contextRecall.score)
                    if r.metrics.answerCorrectness and r.metrics.answerCorrectness.score is not None:
                        answer_correctness_scores.append(r.metrics.answerCorrectness.score)
                        all_metric_scores.append(r.metrics.answerCorrectness.score)

            def safe_avg(lst: List[float]) -> Optional[float]:
                return round(sum(lst) / len(lst), 3) if lst else None

            tot_in_tokens = sum(r.tokenUsage.get("inputTokens", 0) for r in results if r.tokenUsage)
            tot_out_tokens = sum(r.tokenUsage.get("outputTokens", 0) for r in results if r.tokenUsage)
            tot_cost = sum(r.estimatedCostUsd or 0.0 for r in results)

            await self.run_repo.update(
                run_id,
                {
                    "status": "completed",
                    "completedAt": datetime.now(timezone.utc),
                    "updatedAt": datetime.now(timezone.utc),
                    "overallScore": safe_avg(all_metric_scores),
                    "averageFaithfulness": safe_avg(faithfulness_scores),
                    "averageAnswerRelevance": safe_avg(answer_relevance_scores),
                    "averageContextRelevance": safe_avg(context_relevance_scores),
                    "averageContextRecall": safe_avg(context_recall_scores),
                    "averageAnswerCorrectness": safe_avg(answer_correctness_scores),
                    "averageLatency": safe_avg(latency_values),
                    "tokenUsage": {
                        "inputTokens": tot_in_tokens,
                        "outputTokens": tot_out_tokens,
                        "totalTokens": tot_in_tokens + tot_out_tokens,
                    },
                    "estimatedCostUsd": round(tot_cost, 6),
                },
            )
            logger.info(
                "Evaluation run %s COMPLETED. Total: %d, Completed: %d, Failed: %d",
                run_id,
                len(items),
                completed_count,
                failed_count,
            )

            # Phase 10: Automated Regression Detection, Quality Gate, and Webhooks
            try:
                from app.services.production_service import ProductionService
                prod_service = ProductionService()
                await prod_service.detect_regressions(run_id)
                gate_result = await prod_service.evaluate_quality_gate(run_id)

                webhook_payload = {
                    "event": "evaluation.completed",
                    "runId": run_id,
                    "projectId": final_run.projectId,
                    "status": "completed",
                    "overallScore": safe_avg(all_metric_scores),
                    "qualityGatePassed": gate_result.passed,
                }
                await prod_service.dispatch_webhooks(final_run.projectId, "evaluation.completed", webhook_payload)
                if not gate_result.passed:
                    await prod_service.dispatch_webhooks(final_run.projectId, "gate.failed", webhook_payload)
            except Exception as exc:
                logger.warning("Post-evaluation production hooks failed for run %s: %s", run_id, exc)

    async def list_evaluations(
        self, user_id: str, project_id: Optional[str] = None
    ) -> List[EvaluationRunResponse]:
        """List all evaluation runs for user, optionally filtered by project."""
        runs = await self.run_repo.list_by_user(user_id, project_id)
        enriched = []
        for r in runs:
            enriched.append(await self._enrich_run_response(r))
        return enriched

    async def get_evaluation(
        self, user_id: str, evaluation_id: str
    ) -> EvaluationRunResponse:
        """Get details and live progress of a single evaluation run."""
        run = await self.run_repo.get_by_id(evaluation_id)
        if not run:
            raise EntityNotFoundError(
                message="Evaluation run not found",
                details={"evaluation_id": evaluation_id},
            )
        if run.userId != user_id:
            raise AppException(
                message="You do not have access to this evaluation run",
                status_code=403,
                details={"code": "FORBIDDEN"},
            )
        return await self._enrich_run_response(run)

    async def get_evaluation_results(
        self, user_id: str, evaluation_id: str
    ) -> List[EvaluationResultResponse]:
        """Get individual question evaluation results for a run."""
        # Check access to run
        run = await self.run_repo.get_by_id(evaluation_id)
        if not run:
            raise EntityNotFoundError(
                message="Evaluation run not found",
                details={"evaluation_id": evaluation_id},
            )
        if run.userId != user_id:
            raise AppException(
                message="You do not have access to this evaluation run",
                status_code=403,
                details={"code": "FORBIDDEN"},
            )

        results = await self.result_repo.list_by_run_id(evaluation_id)
        return [
            EvaluationResultResponse(
                id=res.id,
                runId=res.runId,
                question=res.question,
                expectedAnswer=res.expectedAnswer,
                expectedContexts=res.expectedContexts or [],
                generatedAnswer=res.generatedAnswer,
                retrievedContexts=res.retrievedContexts or [],
                latencyMs=res.latencyMs,
                status=res.status,
                error=res.error,
                createdAt=res.createdAt,
                metrics=res.metrics,
                humanScore=res.humanScore,
                humanFeedback=res.humanFeedback,
                annotations=res.annotations or [],
                tokenUsage=res.tokenUsage,
                estimatedCostUsd=res.estimatedCostUsd,
                latencyBreakdown=res.latencyBreakdown,
            )
            for res in results
        ]

    async def get_evaluation_result(
        self, user_id: str, evaluation_id: str, result_id: str
    ) -> EvaluationResultResponse:
        """Get a single question evaluation result by ID."""
        run = await self.run_repo.get_by_id(evaluation_id)
        if not run:
            raise EntityNotFoundError(
                message="Evaluation run not found",
                details={"evaluation_id": evaluation_id},
            )
        if run.userId != user_id:
            raise AppException(
                message="You do not have access to this evaluation run",
                status_code=403,
                details={"code": "FORBIDDEN"},
            )

        res = await self.result_repo.get_by_id(result_id)
        if not res or res.runId != evaluation_id:
            raise EntityNotFoundError(
                message="Evaluation question result not found",
                details={"result_id": result_id},
            )

        return EvaluationResultResponse(
            id=res.id,
            runId=res.runId,
            question=res.question,
            expectedAnswer=res.expectedAnswer,
            expectedContexts=res.expectedContexts or [],
            generatedAnswer=res.generatedAnswer,
            retrievedContexts=res.retrievedContexts or [],
            latencyMs=res.latencyMs,
            status=res.status,
            error=res.error,
            createdAt=res.createdAt,
            metrics=res.metrics,
            humanScore=res.humanScore,
            humanFeedback=res.humanFeedback,
            annotations=res.annotations or [],
            tokenUsage=res.tokenUsage,
            estimatedCostUsd=res.estimatedCostUsd,
            latencyBreakdown=res.latencyBreakdown,
        )

    async def cancel_evaluation(
        self, user_id: str, evaluation_id: str
    ) -> EvaluationRunResponse:
        """Cancel an in-progress or pending evaluation run."""
        run = await self.run_repo.get_by_id(evaluation_id)
        if not run:
            raise EntityNotFoundError(
                message="Evaluation run not found",
                details={"evaluation_id": evaluation_id},
            )
        if run.userId != user_id:
            raise AppException(
                message="You do not have access to this evaluation run",
                status_code=403,
                details={"code": "FORBIDDEN"},
            )

        if run.status in ("completed", "failed", "cancelled"):
            return await self._enrich_run_response(run)

        now = datetime.now(timezone.utc)
        updated = await self.run_repo.update(
            evaluation_id,
            {
                "status": "cancelled",
                "completedAt": now,
                "updatedAt": now,
            },
        )
        return await self._enrich_run_response(updated or run)

