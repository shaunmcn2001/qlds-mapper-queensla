// Real backend integration for GIS helpers

import type { ParcelInput, LayerConfig, Parcel, Feature } from '@/types';

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

function assertOk(res: Response) {
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
}

function toParcel(lotPlan: string, geojson: any): Parcel {
  // Compute centroid (simple average of outer ring) for quick popups
  let cx = 0, cy = 0, n = 0;
  const ring = geojson?.coordinates?.[0] || [];
  for (const [x, y] of ring) { cx += x; cy += y; n++; }
  const centroid: [number, number] = n ? [cx / n, cy / n] : [0, 0];
  return {
    id: lotPlan,
    lotPlan,
    geometry: geojson,
    area: 0,           // (optional) could compute on backend; not required by UI
    centroid,
  };
}

export function normalizeLotPlan(input: string): string[] {
  // Let the backend handle the tricky parsing; keep a minimal local fallback
  const s = (input || "").trim().toUpperCase();
  if (!s) return [];
  if (s.includes("/")) {
    const [lot, plan] = s.split("/", 2);
    return [`${lot.trim().replace(/^L/, "")}/${plan.trim().replace(/\s+/g, "")}`];
  }
  // tight form like 3RP67254 → split letters+digits from plan prefix
  const m = s.match(/^L?(\w+?)([A-Z]{1,4}\s*\d{1,7})$/);
  if (m) return [`${m[1]}/${m[2].replace(/\s+/g, "")}`];
  return [s]; // last resort; server will reject if invalid
}

export async function resolveParcels(normalized: string[]): Promise<Parcel[]> {
  // Resolve each LOT/PLAN via backend; server already normalizes internally
  const parcels: Parcel[] = [];
  for (const lp of normalized) {
    const r = await fetch(`${API_BASE}/parcel/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lotplan: lp }),
    });
    assertOk(r);
    const data = await r.json();
    if (data?.parcel) {
      parcels.push(toParcel(lp, data.parcel));
    }
  }
  return parcels;
}

export async function getLayers(): Promise<LayerConfig[]> {
  const r = await fetch(`${API_BASE}/layers`);
  assertOk(r);
  const json = await r.json();
  const layers = (json?.layers || []) as any[];
  // Map minimal fields to LayerConfig the UI expects; provide sane style defaults.
  return layers.map(l => ({
    id: l.id,
    label: l.label || l.id,
    url: l.url,
    description: l.description || "",
    fields: {
      include: (l.fields?.include ?? []),
      aliases: (l.fields?.aliases ?? {}),
    },
    nameTemplate: l.name_template || l.nameTemplate || l.label || l.id,
    style: {
      lineWidth: l.style?.line_width ?? 1,
      lineOpacity: l.style?.line_opacity ?? 0.9,
      polyOpacity: l.style?.poly_opacity ?? 0.3,
      color: l.style?.color ?? "#4f46e5",
    },
    popup: {
      order: l.popup?.order ?? [],
      hideNull: l.popup?.hide_null ?? true,
    },
  }));
}

export async function intersectLayers(parcel: Parcel, layerIds: string[]): Promise<Record<string, Feature[]>> {
  const r = await fetch(`${API_BASE}/intersect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ parcel: parcel.geometry, layer_ids: layerIds })
  });
  assertOk(r);
  const data = await r.json();
  const out: Record<string, Feature[]> = {};
  for (const layer of data.layers || []) {
    const feats: Feature[] = [];
    for (const f of layer.features || []) {
      // Convert backend payload to Feature expected by UI
      feats.push({
        id: String(f.attrs?.OBJECTID ?? crypto.randomUUID()),
        geometry: f.geometry,          // already GeoJSON Polygon
        properties: f.attrs ?? {},
        layerId: layer.id,
        displayName: f.name ?? layer.label ?? layer.id,
      });
    }
    out[layer.id] = feats;
  }
  return out;
}

export async function exportData(parcel: Parcel, features: Record<string, Feature[]>) {
  // Backend expects the same structure as returned by /intersect
  const layers = Object.entries(features).map(([id, feats]) => ({
    id,
    label: id,
    features: feats.map(f => ({ geometry: f.geometry, attrs: f.properties, name: f.displayName })),
    style: {},
  }));
  const r = await fetch(`${API_BASE}/export/kml`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ parcel: parcel.geometry, layers }),
  });
  assertOk(r);
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "export.kmz";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
