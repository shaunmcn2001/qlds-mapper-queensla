# backend/app/utils/geo.py
# Pure-JSON helpers for ArcGIS geometry payloads (no Shapely here).

from typing import Any, Dict, List, Tuple

def _iter_coords(geom: Dict[str, Any]):
    """Yield all (x,y) coordinate pairs from a GeoJSON Polygon/MultiPolygon."""
    gtype = (geom or {}).get("type")
    coords = (geom or {}).get("coordinates", [])
    if gtype == "Polygon":
        for ring in coords:
            for x, y in ring:
                yield float(x), float(y)
    elif gtype == "MultiPolygon":
        for poly in coords:
            for ring in poly:
                for x, y in ring:
                    yield float(x), float(y)

def _bbox_from_geojson(geom: Dict[str, Any]) -> Tuple[float, float, float, float]:
    xmin = ymin = float("inf")
    xmax = ymax = float("-inf")
    found = False
    for x, y in _iter_coords(geom):
        found = True
        if x < xmin: xmin = x
        if x > xmax: xmax = x
        if y < ymin: ymin = y
        if y > ymax: ymax = y
    if not found:
        # fallback empty bbox
        return (0.0, 0.0, 0.0, 0.0)
    return (xmin, ymin, xmax, ymax)

def geojson_to_esri_polygon(geojson_geom: Dict[str, Any], simplify_tol: float = 0.0) -> Dict[str, Any]:
    """
    Convert GeoJSON Polygon/MultiPolygon → Esri polygon (rings).
    No simplification here (kept pure JSON to avoid Shapely).
    """
    gtype = (geojson_geom or {}).get("type")
    coords = (geojson_geom or {}).get("coordinates", [])
    rings: List[List[List[float]]] = []

    if gtype == "Polygon":
        for ring in coords:
            if not ring or len(ring) < 4:  # must be closed ring with at least 4 points
                continue
            rings.append([[float(x), float(y)] for x, y in ring])
    elif gtype == "MultiPolygon":
        for poly in coords:
            # Each poly is list of rings
            for ring in poly:
                if not ring or len(ring) < 4:
                    continue
                rings.append([[float(x), float(y)] for x, y in ring])

    return {"rings": rings, "spatialReference": {"wkid": 4326}}

def geojson_to_esri_envelope(geojson_geom: Dict[str, Any]) -> Dict[str, Any]:
    xmin, ymin, xmax, ymax = _bbox_from_geojson(geojson_geom)
    return {
        "xmin": xmin, "ymin": ymin, "xmax": xmax, "ymax": ymax,
        "spatialReference": {"wkid": 4326}
    }
