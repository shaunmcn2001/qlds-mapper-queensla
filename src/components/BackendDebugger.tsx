import React, { useEffect, useMemo, useState } from "react";

import { API_BASE } from "@/lib/api";
import { getBackendHistory, subscribeBackendEvents, type BackendEvent } from "@/lib/debug";
import { fetchWithTimeout } from "@/lib/http";
import { createFallbackParcels, createFallbackFeatures } from "@/lib/fallbackData";

const IMPORTANT_ENDPOINTS = [
  { id: "layers", method: "GET", suffix: "/layers", label: "GET /layers" },
  { id: "resolve", method: "POST", suffix: "/parcel/resolve", label: "POST /parcel/resolve" },
  { id: "intersect", method: "POST", suffix: "/intersect", label: "POST /intersect" },
  { id: "export", method: "POST", suffix: "/export/kml", label: "POST /export/kml" },
];

function relativePath(url: string) {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    const base = new URL(API_BASE);
    if (parsed.origin === base.origin) return parsed.pathname;
    return url;
  } catch {
    return url;
  }
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString();
}

function statusFor(event?: BackendEvent) {
  if (!event) return { label: "No data", tone: "bg-slate-200 text-slate-600", detail: "No requests yet" };
  if (event.ok) return { label: `HTTP ${event.status}`, tone: "bg-emerald-100 text-emerald-700", detail: "Last call succeeded" };
  if (event.fallback)
    return {
      label: "Offline",
      tone: "bg-amber-100 text-amber-700",
      detail: event.errorMessage || "Safe fetch returned fallback data",
    };
  return {
    label: event.status ? `HTTP ${event.status}` : "Error",
    tone: "bg-red-100 text-red-700",
    detail: event.errorMessage || "Request failed",
  };
}

export default function BackendDebugger() {
  const [events, setEvents] = useState<BackendEvent[]>(() => getBackendHistory(12));
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState<number | null>(null);

  useEffect(() => {
    return subscribeBackendEvents((event) => {
      setEvents((prev) => [event, ...prev].slice(0, 20));
    });
  }, []);

  const endpointStatus = useMemo(() => {
    return IMPORTANT_ENDPOINTS.map((endpoint) => {
      const match = events.find(
        (event) => event.method === endpoint.method && event.path.endsWith(endpoint.suffix),
      );
      const state = statusFor(match);
      return { ...endpoint, state, event: match };
    });
  }, [events]);

  const diagnostics = useMemo(
    () => [
      () => fetchWithTimeout("/layers", { timeoutMs: 8000 }),
      () =>
        fetchWithTimeout("/parcel/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lotplan: createFallbackParcels()[0]?.lotPlan || "3/RP67254" }),
          timeoutMs: 8000,
        }),
      () => {
        const parcel = createFallbackParcels()[0];
        const layers = Object.keys(createFallbackFeatures());
        return fetchWithTimeout("/intersect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ parcel: parcel?.geometry, layer_ids: layers }),
          timeoutMs: 10000,
        });
      },
      () => {
        const parcel = createFallbackParcels()[0];
        const features = createFallbackFeatures();
        const payload = {
          parcel: parcel?.geometry,
          layers: Object.entries(features).map(([id, feats]) => ({ id, label: id, features: feats })),
        };
        return fetchWithTimeout("/export/kml", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          timeoutMs: 10000,
        });
      },
    ],
    [],
  );

  async function runDiagnostics() {
    if (running) return;
    setRunning(true);
    setLastRun(Date.now());
    for (const task of diagnostics) {
      try {
        const response = await task();
        await response.clone().json().catch(() => null);
      } catch (err) {
        // safeFetch already records the failure; swallowing keeps the loop going
        console.error("Diagnostics error", err);
      }
    }
    setRunning(false);
  }

  return (
    <section className="rounded-2xl border bg-white p-6 shadow-sm space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Backend debugger</h2>
          <p className="text-sm text-slate-500">
            Live visibility into the Render backend at <code className="font-mono text-xs text-slate-600">{API_BASE}</code>.
            Trigger diagnostics to ping each endpoint and inspect the last responses.
          </p>
        </div>
        <button
          onClick={runDiagnostics}
          disabled={running}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {running ? "Running checks…" : "Run diagnostics"}
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {endpointStatus.map((endpoint) => (
          <div key={endpoint.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 shadow-inner">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {endpoint.label}
            </p>
            <div className={`mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${endpoint.state.tone}`}>
              {endpoint.state.label}
            </div>
            <p className="mt-2 text-xs text-slate-500">{endpoint.state.detail}</p>
            {endpoint.event && (
              <p className="mt-2 text-[11px] text-slate-400">
                Last: {formatTime(endpoint.event.timestamp)} via {relativePath(endpoint.event.path)}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Recent backend events</span>
          {lastRun && <span>Diagnostics last ran at {new Date(lastRun).toLocaleTimeString()}</span>}
        </div>
        <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-600">
          {events.length === 0 ? (
            <p className="text-center text-slate-500">No API calls recorded yet.</p>
          ) : (
            <ul className="space-y-2">
              {events.map((event) => (
                <li key={event.id} className="flex items-start justify-between gap-3 border-b border-slate-200 pb-2 last:border-b-0 last:pb-0">
                  <div>
                    <div className="font-semibold text-slate-700">
                      {event.method} {relativePath(event.path)}
                    </div>
                    <div className="text-slate-500">
                      {event.ok ? `HTTP ${event.status}` : event.errorMessage || "Error"}
                      {event.fallback ? " · fallback response" : ""}
                    </div>
                  </div>
                  <span className="whitespace-nowrap text-slate-400">{formatTime(event.timestamp)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
