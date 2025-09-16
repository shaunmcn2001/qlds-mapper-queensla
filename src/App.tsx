import React, { useEffect, useMemo, useState } from "react";
import LoadingOverlay from "./components/LoadingOverlay";
import MapView from "./components/MapView";
import BackendDebugger from "./components/BackendDebugger";
import { useToast } from "./components/Toast";
import { API_BASE } from "./lib/api";
import {
  exportData,
  getLayers,
  intersectLayers,
  normalizeLotPlan,
  resolveParcels,
  type FeatureMap,
  type LayerList,
  type ParcelList,
} from "./lib/gis";

function countFeatures(features: FeatureMap): number {
  return Object.entries(features)
    .filter(([key]) => key !== "meta")
    .reduce((acc, [, value]) => (Array.isArray(value) ? acc + value.length : acc), 0);
}

function toRelativePath(url: string): string {
  try {
    const parsed = new URL(url);
    const base = new URL(API_BASE);
    if (parsed.origin === base.origin) {
      return parsed.pathname + (parsed.search || "");
    }
    return url;
  } catch (err) {
    return url;
  }
}

type FeaturePreview = {
  id: string;
  title: string;
  attributes: Array<{ label: string; value: string }>; 
};

type LayerPreview = {
  id: string;
  label: string;
  color: string;
  description?: string;
  total: number;
  previews: FeaturePreview[];
};

const DEFAULT_LAYER_COLORS = [
  "#2563eb",
  "#f97316",
  "#10b981",
  "#8b5cf6",
  "#f43f5e",
  "#0ea5e9",
];

