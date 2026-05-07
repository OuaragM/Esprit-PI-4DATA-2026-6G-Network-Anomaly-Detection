from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

Role = Literal["security_analyst", "admin", "data_scientist"]


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class UserPublic(BaseModel):
    id: UUID
    email: EmailStr
    full_name: str
    role: Role
    is_active: bool
    must_change_password: bool = False
    created_at: datetime

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserPublic


class AccessTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserCreate(BaseModel):
    """Legacy schema kept for internal use; prefer InviteCreate for the API."""
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str = Field(min_length=1, max_length=255)
    role: Role = "security_analyst"


class InviteCreate(BaseModel):
    """Admin creates a user by email — password is auto-generated and emailed."""
    email: EmailStr
    full_name: str = Field(default="", max_length=255)
    role: Role = "security_analyst"


class InviteResponse(BaseModel):
    user: UserPublic
    email_sent: bool
    email_error: str | None = None


class UserUpdate(BaseModel):
    full_name: str | None = None
    role: Role | None = None
    is_active: bool | None = None


class PasswordResetRequest(BaseModel):
    """Admin-only — set any user's password without knowing the current one."""
    new_password: str = Field(min_length=8)


class PasswordChangeRequest(BaseModel):
    """Self-service — current password required to change your own."""
    current_password: str
    new_password: str = Field(min_length=8)
