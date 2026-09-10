from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.user import Role


class UserPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    role: Role


class UserListItem(UserPublic):
    created_at: datetime


class LoginRequest(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=8, max_length=128)


class UserCreate(LoginRequest):
    role: Role

    @field_validator("username")
    @classmethod
    def valid_username(cls, value: str) -> str:
        if not value.isascii() or not all(c.isalnum() or c in "_-" for c in value):
            raise ValueError("username may contain only ASCII letters, numbers, _ and -")
        return value
