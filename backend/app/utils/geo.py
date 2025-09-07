from shapely.geometry import shape, Polygon, MultiPolygon
from shapely.geometry.base import BaseGeometry
from typing import Any, Dict, List

def ensure_multipolygon(geom):
    if isinstance(geom, Polygon):
        from shapely.geometry import MultiPolygon
        return MultiPolygon([geom])
    return geom

def simplify_geom(geom: BaseGeometry, tol: float = 1e-6) -> BaseGeometry:
    try:
        g2 = geom.simplify(tol, preserve_topology=True)
        return g2 if not g2.is_empty else geom
    except Exception:
        return geom

def geojson_to_esri_polygon(geojson_geom: Dict[str, Any]) -> Dict[str, Any]:
    """Convert GeoJSON Polygon/MultiPolygon into Esri JSON polygon with rings in 4326."""
    g = shape(geojson_geom)
    g = simplify_geom(g, 1e-6)  # ← tiny simplification to reduce payload
    mp = ensure_multipolygon(g)
    rings: List[List[List[float]]] = []
    for poly in mp.geoms:
        rings.append([[x, y] for x, y in poly.exterior.coords])
        for interior in poly.interiors:
            rings.append([[x, y] for x, y in interior.coords])
    return {"rings": rings, "spatialReference": {"wkid": 4326}}
