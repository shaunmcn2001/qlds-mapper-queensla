import re
from typing import List, Dict, Any, Optional

from shapely.geometry import Polygon, MultiPolygon, mapping
from shapely.ops import unary_union

from ..core.settings import settings
from .arcgis_client import fetch_all_features


# ---------- Normalisation to LOT/PLAN ----------

# Accepts:
#   "3RP67254"      -> "3/RP67254"
#   "3/RP67254"     -> "3/RP67254"
#   "3 RP67254"     -> "3/RP67254"
#   "L2 RP53435"    -> "2/RP53435"
#   "Lot 2 RP53435" -> "2/RP53435"

LP_SLASH = re.compile(
    r"^\s*([A-Za-z0-9]+)\s*/\s*([A-Za-z]{1,4}\s*\d{1,7})\s*$",
    re.IGNORECASE,
)
LP_SPACE = re.compile(
    r"^\s*(?:L(?:OT)?\s*)?([A-Za-z0-9]+)\s+([A-Za-z]{1,4}\s*\d{1,7})\s*$",
    re.IGNORECASE,
)
LP_TIGHT = re.compile(
    r"^\s*(?:L(?:OT)?\s*)?([0-9A-Za-z]+?)([A-Za-z]{1,4}\s*\d{1,7})\s*$",
    re.IGNORECASE,
)


def normalize_lotplan(text: str) -> List[str]:
    """
    Return a single-element list with 'LOT/PLAN' or [] if cannot parse.
    We never insert a 'section' — cadastre exposes `lotplan` as LOT/PLAN.
    """
    s = (text or "").strip()

    # 1) explicit slash form
    m = LP_SLASH.match(s)
    if m:
        lot = m.group(1).upper().lstrip("L")          # allow "L2" inputs
        plan = m.group(2).upper().replace(" ", "")    # strip spaces in plan
        return [f"{lot}/{plan}"]

    # 2) space-separated "3 RP67254", "Lot 2 RP53435"
    m = LP_SPACE.match(s)
    if m:
        lot = m.group(1).upper().lstrip("L")
        plan = m.group(2).upper().replace(" ", "")
        return [f"{lot}/{plan}"]

    # 3) tight "3RP67254"
    m = LP_TIGHT.match(s)
    if m:
        lot = m.group(1).upper().lstrip("L")
        plan = m.group(2).upper().replace(" ", "")
        return [f"{lot}/{plan}"]

    # 4) fallback: if already looks like LOT/PLAN but with stray spaces
    if "/" in s:
        lot, plan = [p.strip().upper() for p in s.split("/", 1)]
        return [f"{lot}/{plan.replace(' ', '')}"]

    return []


# ---------- Esri → Shapely helpers ----------

def _esri_polygon_to_polygons(geom_esri: Dict[str, Any]) -> List[Polygon]:
    """
    Convert an Esri JSON polygon (with 'rings') to a list of shapely Polygon(s).
    We treat ring[0] as exterior and subsequent rings as holes for that part;
    many QLD parcel layers encode single-part parcels this way. We also guard
    against invalid/degenerate rings.
    """
    polys: List[Polygon] = []
    rings = (geom_esri or {}).get("rings") or []
    if not rings:
        return polys

    # Some services emit multiple outer rings in one "rings" array.
    # We'll group simple: ring0 outer, 1..n holes; then if more rings remain,
    # start a new polygon from the next ring that looks like an outer boundary.
    # This is a pragmatic approach that works with many DCDB exports.
    curr_outer: Optional[List[List[float]]] = None
    curr_holes: List[List[List[float]]] = []

    def _flush():
        if curr_outer:
            try:
                p = Polygon(curr_outer, holes=curr_holes if curr_holes else None)
                if not p.is_valid:
                    p = p.buffer(0)
                if p.is_valid and not p.is_empty:
                    polys.append(p)
            except Exception:
                pass

    for ring in rings:
        if not ring or len(ring) < 4:
            # too short to form a polygon
            continue
        # Heuristic: start a new outer if we have none yet
        if curr_outer is None:
            curr_outer = ring
            curr_holes = []
        else:
            # treat as hole if we already have an outer for this part
            curr_holes.append(ring)

        # NOTE: If your cadastre encodes true multi-part polygons in separate "rings"
        # with orientation hints, a more complete implementation would check ring
        # orientation and bounding to separate parts. This heuristic usually suffices.

    _flush()
    return polys


