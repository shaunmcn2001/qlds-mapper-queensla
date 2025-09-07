from shapely.geometry import shape, Polygon, MultiPolygon, mapping, box
from shapely.geometry.base import BaseGeometry
from typing import Any, Dict, List

def ensure_multipolygon(geom: BaseGeometry):
    if isinstance(geom, Polygon):
        return MultiPolygon([geom])
    return geom

def simplify_geom(geom: BaseGeometry, tol: float = 1e-6) -> BaseGeometry:
    try:
        g2 = geom.simplify(tol, preserve_topology=True)
        return g2 if (not g2.is_empty and g2.is_valid) else geom
    except Exception:
        return geom

def geojson_to_esri_polygon(geojson_geom: Dict[str, Any], simplify_tol: float = 1e-6) -> Dict[str, Any]:
    """
    Convert GeoJSON Polygon/MultiPolygon → Esri JSON polygon with rings (EPSG:4326).
    Lightly simplifies first to reduce payload size.
    """
    g = shape(geojson_geom)
    g = simplify_geom(g, simplify_tol)
    mp = ensure_multipolygon(g)
    rings: List[List[List[float]]] = []
    for poly in mp.geoms:
        rings.append([[x, y] for x, y in poly.exterior.coords])
        for interior in poly.interiors:
            rings.append([[x, y] for x, y in interior.coords])
    return {"rings": rings, "spatialReference": {"wkid": 4326}}

def geojson_to_esri_envelope(geojson_geom: Dict[str, Any]) -> Dict[str, Any]:
    """
    Return an Esri JSON envelope (xmin,ymin,xmax,ymax) for bbox fallback.
    """
    g = shape(geojson_geom)
    minx, miny, maxx, maxy = g.bounds
    return {
        "xmin": minx, "ymin": miny, "xmax": maxx, "ymax": maxy,
        "spatialReference": {"wkid": 4326}
    }
