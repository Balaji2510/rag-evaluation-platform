from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.db.mongodb import mongodb_service
from app.models.production import (
    ApiKey,
    AuditLog,
    EvaluationSchedule,
    EvaluationThresholds,
    WebhookConfig,
    Workspace,
)


class ApiKeyRepository:
    """Repository handling persistence for external API keys."""

    def __init__(self, db: Optional[AsyncIOMotorDatabase] = None) -> None:
        self._db = db

    @property
    def collection(self):
        db = self._db or mongodb_service.db
        if db is None:
            raise RuntimeError("Database connection has not been initialized.")
        return db["api_keys"]

    async def get_by_id(self, key_id: str) -> Optional[ApiKey]:
        doc = await self.collection.find_one({"_id": key_id})
        return ApiKey.from_mongo(doc) if doc else None

    async def get_by_hashed_key(self, hashed_key: str) -> Optional[ApiKey]:
        doc = await self.collection.find_one({"hashedKey": hashed_key, "isRevoked": False})
        return ApiKey.from_mongo(doc) if doc else None

    async def list_by_user(self, user_id: str) -> List[ApiKey]:
        cursor = self.collection.find({"userId": user_id, "isRevoked": False}).sort("createdAt", -1)
        keys = []
        async for doc in cursor:
            keys.append(ApiKey.from_mongo(doc))
        return keys

    async def create(self, key: ApiKey) -> ApiKey:
        await self.collection.insert_one(key.to_mongo())
        return key

    async def revoke(self, key_id: str, user_id: str) -> bool:
        res = await self.collection.update_one(
            {"_id": key_id, "userId": user_id},
            {"$set": {"isRevoked": True, "updatedAt": datetime.now(timezone.utc)}},
        )
        return res.modified_count > 0

    async def record_usage(self, key_id: str) -> None:
        await self.collection.update_one(
            {"_id": key_id},
            {"$set": {"lastUsedAt": datetime.now(timezone.utc)}},
        )


class ThresholdRepository:
    """Repository for project evaluation thresholds."""

    def __init__(self, db: Optional[AsyncIOMotorDatabase] = None) -> None:
        self._db = db

    @property
    def collection(self):
        db = self._db or mongodb_service.db
        if db is None:
            raise RuntimeError("Database connection has not been initialized.")
        return db["evaluation_thresholds"]

    async def get_by_project(self, project_id: str) -> EvaluationThresholds:
        doc = await self.collection.find_one({"_id": project_id})
        if not doc:
            return EvaluationThresholds()
        doc.pop("_id", None)
        return EvaluationThresholds(**doc)

    async def set_for_project(self, project_id: str, thresholds: EvaluationThresholds) -> EvaluationThresholds:
        data = thresholds.model_dump()
        data["_id"] = project_id
        await self.collection.replace_one({"_id": project_id}, data, upsert=True)
        return thresholds


class WebhookRepository:
    """Repository for managing webhook configurations."""

    def __init__(self, db: Optional[AsyncIOMotorDatabase] = None) -> None:
        self._db = db

    @property
    def collection(self):
        db = self._db or mongodb_service.db
        if db is None:
            raise RuntimeError("Database connection has not been initialized.")
        return db["webhooks"]

    async def get_by_id(self, webhook_id: str) -> Optional[WebhookConfig]:
        doc = await self.collection.find_one({"_id": webhook_id})
        return WebhookConfig.from_mongo(doc) if doc else None

    async def list_by_project(self, project_id: str) -> List[WebhookConfig]:
        cursor = self.collection.find({"projectId": project_id, "isActive": True}).sort("createdAt", -1)
        hooks = []
        async for doc in cursor:
            hooks.append(WebhookConfig.from_mongo(doc))
        return hooks

    async def create(self, webhook: WebhookConfig) -> WebhookConfig:
        await self.collection.insert_one(webhook.to_mongo())
        return webhook

    async def delete(self, webhook_id: str) -> bool:
        res = await self.collection.delete_one({"_id": webhook_id})
        return res.deleted_count > 0

    async def record_trigger(self, webhook_id: str) -> None:
        await self.collection.update_one(
            {"_id": webhook_id},
            {"$set": {"lastTriggeredAt": datetime.now(timezone.utc)}},
        )


class ScheduleRepository:
    """Repository for managing recurring evaluation schedules."""

    def __init__(self, db: Optional[AsyncIOMotorDatabase] = None) -> None:
        self._db = db

    @property
    def collection(self):
        db = self._db or mongodb_service.db
        if db is None:
            raise RuntimeError("Database connection has not been initialized.")
        return db["evaluation_schedules"]

    async def get_by_id(self, schedule_id: str) -> Optional[EvaluationSchedule]:
        doc = await self.collection.find_one({"_id": schedule_id})
        return EvaluationSchedule.from_mongo(doc) if doc else None

    async def list_by_project(self, project_id: str) -> List[EvaluationSchedule]:
        cursor = self.collection.find({"projectId": project_id, "isActive": True}).sort("createdAt", -1)
        schedules = []
        async for doc in cursor:
            schedules.append(EvaluationSchedule.from_mongo(doc))
        return schedules

    async def create(self, schedule: EvaluationSchedule) -> EvaluationSchedule:
        await self.collection.insert_one(schedule.to_mongo())
        return schedule

    async def delete(self, schedule_id: str) -> bool:
        res = await self.collection.delete_one({"_id": schedule_id})
        return res.deleted_count > 0


class WorkspaceRepository:
    """Repository for team workspaces and member access."""

    def __init__(self, db: Optional[AsyncIOMotorDatabase] = None) -> None:
        self._db = db

    @property
    def collection(self):
        db = self._db or mongodb_service.db
        if db is None:
            raise RuntimeError("Database connection has not been initialized.")
        return db["workspaces"]

    async def get_by_id(self, workspace_id: str) -> Optional[Workspace]:
        doc = await self.collection.find_one({"_id": workspace_id})
        return Workspace.from_mongo(doc) if doc else None

    async def list_for_user(self, user_id: str) -> List[Workspace]:
        cursor = self.collection.find(
            {"$or": [{"ownerId": user_id}, {"members.userId": user_id}]}
        ).sort("createdAt", -1)
        workspaces = []
        async for doc in cursor:
            workspaces.append(Workspace.from_mongo(doc))
        return workspaces

    async def create(self, workspace: Workspace) -> Workspace:
        await self.collection.insert_one(workspace.to_mongo())
        return workspace


class AuditLogRepository:
    """Repository for audit trail persistence."""

    def __init__(self, db: Optional[AsyncIOMotorDatabase] = None) -> None:
        self._db = db

    @property
    def collection(self):
        db = self._db or mongodb_service.db
        if db is None:
            raise RuntimeError("Database connection has not been initialized.")
        return db["audit_logs"]

    async def create(self, log: AuditLog) -> AuditLog:
        await self.collection.insert_one(log.to_mongo())
        return log

    async def list_by_project_or_user(self, user_id: str, project_id: Optional[str] = None, limit: int = 50) -> List[AuditLog]:
        query: Dict[str, Any] = {"userId": user_id}
        if project_id:
            query = {"$or": [{"userId": user_id, "entityId": project_id}, {"userId": user_id, "details.projectId": project_id}]}
        cursor = self.collection.find(query).sort("createdAt", -1).limit(limit)
        logs = []
        async for doc in cursor:
            logs.append(AuditLog.from_mongo(doc))
        return logs

