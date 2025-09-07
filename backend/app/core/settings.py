from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    CORS_ORIGINS: str = "http://localhost:5173"
    HTTP_TIMEOUT_SECONDS: int = 60
    ARCGIS_CONCURRENCY: int = 4
    CADASTRE_URL: str | None = None
    CADASTRE_LOT_FIELD: str = "LOT"
    CADASTRE_PLAN_FIELD: str = "PLAN"

settings = Settings()
