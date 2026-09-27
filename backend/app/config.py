from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    GROQ_API_KEY: str = ""
    DATABASE_URL: str = "postgresql+psycopg2://localhost:5432/deviation_intake"
    MODEL_PRIMARY: str = "openai/gpt-oss-120b"
    MODEL_FALLBACK: str = "openai/gpt-oss-20b"
    FRONTEND_ORIGIN: str = "http://localhost:5173"


settings = Settings()
