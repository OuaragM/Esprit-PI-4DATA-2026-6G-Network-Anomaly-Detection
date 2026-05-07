import logging
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.schemas.user import InviteCreate, UserCreate, UserUpdate
from app.services.auth_service import hash_password, log_action
from app.services.password_gen import generate_temp_password

log = logging.getLogger(__name__)


async def list_users(db: AsyncSession) -> list[User]:
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    return list(result.scalars().all())


async def get_user(db: AsyncSession, user_id: UUID) -> User | None:
    return await db.get(User, user_id)


async def create_user(db: AsyncSession, payload: UserCreate, actor_id: UUID) -> User:
    """Legacy path — direct password supplied by caller."""
    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        role=payload.role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    await log_action(db, actor_id, "create_user", target=user.email, details={"role": user.role})
    return user


async def invite_user(
    db: AsyncSession, payload: InviteCreate, actor_id: UUID
) -> tuple[User, str]:
    """
    Create a user with an auto-generated password and must_change_password=True.
    Returns (user, plaintext_temp_password) — caller is responsible for emailing it.
    """
    temp_password = generate_temp_password()
    user = User(
        email=payload.email,
        hashed_password=hash_password(temp_password),
        full_name=payload.full_name or "",
        role=payload.role,
        must_change_password=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    await log_action(
        db, actor_id, "invite_user",
        target=user.email, details={"role": user.role},
    )
    return user, temp_password


async def update_user(db: AsyncSession, user_id: UUID, payload: UserUpdate, actor_id: UUID) -> User | None:
    user = await db.get(User, user_id)
    if user is None:
        return None
    changes = payload.model_dump(exclude_unset=True)
    for k, v in changes.items():
        setattr(user, k, v)
    await db.commit()
    await db.refresh(user)
    await log_action(db, actor_id, "update_user", target=user.email, details=changes)
    return user


async def soft_delete_user(db: AsyncSession, user_id: UUID, actor_id: UUID) -> bool:
    user = await db.get(User, user_id)
    if user is None:
        return False
    user.is_active = False
    await db.commit()
    await log_action(db, actor_id, "deactivate_user", target=user.email)
    return True


async def hard_delete_user(db: AsyncSession, user_id: UUID, actor_id: UUID) -> bool:
    """Permanently removes the user row. Only allowed on inactive accounts."""
    user = await db.get(User, user_id)
    if user is None:
        return False
    email = user.email
    await db.delete(user)
    await db.commit()
    await log_action(db, actor_id, "hard_delete_user", target=email)
    return True


async def admin_reset_password(
    db: AsyncSession, user_id: UUID, new_password: str, actor_id: UUID
) -> bool:
    """Admin sets a user's password without knowing the current one."""
    user = await db.get(User, user_id)
    if user is None:
        return False
    user.hashed_password = hash_password(new_password)
    await db.commit()
    await log_action(db, actor_id, "admin_reset_password", target=user.email)
    return True


async def change_own_password(
    db: AsyncSession, user_id: UUID, current_password: str, new_password: str
) -> bool:
    """Self-service password change. Returns False if current_password is wrong."""
    from app.services.auth_service import verify_password

    user = await db.get(User, user_id)
    if user is None:
        return False
    if not verify_password(current_password, user.hashed_password):
        return False
    user.hashed_password = hash_password(new_password)
    user.must_change_password = False
    await db.commit()
    await log_action(db, user_id, "change_password", target=user.email)
    return True
