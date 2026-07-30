import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { HarnessKitEmbeddedApp } from "./embedded-app";
import embedCss from "./embed.css?inline";
import { createApi, type HarnessKitApi } from "@/lib/invoke";
import { createHttpTransport } from "@/lib/transport";
import {
  createNamespacedStorage,
  type EmbeddedTheme,
  type HarnessKitEmbedRuntime,
} from "./runtime";

const VERSION = __APP_VERSION__;
const DEFAULT_API_BASE = "/api/harnesskit";
let nextPanelId = 0;

export interface HarnessKitReadyEventDetail {
  version: string;
}

export interface HarnessKitNavigateEventDetail {
  route: string;
}

export interface HarnessKitErrorEventDetail {
  correlationId?: string;
  code: string;
  message: string;
}

export interface HarnessKitPanelElement extends HTMLElement {
  initialRoute: string;
  route: string;
  theme: EmbeddedTheme;
  language: string;
  scopePath?: string;
  refresh(): Promise<void>;
}

function normalizeTheme(value: string | null): EmbeddedTheme {
  return value === "dark" || value === "light" || value === "system"
    ? value
    : "system";
}

function event<T>(name: string, detail: T): CustomEvent<T> {
  return new CustomEvent(name, {
    detail,
    bubbles: true,
    composed: true,
  });
}

function getSafeError(error: unknown): HarnessKitErrorEventDetail {
  const raw = error instanceof Error ? error.message : String(error);
  let correlationId: string | undefined;
  let code = "harnesskit_request_failed";
  let message = raw;
  try {
    const parsed = JSON.parse(raw) as {
      correlation_id?: unknown;
      correlationId?: unknown;
      code?: unknown;
      message?: unknown;
    };
    const parsedCorrelation = parsed.correlation_id ?? parsed.correlationId;
    if (typeof parsedCorrelation === "string")
      correlationId = parsedCorrelation;
    if (typeof parsed.code === "string") code = parsed.code;
    if (typeof parsed.message === "string") message = parsed.message;
  } catch {
    // Plain text from a reverse proxy is still presented safely below.
  }
  return {
    correlationId,
    code,
    message: message
      .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
      .slice(0, 300),
  };
}

export class HarnessKitPanel
  extends HTMLElement
  implements HarnessKitPanelElement
{
  static get observedAttributes() {
    return [
      "initial-route",
      "route",
      "theme",
      "language",
      "lang",
      "scope-path",
      "api-base",
      "asset-base",
    ];
  }

  readonly #instanceId = `harnesskit-panel-${++nextPanelId}`;
  readonly #shadow = this.attachShadow({ mode: "open" });
  readonly #mount = document.createElement("div");
  readonly #portalContainer = document.createElement("div");
  #root: Root | null = null;
  #controller: AbortController | null = null;
  #runtime: HarnessKitEmbedRuntime | null = null;
  #api: HarnessKitApi | null = null;
  #revision = 0;
  #readyEmitted = false;

  constructor() {
    super();
    const style = document.createElement("style");
    style.textContent = embedCss;
    this.#mount.setAttribute("part", "app");
    this.#portalContainer.setAttribute("part", "portals");
    this.#shadow.append(style, this.#mount, this.#portalContainer);
  }

  get initialRoute() {
    return this.getAttribute("initial-route") || "/overview";
  }

  set initialRoute(value: string) {
    this.setAttribute("initial-route", value);
  }

  get route() {
    return this.getAttribute("route") || this.initialRoute;
  }

  set route(value: string) {
    this.setAttribute("route", value);
  }

  get theme() {
    return normalizeTheme(this.getAttribute("theme"));
  }

  set theme(value: EmbeddedTheme) {
    this.setAttribute("theme", value);
  }

  get language() {
    return (
      this.getAttribute("language") || this.getAttribute("lang") || "en"
    );
  }

  set language(value: string) {
    this.setAttribute("language", value);
  }

  get scopePath() {
    return this.getAttribute("scope-path") || undefined;
  }

  set scopePath(value: string | undefined) {
    if (value) this.setAttribute("scope-path", value);
    else this.removeAttribute("scope-path");
  }

  connectedCallback() {
    if (!this.#root) this.#root = createRoot(this.#mount);
    if (!this.#controller || this.#controller.signal.aborted) {
      this.#controller = new AbortController();
      const transport = createHttpTransport({
        apiBase: this.getAttribute("api-base") || DEFAULT_API_BASE,
        fetch: window.fetch.bind(window),
        credentials: "same-origin",
        signal: this.#controller.signal,
      });
      this.#api = createApi(transport);
      const storageNamespace =
        this.getAttribute("storage-namespace") || this.#instanceId;
      this.#runtime = {
        api: this.#api,
        portalContainer: this.#portalContainer,
        assetBase: this.getAttribute("asset-base") || "",
        storage: createNamespacedStorage(
          window.localStorage,
          storageNamespace,
        ),
        storageNamespace,
        reportError: (error) => {
          this.dispatchEvent(
            event<HarnessKitErrorEventDetail>("error", getSafeError(error)),
          );
        },
      };
    }
    this.#render();
    queueMicrotask(() => {
      if (!this.isConnected || this.#readyEmitted) return;
      this.#readyEmitted = true;
      this.dispatchEvent(
        event<HarnessKitReadyEventDetail>("ready", { version: VERSION }),
      );
    });
  }

  disconnectedCallback() {
    this.#controller?.abort();
    this.#root?.unmount();
    this.#root = null;
    this.#controller = null;
    this.#runtime = null;
    this.#api = null;
    this.#readyEmitted = false;
  }

  attributeChangedCallback(
    name: string,
    oldValue: string | null,
    newValue: string | null,
  ) {
    if (oldValue === newValue || !this.isConnected) return;
    if (name === "api-base") {
      this.#controller?.abort();
      this.#controller = null;
      this.#runtime = null;
      this.#api = null;
      this.connectedCallback();
      return;
    }
    this.#render();
  }

  async refresh(): Promise<void> {
    if (!this.#api) throw new Error("HarnessKit panel is not connected");
    // Embed refresh is deliberately read-only. Filesystem scans and all
    // extension mutations are owned by authenticated 1agents host APIs.
    this.#revision += 1;
    this.#render();
    await Promise.resolve();
  }

  #render() {
    if (!this.#root || !this.#runtime) return;
    this.#root.render(
      <React.StrictMode>
        <HarnessKitEmbeddedApp
          runtime={this.#runtime}
          initialRoute={this.initialRoute}
          route={this.route}
          theme={this.theme}
          language={this.language}
          scopePath={this.scopePath}
          revision={this.#revision}
          onRefresh={() => {
            void this.refresh();
          }}
          onNavigate={(route) => {
            if (route === this.route) return;
            this.dispatchEvent(
              event<HarnessKitNavigateEventDetail>("navigate", { route }),
            );
          }}
        />
      </React.StrictMode>,
    );
  }
}

export function registerHarnessKitPanel(
  registry: CustomElementRegistry = window.customElements,
) {
  if (!registry.get("harnesskit-panel")) {
    registry.define("harnesskit-panel", HarnessKitPanel);
  }
}
