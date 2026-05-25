import os

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


def _normalize_asyncpg_url(url: str) -> str:
    if url.startswith("postgres://"):
        return "postgresql+asyncpg://" + url[len("postgres://") :]
    if url.startswith("postgresql://"):
        return "postgresql+asyncpg://" + url[len("postgresql://") :]
    if url.startswith("postgresql+psycopg://"):
        return "postgresql+asyncpg://" + url[len("postgresql+psycopg://") :]
    return url


def _compose_pg_url_from_parts() -> str | None:
    host = os.getenv("PGHOST")
    port = os.getenv("PGPORT")
    user = os.getenv("PGUSER")
    password = os.getenv("PGPASSWORD")
    database = os.getenv("PGDATABASE")
    if not all([host, port, user, password, database]):
        return None
    return f"postgresql+asyncpg://{user}:{password}@{host}:{port}/{database}"


def _resolve_database_url() -> str:
    direct = os.getenv("DATABASE_URL") or os.getenv("POSTGRES_URL") or os.getenv("POSTGRESQL_URL")
    if direct:
        return _normalize_asyncpg_url(direct)

    from_parts = _compose_pg_url_from_parts()
    if from_parts:
        return from_parts

    return "postgresql+asyncpg://postgres:postgres@localhost:5432/poker"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="")

    database_url: str = Field(default_factory=_resolve_database_url)
    room_code_length: int = 6


settings = Settings()
