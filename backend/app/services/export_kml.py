import io, zipfile
import simplekml
from shapely.geometry import shape
from typing import List, Dict, Any

def write_kmz(parcel_geojson: Dict[str, Any], layers: List[Dict[str, Any]]) -> bytes:
    kml = simplekml.Kml()
    if parcel_geojson:
        geom = shape(parcel_geojson)
        polys = [geom] if geom.geom_type == 'Polygon' else list(geom.geoms)
        folder = kml.newfolder(name="Parcel")
        for i, poly in enumerate(polys, 1):
            p = folder.newpolygon(
                name=f"Parcel {i}",
                outerboundaryis=list(poly.exterior.coords),
                innerboundaryis=[list(r.coords) for r in poly.interiors],
            )
            p.style.polystyle.fill = 0
            p.style.linestyle.width = 3
    for layer in layers:
        lf = kml.newfolder(name=layer.get('label', layer.get('id', 'Layer')))
        style_cfg = layer.get('style', {})
        poly_opacity = float(style_cfg.get('poly_opacity', 0.35))
        line_width = int(style_cfg.get('line_width', 1))
        for f in layer.get('features', []):
            geom = shape(f['geometry'])
            name = f.get('name') or layer.get('label', 'Feature')
            desc = "<br/>".join([f"<b>{k}</b>: {v}" for k,v in f.get('attrs',{}).items() if v])
            if geom.geom_type in ('Polygon','MultiPolygon'):
                polys = [geom] if geom.geom_type=='Polygon' else list(geom.geoms)
                for poly in polys:
                    pm = lf.newpolygon(
                        name=name,
                        outerboundaryis=list(poly.exterior.coords),
                        innerboundaryis=[list(r.coords) for r in poly.interiors],
                    )
                    pm.style.polystyle.color = simplekml.Color.changealphaint(int(poly_opacity*255), simplekml.Color.white)
                    pm.style.linestyle.width = line_width
                    pm.description = desc
    buf = io.BytesIO()
    with zipfile.ZipFile(buf,'w',zipfile.ZIP_DEFLATED) as z:
        z.writestr('doc.kml',kml.kml())
    return buf.getvalue()
