from typing import Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.db.mongodb import mongodb_service
from app.models.user import User


class UserRepository:
    """Repository handling persistence operations for users in MongoDB."""

    def __init__(self, db: Optional[AsyncIOMotorDatabase] = None) -> None:
        self._db = db

    @property
    def collection(self):
        db = self._db or mongodb_service.db
        if db is None:
            raise RuntimeError("Database connection has not been initialized.")
        return db["users"]

    async def ensure_indexes(self) -> None:
        """Create required unique indexes on users collection."""
        await self.collection.create_index("email", unique=True)

    async def get_by_email(self, email: str) -> Optional[User]:
        """Find user by email address (case-insensitive lookup)."""
        normalized_email = email.strip().lower()
        doc = await self.collection.find_one({"email": normalized_email})
        if not doc:
            return None
        return User.from_mongo(doc)

    async def get_by_id(self, user_id: str) -> Optional[User]:
        """Find user by string ID."""
        doc = await self.collection.find_one({"_id": user_id})
        if not doc:
            return None
        return User.from_mongo(doc)

    async def create(self, user: User) -> User:
        """Insert new user into users collection."""
        mongo_doc = user.to_mongo()
        await self.collection.insert_one(mongo_doc)
        return user
