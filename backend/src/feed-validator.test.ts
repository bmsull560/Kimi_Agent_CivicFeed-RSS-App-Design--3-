import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import type { Feed } from "./feeds.js";
import {
  classifyFeedType,
  classifyFormat,
  normalizeCanonicalUrl,
  evaluateParse,
  evaluateFreshness,
  fetchWithReliability,
  validateFeeds,
  HostSemaphore,
  type ReliabilityOptions,
} from "./feed-validator.js";

function sampleFeed(overrides: Partial<Feed> = {}): Feed {
  return {
    id: "feed-001",
    name: "Test Feed",
    shortName: "Test",
    agency: "TSA",
    description: "Test description",
    rssUrl: "http://127.0.0.1:8080/feed.xml",
    website: "https://example.gov",
    department: "",
    category: "General",
    subCategory: "test",
    contentType: "News",
    updateFrequency: "",
    status: "working",
    tags: ["general"],
    ...overrides,
  };
}

function mockResponse(
  bodyText: string,
  status = 200,
  headers: Record<string, string> = {}
): Response {
  return new Response(bodyText, {
    status,
    headers: new Headers(headers),
  });
}

function rssXml(title = "Item"): string {
  return `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <item>
      <title>${title}</title>
      <link>https://example.gov/item</link>
      <description>Desc</description>
      <pubDate>Mon, 15 Jun 2026 12:00:00 GMT</pubDate>
      <guid>${title}</guid>
    </item>
  </channel>
</rss>`;
}

function atomXml(): string {
  return `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>Atom Item</title>
    <link href="https://example.gov/atom"/>
    <summary>Summary</summary>
    <published>2026-06-15T12:00:00Z</published>
    <id>atom-1</id>
  </entry>
</feed>`;
}

function rdfXml(): string {
  return `<?xml version="1.0"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/">
  <item rdf:about="https://example.gov/rdf">
    <title>RDF Item</title>
    <link>https://example.gov/rdf</link>
    <description>RDF</description>
    <dc:date xmlns:dc="http://purl.org/dc/elements/1.1/">2026-06-15T12:00:00Z</dc:date>
  </item>
</rdf:RDF>`;
}

describe("classifyFeedType", () => {
  it("classifies weather/safety as alert", () => {
    const feed = sampleFeed({ tags: ["weather", "alert", "noaa"] });
    expect(classifyFeedType(feed)).toBe("alert");
  });

  it("classifies oral arguments as event", () => {
    const feed = sampleFeed({
      subCategory: "oral-arguments",
      contentType: "Oral Argument Calendar",
    });
    expect(classifyFeedType(feed)).toBe("event");
  });

  it("classifies archive content as archive", () => {
    const feed = sampleFeed({ contentType: "Historical Records Archive" });
    expect(classifyFeedType(feed)).toBe("archive");
  });

  it("classifies quarterly updates as low_frequency", () => {
    const feed = sampleFeed({ updateFrequency: "Quarterly" });
    expect(classifyFeedType(feed)).toBe("low_frequency");
  });

  it("defaults to news", () => {
    expect(classifyFeedType(sampleFeed())).toBe("news");
  });
});

describe("classifyFormat", () => {
  it("detects RSS", () => {
    expect(classifyFormat(rssXml())).toBe("RSS");
  });

  it("detects Atom", () => {
    expect(classifyFormat(atomXml())).toBe("Atom");
  });

  it("detects RDF RSS", () => {
    expect(classifyFormat(rdfXml())).toBe("RDF RSS");
  });

  it("returns Unknown for HTML", () => {
    expect(classifyFormat("<html><body>Hi</body></html>")).toBe("Unknown");
  });
});

describe("normalizeCanonicalUrl", () => {
  it("lowercases host and strips trailing slash", () => {
    expect(normalizeCanonicalUrl("https://EXAMPLE.GOV/path/")).toBe("https://example.gov/path");
  });

  it("removes hash", () => {
    expect(normalizeCanonicalUrl("https://example.gov/path#section")).toBe(
      "https://example.gov/path"
    );
  });
});

