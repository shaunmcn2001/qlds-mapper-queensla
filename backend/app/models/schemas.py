from pydantic import BaseModel
from typing import List, Dict, Any

class ParcelResolveRequest(BaseModel):
    lotplan: str

class IntersectRequest(BaseModel):
    parcel: Dict[str, Any]
    layer_ids: List[str]
    options: Dict[str, Any] = {}

class ExportKmlRequest(BaseModel):
    parcel: Dict[str, Any]
    layers: List[Dict[str, Any]]
    options: Dict[str, Any] = {}