# ---------- Resolver ----------

async def resolve_parcels(lotplans: List[str]) -> Dict[str, Any]:
    """
    Given a list like ["3/RP67254"], query the cadastre:
      1) Try equality on CADASTRE_LOTPLAN_FIELD (if provided), e.g. UPPER(lotplan)='3/RP67254'
      2) Fallback to CADASTRE_LOT_FIELD + CADASTRE_PLAN_FIELD (ignoring spaces in plan)
    Returns {'parcel': <GeoJSON Polygon/MultiPolygon> | None, 'matched': [ ... ] }
    """
    if not settings.CADASTRE_URL:
        raise RuntimeError("CADASTRE_URL not set. Provide a QLD cadastre layer endpoint via env.")

    lot_field = settings.CADASTRE_LOT_FIELD
    plan_field = settings.CADASTRE_PLAN_FIELD
    lotplan_field = getattr(settings, "CADASTRE_LOTPLAN_FIELD", None)

    geoms: List[Polygon] = []
    matched: List[Dict[str, str]] = []

    for lp in lotplans:
        if "/" not in lp:
            continue

        lot, plan = lp.split("/", 1)
        lot_u = lot.upper().strip()
        plan_u = plan.upper().replace(" ", "")

        feats = []

        # A) Prefer the combined 'lotplan' field
        if lotplan_field:
            where_lp = f"UPPER({lotplan_field}) = '{lot_u}/{plan_u}'"
            try:
                feats = await fetch_all_features(
                    settings.CADASTRE_URL,
                    {
                        "where": where_lp,
                        "outFields": f"{lot_field},{plan_field},{lotplan_field}",
                        "returnGeometry": "true",
                        "outSR": 4326,
                    },
                )
            except Exception:
                feats = []

        # B) Fallback to lot + plan (ignore spaces in plan if REPLACE is supported)
        if not feats:
            where_candidates = [
                f"UPPER({lot_field}) = '{lot_u}' AND REPLACE(UPPER({plan_field}), ' ', '') = '{plan_u}'",
                f"UPPER({lot_field}) = '{lot_u}' AND UPPER({plan_field}) = '{plan_u}'",
            ]
            for w in where_candidates:
                try:
                    feats = await fetch_all_features(
                        settings.CADASTRE_URL,
                        {
                            "where": w,
                            "outFields": f"{lot_field},{plan_field}"
                            + (f",{lotplan_field}" if lotplan_field else ""),
                            "returnGeometry": "true",
                            "outSR": 4326,
                        },
                    )
                    if feats:
                        break
                except Exception:
                    continue

        # Convert Esri geometries → shapely Polygons
        for f in feats:
            for poly in _esri_polygon_to_polygons(f.get("geometry") or {}):
                if poly and poly.is_valid and not poly.is_empty:
                    geoms.append(poly)
                    attrs = f.get("attributes", {}) or {}
                    matched.append(
                        {
                            "lot": str(attrs.get(lot_field, lot_u)),
                            "plan": str(attrs.get(plan_field, plan_u)),
                            "lotplan": f"{lot_u}/{plan_u}",
                        }
                    )

    if not geoms:
        return {"parcel": None, "matched": []}

    # Robust union with fallbacks
    try:
        unioned = unary_union(geoms)
        # Ensure polygonal output only
        if unioned.geom_type == "Polygon":
            return {"parcel": mapping(unioned), "matched": matched}
        elif unioned.geom_type == "MultiPolygon":
            return {"parcel": mapping(unioned), "matched": matched}
        else:
            # Unexpected (e.g., GeometryCollection) — fall back to MultiPolygon
            mp = MultiPolygon([g for g in geoms if isinstance(g, Polygon)])
            return {"parcel": mapping(mp), "matched": matched}
    except Exception:
        try:
            mp = MultiPolygon([g for g in geoms if isinstance(g, Polygon)])
            return {"parcel": mapping(mp), "matched": matched}
        except Exception:
            # Last resort: return the first polygon only
            return {"parcel": mapping(geoms[0]), "matched": matched}
