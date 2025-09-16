export type BackendEvent = {
  id: number;
  path: string;
  method: string;
  ok: boolean;
  status: number;
  statusText?: string;
  errorMessage?: string;
  fallback?: boolean;
  timestamp: number;
};

type Listener = (event: BackendEvent) => void;

let counter = 0;
const listeners = new Set<Listener>();
const history: BackendEvent[] = [];

function push(event: Omit<BackendEvent, "id">): BackendEvent {
  const enriched: BackendEvent = { ...event, id: ++counter };
  history.push(enriched);
  if (history.length > 100) history.splice(0, history.length - 100);
  for (const listener of listeners) listener(enriched);
  return enriched;
}

export function logBackendEvent(event: Omit<BackendEvent, "id">) {
  push(event);
}

export function subscribeBackendEvents(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getBackendHistory(limit = 20): BackendEvent[] {
  return history.slice(-limit).reverse();
}

export function clearBackendHistory() {
  history.splice(0, history.length);
  counter = 0;
}
