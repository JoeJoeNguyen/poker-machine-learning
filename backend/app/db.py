from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from .config import settings


class Base(DeclarativeBase):
    pass


def create_engine() -> AsyncEngine:
    # Ensure the URL uses the asyncpg driver so SQLAlchemy doesn't attempt
    # to import the synchronous psycopg2 DB-API at import time.
    url = settings.database_url
    if url.startswith("postgres://"):
        url = "postgresql+asyncpg://" + url[len("postgres://") :]
    elif url.startswith("postgresql://"):
        url = "postgresql+asyncpg://" + url[len("postgresql://") :]
    elif url.startswith("postgresql+psycopg://"):
        url = "postgresql+asyncpg://" + url[len("postgresql+psycopg://") :]
    return create_async_engine(url, echo=False, future=True)


def create_session_factory(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(engine, expire_on_commit=False)
