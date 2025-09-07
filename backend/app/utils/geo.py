from shapely.geometry import shape, mapping, Polygon, MultiPolygon
from typing import Any, Dict, List

def ensure_multipolygon(geom):
    if isinstance(geom, Polygon):
        return MultiPolygon([geom])
    return geom

def geojson_to_esri_polygon(geojson_geom: Dict[str, Any]) -> Dict[str, Any]:
    g = shape(geojson_geom)
    mp = ensure_multipolygon(g)
    rings: List[List[List[float]]] = []
    for poly in mp.geoms:
        rings.append([[x, y] for x, y in poly.exterior.coords])
        for interior in poly.interiors:
            rings.append([[x, y] for x, y in interior.coords])
    return {"rings": rings, "spatialReference": {"wkid": 4326}}
