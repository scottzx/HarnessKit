import { act, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  HarnessKitPanel,
  registerHarnessKitPanel,
  type HarnessKitNavigateEventDetail,
} from "../custom-element";

const stats = {
  total_extensions: 7,
  skill_count: 2,
  mcp_count: 1,
  plugin_count: 1,
  hook_count: 1,
  cli_count: 2,
  critical_issues: 0,
  high_issues: 0,
  medium_issues: 0,
  low_issues: 0,
  updates_available: 0,
};

function json(data: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

beforeEach(() => {
  registerHarnessKitPanel();
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>().mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith("/get_dashboard_stats")) return json(stats);
      if (url.endsWith("/list_agents")) return json([]);
      if (url.endsWith("/scan_and_sync")) return json(0);
      return json([]);
    }),
  );
});

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

describe("<harnesskit-panel>", () => {
  it("mounts into a Shadow root and emits a composed ready event", async () => {
    const ready = vi.fn();
    const panel = document.createElement(
      "harnesskit-panel",
    ) as HarnessKitPanel;
    panel.addEventListener("ready", ready);
    act(() => document.body.append(panel));

    await waitFor(() => expect(ready).toHaveBeenCalledTimes(1));
    expect(panel.shadowRoot).not.toBeNull();
    expect(panel.shadowRoot?.querySelector('[part="app"]')).not.toBeNull();
    expect(panel.shadowRoot?.querySelector('[part="portals"]')).not.toBeNull();
    expect(
      panel.shadowRoot?.textContent?.includes("1agents Extensions"),
    ).toBe(true);
  });

  it("keeps transport and router state independent across two instances", async () => {
    const first = document.createElement(
      "harnesskit-panel",
    ) as HarnessKitPanel;
    const second = document.createElement(
      "harnesskit-panel",
    ) as HarnessKitPanel;
    first.setAttribute("api-base", "/api/first");
    second.setAttribute("api-base", "/api/second");
    first.initialRoute = "/overview";
    second.initialRoute = "/agents";
    act(() => document.body.append(first, second));

    await waitFor(() => {
      const calls = vi.mocked(fetch).mock.calls.map(([url]) => String(url));
      expect(calls).toContain("/api/first/get_dashboard_stats");
      expect(calls).toContain("/api/second/list_agents");
    });

    expect(first.shadowRoot?.textContent).toContain("Overview");
    expect(second.shadowRoot?.textContent).toContain("Agents");
    expect(first.shadowRoot).not.toBe(second.shadowRoot);
  });

  it("reacts to route, theme, and language changes without replacing the mount", async () => {
    const navigate = vi.fn<(event: Event) => void>();
    const panel = document.createElement(
      "harnesskit-panel",
    ) as HarnessKitPanel;
    panel.addEventListener("navigate", navigate);
    act(() => document.body.append(panel));
    const mount = panel.shadowRoot?.querySelector('[part="app"]');

    act(() => {
      panel.route = "/agents";
      panel.theme = "dark";
      panel.language = "zh-CN";
    });

    await waitFor(() => {
      expect(panel.shadowRoot?.textContent).toContain("概览");
    });
    expect(panel.shadowRoot?.querySelector('[part="app"]')).toBe(mount);
    expect(
      panel.shadowRoot
        ?.querySelector(".hk-embed-root")
        ?.getAttribute("data-color-mode"),
    ).toBe("dark");
    const auditLink = Array.from(
      panel.shadowRoot?.querySelectorAll<HTMLAnchorElement>("a") ?? [],
    ).find((link) => link.getAttribute("href") === "/audit");
    act(() => auditLink?.click());
    await waitFor(() =>
      expect(
        navigate.mock.calls.map(
          ([event]) =>
            (event as CustomEvent<HarnessKitNavigateEventDetail>).detail.route,
        ),
      ).toContain("/audit"),
    );
    const details = navigate.mock.calls.map(
      ([event]) =>
        (event as CustomEvent<HarnessKitNavigateEventDetail>).detail.route,
    );
    expect(details).toContain("/audit");
  });

  it("aborts in-flight requests on disconnect and reconnects cleanly", async () => {
    let aborted = false;
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockImplementation((_input, init) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            aborted = true;
            reject(new DOMException("aborted", "AbortError"));
          });
        });
      }),
    );
    const panel = document.createElement(
      "harnesskit-panel",
    ) as HarnessKitPanel;
    act(() => document.body.append(panel));
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    act(() => panel.remove());

    await waitFor(() => expect(aborted).toBe(true));

    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockImplementation(() => json(stats)),
    );
    act(() => document.body.append(panel));
    await waitFor(() =>
      expect(panel.shadowRoot?.textContent).toContain("Overview"),
    );
  });
});
