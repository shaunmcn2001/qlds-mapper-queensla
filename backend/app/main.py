from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import yaml
from typing import List, Dict, Any
from shapely.geometry import mapping

from .core.settings import settings
from .core.logging import get_logger
from .utils.geo import geojson_to_esri_polygon
from .services.arcgis_client import fetch_all_features
from .services.parcel_resolver import normalize_lotplan, resolve_parcels
from .services.export_kml import write_kmz
from .models.schemas import ParcelResolveRequest, IntersectRequest, ExportKmlRequest

log = get_logger(__name__)
app = FastAPI(title="Lot/Plan → ArcGIS → KML API", version="0.2.0")

origins = [o.strip() for o in settings.CORS_ORIGINS.split(',') if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def load_layers_config() -> List[Dict[str, Any]]:
    cfg_path = Path(__file__).parent / 'config' / 'layers.yaml'
    if not cfg_path.exists():
        raise HTTPException(status_code=500, detail='layers.yaml not found')
    with cfg_path.open('r', encoding='utf-8') as f:
        data = yaml.safe_load(f) or {}
    return data.get('services', [])

@app.get("/")
def root():
    return {"service": "Lot/Plan → ArcGIS → KML API", "status": "ok"}

@app.get("/healthz")
def healthz():
    return {"ok": True}

@app.get("/layers")
def get_layers():
    return {"layers": load_layers_config()}

@app.post("/parcel/normalize")
def parcel_normalize(body: ParcelResolveRequest):
    normalized = normalize_lotplan(body.lotplan)
    if not normalized:
        raise HTTPException(status_code=400, detail='Could not parse lot/plan input')
    return {"normalized": normalized}

@app.post("/parcel/resolve")
async def parcel_resolve(body: ParcelResolveRequest):
    normalized = normalize_lotplan(body.lotplan)
    if not normalized:
        raise HTTPException(status_code=400, detail='Could not parse lot/plan input')
    try:
        result = await resolve_parcels(normalized)
        return result
    except Exception as e:
        log.exception('Parcel resolve failed')
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/intersect")
async def intersect(body: IntersectRequest):
    layers = load_layers_config()
    layer_map = {l['id']: l for l in layers}
    missing = [lid for lid in body.layer_ids if lid not in layer_map]
    if missing:
        raise HTTPException(status_code=400, detail=f"Unknown layer ids: {missing}")
    parcel_geom = body.parcel
    if not parcel_geom:
        raise HTTPException(status_code=400, detail='parcel geometry is required')
    esri_geom = geojson_to_esri_polygon(parcel_geom)
    out = []
    for lid in body.layer_ids:
        layer = layer_map[lid]
        url = layer['url']
        include_fields = layer.get('fields', {}).get('include', [])
        outFields = ','.join(include_fields) if include_fields else '*'
        feats = await fetch_all_features(url, {
            'geometry': esri_geom,
            'geometryType': 'esriGeometryPolygon',
            'spatialRel': 'esriSpatialRelIntersects',
            'outFields': outFields,
            'returnGeometry': 'true',
            'outSR': 4326
        })
        features = []
        from shapely.geometry import Polygon
        for f in feats:
            geom_esri = f.get('geometry') or {}
            rings = geom_esri.get('rings')
            if not rings: continue
            poly = Polygon(rings[0], holes=rings[1:]) if rings else None
            if poly and not poly.is_valid: poly = poly.buffer(0)
            if poly:
                features.append({
                    'geometry': mapping(poly),
                    'attrs': f.get('attributes', {}),
                    'name': layer.get('name_template', layer.get('label', 'Feature'))
                })
        out.append({'id': lid, 'label': layer.get('label', lid), 'features': features, 'style': layer.get('style', {})})
    return {'layers': out}

@app.post("/export/kml")
def export_kml(body: ExportKmlRequest):
    try:
        kmz = write_kmz(body.parcel, body.layers)
        return Response(content=kmz, media_type='application/vnd.google-earth.kmz',
                        headers={'Content-Disposition': 'attachment; filename="export.kmz"'})
    except Exception as e:
        log.exception('KML export failed')
        raise HTTPException(status_code=500, detail=str(e))