describe("evaluateParse", () => {
  it("parses valid RSS", () => {
    const result = evaluateParse(rssXml(), "feed-1", "Test");
    expect(result.parseStatus).toBe("ok");
    expect(result.entryCount).toBe(1);
    expect(result.format).toBe("RSS");
  });

  it("parses valid Atom", () => {
    const result = evaluateParse(atomXml(), "feed-1", "Test");
    expect(result.parseStatus).toBe("ok");
    expect(result.entryCount).toBe(1);
    expect(result.format).toBe("Atom");
  });

  it("parses valid RDF RSS", () => {
    const result = evaluateParse(rdfXml(), "feed-1", "Test");
    expect(result.parseStatus).toBe("ok");
    expect(result.entryCount).toBe(1);
    expect(result.format).toBe("RDF RSS");
  });

  it("reports empty feeds", () => {
    const xml = "<?xml version='1.0'?><rss><channel></channel></rss>";
    const result = evaluateParse(xml, "feed-1", "Test");
    expect(result.parseStatus).toBe("empty");
    expect(result.entryCount).toBe(0);
  });

  it("reports unparseable content", () => {
    const result = evaluateParse("<not-xml", "feed-1", "Test");
    expect(result.parseStatus).toBe("unparseable");
  });
});

describe("evaluateFreshness", () => {
  const now = new Date("2026-07-17T00:00:00Z");

  it("flags stale news", () => {
    const date = new Date("2026-05-01T00:00:00Z");
    const result = evaluateFreshness(date, "news", now);
    expect(result.freshnessStatus).toBe("stale");
  });

  it("accepts current news", () => {
    const date = new Date("2026-07-10T00:00:00Z");
    const result = evaluateFreshness(date, "news", now);
    expect(result.freshnessStatus).toBe("current");
  });

  it("accepts old archive feeds", () => {
    const date = new Date("2020-01-01T00:00:00Z");
    const result = evaluateFreshness(date, "archive", now);
    expect(result.freshnessStatus).toBe("archive");
  });

  it("allows future event dates", () => {
    const date = new Date("2026-08-01T00:00:00Z");
    const result = evaluateFreshness(date, "event", now);
    expect(result.freshnessStatus).toBe("future_event");
    expect(result.futureDated).toBe(true);
  });

  it("flags future-dated news", () => {
    const date = new Date("2026-08-01T00:00:00Z");
    const result = evaluateFreshness(date, "news", now);
    expect(result.freshnessStatus).toBe("stale");
    expect(result.futureDated).toBe(true);
  });
});

