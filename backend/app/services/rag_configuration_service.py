from datetime import datetime, timezone
import json
import re
import time
from typing import Any, Dict, List, Optional
import uuid
import httpx
from app.core.exceptions import AppException, EntityNotFoundError
from app.core.logging import get_logger
from app.models.rag_configuration import RAGConfiguration
from app.repositories.project_repository import ProjectRepository
from app.repositories.rag_configuration_repository import RAGConfigurationRepository
from app.schemas.rag_configuration import (
    RAGConfigurationCreate,
    RAGConfigurationResponse,
    RAGConfigurationUpdate,
    RAGTestResponse,
    mask_headers,
)

logger = get_logger("rag_config_service")


def extract_json_path(data: Any, path: Optional[str]) -> Any:
    """Traverse a dictionary or list using dot and index notation e.g. 'data.answer' or 'choices[0].text'."""
    if not path or not data:
        return None

    # Clean path (strip leading slash or dot)
    clean_path = path.strip().lstrip("./")
    # Split by dots or bracket indices e.g. a[0].b -> ['a', '0', 'b']
    tokens = re.split(r"\.|\[(\d+)\]", clean_path)
    tokens = [t for t in tokens if t is not None and t != ""]

    curr = data
    for token in tokens:
        if isinstance(curr, dict):
            if token in curr:
                curr = curr[token]
            else:
                return None
        elif isinstance(curr, list):
            try:
                idx = int(token)
                if 0 <= idx < len(curr):
                    curr = curr[idx]
                else:
                    return None
            except ValueError:
                return None
        else:
            return None

    return curr


def render_template(template: Any, question: str) -> Any:
    """Recursively replace {{question}} placeholder with the question string."""
    if isinstance(template, str):
        return template.replace("{{question}}", question)
    elif isinstance(template, dict):
        return {k: render_template(v, question) for k, v in template.items()}
    elif isinstance(template, list):
        return [render_template(item, question) for item in template]
    return template