export default function App() {
  const toast = useToast();

  const [lotPlanInput, setLotPlanInput] = useState("3/RP67254");
  const [layers, setLayers] = useState<LayerList>(() => [] as LayerList);
  const [selectedLayers, setSelectedLayers] = useState<string[]>([]);
  const [parcels, setParcels] = useState<ParcelList>(() => [] as ParcelList);
  const [featuresByLayer, setFeaturesByLayer] = useState<FeatureMap>(() => ({} as FeatureMap));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      setLoading(true);
      try {
        const layerList = await getLayers();
        if (cancelled) return;
        setLayers(layerList);
        setSelectedLayers((prev) => {
          const next = prev.filter((id) => layerList.some((layer) => layer.id === id));
          if (next.length > 0) return next;
          return layerList.slice(0, Math.min(3, layerList.length)).map((layer) => layer.id);
        });
        if (layerList.meta?.message) {
          setNotice(layerList.meta.message);
          if (layerList.meta?.fallback) {
            toast.push("Loaded sample datasets while the backend is offline.", "info");
          }
        } else {
          setNotice(null);
        }
        setError(null);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        setNotice(message);
        toast.push(message, "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  const layerColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    layers.forEach((layer, idx) => {
      map[layer.id] = layer.style?.color || DEFAULT_LAYER_COLORS[idx % DEFAULT_LAYER_COLORS.length];
    });
    return map;
  }, [layers]);

  const layerPreviews = useMemo<LayerPreview[]>(() => {
    return selectedLayers
      .map((layerId, idx) => {
        const layer = layers.find((item) => item.id === layerId);
        if (!layer) return null;
        const raw = (featuresByLayer as Record<string, any>)[layerId];
        const features = Array.isArray(raw) ? raw : [];
        const displayFields =
          layer.popup?.order?.length ? layer.popup.order : layer.fields?.include ?? [];
        const previewFields = displayFields.slice(0, 3);
        const previews: FeaturePreview[] = features.slice(0, 3).map((feature) => ({
          id: feature.id,
          title:
            feature.displayName ||
            (previewFields[0]
              ? String(feature.properties?.[previewFields[0]] ?? `Feature ${feature.id}`)
              : `Feature ${feature.id}`),
          attributes: previewFields.map((field) => ({
            label: layer.fields?.aliases?.[field] || field,
            value: String(feature.properties?.[field] ?? "—"),
          })),
        }));
        return {
          id: layer.id,
          label: layer.label,
          color: layerColorMap[layer.id] || DEFAULT_LAYER_COLORS[idx % DEFAULT_LAYER_COLORS.length],
          description: layer.description,
          total: features.length,
          previews,
        } as LayerPreview;
      })
      .filter(Boolean) as LayerPreview[];
  }, [selectedLayers, layers, featuresByLayer, layerColorMap]);

  const activeParcel = parcels[0];
  const totalFeatureCount = useMemo(() => countFeatures(featuresByLayer), [featuresByLayer]);
  const usingFallback = Boolean(
    layers.meta?.fallback || parcels.meta?.fallback || featuresByLayer.meta?.fallback,
  );

  function updateNoticeFromMeta(...messages: Array<string | null | undefined>) {
    const first = messages.find((msg) => typeof msg === "string" && msg.trim().length > 0);
    setNotice(first || null);
  }

  async function runIntersect() {
    const normalized = normalizeLotPlan(lotPlanInput);
    if (normalized.length === 0) {
      const message = "Enter a valid Queensland lot/plan combination (e.g. 3/RP67254).";
      setError(message);
      setNotice(message);
      toast.push(message, "error");
      return;
    }

    setError(null);
    setLoading(true);
    setFeaturesByLayer({} as FeatureMap);

    try {
      toast.push("Resolving parcel…");
      const resolved = await resolveParcels(normalized);
      if (!resolved.length || !resolved[0]?.geometry) {
        setParcels([] as ParcelList);
        throw new Error("Parcel not found for that lot/plan.");
      }
      setParcels(resolved);
      if (resolved.meta?.fallback) {
        toast.push("Parcel service offline – using sample parcel geometry.", "info");
      } else {
        toast.push("Parcel resolved", "success");
      }

      if (selectedLayers.length === 0) {
        updateNoticeFromMeta(resolved.meta?.message, layers.meta?.message);
        toast.push("No datasets selected — displaying parcel outline only.", "info");
        return;
      }

      toast.push("Intersecting layers…");
      const intersections = await intersectLayers(resolved[0], selectedLayers);
      setFeaturesByLayer(intersections);
      if (intersections.meta?.fallback) {
        toast.push("Overlay service offline – showing curated sample intersections.", "info");
      } else {
        toast.push("Intersect complete", "success");
      }

      updateNoticeFromMeta(
        intersections.meta?.message,
        resolved.meta?.message,
        layers.meta?.message,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setNotice(message);
      toast.push(message, "error");
    } finally {
      setLoading(false);
    }
  }

  async function runExport() {
    if (!parcels.length) {
      toast.push("Resolve a parcel before exporting data.", "info");
      return;
    }

    setLoading(true);
    try {
      toast.push("Preparing KMZ…");
      await exportData(parcels[0], featuresByLayer);
      toast.push("Download started", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setNotice(message);
      toast.push(message, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto max-w-6xl px-6 py-10 space-y-8">
        <header className="space-y-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
            QLDS Mapper
          </span>
          <h1 className="text-3xl font-bold text-slate-900">
            Queensland parcel & overlay explorer
          </h1>
          <p className="max-w-3xl text-sm text-slate-600">
            Analyse Queensland land parcels against public GIS datasets. The UI now mirrors the
            production site at <a className="text-blue-600 underline" href="https://qlds-mapper-queensla-1.onrender.com" target="_blank" rel="noreferrer">qlds-mapper-queensla-1.onrender.com</a> and gracefully falls back to curated sample data whenever the backend at {toRelativePath(API_BASE)} is unreachable.
          </p>
        </header>

        {notice && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900 shadow-sm">
            {notice}
          </div>
        )}

        <section className="grid gap-6 lg:grid-cols-[360px,1fr]">
          <div className="space-y-6">
            <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-4">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold text-slate-900">1. Choose a lot/plan</h2>
                <p className="text-sm text-slate-500">
                  Enter a Queensland lot/plan descriptor. The mapper normalises the value, resolves the
                  cadastral parcel, and highlights it on the map.
                </p>
              </div>
              <div className="space-y-2">
                <label htmlFor="lot-plan" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Lot/Plan
                </label>
                <input
                  id="lot-plan"
                  value={lotPlanInput}
                  onChange={(event) => setLotPlanInput(event.target.value)}
                  placeholder="e.g. 3/RP67254 or L3 RP67254"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-inner outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={runIntersect}
                  disabled={loading}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Working…" : "Resolve & intersect"}
                </button>
                <button
                  onClick={runExport}
                  disabled={loading}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-500 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Export KMZ
                </button>
              </div>
              {activeParcel && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                  <p className="font-semibold text-slate-700">Active parcel</p>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    <div>
                      <span className="block text-[10px] uppercase text-slate-400">Lot/Plan</span>
                      <span className="font-mono text-sm">{activeParcel.lotPlan}</span>
                    </div>
                    {Array.isArray(activeParcel.centroid) && (
                      <div>
                        <span className="block text-[10px] uppercase text-slate-400">Centroid</span>
                        <span className="font-mono text-sm">
                          {activeParcel.centroid[1].toFixed(4)}, {activeParcel.centroid[0].toFixed(4)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">2. Select datasets</h2>
                  <p className="text-sm text-slate-500">
                    Toggle the Queensland Government layers you want to intersect with the parcel.
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {selectedLayers.length} selected
                </span>
              </div>
              <div className="max-h-72 space-y-2 overflow-y-auto pr-2">
                {layers.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                    No datasets loaded yet. Check the backend status below to diagnose the connection.
                  </div>
                ) : (
                  layers.map((layer, index) => {
                    const checked = selectedLayers.includes(layer.id);
                    const color = layerColorMap[layer.id] || DEFAULT_LAYER_COLORS[index % DEFAULT_LAYER_COLORS.length];
                    return (
                      <label
                        key={layer.id}
                        className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm transition hover:border-blue-400 hover:bg-blue-50/40"
                      >
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          checked={checked}
                          onChange={() => {
                            setSelectedLayers((prev) =>
                              prev.includes(layer.id)
                                ? prev.filter((id) => id !== layer.id)
                                : [...prev, layer.id],
                            );
                          }}
                        />
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-900">{layer.label}</span>
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: color }}
                            />
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                              {layer.id}
                            </span>
                          </div>
                          {layer.description && (
                            <p className="text-xs text-slate-500">{layer.description}</p>
                          )}
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="h-[460px] overflow-hidden rounded-2xl border bg-white shadow-sm">
              <MapView parcels={parcels} featuresByLayer={featuresByLayer} layerStyles={layerColorMap} />
            </div>

            <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">3. Feature preview</h2>
                  <p className="text-sm text-slate-500">
                    Summaries of the latest intersections. Sample data is shown whenever the backend is
                    unreachable so you can still explore the UI.
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {totalFeatureCount} feature{totalFeatureCount === 1 ? "" : "s"}
                </span>
              </div>

              {layerPreviews.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                  Run an intersection to preview results or use the backend debugger below to troubleshoot
                  connectivity.
                </div>
              ) : (
                <div className="space-y-4">
                  {layerPreviews.map((preview) => (
                    <div key={preview.id} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 rounded-full border border-slate-200"
                          style={{ backgroundColor: preview.color }}
                        />
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-slate-800">{preview.label}</p>
                          {preview.description && (
                            <p className="text-xs text-slate-500">{preview.description}</p>
                          )}
                        </div>
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">
                          {preview.total} feature{preview.total === 1 ? "" : "s"}
                        </span>
                      </div>
                      {preview.previews.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-500">
                          No intersecting features returned yet.
                        </div>
                      ) : (
                        <div className="grid gap-3 sm:grid-cols-2">
                          {preview.previews.map((item) => (
                            <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-600">
                              <p className="text-sm font-semibold text-slate-700">{item.title}</p>
                              <dl className="mt-2 space-y-1">
                                {item.attributes.map((attr) => (
                                  <div key={attr.label} className="flex justify-between gap-2">
                                    <dt className="text-[11px] font-medium text-slate-500">{attr.label}</dt>
                                    <dd className="truncate font-mono text-[11px] text-slate-700">
                                      {attr.value}
                                    </dd>
                                  </div>
                                ))}
                              </dl>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        <BackendDebugger />

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 shadow-sm">
            {error}
          </div>
        )}

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-6 text-xs text-slate-500">
          <div className="space-y-1">
            <div>
              API target: <code className="font-mono text-slate-700">{API_BASE}</code>
            </div>
            <div>Frontend build mirrors: qlds-mapper-queensla-1.onrender.com</div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 shadow-sm">
            <span className={`h-2.5 w-2.5 rounded-full ${usingFallback ? "bg-amber-500" : "bg-emerald-500"}`} />
            <span className="font-semibold text-slate-600">
              {usingFallback ? "Sample data active (backend offline)" : "Live backend connection"}
            </span>
          </div>
        </footer>
      </main>

      <LoadingOverlay show={loading} label={error ? "Retrying…" : "Working…"} />
    </div>
  );
}
