// src/api.ts or src/lib/gis.ts (where you call fetch)
import { fetchWithTimeout, withRetry } from "./lib/http";

async function asJson(res: Response) {
  if (!res.ok) throw new Error(await res.text() || res.statusText);
  return res.json();
}

const BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

export async function resolveLotPlan(lotplan: string) {
  return withRetry(async () => {
    const r = await fetchWithTimeout(`${BASE}/parcel/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lotplan }),
      timeoutMs: 35000,            // match backend timeout-ish
    });
    return asJson(r);
  });
}

export async function intersect(parcel: any, layerIds: string[]) {
  return withRetry(async () => {
    const r = await fetchWithTimeout(`${BASE}/intersect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parcel, layer_ids: layerIds }),
      timeoutMs: 45000,
    });
    return asJson(r);
  });
}

export async function exportKmz(parcel: any, layers: any[]) {
  return withRetry(async () => {
    const r = await fetchWithTimeout(`${BASE}/export/kml`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parcel, layers }),
      timeoutMs: 45000,
    });
    if (!r.ok) throw new Error(await r.text());
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "export.kmz"; a.click();
    URL.revokeObjectURL(url);
  });
}