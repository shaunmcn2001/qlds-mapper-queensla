import httpx
from typing import Dict, Any, List
from ..core.settings import settings

BASE_PARAMS = {"f": "json"}

async def arcgis_get(url: str, params: Dict[str, Any]) -> Dict[str, Any]:
    q = {**BASE_PARAMS, **params}
    timeout = httpx.Timeout(settings.HTTP_TIMEOUT_SECONDS)
    async with httpx.AsyncClient(timeout=timeout) as client:
        r = await client.get(url.rstrip('/') + '/query', params=q)
        r.raise_for_status()
        data = r.json()
        if 'error' in data:
            raise RuntimeError(str(data['error']))
        return data

async def fetch_all_features(layer_url: str, params: Dict[str, Any]) -> List[Dict[str, Any]]:
    features: List[Dict[str, Any]] = []
    result_offset = 0
    while True:
        page = await arcgis_get(layer_url, {**params, "resultOffset": result_offset})
        feats = page.get('features', [])
        features.extend(feats)
        if not page.get('exceededTransferLimit'):
            break
        result_offset += len(feats)
        if len(feats) == 0:
            break
    return features
