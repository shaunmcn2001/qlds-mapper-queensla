import re
from typing import List, Dict, Any
from shapely.geometry import Polygon, mapping
from shapely.ops import unary_union
from ..core.settings import settings
from .arcgis_client import fetch_all_features

LOTPLAN_RX = re.compile(r"(?i)(?:lot\s*)?(?P<lot>[A-Z0-9\-]+)(?:\s*(?:sec(?:tion)?\s*)?(?P<section>[A-Z0-9]+))?\s*(?:on\s*)?(?:sp|rp|cp|dp|op|bp|ep|ap|mp|gdp|sr|cve|plan)?\s*(?P<plan>[A-Z]{1,3}\s*\d{1,7}|\d{1,7}|[A-Z]{1,3}\d{1,7})")

def _expand_range(lot: str) -> List[str]:
    if '-' in lot:
        a, b = lot.split('-', 1)
        if a.isdigit() and b.isdigit():
            return [str(i) for i in range(int(a), int(b) + 1)]
    return [lot]

def normalize_lotplan(text: str) -> List[str]:
    text = text.strip().replace('/', ' ').replace(',', ' ')
    parts = [p for p in re.split(r'[&]|\band\b', text, flags=re.IGNORECASE) if p.strip()]
    results: List[str] = []
    for part in parts:
        m = LOTPLAN_RX.search(part)
        if not m: continue
        lot_raw = (m.group('lot') or '').upper().replace('L', '').strip()
        section = (m.group('section') or '').upper().strip()
        plan_raw = (m.group('plan') or '').upper().replace(' ', '').strip()
        for lot in _expand_range(lot_raw):
            results.append(f"{lot}/{section}/{plan_raw}" if section else f"{lot}//{plan_raw}")
    out, seen = [], set()
    for r in results:
        if r not in seen:
            out.append(r); seen.add(r)
    return out

async def resolve_parcels(lotplans: List[str]) -> Dict[str, Any]:
    if not settings.CADASTRE_URL:
        raise RuntimeError("CADASTRE_URL not set. Provide a QLD cadastre layer endpoint via env.")
    lot_field = settings.CADASTRE_LOT_FIELD
    plan_field = settings.CADASTRE_PLAN_FIELD

    geoms, matched = [], []
    for lp in lotplans:
        lot, section, plan = lp.split('/')
        plan_nospace = plan.replace(' ', '')
        candidates = [plan, plan_nospace]
        feats = []
        for p in candidates:
            where_candidates = [
                f"UPPER({lot_field}) = '{lot.upper()}' AND REPLACE(UPPER({plan_field}), ' ', '') = '{p}'",
                f"UPPER({lot_field}) = '{lot.upper()}' AND UPPER({plan_field}) = '{p}'",
            ]
            for w in where_candidates:
                try:
                    feats = await fetch_all_features(settings.CADASTRE_URL, {
                        'where': w,
                        'outFields': f"{lot_field},{plan_field}",
                        'returnGeometry': 'true',
                        'outSR': 4326
                    })
                    if feats: break
                except Exception: continue
            if feats: break

        from shapely.geometry import Polygon
        for f in feats:
            geom_esri = f.get('geometry') or {}
            rings = geom_esri.get('rings') or []
            if not rings: continue
            poly = Polygon(rings[0], holes=rings[1:]) if rings else None
            if poly and not poly.is_valid: poly = poly.buffer(0)
            if poly:
                geoms.append(poly)
                attrs = f.get('attributes', {})
                matched.append({'lot': str(attrs.get(lot_field, lot)), 'plan': str(attrs.get(plan_field, plan))})

    if not geoms:
        return {'parcel': None, 'matched': []}
    from shapely.ops import unary_union
    unioned = unary_union(geoms)
    return {'parcel': mapping(unioned), 'matched': matched}
