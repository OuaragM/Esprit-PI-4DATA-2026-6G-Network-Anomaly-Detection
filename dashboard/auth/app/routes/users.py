import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.routes.deps import actor_from_headers
from app.schemas.user import (
    InviteCreate,
    InviteResponse,
    PasswordChangeRequest,
    PasswordResetRequest,
    UserPublic,
    UserUpdate,
)
from app.services import user_service
from app.services.email_service import send_invite_email

log = logging.getLogger(__name__)

router = APIRouter(tags=["users"])


def _require_admin(identity: tuple[UUID, str]) -> UUID:
    actor_id, role = identity
    if role != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")
    return actor_id


@router.post("/auth/register", response_model=InviteResponse, status_code=201)
async def register(
    payload: InviteCreate,
    identity: tuple[UUID, str] = Depends(actor_from_headers),
    db: AsyncSession = Depends(get_db),
):
    """Admin invites a new user — password is auto-generated and emailed."""
    actor_id = _require_admin(identity)
    existing = await user_service.list_users(db)
    if any(u.email == payload.email for u in existing):
        raise HTTPException(status_code=409, detail="Email already registered")

    user, temp_password = await user_service.invite_user(db, payload, actor_id)

    email_sent = False
    email_error: str | None = None
    try:
        await send_invite_email(
            to_email=user.email,
            full_name=user.full_name,
            role=user.role,
            temp_password=temp_password,
        )
        email_sent = True
    except Exception as exc:
        log.warning("Failed to send invite email to %s: %s", user.email, exc)
        email_error = str(exc)

    return InviteResponse(
        user=UserPublic.model_validate(user),
        email_sent=email_sent,
        email_error=email_error,
    )


@router.get("/users", response_model=list[UserPublic])
async def list_users(
    identity: tuple[UUID, str] = Depends(actor_from_headers),
    db: AsyncSession = Depends(get_db),
):
    _require_admin(identity)
    return await user_service.list_users(db)


@router.get("/users/{user_id}", response_model=UserPublic)
async def get_user(
    user_id: UUID,
    identity: tuple[UUID, str] = Depends(actor_from_headers),
    db: AsyncSession = Depends(get_db),
):
    _require_admin(identity)
    user = await user_service.get_user(db, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.put("/users/{user_id}", response_model=UserPublic)
async def update_user(
    user_id: UUID,
    payload: UserUpdate,
    identity: tuple[UUID, str] = Depends(actor_from_headers),
    db: AsyncSession = Depends(get_db),
):
    actor_id = _require_admin(identity)
    if user_id == actor_id and payload.role is not None and payload.role != "admin":
        raise HTTPException(status_code=400, detail="Cannot demote yourself")
    if user_id == actor_id and payload.is_active is False:
        raise HTTPException(status_code=400, detail="Cannot deactivate yourself")
    user = await user_service.update_user(db, user_id, payload, actor_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.delete("/users/{user_id}", status_code=204)
async def deactivate_user(
    user_id: UUID,
    identity: tuple[UUID, str] = Depends(actor_from_headers),
    db: AsyncSession = Depends(get_db),
):
    """Soft delete — sets is_active=False, row is preserved."""
    actor_id = _require_admin(identity)
    if user_id == actor_id:
        raise HTTPException(status_code=400, detail="Cannot deactivate yourself")
    ok = await user_service.soft_delete_user(db, user_id, actor_id)
    if not ok:
        raise HTTPException(status_code=404, detail="User not found")
    return None


@router.delete("/users/{user_id}/permanent", status_code=204)
async def hard_delete_user(
    user_id: UUID,
    identity: tuple[UUID, str] = Depends(actor_from_headers),
    db: AsyncSession = Depends(get_db),
):
    """Hard delete — permanently removes the row. User must be inactive first."""
    actor_id = _require_admin(identity)
    if user_id == actor_id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    user = await user_service.get_user(db, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    if user.is_active:
        raise HTTPException(status_code=409, detail="Deactivate the user before permanently deleting them")
    ok = await user_service.hard_delete_user(db, user_id, actor_id)
    if not ok:
        raise HTTPException(status_code=404, detail="User not found")
    return None


@router.post("/users/{user_id}/password", status_code=204)
async def admin_reset_password(
    user_id: UUID,
    payload: PasswordResetRequest,
    identity: tuple[UUID, str] = Depends(actor_from_headers),
    db: AsyncSession = Depends(get_db),
):
    """Admin overrides a user's password without knowing the current one."""
    actor_id = _require_admin(identity)
    ok = await user_service.admin_reset_password(db, user_id, payload.new_password, actor_id)
    if not ok:
        raise HTTPException(status_code=404, detail="User not found")
    return None


@router.post("/auth/change-password", status_code=204)
async def change_password(
    payload: PasswordChangeRequest,
    identity: tuple[UUID, str] = Depends(actor_from_headers),
    db: AsyncSession = Depends(get_db),
):
    """Authenticated user changes their own password (current_password required)."""
    actor_id, _role = identity
    ok = await user_service.change_own_password(
        db, actor_id, payload.current_password, payload.new_password,
    )
    if not ok:
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    return None