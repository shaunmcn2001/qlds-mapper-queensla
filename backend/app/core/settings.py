from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    CORS_ORIGINS: str = "http://localhost:5173"
    HTTP_TIMEOUT_SECONDS: int = 60
    ARCGIS_CONCURRENCY: int = 4

    # Cadastre fields
    CADASTRE_URL: str | None = None
    CADASTRE_LOT_FIELD: str = "lot"       # <- match your service’s lowercase names if needed
    CADASTRE_PLAN_FIELD: str = "plan"
    CADASTRE_LOTPLAN_FIELD: str | None = "lotplan"  # <- use this when available

settings = Settings()