class RAGConfigurationService:
    """Service handling RAG application configurations and test pings."""

    def __init__(
        self,
        rag_repo: Optional[RAGConfigurationRepository] = None,
        project_repo: Optional[ProjectRepository] = None,
    ) -> None:
        self.rag_repo = rag_repo or RAGConfigurationRepository()
        self.project_repo = project_repo or ProjectRepository()

    async def _verify_project_access(self, project_id: str, user_id: str) -> None:
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

    async def _get_and_verify_config(self, config_id: str, user_id: str) -> RAGConfiguration:
        config = await self.rag_repo.get_by_id(config_id)
        if not config:
            raise EntityNotFoundError(
                message="RAG configuration not found",
                details={"config_id": config_id},
            )
        await self._verify_project_access(config.projectId, user_id)
        return config

    def _to_response(self, config: RAGConfiguration) -> RAGConfigurationResponse:
        """Convert domain model to safe response with masked sensitive headers."""
        return RAGConfigurationResponse(
            id=config.id,
            projectId=config.projectId,
            name=config.name,
            apiUrl=config.apiUrl,
            method=config.method,
            headers=mask_headers(config.headers),
            requestTemplate=config.requestTemplate,
            answerPath=config.answerPath,
            contextPath=config.contextPath,
            timeoutSeconds=config.timeoutSeconds,
            createdAt=config.createdAt,
            updatedAt=config.updatedAt,
        )

    async def create_configuration(
        self,
        user_id: str,
        data: RAGConfigurationCreate,
    ) -> RAGConfigurationResponse:
        """Create new RAG application configuration."""
        await self._verify_project_access(data.projectId, user_id)
        now = datetime.now(timezone.utc)
        config_id = str(uuid.uuid4())

        config = RAGConfiguration(
            id=config_id,
            projectId=data.projectId,
            name=data.name.strip(),
            apiUrl=data.apiUrl.strip(),
            method=data.method.upper().strip(),
            headers=data.headers,
            requestTemplate=data.requestTemplate,
            answerPath=data.answerPath.strip(),
            contextPath=data.contextPath.strip() if data.contextPath else None,
            timeoutSeconds=data.timeoutSeconds,
            createdAt=now,
            updatedAt=now,
        )

        created = await self.rag_repo.create(config)
        logger.info("Created RAG configuration %s for project %s", created.id, created.projectId)
        return self._to_response(created)

    async def list_configurations(
        self,
        user_id: str,
        project_id: Optional[str] = None,
    ) -> List[RAGConfigurationResponse]:
        """List RAG configurations for a specific project or all user projects."""
        if project_id:
            await self._verify_project_access(project_id, user_id)
            configs = await self.rag_repo.list_by_project(project_id)
        else:
            user_projects = await self.project_repo.list_by_user(user_id)
            project_ids = [p.id for p in user_projects]
            configs = await self.rag_repo.list_by_projects(project_ids)

        return [self._to_response(c) for c in configs]

    async def get_configuration(
        self,
        config_id: str,
        user_id: str,
    ) -> RAGConfigurationResponse:
        """Retrieve single RAG configuration by ID with masked secrets."""
        config = await self._get_and_verify_config(config_id, user_id)
        return self._to_response(config)

    async def update_configuration(
        self,
        config_id: str,
        user_id: str,
        data: RAGConfigurationUpdate,
    ) -> RAGConfigurationResponse:
        """Update RAG configuration. Preserves existing secret if masked '********' is passed."""
        existing = await self._get_and_verify_config(config_id, user_id)
        updates: Dict[str, Any] = {"updatedAt": datetime.now(timezone.utc)}

        if data.name is not None:
            updates["name"] = data.name.strip()
        if data.apiUrl is not None:
            updates["apiUrl"] = data.apiUrl.strip()
        if data.method is not None:
            updates["method"] = data.method.upper().strip()
        if data.requestTemplate is not None:
            updates["requestTemplate"] = data.requestTemplate
        if data.answerPath is not None:
            updates["answerPath"] = data.answerPath.strip()
        if data.contextPath is not None:
            updates["contextPath"] = data.contextPath.strip() if data.contextPath else None
        if data.timeoutSeconds is not None:
            updates["timeoutSeconds"] = data.timeoutSeconds

        if data.headers is not None:
            # Retain existing secret values if client sent masked string
            merged_headers = dict(data.headers)
            for k, v in merged_headers.items():
                if v == "********" and k in existing.headers:
                    merged_headers[k] = existing.headers[k]
            updates["headers"] = merged_headers

        updated = await self.rag_repo.update(config_id, updates)
        if not updated:
            raise EntityNotFoundError("RAG configuration could not be updated")

        logger.info("Updated RAG configuration %s", config_id)
        return self._to_response(updated)

    async def delete_configuration(self, config_id: str, user_id: str) -> bool:
        """Delete RAG configuration."""
        await self._get_and_verify_config(config_id, user_id)
        deleted = await self.rag_repo.delete(config_id)
        logger.info("Deleted RAG configuration %s", config_id)
        return deleted

    async def test_configuration(
        self,
        config_id: str,
        user_id: str,
        sample_question: str = "What is Retrieval-Augmented Generation?",
    ) -> RAGTestResponse:
        """Test external RAG application connection and verify answer extraction."""
        config = await self._get_and_verify_config(config_id, user_id)
        rendered_body = render_template(config.requestTemplate, sample_question)

        # Prepare request
        client_kwargs: Dict[str, Any] = {
            "timeout": float(config.timeoutSeconds),
            "follow_redirects": True,
        }

        start_time = time.perf_counter()
        status_code: Optional[int] = None
        raw_response: Optional[Any] = None

        logger.info("Testing RAG configuration %s -> %s %s", config.id, config.method, config.apiUrl)

        try:
            async with httpx.AsyncClient(**client_kwargs) as client:
                headers = dict(config.headers)
                if config.method in ("POST", "PUT", "PATCH"):
                    if "Content-Type" not in headers and "content-type" not in headers:
                        headers["Content-Type"] = "application/json"

                    response = await client.request(
                        method=config.method,
                        url=config.apiUrl,
                        headers=headers,
                        json=rendered_body,
                    )
                else:
                    # For GET, pass parameters
                    response = await client.request(
                        method=config.method,
                        url=config.apiUrl,
                        headers=headers,
                        params={"question": sample_question},
                    )

            elapsed_ms = int((time.perf_counter() - start_time) * 1000)
            status_code = response.status_code

            try:
                raw_response = response.json()
            except Exception:
                raw_response = response.text

            if status_code >= 400:
                return RAGTestResponse(
                    success=False,
                    statusCode=status_code,
                    latencyMs=elapsed_ms,
                    rawResponse=raw_response,
                    error=f"Endpoint returned HTTP error {status_code}",
                )

            # Extract answer
            extracted_answer = extract_json_path(raw_response, config.answerPath)
            if extracted_answer is None and isinstance(raw_response, dict):
                # Fallback to common keys
                for fallback_key in ("answer", "output", "text", "response", "result"):
                    if fallback_key in raw_response:
                        extracted_answer = raw_response[fallback_key]
                        break

            # Extract contexts
            extracted_contexts: List[str] = []
            if config.contextPath:
                raw_contexts = extract_json_path(raw_response, config.contextPath)
                if isinstance(raw_contexts, list):
                    extracted_contexts = [
                        c if isinstance(c, str) else str(c) for c in raw_contexts
                    ]
                elif isinstance(raw_contexts, str):
                    extracted_contexts = [raw_contexts]

            # Validate extraction
            if extracted_answer is None:
                return RAGTestResponse(
                    success=False,
                    statusCode=status_code,
                    latencyMs=elapsed_ms,
                    rawResponse=raw_response,
                    error=f"Could not extract answer from path '{config.answerPath}'. Check response structure.",
                )

            return RAGTestResponse(
                success=True,
                statusCode=status_code,
                answer=str(extracted_answer),
                contexts=extracted_contexts,
                latencyMs=elapsed_ms,
                rawResponse=raw_response,
            )

        except httpx.TimeoutException:
            elapsed_ms = int((time.perf_counter() - start_time) * 1000)
            return RAGTestResponse(
                success=False,
                latencyMs=elapsed_ms,
                error=f"Request timed out after {config.timeoutSeconds} seconds.",
            )
        except Exception as exc:
            elapsed_ms = int((time.perf_counter() - start_time) * 1000)
            return RAGTestResponse(
                success=False,
                latencyMs=elapsed_ms,
                error=f"Connection failed: {str(exc)}",
            )