describe("fetchWithReliability", () => {
  let fetchMock: Mock;
  const baseOptions: ReliabilityOptions = {
    userAgent: "Test/1.0",
    timeoutMs: 10_000,
    maxRetries: 2,
    perHostConcurrency: 2,
  };

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("CIVICFEED_ALLOW_PRIVATE_URLS", "1");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("returns successful response", async () => {
    fetchMock.mockResolvedValue(mockResponse(rssXml(), 200));
    const sem = new HostSemaphore(2);
    const result = await fetchWithReliability("http://127.0.0.1:8080/feed.xml", baseOptions, sem);
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.attempts).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries 500 errors", async () => {
    fetchMock
      .mockResolvedValueOnce(mockResponse("", 500))
      .mockResolvedValueOnce(mockResponse(rssXml(), 200));
    const sem = new HostSemaphore(2);
    const result = await fetchWithReliability("http://127.0.0.1:8080/feed.xml", baseOptions, sem);
    expect(result.ok).toBe(true);
    expect(result.attempts).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry 404 errors", async () => {
    fetchMock.mockResolvedValue(mockResponse("", 404));
    const sem = new HostSemaphore(2);
    const result = await fetchWithReliability("http://127.0.0.1:8080/feed.xml", baseOptions, sem);
    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
    expect(result.attempts).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries transient timeouts", async () => {
    fetchMock
      .mockRejectedValueOnce(new DOMException("The operation was aborted", "AbortError"))
      .mockResolvedValueOnce(mockResponse(rssXml(), 200));
    const sem = new HostSemaphore(2);
    const result = await fetchWithReliability("http://127.0.0.1:8080/feed.xml", baseOptions, sem);
    expect(result.ok).toBe(true);
    expect(result.attempts).toBe(2);
  });

  it("passes the configured timeout through to the abort signal", async () => {
    // The mock only settles when the caller's AbortSignal fires, so the test
    // can only pass if options.timeoutMs actually reaches guardedFetch's timer.
    fetchMock.mockImplementation(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted", "AbortError"));
          });
        })
    );
    const sem = new HostSemaphore(2);
    const start = Date.now();
    const result = await fetchWithReliability(
      "http://127.0.0.1:8080/slow.xml",
      { ...baseOptions, timeoutMs: 50, maxRetries: 0 },
      sem
    );
    const elapsed = Date.now() - start;
    expect(result.ok).toBe(false);
    expect(result.timedOut).toBe(true);
    // Default guardedFetch timeout is 15s; a wired-through 50ms must abort far sooner.
    expect(elapsed).toBeLessThan(5_000);
  });

  it("respects per-host concurrency", async () => {
    const startTimes: number[] = [];
    fetchMock.mockImplementation(async () => {
      startTimes.push(Date.now());
      await new Promise((resolve) => setTimeout(resolve, 50));
      return mockResponse(rssXml(), 200);
    });
    const sem = new HostSemaphore(1);
    const opts: ReliabilityOptions = { ...baseOptions, perHostConcurrency: 1 };
    await Promise.all([
      fetchWithReliability("http://127.0.0.1:8080/a.xml", opts, sem),
      fetchWithReliability("http://127.0.0.1:8080/b.xml", opts, sem),
    ]);
    expect(startTimes.length).toBe(2);
    expect(startTimes[1]! - startTimes[0]!).toBeGreaterThanOrEqual(30);
  });
});

