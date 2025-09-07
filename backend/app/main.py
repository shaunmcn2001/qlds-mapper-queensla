from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic_settings import BaseSettings
import yaml
from pathlib import Path
import os

class Settings(BaseSettings):
    CORS_ORIGINS: str = "http://localhost:5173"
    HTTP_TIMEOUT_SECONDS: int = 60
    ARCGIS_CONCURRENCY: int = 4

settings = Settings()

app = FastAPI(title="Lot/Plan → ArcGIS → KML API", version="0.1.0")

# CORS
origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def load_layers():
    cfg_path = Path(__file__).parent / "config" / "layers.yaml"
    if not cfg_path.exists():
        raise HTTPException(status_code=500, detail="layers.yaml not found")
    with cfg_path.open("r", encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}
    return data.get("services", [])

@app.get("/healthz")
def healthz():
    return {"ok": True}

@app.get("/layers")
def get_layers():
    return {"layers": load_layers()}

# Placeholders for next steps (you can flesh these out later)
@app.post("/parcel/resolve")
def parcel_resolve(body: dict):
    # TODO: implement QLD cadastre lookup and geometry return
    q = body.get("lotplan")
    if not q:
        raise HTTPException(status_code=400, detail="lotplan is required")
    return {"lotplan": q, "parcel": None, "note": "Resolver not implemented yet"}

@app.post("/intersect")
def intersect(body: dict):
    # TODO: implement ArcGIS queries against selected layers
    return {"features_by_layer": {}, "note": "Intersect not implemented yet"}

@app.post("/export/kml")
def export_kml(body: dict):
    # TODO: build and stream KMZ
    return {"note": "KML export not implemented yet"}
