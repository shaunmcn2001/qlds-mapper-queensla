// Real backend integration for GIS helpers

import type { LayerConfig, Parcel, Feature } from '@/types';
import { fetchWithTimeout, withRetry } from '@/lib/http';
import {
  createFallbackFeatures,
  createFallbackLayers,
  createFallbackParcels,
} from '@/lib/fallbackData';

export interface LayerList extends Array<LayerConfig> {
  meta?: { error?: string; fallback?: boolean; message?: string; timestamp?: number };
}

export interface ParcelList extends Array<Parcel> {
  meta?: { fallback?: boolean; message?: string; timestamp?: number };
}

export type FeatureMap = Record<string, Feature[]> & {
  meta?: { fallback?: boolean; message?: string; timestamp?: number };
};

function assertOk(res: Response) {
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
}

function toParcel(lotPlan: string, geojson: any): Parcel {
  let cx = 0, cy = 0, n = 0;
  const ring = geojson?.coordinates?.[0] || [];
  for (const [x, y] of ring) { cx += x; cy += y; n++; }
  const centroid: [number, number] = n ? [cx / n, cy / n] : [0, 0];
  return { id: lotPlan, lotPlan, geometry: geojson, area: 0, centroid };
}

export function normalizeLotPlan(input: string): string[] {
  const s = (input || "").trim().toUpperCase();
  if (!s) return [];
  if (s.includes("/")) {
    const [lot, plan] = s.split("/", 2);
    return [`${lot.trim().replace(/^L/, "")}/${plan.trim().replace(/\s+/g, "")}`];
  }
  const m = s.match(/^L?(\w+?)([A-Z]{1,4}\s*\d{1,7})$/);
  if (m) return [`${m[1]}/${m[2].replace(/\s+/g, "")}`];
  return [s];
}

function buildFallbackMessage(kind: string, reason?: string) {
  const base = reason?.trim()
    ? `${kind} unavailable (${reason}).`
    : `${kind} unavailable.`;
  return `${base} Showing interactive sample data so the interface remains usable.`;
}

function fallbackParcels(message?: string): ParcelList {
  const parcels = createFallbackParcels() as ParcelList;
  parcels.meta = {
    fallback: true,
    message: buildFallbackMessage('Parcel resolution', message),
    timestamp: Date.now(),
  };
  return parcels;
}

function fallbackLayers(message?: string): LayerList {
  const layers = createFallbackLayers() as LayerList;
  const msg = buildFallbackMessage('Dataset catalogue', message);
  layers.meta = {
    fallback: true,
    error: msg,
    message: msg,
    timestamp: Date.now(),
  };
  return layers;
}

function fallbackFeatures(layerIds: string[], message?: string): FeatureMap {
  const snapshot = createFallbackFeatures();
  const features = {} as FeatureMap;
  layerIds.forEach((id) => {
    if (snapshot[id]) features[id] = snapshot[id];
  });
  features.meta = {
    fallback: true,
    message: buildFallbackMessage('Intersection service', message),
    timestamp: Date.now(),
  };
  return features;
}

export async function resolveParcels(normalized: string[]): Promise<ParcelList> {
  if (normalized.length === 0) return fallbackParcels();

  const parcels: ParcelList = [] as ParcelList;
  for (const lp of normalized) {
    const r = await withRetry(() =>
      fetchWithTimeout("/parcel/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lotplan: lp }),
        timeoutMs: 40000,
      })
    );
    assertOk(r);
    const data = await r.json();
    if (data?.error === "unreachable") {
      const reason = data?.message || r.headers.get("X-Safe-Fetch-Error") || undefined;
      return fallbackParcels(reason);
    }
    if (data?.error) {
      throw new Error(data.error);
    }
    if (data?.parcel) parcels.push(toParcel(lp, data.parcel));
  }
  return parcels;
}

export async function getLayers(): Promise<LayerList> {
  const r = await withRetry(() =>
    fetchWithTimeout("/layers", { timeoutMs: 20000 })
  );
  assertOk(r);
  const json = await r.json();
  if (json?.error === "unreachable") {
    const reason = json?.message || r.headers.get("X-Safe-Fetch-Error") || undefined;
    return fallbackLayers(reason);
  }
  const arr = (json?.layers || []) as any[];
  const layers = arr.map((l: any) => ({
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
  })) as LayerList;

  if (typeof json?.error === "string" && json.error) {
    layers.meta = { error: json.error, message: json.error, timestamp: Date.now() };
  }

  return layers;
}

export async function intersectLayers(parcel: Parcel, layerIds: string[]): Promise<FeatureMap> {
  const r = await withRetry(() =>
    fetchWithTimeout("/intersect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parcel: parcel.geometry, layer_ids: layerIds }),
      timeoutMs: 45000,
    })
  );
  assertOk(r);
  const data = await r.json();
  if (data?.error === "unreachable") {
    const reason = data?.message || r.headers.get("X-Safe-Fetch-Error") || undefined;
    return fallbackFeatures(layerIds, reason);
  }
  if (data?.error) {
    throw new Error(data.error);
  }
  const out = {} as FeatureMap;
  for (const layer of (data.layers || [])) {
    const feats: Feature[] = [];
    for (const f of (layer.features || [])) {
      feats.push({
        id: String(f.attrs?.OBJECTID ?? crypto.randomUUID()),
        geometry: f.geometry,
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
  const entries = Object.entries(features).filter(([, value]) => Array.isArray(value));
  const layers = entries.map(([id, feats]) => ({
    id,
    label: id,
    features: feats.map(f => ({ geometry: f.geometry, attrs: f.properties, name: f.displayName })),
    style: {},
  }));
  const r = await withRetry(() =>
    fetchWithTimeout("/export/kml", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parcel: parcel.geometry, layers }),
      timeoutMs: 45000,
    })
  );
  assertOk(r);
  const maybeJson = await r.clone().json().catch(() => null);
  if (maybeJson?.error === "unreachable") {
    const reason = maybeJson?.message || r.headers.get("X-Safe-Fetch-Error") || undefined;
    throw new Error(buildFallbackMessage('Export service', reason));
  }
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