describe("validateFeeds", () => {
  beforeEach(() => {
    vi.stubEnv("CIVICFEED_ALLOW_PRIVATE_URLS", "1");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  function makeMockFetch(patterns: Array<{ url: string; response: Response }>) {
    return vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      if (method !== "GET") {
        throw new Error(`Unexpected non-GET request: ${method} ${url}`);
      }
      for (const p of patterns) {
        if (p.url === url) {
          return p.response;
        }
      }
      return mockResponse("", 200);
    });
  }

  const baseOptions = {
    userAgent: "Test/1.0",
    timeoutMs: 10_000,
    maxRetries: 0,
    perHostConcurrency: 4,
    globalConcurrency: 8,
  };

  it("makes only GET requests, resolving canonical URLs from the response", async () => {
    const fetchMock = makeMockFetch([
      {
        url: "http://127.0.0.1:8080/feed.xml",
        response: mockResponse(rssXml(), 200, { "content-type": "application/rss+xml" }),
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const { results } = await validateFeeds([sampleFeed()], baseOptions);
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("working");
    expect(results[0].transportStatus).toBe("ok");
    expect(results[0].parseStatus).toBe("ok");
    expect(results[0].entryCount).toBe(1);
    expect(results[0].canonicalUrl).toBe("http://127.0.0.1:8080/feed.xml");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(
      fetchMock.mock.calls.every(([, init]) => (init as RequestInit | undefined)?.method !== "HEAD")
    ).toBe(true);
  });

  it("detects empty feeds", async () => {
    const xml = "<?xml version='1.0'?><rss><channel></channel></rss>";
    const fetchMock = makeMockFetch([
      {
        url: "http://127.0.0.1:8080/feed.xml",
        response: mockResponse(xml, 200),
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const { results } = await validateFeeds([sampleFeed()], baseOptions);
    expect(results[0].parseStatus).toBe("empty");
    expect(results[0].operationalStatus).toBe("empty");
    expect(results[0].status).toBe("working");
  });

  it("handles HTTP 200 with HTML", async () => {
    const fetchMock = makeMockFetch([
      {
        url: "http://127.0.0.1:8080/feed.xml",
        response: mockResponse("<html><body>Not a feed</body></html>", 200),
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const { results } = await validateFeeds([sampleFeed()], baseOptions);
    expect(results[0].transportStatus).toBe("ok");
    expect(results[0].parseStatus).toBe("unparseable");
    expect(results[0].status).toBe("blocked");
  });

  it("handles HTTP 403", async () => {
    const fetchMock = makeMockFetch([
      {
        url: "http://127.0.0.1:8080/feed.xml",
        response: mockResponse("", 403),
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const { results } = await validateFeeds([sampleFeed()], baseOptions);
    expect(results[0].transportStatus).toBe("blocked");
    expect(results[0].status).toBe("blocked");
  });

  it("handles HTTP 404", async () => {
    const fetchMock = makeMockFetch([
      {
        url: "http://127.0.0.1:8080/feed.xml",
        response: mockResponse("", 404),
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const { results } = await validateFeeds([sampleFeed()], baseOptions);
    expect(results[0].transportStatus).toBe("not_found");
    expect(results[0].status).toBe("blocked");
  });

  it("handles connection failure", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("fetch failed"));
    vi.stubGlobal("fetch", fetchMock);
    const { results } = await validateFeeds([sampleFeed()], baseOptions);
    expect(results[0].transportStatus).toBe("network_error");
    expect(results[0].status).toBe("blocked");
  });

  it("handles malformed XML", async () => {
    const fetchMock = makeMockFetch([
      {
        url: "http://127.0.0.1:8080/feed.xml",
        response: mockResponse("<html><body>Not XML at all</body></html>", 200),
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const { results } = await validateFeeds([sampleFeed()], baseOptions);
    expect(results[0].parseStatus).toBe("unparseable");
  });

  it("detects stale news feeds", async () => {
    const xml = rssXml("Old").replace(
      "Mon, 15 Jun 2026 12:00:00 GMT",
      "Mon, 15 Jan 2024 12:00:00 GMT"
    );
    const fetchMock = makeMockFetch([
      {
        url: "http://127.0.0.1:8080/feed.xml",
        response: mockResponse(xml, 200),
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const { results } = await validateFeeds([sampleFeed()], baseOptions);
    expect(results[0].freshnessStatus).toBe("stale");
    expect(results[0].operationalStatus).toBe("stale");
  });

  it("allows valid archive feeds to be old", async () => {
    const xml = rssXml("Old").replace(
      "Mon, 15 Jun 2026 12:00:00 GMT",
      "Mon, 15 Jan 2020 12:00:00 GMT"
    );
    const fetchMock = makeMockFetch([
      {
        url: "http://127.0.0.1:8080/feed.xml",
        response: mockResponse(xml, 200),
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const feed = sampleFeed({ contentType: "Historical Records Archive" });
    const { results } = await validateFeeds([feed], baseOptions);
    expect(results[0].freshnessStatus).toBe("archive");
    expect(results[0].operationalStatus).toBe("archive");
  });

  it("detects duplicates across categories", async () => {
    const feedA = sampleFeed({ id: "feed-a", rssUrl: "http://127.0.0.1:8080/a.xml" });
    const feedB = sampleFeed({
      id: "feed-b",
      rssUrl: "http://127.0.0.1:8080/b.xml",
      category: "Courts & Judiciary",
    });

    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      if (method !== "GET") {
        throw new Error(`Unexpected non-GET request: ${method} ${url}`);
      }
      if (url === "http://127.0.0.1:8080/a.xml" || url === "http://127.0.0.1:8080/b.xml") {
        return mockResponse("", 302, {
          location: "http://127.0.0.1:8080/canonical.xml",
        });
      }
      if (url === "http://127.0.0.1:8080/canonical.xml") {
        return mockResponse(rssXml(), 200);
      }
      return mockResponse("", 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { results, report } = await validateFeeds([feedA, feedB], baseOptions);
    const a = results.find((r) => r.id === "feed-a")!;
    const b = results.find((r) => r.id === "feed-b")!;
    expect(a.duplicateOf).toBeNull();
    expect(b.duplicateOf).toBe("feed-a");
    expect(report.duplicateGroups).toHaveLength(1);
    expect(report.duplicateGroups[0].ids).toEqual(["feed-a", "feed-b"]);
  });

  it("produces deterministic sorted output", async () => {
    const feeds = [
      sampleFeed({ id: "feed-z" }),
      sampleFeed({ id: "feed-a" }),
      sampleFeed({ id: "feed-m" }),
    ];
    const fetchMock = makeMockFetch(
      feeds.map((f) => ({
        url: f.rssUrl,
        response: mockResponse(rssXml(), 200),
      }))
    );
    vi.stubGlobal("fetch", fetchMock);
    const { results } = await validateFeeds(feeds, baseOptions);
    expect(results.map((r) => r.id)).toEqual(["feed-a", "feed-m", "feed-z"]);
  });

  it("sends conditional headers and inherits previous parse state on 304", async () => {
    const previousReport = {
      validatedAt: "2026-07-16T00:00:00Z",
      results: [
        {
          id: "feed-001",
          parseStatus: "ok",
          entryCount: 5,
          format: "RSS",
          newestItemDate: "2026-07-10T12:00:00Z",
          etag: '"abc123"',
          lastModified: "Wed, 15 Jul 2026 00:00:00 GMT",
        },
      ],
    } as never;
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.get("If-None-Match")).toBe('"abc123"');
      expect(headers.get("If-Modified-Since")).toBe("Wed, 15 Jul 2026 00:00:00 GMT");
      // The Response constructor rejects 304; override the status on a 200 instead.
      const res = mockResponse("", 200);
      Object.defineProperty(res, "status", { value: 304 });
      return res;
    });
    vi.stubGlobal("fetch", fetchMock);
    const { results } = await validateFeeds([sampleFeed()], {
      ...baseOptions,
      previousReport,
    });
    expect(results[0].transportStatus).toBe("ok");
    expect(results[0].parseStatus).toBe("ok");
    expect(results[0].entryCount).toBe(5);
    expect(results[0].format).toBe("RSS");
    expect(results[0].newestItemDate).toBe("2026-07-10T12:00:00Z");
    expect(results[0].status).toBe("working");
  });

  it("classifies malformed catalog URLs as unsafe_url instead of aborting the run", async () => {
    const good = sampleFeed({ id: "feed-good", rssUrl: "http://127.0.0.1:8080/good.xml" });
    const bad = sampleFeed({ id: "feed-bad", rssUrl: "not a url" });
    const fetchMock = makeMockFetch([
      { url: "http://127.0.0.1:8080/good.xml", response: mockResponse(rssXml(), 200) },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const { results } = await validateFeeds([bad, good], baseOptions);
    const badResult = results.find((r) => r.id === "feed-bad")!;
    expect(badResult.transportStatus).toBe("unsafe_url");
    expect(badResult.status).toBe("blocked");
    expect(results.find((r) => r.id === "feed-good")!.status).toBe("working");
  });

  it("classifies SSRF-rejected URLs as unsafe_url", async () => {
    // Private URLs are NOT allowed in this test (no CIVICFEED_ALLOW_PRIVATE_URLS override).
    vi.unstubAllEnvs();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { results } = await validateFeeds([sampleFeed()], baseOptions);
    expect(results[0].transportStatus).toBe("unsafe_url");
    expect(results[0].status).toBe("blocked");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
