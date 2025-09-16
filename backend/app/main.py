# backend/app/main.py

import os

from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import yaml
from typing import List, Dict, Any

from shapely.geometry import mapping  # only used for the parcel outline in /export
from .core.logging import get_logger

from .services.arcgis_client import fetch_all_features
from .services.parcel_resolver import normalize_lotplan, resolve_parcels
from .services.export_kml import write_kmz

# polygon + envelope converters for querying ArcGIS
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
    version="0.3.1",
)

# --------------------------
# CORS
# --------------------------
_cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
_cors_origins = [o.strip() for o in _cors_origins if o.strip()]
if not _cors_origins:
    _cors_origins = ["http://localhost:5173"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
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
# Root / Health / Layers
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
    normalized = normalize_lotplan(body.lotplan)
    if not normalized:
        raise HTTPException(status_code=400, detail="Could not parse lot/plan input")
    return {"normalized": normalized}

@app.post("/parcel/resolve")
async def parcel_resolve(body: ParcelResolveRequest):
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
# Esri→GeoJSON (no Shapely) helper
# --------------------------
def esri_polygon_to_geojson(geom_esri: Dict[str, Any]) -> Dict[str, Any] | None:
    rings = (geom_esri or {}).get("rings") or []
    if not rings:
        return None
    try:
        coords: List[List[List[float]]] = []
        for ring in rings:
            if not ring or len(ring) < 4:
                continue
            coords.append([[float(x), float(y)] for x, y in ring])
        if not coords:
            return None
        return {"type": "Polygon", "coordinates": coords}
    except Exception:
        return None

# --------------------------
# Intersect (robust, ArcGIS POST)
# --------------------------
@app.post("/intersect")
async def intersect(body: IntersectRequest):
    """
    Intersect a parcel geometry with configured ArcGIS layers.

    Hardening:
      - ArcGIS /query via POST (form-encoded) → avoids URL length limits.
      - Slight parcel simplification for the query (in utils.geo).
      - Fallback to envelope (bbox) if polygon query fails.
      - Convert Esri rings → GeoJSON WITHOUT Shapely (prevents GEOS errors).
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

            # 1) Polygon intersect
                        # 1) Polygon intersect (try configured outFields; fallback to '*')
            features = []
            query_errors = []

            def _common(ofields: str):
                return {
                    "outFields": ofields,
                    "returnGeometry": "true",
                    "outSR": 4326,
                    "returnExceededLimitFeatures": "true",
                    "maxRecordCountFactor": 2,
                }

            # Try with configured include list first
            ofields_conf = ",".join(include_fields) if include_fields else "*"

            # --- First attempt: polygon + configured outFields
            try:
                feats = await fetch_all_features(
                    url,
                    {
                        **_common(ofields_conf),
                        "geometry": esri_poly,
                        "geometryType": "esriGeometryPolygon",
                        "spatialRel": "esriSpatialRelIntersects",
                    },
                )
                features = feats
            except Exception as e_poly_conf:
                query_errors.append(f"poly/conf: {e_poly_conf}")
                # --- Second attempt: polygon + outFields='*'
                try:
                    feats = await fetch_all_features(
                        url,
                        {
                            **_common("*"),
                            "geometry": esri_poly,
                            "geometryType": "esriGeometryPolygon",
                            "spatialRel": "esriSpatialRelIntersects",
                        },
                    )
                    features = feats
                except Exception as e_poly_star:
                    query_errors.append(f"poly/*: {e_poly_star}")
                    # --- Fallback: envelope + outFields='*'
                    try:
                        feats = await fetch_all_features(
                            url,
                            {
                                **_common("*"),
                                "geometry": esri_env,
                                "geometryType": "esriGeometryEnvelope",
                                "spatialRel": "esriSpatialRelIntersects",
                            },
                        )
                        features = feats
                    except Exception as e_env_star:
                        query_errors.append(f"env/*: {e_env_star}")
                        raise HTTPException(
                            status_code=502,
                            detail=(
                                f"ArcGIS query failed for layer '{lid}'. Attempts: "
                                + "; ".join(query_errors)
                            ),
                        )

            # Esri → GeoJSON (no Shapely)
            out_feats = []
            for f in features:
                gj = esri_polygon_to_geojson(f.get("geometry") or {})
                if not gj:
                    continue
                out_feats.append(
                    {
                        "geometry": gj,
                        "attrs": f.get("attributes", {}),
                        "name": layer.get("name_template", layer.get("label", "Feature")),
                    }
                )

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
