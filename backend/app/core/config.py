from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Pirates of the Aibbean API"
    postgres_db: str = "pirates"
    postgres_user: str = "pirates"
    postgres_password: str = "change-me"
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    session_cookie_name: str = "pirates_session"
    session_cookie_secure: bool = False
    session_cookie_samesite: str = "lax"
    session_lifetime_seconds: int = 604800
    cors_origins: str = "http://localhost:5173"
    bootstrap_admin_username: str | None = None
    bootstrap_admin_password: str | None = None

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+psycopg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
