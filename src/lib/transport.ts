/**
 * Transport layer abstraction.
 *
 * Standalone HarnessKit uses the default transport exported at the bottom of
 * this module. Embedders create their own transport with
 * `createHttpTransport`; no mutable module-global API base is involved.
 */

export type Transport = <T>(
  command: string,
  args?: Record<string, unknown>,
) => Promise<T>;

export interface HttpTransportOptions {
  apiBase: string;
  fetch?: typeof globalThis.fetch;
  getAuthToken?: () => string | null;
  credentials?: RequestCredentials;
  signal?: AbortSignal;
}

// Ensure __TAURI_INTERNALS__ stub exists so @tauri-apps/api doesn't throw when initialized in pure browser/iframe
if (typeof window !== "undefined" && !("__TAURI_INTERNALS__" in window)) {
  (window as any).__TAURI_INTERNALS__ = {
    metadata: {},
    invoke: () => Promise.reject(new Error("Not in Tauri")),
    transformCallback: () => 0,
  };
}

// Tauri v2 injects __TAURI_INTERNALS__ on the window object with currentWindow metadata
const isTauri =
  typeof window !== "undefined" &&
  "__TAURI_INTERNALS__" in window &&
  Boolean((window as any).__TAURI_INTERNALS__?.metadata?.currentWindow);

// Use a Promise to avoid race condition: the first API call waits for the
// dynamic import to resolve before proceeding.
const tauriInvokePromise: Promise<
  (cmd: string, args?: Record<string, unknown>) => Promise<unknown>
> | null = isTauri
  ? import("@tauri-apps/api/core").then((mod) => mod.invoke)
  : null;

/**
 * Call a backend command.
 * - In Tauri: `invoke(command, args)` via IPC
 * - In browser: `POST /api/{command}` with JSON body
 */
async function standaloneTransport<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  if (tauriInvokePromise) {
    const invoke = await tauriInvokePromise;
    return invoke(command, args) as Promise<T>;
  }
  return standaloneHttpTransport<T>(command, args);
}

/** Token for authenticated web mode — set by the login page or URL param */
let authToken: string | null = null;

export function setAuthToken(token: string): void {
  authToken = token;
  // localStorage (not sessionStorage) so the token survives across new tabs
  // and reloads — the user only has to open the `?token=` URL once.
  localStorage.setItem("hk_token", token);
}

export function getAuthToken(): string | null {
  if (authToken) return authToken;
  authToken = localStorage.getItem("hk_token");
  return authToken;
}

/**
 * Consume a `?token=` query param (printed by `hk serve` for authenticated
 * binds): store it, then strip it from the address bar via replaceState so the
 * token doesn't linger in browser history or leak via the Referer header on
 * outbound asset/badge requests. Mirrors Jupyter's `?token=` login flow.
 * Call once, before anything renders or fires a request.
 */
export function consumeUrlToken(): void {
  const url = new URL(window.location.href);
  const token = url.searchParams.get("token");
  if (!token) return;
  setAuthToken(token);
  url.searchParams.delete("token");
  window.history.replaceState({}, "", url.pathname + url.search + url.hash);
}

/** Convert camelCase keys to snake_case (Tauri invoke does this automatically) */
function toSnakeKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
    result[snakeKey] = value;
  }
  return result;
}

function normalizeApiBase(apiBase: string): string {
  const trimmed = apiBase.trim();
  if (!trimmed) throw new Error("HarnessKit API base cannot be empty");
  return trimmed.replace(/\/+$/, "");
}

/**
 * Build a transport owned by one application/custom-element instance.
 *
 * The caller supplies fetch rather than the transport reading it from a
 * mutable singleton. In the 1agents embed this is the parent window's fetch,
 * which preserves its relay interception and authenticated session.
 */
export function createHttpTransport(options: HttpTransportOptions): Transport {
  const apiBase = normalizeApiBase(options.apiBase);
  const fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);

  return async function httpTransport<T>(
    command: string,
    args?: Record<string, unknown>,
  ): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    const token = options.getAuthToken?.();
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetchImpl(
      `${apiBase}/${encodeURIComponent(command)}`,
      {
        method: "POST",
        headers,
        credentials: options.credentials ?? "same-origin",
        signal: options.signal,
        body: JSON.stringify(toSnakeKeys(args ?? {})),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      // Throw as-is — parseError() in error-types.ts handles both
      // JSON HkError strings and plain text formats.
      throw text || `HTTP ${response.status}`;
    }

    return response.json() as Promise<T>;
  };
}

/**
 * Resolve the standalone SPA API base.
 * - Standalone `hk serve` / Tauri: `/api`
 * - 1agents iframe under `/api/harnesskit/`: `/api/harnesskit`
 * Embed custom elements pass api-base explicitly and do not use this.
 */
function resolveStandaloneApiBase(): string {
  if (typeof window === "undefined") return "/api";
  const path = window.location.pathname || "";
  if (path === "/api/harnesskit" || path.startsWith("/api/harnesskit/")) {
    return "/api/harnesskit";
  }
  return "/api";
}

const standaloneHttpTransport = createHttpTransport({
  apiBase: resolveStandaloneApiBase(),
  getAuthToken,
});

export const transport: Transport = standaloneTransport;

/** Whether we're running in Tauri desktop or web browser */
export function isDesktop(): boolean {
  return isTauri;
}
