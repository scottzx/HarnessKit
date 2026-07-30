import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  consumeUrlToken,
  createHttpTransport,
  getAuthToken,
} from "@/lib/transport";

beforeEach(() => {
  localStorage.clear();
  // Reset the URL between tests (jsdom keeps the last replaceState value).
  window.history.replaceState({}, "", "/");
});

describe("consumeUrlToken", () => {
  it("stores the token and strips it from the URL", () => {
    window.history.replaceState({}, "", "/?token=abc123");

    consumeUrlToken();

    expect(getAuthToken()).toBe("abc123");
    expect(localStorage.getItem("hk_token")).toBe("abc123");
    expect(window.location.search).toBe("");
  });

  it("preserves other query params while removing only the token", () => {
    window.history.replaceState({}, "", "/?scope=all&token=abc123");

    consumeUrlToken();

    expect(localStorage.getItem("hk_token")).toBe("abc123");
    expect(window.location.search).toBe("?scope=all");
  });

  it("is a no-op when no token param is present", () => {
    window.history.replaceState({}, "", "/?scope=all");

    consumeUrlToken();

    expect(localStorage.getItem("hk_token")).toBeNull();
    expect(window.location.search).toBe("?scope=all");
  });
});

describe("createHttpTransport", () => {
  it("keeps API bases and fetch implementations instance-scoped", async () => {
    const firstFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ source: "first" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const secondFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ source: "second" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const first = createHttpTransport({
      apiBase: "/api/first/",
      fetch: firstFetch,
    });
    const second = createHttpTransport({
      apiBase: "/api/second",
      fetch: secondFetch,
    });

    await Promise.all([
      first("list_extensions", { targetAgent: "claude" }),
      second("list_agents"),
    ]);

    expect(firstFetch).toHaveBeenCalledWith(
      "/api/first/list_extensions",
      expect.objectContaining({
        credentials: "same-origin",
        body: JSON.stringify({ target_agent: "claude" }),
      }),
    );
    expect(secondFetch).toHaveBeenCalledWith(
      "/api/second/list_agents",
      expect.objectContaining({ credentials: "same-origin" }),
    );
    expect(firstFetch).not.toHaveBeenCalledWith(
      expect.stringContaining("/api/second"),
      expect.anything(),
    );
  });

  it("forwards the instance abort signal", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        }),
    );
    const transport = createHttpTransport({
      apiBase: "/api/harnesskit",
      fetch: fetchMock,
      signal: controller.signal,
    });

    const request = transport("list_agents");
    controller.abort();

    await expect(request).rejects.toMatchObject({ name: "AbortError" });
  });
});
