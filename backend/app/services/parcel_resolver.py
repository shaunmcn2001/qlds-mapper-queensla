# backend/app/services/parcel_resolver.py

import re
from typing import List, Dict, Any
from shapely.geometry import Polygon, mapping
from shapely.ops import unary_union
from ..core.settings import settings
from .arcgis_client import fetch_all_features

# --- Normalisation patterns ---
# Accepts the following formats and always outputs "LOT/PLAN":
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
# "tight" form like 3RP67254 -> split between lot (leading digits/letters) and plan (alpha+digits)
LP_TIGHT = re.compile(
    r"^\s*(?:L(?:OT)?\s*)?([0-9A-Za-z]+?)([A-Za-z]{1,4}\s*\d{1,7})\s*$",
    re.IGNORECASE,
)


def normalize_lotplan(text: str) -> List[str]:
    """
    Return a single-element list with 'LOT/PLAN' or [] if cannot parse.
    Never inserts a 'section'; we stick to LOT/PLAN because your cadastre exposes `lotplan`.
    """
    s = (text or "").strip()

    # 1) explicit slash form
    m = LP_SLASH.match(s)
    if m:
        lot = m.group(1).upper().lstrip("L")         # allow "L2" inputs
        plan = m.group(2).upper().replace(" ", "")   # remove spaces inside plan code
        return [f"{lot}/{plan}"]

    # 2) space-separated "3 RP67254", "Lot 2 RP53435"
    m = LP_SPACE.match(s)
    if m:
        lot = m.group(1).upper().lstrip("L")
        plan = m.group(2).upper().replace(" ", "")
        return [f"{lot}/{plan}"]

    # 3) tight form "3RP67254"
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


async def resolve_parcels(lotplans: List[str]) -> Dict[str, Any]:
    if not settings.CADASTRE_URL:
        raise RuntimeError("CADASTRE_URL not set. Provide a QLD cadastre layer endpoint via env.")

    lot_field = settings.CADASTRE_LOT_FIELD
    plan_field = settings.CADASTRE_PLAN_FIELD
    lotplan_field = settings.CADASTRE_LOTPLAN_FIELD  # may be None

    geoms = []
    matched: List[Dict[str, str]] = []

    for lp in lotplans:
        # Expect "LOT/PLAN"
        if "/" not in lp:
            continue
        lot, plan = lp.split("/", 1)
        lot_u = lot.upper().strip()
        plan_u = plan.upper().replace(" ", "")

        feats = []

        # A) Try LOTPLAN field first (exact uppercase match)
        if lotplan_field:
            where_lp = f"UPPER({lotplan_field}) = '{lot_u}/{plan_u}'"
            try:
                feats = await fetch_all_features(settings.CADASTRE_URL, {
                    "where": where_lp,
                    "outFields": f"{lot_field},{plan_field},{lotplan_field}",
                    "returnGeometry": "true",
                    "outSR": 4326
                })
            except Exception:
                feats = []

        # B) Fallback to LOT + PLAN (ignore optional spaces in PLAN)
        if not feats:
            where_candidates = [
                # If service supports REPLACE
                f"UPPER({lot_field}) = '{lot_u}' AND REPLACE(UPPER({plan_field}), ' ', '') = '{plan_u}'",
                # Plain equality (if values are stored without spaces)
                f"UPPER({lot_field}) = '{lot_u}' AND UPPER({plan_field}) = '{plan_u}'",
            ]
            for w in where_candidates:
                try:
                    feats = await fetch_all_features(settings.CADASTRE_URL, {
                        "where": w,
                        "outFields": f"{lot_field},{plan_field}" + (f",{lotplan_field}" if lotplan_field else ""),
                        "returnGeometry": "true",
                        "outSR": 4326
                    })
                    if feats:
                        break
                except Exception:
                    continue

        # Build geometry
        for f in feats:
            geom_esri = f.get("geometry") or {}
            rings = geom_esri.get("rings") or []
            if not rings:
                continue
            poly = Polygon(rings[0], holes=rings[1:]) if rings else None
            if poly and not poly.is_valid:
                poly = poly.buffer(0)
            if poly:
                geoms.append(poly)
                attrs = f.get("attributes", {})
                matched.append({
                    "lot": str(attrs.get(lot_field, lot_u)),
                    "plan": str(attrs.get(plan_field, plan_u)),
                    "lotplan": f"{lot_u}/{plan_u}",
                })

    if not geoms:
        return {"parcel": None, "matched": []}

    unioned = unary_union(geoms)
    return {"parcel": mapping(unioned), "matched": matched}
