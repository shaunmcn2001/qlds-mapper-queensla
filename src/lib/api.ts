const RAW_API_BASE =
  (import.meta as any).env?.VITE_API_BASE ||
  "https://qlds-mapper-queensla.onrender.com";

export const API_BASE = RAW_API_BASE.replace(/\/+$/, "");

function resolvePath(path: string): string {
  if (/^https?:/i.test(path)) return path;
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${suffix}`;
}

export async function safeFetch(path: string, init?: RequestInit) {
  try {
    const res = await fetch(resolvePath(path), init);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res;
  } catch (err) {
    console.error("API error", err);
    // Return a harmless empty payload so UI can still render.
    return new Response(
      JSON.stringify({ items: [], error: "unreachable" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
