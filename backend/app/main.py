# backend/app/main.py

from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import yaml
from typing import List, Dict, Any

from shapely.geometry import mapping, Polygon, MultiPolygon

from .core.settings import settings
from .core.logging import get_logger

from .services.arcgis_client import fetch_all_features
from .services.parcel_resolver import normalize_lotplan, resolve_parcels
from .services.export_kml import write_kmz

# NOTE: we use both polygon + envelope conversions for robust ArcGIS queries
from .utils.geo import (
    geojson_to_esri_polygon,
    geojson_to_esri_envelope,
)

from .models.schemas import (
    ParcelResolveRequest,
    IntersectRequest,
    ExportKmlRequest,
)

log = get_logger(__name__)

app = FastAPI(
    title="Lot/Plan → ArcGIS → KML API",
    version="0.3.0",
)

# --------------------------
# CORS
# --------------------------
origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --------------------------
# Config loader
# --------------------------
def load_layers_config() -> List[Dict[str, Any]]:
    cfg_path = Path(__file__).parent / "config" / "layers.yaml"
    if not cfg_path.exists():
        raise HTTPException(status_code=500, detail="layers.yaml not found")
    with cfg_path.open("r", encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}
    services = data.get("services", [])
    if not isinstance(services, list):
        raise HTTPException(status_code=500, detail="Invalid layers.yaml format")
    return services

# --------------------------
# Simple routes
# --------------------------
@app.get("/")
def root():
    return {"service": "Lot/Plan → ArcGIS → KML API", "status": "ok"}

@app.get("/healthz")
def healthz():
    return {"ok": True}

@app.get("/layers")
def get_layers():
    return {"layers": load_layers_config()}

# --------------------------
# Parcel helpers
# --------------------------
@app.post("/parcel/normalize")
def parcel_normalize(body: ParcelResolveRequest):
    """
    Normalises to exactly 'LOT/PLAN'. Example: '3RP67254' → ['3/RP67254'].
    """
    normalized = normalize_lotplan(body.lotplan)
    if not normalized:
        raise HTTPException(status_code=400, detail="Could not parse lot/plan input")
    return {"normalized": normalized}

@app.post("/parcel/resolve")
async def parcel_resolve(body: ParcelResolveRequest):
    """
    Resolve a parcel geometry via the cadastre.
    Prefers equality on the combined 'lotplan' field, then falls back to lot+plan.
    """
    normalized = normalize_lotplan(body.lotplan)
    if not normalized:
        raise HTTPException(status_code=400, detail="Could not parse lot/plan input")
    try:
        result = await resolve_parcels(normalized)
        return result
    except Exception as e:
        log.exception("Parcel resolve failed")
        raise HTTPException(status_code=500, detail=str(e))

# --------------------------
# Intersect (robust)
# --------------------------
@app.post("/intersect")
async def intersect(body: IntersectRequest):
    """
    Intersect a parcel geometry with one or more configured ArcGIS layers.

    Hardening:
      - Sends ArcGIS /query as POST (form-encoded) to avoid URL length limits.
      - Lightly simplifies parcel in polygon conversion (done in utils.geo).
      - Fallback to envelope (bbox) intersect if polygon query fails.
      - Returns a clear JSON error (502) when upstream ArcGIS fails.
    """
    try:
        layers_cfg = load_layers_config()
        layer_map = {l["id"]: l for l in layers_cfg}

        # Validate layer IDs
        missing = [lid for lid in body.layer_ids if lid not in layer_map]
        if missing:
            raise HTTPException(status_code=400, detail=f"Unknown layer ids: {missing}")

        # Validate parcel geometry
        parcel_geom = body.parcel
        if not parcel_geom:
            raise HTTPException(status_code=400, detail="parcel geometry is required")

        # Build Esri geometries (polygon + envelope fallback)
        esri_poly = geojson_to_esri_polygon(parcel_geom, simplify_tol=1e-6)
        esri_env = geojson_to_esri_envelope(parcel_geom)

        results: List[Dict[str, Any]] = []

        for lid in body.layer_ids:
            layer = layer_map[lid]
            url = layer["url"]
            include_fields = layer.get("fields", {}).get("include", [])
            outFields = ",".join(include_fields) if include_fields else "*"

            common = {
                "outFields": outFields,
                "returnGeometry": "true",
                "outSR": 4326,
                "returnExceededLimitFeatures": "true",
                "maxRecordCountFactor": 2,
            }

            # 1) Try polygon intersect (POST)
            features = []
            try:
                feats = await fetch_all_features(
                    url,
                    {
                        **common,
                        "geometry": esri_poly,
                        "geometryType": "esriGeometryPolygon",
                        "spatialRel": "esriSpatialRelIntersects",
                    },
                )
                features = feats
            except Exception as e_poly:
                # 2) Fallback to envelope intersect
                try:
                    feats = await fetch_all_features(
                        url,
                        {
                            **common,
                            "geometry": esri_env,
                            "geometryType": "esriGeometryEnvelope",
                            "spatialRel": "esriSpatialRelIntersects",
                        },
                    )
                    features = feats
                except Exception as e_env:
                    raise HTTPException(
                        status_code=502,
                        detail=(
                            f"ArcGIS query failed for layer '{lid}'. "
                            f"Polygon error: {e_poly}. Envelope error: {e_env}"
                        ),
                    )

            # Convert Esri rings → GeoJSON polygons
            out_feats = []
            for f in features:
                geom_esri = f.get("geometry") or {}
                rings = geom_esri.get("rings") or []
                if not rings:
                    continue
                try:
                    poly = Polygon(rings[0], holes=rings[1:]) if rings else None
                    if poly and not poly.is_valid:
                        poly = poly.buffer(0)
                    if poly and poly.is_valid and not poly.is_empty:
                        out_feats.append(
                            {
                                "geometry": mapping(poly),
                                "attrs": f.get("attributes", {}),
                                "name": layer.get("name_template", layer.get("label", "Feature")),
                            }
                        )
                except Exception:
                    # Skip malformed feature geometries
                    continue

            results.append(
                {
                    "id": lid,
                    "label": layer.get("label", lid),
                    "features": out_feats,
                    "style": layer.get("style", {}),
                }
            )

        return {"layers": results}

    except HTTPException:
        raise
    except Exception as e:
        log.exception("Intersect failed")
        raise HTTPException(status_code=500, detail=f"Intersect failed: {e}")

# --------------------------
# KML export
# --------------------------
@app.post("/export/kml")
def export_kml(body: ExportKmlRequest):
    """
    Build a KMZ with:
      - Parcel outline (no fill) as a 'Parcel' folder.
      - One folder per layer, with attributes in popup.
    """
    try:
        kmz = write_kmz(body.parcel, body.layers)
        return Response(
            content=kmz,
            media_type="application/vnd.google-earth.kmz",
            headers={"Content-Disposition": 'attachment; filename="export.kmz"'},
        )
    except Exception as e:
        log.exception("KML export failed")
        raise HTTPException(status_code=500, detail=str(e))
