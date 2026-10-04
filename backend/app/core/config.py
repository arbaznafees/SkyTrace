import os
import sys
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Determine path to backend/.env
env_file_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.env"))


class Settings(BaseSettings):
    PROJECT_NAME: str = "SkyTrace"
    API_V1_STR: str = "/api/v1"
    
    # Database: Supabase Session Pooler (port 5432, pooler host)
    DATABASE_URL: str
    
    # Secret Key for JWT Authentication
    JWT_SECRET_KEY: str = "skytrace_tactical_defense_jwt_secret_key_2026"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 12  # 12-hour analyst duty shift
    
    # AI / Model Keys (Gemini for incident classification and RAG chat)
    GEMINI_API_KEY: str

    @field_validator("DATABASE_URL")
    @classmethod
    def validate_database_url(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError(
                "\n[FATAL STARTUP ERROR] DATABASE_URL is missing!\n"
                "Please configure DATABASE_URL in backend/.env with your Supabase session pooler connection string:\n"
                "  postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres\n"
                "(Ensure port 5432 session pooler is used, not 6543 transaction pooler, and vector/postgis extensions are enabled)."
            )
        return v.strip()

    @field_validator("GEMINI_API_KEY")
    @classmethod
    def validate_gemini_api_key(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError(
                "\n[FATAL STARTUP ERROR] GEMINI_API_KEY is missing!\n"
                "Please configure GEMINI_API_KEY in backend/.env with your Google AI Studio API key."
            )
        return v.strip()

    model_config = SettingsConfigDict(
        env_file=env_file_path,
        env_file_encoding="utf-8",
        extra="ignore"
    )


try:
    settings = Settings()
except Exception as e:
    # Print formatted message for startup logs
    print(f"\n==================== CONFIGURATION ERROR ====================\n{e}\n=============================================================\n")
    raise
