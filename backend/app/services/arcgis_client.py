import httpx, json
from typing import Dict, Any, List
from ..core.settings import settings

BASE_PARAMS = {"f": "json"}

def _prep_params(params: Dict[str, Any]) -> Dict[str, Any]:
    # Always include f=json and a default WHERE
    q = {**BASE_PARAMS, "where": "1=1", **params}

    # If we’re sending a geometry, it must be a JSON STRING; also set inSR
    if "geometry" in q and isinstance(q["geometry"], (dict, list)):
        q["geometry"] = json.dumps(q["geometry"])
        q.setdefault("inSR", 4326)

    # Sensible paging defaults (ArcGIS will cap anyway)
    q.setdefault("resultRecordCount", 2000)
    return q

async def arcgis_query(url: str, params: Dict[str, Any]) -> Dict[str, Any]:
    q = _prep_params(params)
    timeout = httpx.Timeout(settings.HTTP_TIMEOUT_SECONDS)
    async with httpx.AsyncClient(timeout=timeout) as client:
        r = await client.post(url.rstrip('/') + '/query', data=q)
        r.raise_for_status()
        data = r.json()
        if isinstance(data, dict) and "error" in data:
            raise RuntimeError(f"ArcGIS error: {data['error']}")
        return data

async def fetch_all_features(layer_url: str, params: Dict[str, Any]) -> List[Dict[str, Any]]:
    features: List[Dict[str, Any]] = []
    result_offset = 0
    while True:
        page = await arcgis_query(layer_url, {**params, "resultOffset": result_offset})
        feats = page.get("features", [])
        features.extend(feats)
        if not page.get("exceededTransferLimit"):
            break
        result_offset += len(feats)
        if len(feats) == 0:
            break
    return features
