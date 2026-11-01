from datetime import datetime, timezone
import hashlib
import hmac
import json
import secrets
from typing import Any, Dict, List, Optional
import uuid
import httpx

from app.core.exceptions import AppException, EntityNotFoundError
from app.core.logging import get_logger
from app.models.production import (
    ApiKey,
    AuditLog,
    EvaluationSchedule,
    EvaluationThresholds,
    WebhookConfig,
    Workspace,
)
from app.repositories.evaluation_repository import (
    EvaluationResultRepository,
    EvaluationRunRepository,
)
from app.repositories.production_repository import (
    ApiKeyRepository,
    AuditLogRepository,
    ScheduleRepository,
    ThresholdRepository,
    WebhookRepository,
    WorkspaceRepository,
)
from app.repositories.project_repository import ProjectRepository
from app.schemas.production import (
    ApiKeyResponse,
    QualityGateRequest,
    QualityGateResponse,
    ProjectTrendsResponse,
    TrendPoint,
)

logger = get_logger("production_service")


class ProductionService:
    """Service providing production-grade enterprise features:
    API Keys, Quality Gates, Webhooks, Schedules, Workspaces, Audit Logs, Export, and Observability.
    """

    def __init__(
        self,
        api_key_repo: Optional[ApiKeyRepository] = None,
        threshold_repo: Optional[ThresholdRepository] = None,
        webhook_repo: Optional[WebhookRepository] = None,
        schedule_repo: Optional[ScheduleRepository] = None,
        workspace_repo: Optional[WorkspaceRepository] = None,
        audit_repo: Optional[AuditLogRepository] = None,
        run_repo: Optional[EvaluationRunRepository] = None,
        result_repo: Optional[EvaluationResultRepository] = None,
        project_repo: Optional[ProjectRepository] = None,
    ) -> None:
        self.api_key_repo = api_key_repo or ApiKeyRepository()
        self.threshold_repo = threshold_repo or ThresholdRepository()
        self.webhook_repo = webhook_repo or WebhookRepository()
        self.schedule_repo = schedule_repo or ScheduleRepository()
        self.workspace_repo = workspace_repo or WorkspaceRepository()
        self.audit_repo = audit_repo or AuditLogRepository()
        self.run_repo = run_repo or EvaluationRunRepository()
        self.result_repo = result_repo or EvaluationResultRepository()
        self.project_repo = project_repo or ProjectRepository()

    # --- 1. API Keys & Authentication ---

    @staticmethod
    def hash_key(raw_key: str) -> str:
        return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()

    async def create_api_key(
        self, user_id: str, name: str, project_id: Optional[str] = None
    ) -> ApiKeyResponse:
        """Create a new external integration API key. The full secret is returned ONLY once."""
        raw_token = f"rageval_{secrets.token_urlsafe(32)}"
        key_prefix = raw_token[:16] + "..."
        hashed = self.hash_key(raw_token)

        key = ApiKey(
            id=str(uuid.uuid4()),
            userId=user_id,
            projectId=project_id,
            name=name,
            keyPrefix=key_prefix,
            hashedKey=hashed,
            createdAt=datetime.now(timezone.utc),
            isRevoked=False,
        )
        saved = await self.api_key_repo.create(key)

        await self.audit_repo.create(
            AuditLog(
                id=str(uuid.uuid4()),
                userId=user_id,
                action="create_api_key",
                entityType="api_key",
                entityId=saved.id,
                details={"name": name, "projectId": project_id},
            )
        )

        return ApiKeyResponse(
            id=saved.id,
            name=saved.name,
            keyPrefix=saved.keyPrefix,
            secretKey=raw_token,
            projectId=saved.projectId,
            createdAt=saved.createdAt,
            lastUsedAt=saved.lastUsedAt,
            isRevoked=saved.isRevoked,
        )

    async def list_api_keys(self, user_id: str) -> List[ApiKeyResponse]:
        keys = await self.api_key_repo.list_by_user(user_id)
        return [
            ApiKeyResponse(
                id=k.id,
                name=k.name,
                keyPrefix=k.keyPrefix,
                secretKey=None,
                projectId=k.projectId,
                createdAt=k.createdAt,
                lastUsedAt=k.lastUsedAt,
                isRevoked=k.isRevoked,
            )
            for k in keys
        ]

    async def revoke_api_key(self, user_id: str, key_id: str) -> bool:
        revoked = await self.api_key_repo.revoke(key_id, user_id)
        if revoked:
            await self.audit_repo.create(
                AuditLog(
                    id=str(uuid.uuid4()),
                    userId=user_id,
                    action="revoke_api_key",
                    entityType="api_key",
                    entityId=key_id,
                    details={},
                )
            )
        return revoked

    async def authenticate_raw_key(self, raw_key: str) -> Optional[ApiKey]:
        """Validate an API key and update last used timestamp."""
        hashed = self.hash_key(raw_key.strip())
        key = await self.api_key_repo.get_by_hashed_key(hashed)
        if key:
            await self.api_key_repo.record_usage(key.id)
        return key

    # --- 2. Quality Gate Evaluation ---

    async def evaluate_quality_gate(
        self, run_id: str, overrides: Optional[QualityGateRequest] = None
    ) -> QualityGateResponse:
        """Evaluate whether an evaluation run satisfies project quality gate thresholds."""
        run = await self.run_repo.get_by_id(run_id)
        if not run:
            raise EntityNotFoundError("Evaluation run not found", {"runId": run_id})

        if run.status != "completed":
            return QualityGateResponse(
                passed=False,
                score=run.overallScore or 0.0,
                thresholds={},
                actuals={},
                failures=[f"Evaluation run is not completed (current status: {run.status})."],
                runId=run_id,
                status=run.status,
            )

        # Retrieve default project thresholds
        base_thresholds = await self.threshold_repo.get_by_project(run.projectId)
        threshold_dict = base_thresholds.model_dump()

        # Apply overrides if provided
        if overrides:
            override_data = overrides.model_dump(exclude_unset=True)
            for k, v in override_data.items():
                if v is not None:
                    threshold_dict[k] = v

        failures: List[str] = []
        actuals: Dict[str, Any] = {
            "overallScore": run.overallScore,
            "faithfulness": run.averageFaithfulness,
            "answerCorrectness": run.averageAnswerCorrectness,
            "answerRelevance": run.averageAnswerRelevance,
            "contextRelevance": run.averageContextRelevance,
            "contextRecall": run.averageContextRecall,
            "maxLatencyMs": run.averageLatency,
        }

        # Check thresholds
        if threshold_dict.get("overallScore") is not None:
            min_score = float(threshold_dict["overallScore"])
            actual = run.overallScore or 0.0
            if actual < min_score:
                failures.append(f"Overall score {actual:.2f} is below threshold {min_score:.2f}")

        if threshold_dict.get("faithfulness") is not None and run.averageFaithfulness is not None:
            min_f = float(threshold_dict["faithfulness"])
            if run.averageFaithfulness < min_f:
                failures.append(f"Faithfulness {run.averageFaithfulness:.2f} is below threshold {min_f:.2f}")

        if threshold_dict.get("answerCorrectness") is not None and run.averageAnswerCorrectness is not None:
            min_c = float(threshold_dict["answerCorrectness"])
            if run.averageAnswerCorrectness < min_c:
                failures.append(f"Answer Correctness {run.averageAnswerCorrectness:.2f} is below threshold {min_c:.2f}")

        if threshold_dict.get("answerRelevance") is not None and run.averageAnswerRelevance is not None:
            min_r = float(threshold_dict["answerRelevance"])
            if run.averageAnswerRelevance < min_r:
                failures.append(f"Answer Relevance {run.averageAnswerRelevance:.2f} is below threshold {min_r:.2f}")

        if threshold_dict.get("contextRelevance") is not None and run.averageContextRelevance is not None:
            min_cr = float(threshold_dict["contextRelevance"])
            if run.averageContextRelevance < min_cr:
                failures.append(f"Context Relevance {run.averageContextRelevance:.2f} is below threshold {min_cr:.2f}")

        if threshold_dict.get("maxLatencyMs") is not None and run.averageLatency is not None:
            max_lat = float(threshold_dict["maxLatencyMs"])
            if run.averageLatency > max_lat:
                failures.append(f"Average latency {run.averageLatency:.1f}ms exceeds threshold {max_lat:.1f}ms")

        passed = len(failures) == 0
        await self.run_repo.update(run_id, {"qualityGatePassed": passed})

        return QualityGateResponse(
            passed=passed,
            score=run.overallScore or 0.0,
            thresholds=threshold_dict,
            actuals=actuals,
            failures=failures,
            runId=run_id,
            status=run.status,
        )

    # --- 3. Automated Regression Detection ---

    async def detect_regressions(self, current_run_id: str) -> Dict[str, Any]:
        """Compare current run against the preceding completed run for the same project/dataset."""
        current_run = await self.run_repo.get_by_id(current_run_id)
        if not current_run or current_run.status != "completed":
            return {"regression": False}

        # Find previous completed run
        db = self.run_repo._db or self.run_repo.collection.database
        cursor = db["evaluation_runs"].find(
            {
                "projectId": current_run.projectId,
                "datasetId": current_run.datasetId,
                "status": "completed",
                "_id": {"$ne": current_run.id},
                "createdAt": {"$lt": current_run.createdAt},
            }
        ).sort("createdAt", -1).limit(1)

        prev_docs = await cursor.to_list(length=1)
        if not prev_docs:
            return {"regression": False, "message": "Baseline run established"}

        prev_doc = prev_docs[0]
        prev_overall = prev_doc.get("overallScore")
        current_overall = current_run.overallScore

        regression = False
        details: List[str] = []

        if prev_overall is not None and current_overall is not None:
            drop = prev_overall - current_overall
            if drop >= 0.05:
                regression = True
                details.append(f"Overall quality dropped by {drop:.2f} ({prev_overall:.2f} -> {current_overall:.2f})")

        prev_latency = prev_doc.get("averageLatency")
        current_latency = current_run.averageLatency
        if prev_latency and current_latency and (current_latency > prev_latency * 1.5):
            regression = True
            details.append(f"Latency increased significantly ({prev_latency:.0f}ms -> {current_latency:.0f}ms)")

        detail_msg = "; ".join(details) if details else None
        await self.run_repo.update(
            current_run_id,
            {
                "regressionDetected": regression,
                "regressionDetails": detail_msg,
            },
        )
        return {"regression": regression, "details": detail_msg}

    # --- 4. Webhooks & Notifications ---

    async def dispatch_webhooks(self, project_id: str, event: str, payload: Dict[str, Any]) -> None:
        """Dispatch signed HTTP POST webhooks asynchronously to registered subscribers."""
        hooks = await self.webhook_repo.list_by_project(project_id)
        if not hooks:
            return

        body_str = json.dumps(payload, default=str)
        async with httpx.AsyncClient(timeout=10.0) as client:
            for hook in hooks:
                if event not in hook.events:
                    continue
                headers = {"Content-Type": "application/json", "X-Event": event}
                if hook.secret:
                    sig = hmac.new(hook.secret.encode(), body_str.encode(), hashlib.sha256).hexdigest()
                    headers["X-Signature-256"] = f"sha256={sig}"
                try:
                    await client.post(hook.url, content=body_str, headers=headers)
                    await self.webhook_repo.record_trigger(hook.id)
                except Exception as exc:
                    logger.warning("Webhook dispatch failed for %s: %s", hook.url, exc)

    # --- 5. Export Results (CSV & JSON) ---

    async def export_run_csv(self, run_id: str) -> str:
        """Export an evaluation run and all question results as CSV."""
        run = await self.run_repo.get_by_id(run_id)
        if not run:
            raise EntityNotFoundError("Evaluation run not found", {"runId": run_id})

        results = await self.result_repo.list_by_run_id(run_id)

        headers = [
            "ResultId",
            "Question",
            "ExpectedAnswer",
            "GeneratedAnswer",
            "LatencyMs",
            "Status",
            "Faithfulness",
            "AnswerRelevance",
            "ContextRelevance",
            "AnswerCorrectness",
            "GeminiReason",
            "HumanScore",
            "HumanFeedback",
            "Annotations",
        ]

        import csv
        import io

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(headers)

        for r in results:
            faithfulness = r.metrics.faithfulness.score if (r.metrics and r.metrics.faithfulness) else ""
            relevance = r.metrics.answerRelevance.score if (r.metrics and r.metrics.answerRelevance) else ""
            ctx_rel = r.metrics.contextRelevance.score if (r.metrics and r.metrics.contextRelevance) else ""
            correctness = r.metrics.answerCorrectness.score if (r.metrics and r.metrics.answerCorrectness) else ""
            
            reasons = []
            if r.metrics:
                for m in (r.metrics.faithfulness, r.metrics.answerCorrectness, r.metrics.answerRelevance):
                    if m and m.reason:
                        reasons.append(m.reason)
            gemini_reason = " | ".join(reasons)

            writer.writerow([
                r.id,
                r.question or "",
                r.expectedAnswer or "",
                r.generatedAnswer or "",
                f"{r.latencyMs:.1f}" if r.latencyMs is not None else "",
                r.status,
                faithfulness,
                relevance,
                ctx_rel,
                correctness,
                gemini_reason,
                r.humanScore or "",
                r.humanFeedback or "",
                ";".join(r.annotations or []),
            ])

        return output.getvalue()

    async def export_run_json(self, run_id: str) -> Dict[str, Any]:
        """Export full serialized run and all granular question evaluations as JSON."""
        run = await self.run_repo.get_by_id(run_id)
        if not run:
            raise EntityNotFoundError("Evaluation run not found", {"runId": run_id})

        results = await self.result_repo.list_by_run_id(run_id)
        return {
            "evaluationRun": run.model_dump(),
            "results": [r.model_dump() for r in results],
        }

    # --- 6. Human Review & Question Annotations ---

    async def record_human_eval(
        self, result_id: str, human_score: float, human_feedback: Optional[str] = None
    ) -> bool:
        """Attach a human reviewer score (1.0-5.0) and feedback note to a question result."""
        res = await self.result_repo.collection.update_one(
            {"_id": result_id},
            {"$set": {"humanScore": human_score, "humanFeedback": human_feedback}},
        )
        return res.modified_count > 0

    async def set_annotations(self, result_id: str, annotations: List[str]) -> bool:
        """Tag/annotate an individual question evaluation result."""
        res = await self.result_repo.collection.update_one(
            {"_id": result_id},
            {"$set": {"annotations": annotations}},
        )
        return res.modified_count > 0

    # --- 7. Historical Trends ---

    async def get_project_trends(self, project_id: str, user_id: str) -> ProjectTrendsResponse:
        """Retrieve chronological run points for tracking regression and quality trajectory."""
        runs = await self.run_repo.list_by_user(user_id, project_id=project_id)
        runs_sorted = sorted(runs, key=lambda r: r.createdAt)

        points = []
        for r in runs_sorted:
            points.append(
                TrendPoint(
                    runId=r.id,
                    createdAt=r.createdAt.isoformat() if isinstance(r.createdAt, datetime) else str(r.createdAt),
                    overallScore=r.overallScore,
                    faithfulness=r.averageFaithfulness,
                    answerCorrectness=r.averageAnswerCorrectness,
                    averageLatency=r.averageLatency,
                    status=r.status,
                    promptVersion=r.promptVersion,
                )
            )

        return ProjectTrendsResponse(
            projectId=project_id,
            totalRuns=len(points),
            trends=points,
        )

