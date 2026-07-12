import { describe, it, expect, afterEach, vi } from "vitest";
import { assertSafeUrl, guardedFetch, UnsafeUrlError } from "./url-security.js";

describe("assertSafeUrl", () => {
  it("accepts a public HTTPS URL", async () => {
    const url = await assertSafeUrl("https://example.com/feed.xml");
    expect(url.hostname).toBe("example.com");
  });

  it("rejects malformed URLs", async () => {
    await expect(assertSafeUrl("not-a-url")).rejects.toBeInstanceOf(UnsafeUrlError);
  });

  it("rejects non-HTTP protocols", async () => {
    await expect(assertSafeUrl("ftp://example.com/feed.xml")).rejects.toBeInstanceOf(
      UnsafeUrlError
    );
    await expect(assertSafeUrl("file:///etc/passwd")).rejects.toBeInstanceOf(UnsafeUrlError);
  });

  it("rejects URLs containing credentials", async () => {
    await expect(assertSafeUrl("https://user:pass@example.com")).rejects.toBeInstanceOf(
      UnsafeUrlError
    );
  });

  it("rejects loopback IPv4 addresses", async () => {
    await expect(assertSafeUrl("http://127.0.0.1/feed.xml")).rejects.toBeInstanceOf(UnsafeUrlError);
  });

  it("rejects loopback IPv6 addresses", async () => {
    await expect(assertSafeUrl("http://[::1]/feed.xml")).rejects.toBeInstanceOf(UnsafeUrlError);
  });

  it("rejects private IPv4 ranges", async () => {
    await expect(assertSafeUrl("http://10.0.0.1/feed.xml")).rejects.toBeInstanceOf(UnsafeUrlError);
    await expect(assertSafeUrl("http://172.16.0.1/feed.xml")).rejects.toBeInstanceOf(
      UnsafeUrlError
    );
    await expect(assertSafeUrl("http://192.168.1.1/feed.xml")).rejects.toBeInstanceOf(
      UnsafeUrlError
    );
  });

  it("rejects link-local / cloud metadata addresses", async () => {
    await expect(assertSafeUrl("http://169.254.169.254/latest/meta-data/")).rejects.toBeInstanceOf(
      UnsafeUrlError
    );
  });

  it("rejects hostnames that resolve to private addresses", async () => {
    await expect(assertSafeUrl("http://localhost/feed.xml")).rejects.toBeInstanceOf(UnsafeUrlError);
  });

  it("rejects blocked ports", async () => {
    await expect(assertSafeUrl("http://example.com:22/feed.xml")).rejects.toBeInstanceOf(
      UnsafeUrlError
    );
  });
});

describe("guardedFetch", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function makeResponse(overrides: Partial<Response> & { bodyText?: string } = {}): Response {
    const { bodyText, ...rest } = overrides;
    return new Response(bodyText ?? "", {
      status: 200,
      statusText: "OK",
      headers: new Headers(),
      ...rest,
    });
  }

  it("returns body for a successful response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => makeResponse({ bodyText: "<?xml version='1.0'?><rss/>" }))
    );

    const result = await guardedFetch("https://example.com/feed.xml");
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.text).toBe("<?xml version='1.0'?><rss/>");
  });

  it("follows safe redirects up to the limit", async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(
      makeResponse({
        status: 302,
        headers: new Headers({ location: "https://example.com/feed2.xml" }),
      })
    );
    fetchMock.mockResolvedValueOnce(makeResponse({ bodyText: "ok" }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await guardedFetch("https://example.com/feed.xml");
    expect(result.ok).toBe(true);
    expect(result.text).toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects redirects that target private hosts", async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(
      makeResponse({ status: 302, headers: new Headers({ location: "http://127.0.0.1/secret" }) })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await guardedFetch("https://example.com/feed.xml");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Private or reserved/);
  });

  it("fails after too many redirects", async () => {
    const fetchMock = vi.fn();
    for (let i = 0; i < 6; i++) {
      fetchMock.mockResolvedValueOnce(
        makeResponse({
          status: 302,
          headers: new Headers({ location: `https://example.com/step${i + 1}.xml` }),
        })
      );
    }
    vi.stubGlobal("fetch", fetchMock);

    const result = await guardedFetch("https://example.com/feed.xml");
    expect(result.ok).toBe(false);
    expect(result.error).toBe("Too many redirects");
  });

  it("truncates responses that exceed the size limit", async () => {
    const bigBody = "x".repeat(11 * 1024 * 1024);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => makeResponse({ bodyText: bigBody }))
    );

    const result = await guardedFetch("https://example.com/feed.xml");
    expect(result.ok).toBe(true);
    expect(result.truncated).toBe(true);
    expect(result.text.length).toBeLessThan(bigBody.length);
  });

  it("surfaces HTTP errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => makeResponse({ status: 503, statusText: "Service Unavailable" }))
    );

    const result = await guardedFetch("https://example.com/feed.xml");
    expect(result.ok).toBe(false);
    expect(result.error).toBe("HTTP 503");
  });
});
