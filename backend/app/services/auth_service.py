from datetime import datetime, timezone
from typing import Optional
import uuid
from app.core.exceptions import AppException, EntityNotFoundError
from app.core.security import (
    create_access_token,
    hash_password,
    verify_password,
)
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.auth import (
    TokenResponse,
    UserLoginRequest,
    UserRegisterRequest,
    UserResponse,
)


class AuthService:
    """Authentication business logic service."""

    def __init__(self, user_repo: Optional[UserRepository] = None) -> None:
        self.user_repo = user_repo or UserRepository()

    async def register(self, payload: UserRegisterRequest) -> TokenResponse:
        """Register a new user, hash password, and issue access token."""
        normalized_email = payload.email.strip().lower()

        # Check for duplicate email
        existing_user = await self.user_repo.get_by_email(normalized_email)
        if existing_user:
            raise AppException(
                message="A user with this email already exists",
                status_code=409,
                details={"field": "email"},
            )

        now = datetime.now(timezone.utc)
        user_id = str(uuid.uuid4())
        hashed_password = hash_password(payload.password)

        new_user = User(
            id=user_id,
            email=normalized_email,
            passwordHash=hashed_password,
            name=payload.name.strip(),
            createdAt=now,
            updatedAt=now,
        )

        created_user = await self.user_repo.create(new_user)
        access_token = create_access_token(subject=created_user.id, email=created_user.email)

        user_response = UserResponse(
            id=created_user.id,
            email=created_user.email,
            name=created_user.name,
            createdAt=created_user.createdAt,
            updatedAt=created_user.updatedAt,
        )

        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            user=user_response,
        )

    async def login(self, payload: UserLoginRequest) -> TokenResponse:
        """Authenticate user credentials and issue access token."""
        normalized_email = payload.email.strip().lower()
        user = await self.user_repo.get_by_email(normalized_email)

        if not user or not verify_password(payload.password, user.passwordHash):
            raise AppException(
                message="Invalid email or password",
                status_code=401,
                details={"code": "INVALID_CREDENTIALS"},
            )

        access_token = create_access_token(subject=user.id, email=user.email)

        user_response = UserResponse(
            id=user.id,
            email=user.email,
            name=user.name,
            createdAt=user.createdAt,
            updatedAt=user.updatedAt,
        )

        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            user=user_response,
        )

    async def get_current_user(self, user_id: str) -> UserResponse:
        """Retrieve user profile by ID."""
        user = await self.user_repo.get_by_id(user_id)
        if not user:
            raise EntityNotFoundError(
                message="User not found",
                details={"user_id": user_id},
            )

        return UserResponse(
            id=user.id,
            email=user.email,
            name=user.name,
            createdAt=user.createdAt,
            updatedAt=user.updatedAt,
        )
