import { logBackendEvent } from "./debug";

const RAW_API_BASE =
  (import.meta as any).env?.VITE_API_BASE ||
  "https://qlds-mapper-queensla.onrender.com";

export const API_BASE = RAW_API_BASE.replace(/\/+$/, "");

function resolvePath(path: string): string {
  if (/^https?:/i.test(path)) return path;
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${suffix}`;
}

export async function safeFetch(path: string, init: RequestInit = {}) {
  const url = resolvePath(path);
  const method = (init.method || "GET").toUpperCase();
  try {
    const res = await fetch(url, init);
    if (!res.ok) {
      const message = `HTTP ${res.status}${res.statusText ? `: ${res.statusText}` : ""}`;
      logBackendEvent({
        path: url,
        method,
        ok: false,
        status: res.status,
        statusText: res.statusText,
        errorMessage: message,
        timestamp: Date.now(),
      });
      throw new Error(message);
    }

    logBackendEvent({
      path: url,
      method,
      ok: true,
      status: res.status,
      statusText: res.statusText,
      timestamp: Date.now(),
    });

    return res;
  } catch (err: any) {
    const message = err?.message || String(err);
    console.error("API error", err);
    logBackendEvent({
      path: url,
      method,
      ok: false,
      status: 0,
      errorMessage: message,
      fallback: true,
      timestamp: Date.now(),
    });
    return new Response(
      JSON.stringify({ items: [], error: "unreachable", message }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "X-Safe-Fetch-Error": message,
          "X-Safe-Fetch-Url": url,
          "X-Safe-Fetch-Method": method,
        },
      },
    );
  }
}
