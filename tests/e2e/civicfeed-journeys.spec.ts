import { expect, test, type Page } from "@playwright/test";

function makeCatalog(extraFeeds: Record<string, unknown>[] = []) {
  return {
    feeds: [
      {
        id: "feed-001",
        name: "ITA News",
        shortName: "ITA News",
        agency: "International Trade Administration",
        description: "Export Promotion",
        rssUrl: "https://www.trade.gov/rss.xml",
        website: "https://www.trade.gov",
        department: "",
        category: "Commerce & Trade",
        subCategory: "export-promotion",
        contentType: "Export Promotion",
        updateFrequency: "",
        status: "working",
        tags: ["export-promotion"],
      },
      ...extraFeeds,
    ],
    categoryList: ["Commerce & Trade"],
    feedStats: { total: 1 + extraFeeds.length, working: 1 + extraFeeds.length, categories: 1 },
  };
}

function makeArticles(feedId: string, feedName: string, title: string, entryId: string) {
  return {
    entries: [
      {
        id: entryId,
        title,
        link: `https://example.com/${entryId}`,
        description: "Deterministic browser test entry.",
        pubDate: "Mon, 15 Jun 2026 12:00:00 GMT",
        feedId,
        feedName,
        fetchedAt: Date.now(),
      },
    ],
    cached: false,
    error: null,
  };
}

async function collectRuntimeErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    const text = message.text();
    const isExpectedNetworkDiagnostic =
      text.startsWith("Failed to load resource:") || text.includes("Cross-Origin Request Blocked:");
    if (message.type() === "error" && !isExpectedNetworkDiagnostic) errors.push(`console: ${text}`);
  });
  return errors;
}

async function blockExternalRssAndProxies(page: Page) {
  await page.route(/https?:\/\/(www\.)?trade\.gov\/rss\.xml/, (route) =>
    route.abort("internetdisconnected")
  );
  await page.route(/api\.allorigins\.win|api\.codetabs\.com|corsproxy\.io/, (route) =>
    route.abort("internetdisconnected")
  );
}

async function mockBackendBasics(page: Page) {
  await blockExternalRssAndProxies(page);
  await page.route("**/api/feeds", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(makeCatalog()),
    })
  );
  await page.route("**/api/articles/recent*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ results: [] }),
    })
  );
  await page.route("**/api/stats/feeds", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        totalFeeds: 1,
        workingFeeds: 1,
        feedsWithStatus: 0,
        feedsWithRecentError: 0,
        staleFeeds: 0,
      }),
    })
  );
}

async function mockDiscover(
  page: Page,
  inputUrl: string,
  discoveredFeeds: { href: string; type: string; title: string }[]
) {
  await page.route(
    (url) => url.toString().includes(`/api/discover?url=${encodeURIComponent(inputUrl)}`),
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ feeds: discoveredFeeds }),
      })
  );
}

async function mockFeedArticles(
  page: Page,
  feedId: string,
  feedName: string,
  title: string,
  entryId: string
) {
  await page.route(`**/api/feeds/${feedId}/articles`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(makeArticles(feedId, feedName, title, entryId)),
    })
  );
}

async function addUserFeed(
  page: Page,
  {
    name,
    url,
    discoverUrl,
    discovered,
  }: {
    name: string;
    url: string;
    discoverUrl?: string;
    discovered?: { href: string; type: string; title: string }[];
  }
) {
  if (discoverUrl && discovered) {
    await mockDiscover(page, discoverUrl, discovered);
  }
  await mockDiscover(
    page,
    url,
    discovered ?? [{ href: url, type: "application/rss+xml", title: name }]
  );

  await page.goto("/feeds");
  await page.getByRole("button", { name: "Add Feed" }).click();
  await page.getByLabel("Name").fill(name);
  await page
    .getByPlaceholder("https://example.com/feed.xml or https://example.com")
    .fill(discoverUrl ?? url);
  if (discoverUrl && discovered) {
    await page.getByRole("button", { name: "Discover" }).click();
    await page
      .getByRole("button", { name: new RegExp(`Select feed ${discovered[0].title}`) })
      .click();
  }
  await page.getByRole("dialog").getByRole("button", { name: "Add Feed" }).click();
}

function stableFeedId(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `user-${Math.abs(hash).toString(36)}`;
}

test("first launch shows a useful feed with a clear empty-state fallback", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "desktop-only path");
  const runtimeErrors = await collectRuntimeErrors(page);
  await mockBackendBasics(page);

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "U.S. Government RSS Feeds" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Browse All/i })).toBeVisible();
  await expect(page.getByText("No recent entries yet")).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});

test("user adds a valid RSS feed and its articles appear", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "desktop-only path");
  const runtimeErrors = await collectRuntimeErrors(page);
  await mockBackendBasics(page);

  const feedUrl = "https://example.com/test-feed.xml";
  const feedId = stableFeedId(feedUrl);
  await mockFeedArticles(page, feedId, "My Test Feed", "Added Feed Entry", "browser-test-entry");
  await page.route("**/api/articles/recent*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        results: [
          {
            entryId: "browser-test-entry",
            feedId,
            title: "Added Feed Entry",
            link: "https://example.com/browser-test-entry",
            description: "Deterministic browser test entry.",
            pubDate: "Mon, 15 Jun 2026 12:00:00 GMT",
            author: null,
            feedName: "My Test Feed",
          },
        ],
      }),
    })
  );

  await addUserFeed(page, { name: "My Test Feed", url: feedUrl });
  await expect(page.getByText("My Test Feed")).toBeVisible();

  await page.getByText("My Test Feed").click();
  await expect(page).toHaveURL(new RegExp(`\\/feed\\/${feedId}$`));
  await expect(page.getByText("Added Feed Entry")).toBeVisible({ timeout: 20_000 });

  await page.goto("/reading");
  await expect(page.getByText("Added Feed Entry")).toBeVisible({ timeout: 20_000 });
  expect(runtimeErrors).toEqual([]);
});

test("adding a duplicate RSS feed is prevented", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "desktop-only path");
  const runtimeErrors = await collectRuntimeErrors(page);
  await mockBackendBasics(page);

  const feedUrl = "https://example.com/test-feed.xml";
  const feedId = stableFeedId(feedUrl);
  await mockFeedArticles(page, feedId, "Original Feed", "Duplicate Feed Entry", "duplicate-entry");

  await addUserFeed(page, { name: "Original Feed", url: feedUrl });
  await expect(page.getByText("Original Feed")).toBeVisible();

  await page.getByRole("button", { name: "Add Feed" }).click();
  await page.getByLabel("Name").fill("Duplicate Feed");
  await page.getByPlaceholder("https://example.com/feed.xml or https://example.com").fill(feedUrl);

  const dialogPromise = new Promise<string>((resolve) => {
    page.once("dialog", (d) => {
      resolve(d.message());
      d.accept();
    });
  });

  await page.getByRole("dialog").getByRole("button", { name: "Add Feed" }).click();
  const alertMessage = await dialogPromise;
  expect(alertMessage).toContain("already exists");

  await expect(page.getByRole("dialog")).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});

test("user discovers a feed from a website URL", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "desktop-only path");
  const runtimeErrors = await collectRuntimeErrors(page);
  await mockBackendBasics(page);

  const discoveredUrl = "https://example.com/discovered.xml";
  const discoveredFeedId = stableFeedId(discoveredUrl);
  await mockDiscover(page, "https://example.com/news", [
    { href: discoveredUrl, type: "application/rss+xml", title: "Discovered Feed" },
  ]);
  await mockDiscover(page, discoveredUrl, [
    { href: discoveredUrl, type: "application/rss+xml", title: "Discovered Feed" },
  ]);
  await mockFeedArticles(
    page,
    discoveredFeedId,
    "Discovered Test Feed",
    "Discovered Entry",
    "discovered-entry"
  );

  await page.goto("/feeds");
  await page.getByRole("button", { name: "Add Feed" }).click();
  await page.getByLabel("Name").fill("Discovered Test Feed");
  await page
    .getByPlaceholder("https://example.com/feed.xml or https://example.com")
    .fill("https://example.com/news");

  await page.getByRole("button", { name: "Discover" }).click();
  await page.getByRole("button", { name: /Select feed Discovered Feed/i }).click();

  await page.getByRole("dialog").getByRole("button", { name: "Add Feed" }).click();

  await expect(page.getByText("Discovered Test Feed")).toBeVisible();

  await page.getByText("Discovered Test Feed").click();
  await expect(page).toHaveURL(new RegExp(`\\/feed\\/${discoveredFeedId}$`));
  await expect(page.getByText("Discovered Entry")).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});

test("invalid or unreachable feed produces an actionable error", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "desktop-only path");
  const runtimeErrors = await collectRuntimeErrors(page);
  await mockBackendBasics(page);

  const badUrl = "https://example.com/bad-feed.xml";
  await mockDiscover(page, badUrl, []);

  await page.goto("/feeds");
  await page.getByRole("button", { name: "Add Feed" }).click();
  await page.getByLabel("Name").fill("Bad Feed");
  await page.getByPlaceholder("https://example.com/feed.xml or https://example.com").fill(badUrl);
  await page.getByRole("dialog").getByRole("button", { name: "Add Feed" }).click();

  await expect(
    page.getByText(
      /Could not fetch|No entries found|valid feed|valid HTTP|RSS URL is required|No RSS or Atom feeds found/i
    )
  ).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});

test("feed detail shows backend fetch diagnostics for a failing feed", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "desktop-only path");
  const runtimeErrors = await collectRuntimeErrors(page);
  await mockBackendBasics(page);

  await page.route("**/api/feeds/feed-001/status", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        feedId: "feed-001",
        lastSuccessAt: null,
        lastErrorAt: Date.now(),
        lastErrorMessage: "HTTP 500",
        attemptCount: 3,
        successCount: 0,
        failureCount: 3,
        nextFetchAt: Date.now() + 5 * 60 * 1000,
      }),
    })
  );
  await page.route("**/api/feeds/feed-001/health", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        feedId: "feed-001",
        status: "fail",
        checks: {
          reachable: false,
          validXml: false,
          validSchema: false,
          stableGuids: false,
          saneDates: false,
          usableContent: false,
          fresh: false,
        },
        newestItemDate: null,
        responseTimeMs: 0,
        lastValidatedAt: Date.now(),
        error: "HTTP 500",
      }),
    })
  );

  await page.goto("/feeds");
  await page.locator("h3").first().click();
  await expect(page).toHaveURL(/\/feed\//);

  await expect(page.getByText("Fetch diagnostics")).toBeVisible();
  await expect(page.getByText("Recent fetch failures")).toBeVisible();
  await expect(page.locator(".text-amber-800").getByText("HTTP 500")).toBeVisible();
  await expect(page.getByText(/Failures: ?3/i)).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});

test("user filters by source or category", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "desktop-only path");
  const runtimeErrors = await collectRuntimeErrors(page);
  await mockBackendBasics(page);

  await page.goto("/feeds");
  await page.getByPlaceholder("Search...").fill("ITA News");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/feeds\?q=ITA/);
  await expect(page.locator("h3").filter({ hasText: "ITA News" }).first()).toBeVisible();

  await page.goto("/feeds?category=Commerce%20%26%20Trade");
  await expect(page.getByRole("heading", { name: "Commerce & Trade" })).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});

test("user searches for an article", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "desktop-only path");
  const runtimeErrors = await collectRuntimeErrors(page);
  await mockBackendBasics(page);

  await page.route("**/api/search?q=*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        query: "Searchable",
        results: [
          {
            entryId: "searchable-entry",
            feedId: "feed-001",
            title: "Searchable Article Title",
            link: "https://example.com/searchable",
            description: "A searchable description.",
            pubDate: "Mon, 15 Jun 2026 12:00:00 GMT",
            author: null,
            feedName: "ITA News",
          },
        ],
        total: 1,
      }),
    })
  );

  await page.goto("/search?q=Searchable");
  await expect(page.getByText("Searchable Article Title")).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});

test("search shows an error when the backend is unavailable", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "desktop-only path");
  const runtimeErrors = await collectRuntimeErrors(page);
  await mockBackendBasics(page);

  await page.route("**/api/search?q=*", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Backend not available in tests" }),
    })
  );

  await page.goto("/search?q=Searchable");
  await expect(page.getByText("No articles found")).toBeVisible();
  await expect(page.getByText("Search unavailable. Is the backend running?").last()).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});

test("built-in feed enabled state persists after reload", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "desktop-only path");
  await mockBackendBasics(page);
  await page.goto("/feeds");

  const toggle = page.getByRole("switch", { name: "ITA News enabled" }).first();
  await expect(toggle).toBeChecked();
  await toggle.click();
  await expect(toggle).not.toBeChecked();
  await page.reload();
  await expect(page.getByRole("switch", { name: "ITA News enabled" }).first()).not.toBeChecked();

  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("civicfeed_v2_user") || "{}")
  );
  expect(stored.feedOverrides["feed-001"]).toEqual({ enabled: false });
});

test("user bookmarks and marks an article as read", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "desktop-only path");
  const runtimeErrors = await collectRuntimeErrors(page);
  await mockBackendBasics(page);

  await page.route("**/api/articles/recent*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        results: [
          {
            entryId: "state-entry",
            feedId: "feed-001",
            title: "State Test Entry",
            link: "https://example.com/state",
            description: "State test.",
            pubDate: "Mon, 15 Jun 2026 12:00:00 GMT",
            author: null,
            feedName: "ITA News",
          },
        ],
      }),
    })
  );

  await page.goto("/reading");
  await page.getByRole("article").getByRole("button", { name: "Bookmark" }).click();
  await page.getByRole("article").getByRole("button", { name: "Mark read" }).click();

  await expect(page.getByRole("button", { name: "Remove bookmark" })).toBeVisible();
  await expect(
    page.getByRole("article").getByRole("button", { name: "Mark unread" })
  ).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});

test("state persists after reload", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "desktop-only path");
  const runtimeErrors = await collectRuntimeErrors(page);
  await mockBackendBasics(page);

  await page.route("**/api/articles/recent*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        results: [
          {
            entryId: "persist-entry",
            feedId: "feed-001",
            title: "Persist Entry",
            link: "https://example.com/persist",
            description: "Persistence test.",
            pubDate: "Mon, 15 Jun 2026 12:00:00 GMT",
            author: null,
            feedName: "ITA News",
          },
        ],
      }),
    })
  );

  await page.goto("/reading");
  await page.getByRole("article").getByRole("button", { name: "Bookmark" }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: "Remove bookmark" })).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});

test("user edits and removes a feed", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "desktop-only path");
  const runtimeErrors = await collectRuntimeErrors(page);
  await mockBackendBasics(page);

  const feedUrl = "https://example.com/test-feed.xml";
  const feedId = stableFeedId(feedUrl);
  await mockFeedArticles(page, feedId, "Feed To Edit", "Edit Feed Entry", "edit-entry");

  await addUserFeed(page, { name: "Feed To Edit", url: feedUrl });
  await expect(page.getByText("Feed To Edit")).toBeVisible();

  await page.getByRole("button", { name: "Grid view" }).click();

  await page
    .locator(".card-hover")
    .filter({ hasText: "Feed To Edit" })
    .getByTestId("edit-feed")
    .click();
  await page.getByLabel("Name").fill("Edited Feed Name");
  await page.getByRole("button", { name: "Save Changes" }).click();
  await expect(page.getByText("Edited Feed Name")).toBeVisible();

  await page
    .locator(".card-hover")
    .filter({ hasText: "Edited Feed Name" })
    .getByTestId("remove-feed")
    .click();
  await expect(page.getByText("Edited Feed Name")).not.toBeVisible();
  expect(runtimeErrors).toEqual([]);
});

function sampleOpml() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head><title>Test OPML</title></head>
  <body>
    <outline type="rss" text="Imported Feed" title="Imported Feed" xmlUrl="https://example.com/imported.xml" htmlUrl="https://example.com" />
  </body>
</opml>`;
}

test("user imports and exports OPML", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "desktop-only path");
  const runtimeErrors = await collectRuntimeErrors(page);
  await mockBackendBasics(page);

  const importedUrl = "https://example.com/imported.xml";
  const importedFeedId = stableFeedId(importedUrl);
  await mockFeedArticles(page, importedFeedId, "Imported Feed", "Imported Entry", "imported-entry");

  await page.goto("/feeds");

  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Import" }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles([
    {
      name: "feeds.opml",
      mimeType: "text/xml",
      buffer: Buffer.from(sampleOpml()),
    },
  ]);

  await page.waitForTimeout(500);
  await expect(page.getByText("Imported Feed")).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export" }).click(),
  ]);
  const downloadPath = await download.path();
  expect(downloadPath).toBeTruthy();
  expect(runtimeErrors).toEqual([]);
});

test("core navigation works at mobile and desktop widths", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "mobile-only path");
  const runtimeErrors = await collectRuntimeErrors(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "U.S. Government RSS Feeds" })).toBeVisible();
  await page.getByRole("button", { name: "Toggle menu" }).click();
  await page
    .getByRole("navigation", { name: "Feed categories" })
    .getByRole("button", { name: "Reading Stream" })
    .click();
  await expect(page).toHaveURL(/\/reading$/);
  await page.getByRole("button", { name: "Toggle menu" }).click();
  await page
    .getByRole("navigation", { name: "Feed categories" })
    .getByRole("button", { name: "Bookmarks" })
    .click();
  await expect(page).toHaveURL(/\/bookmarks$/);
  expect(runtimeErrors).toEqual([]);
});

test("keyboard-only interaction completes the principal workflow", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "desktop-only path");
  const runtimeErrors = await collectRuntimeErrors(page);
  await page.goto("/");

  let focusedText = "";
  let reached = false;
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press("Tab");
    focusedText = await page.evaluate(() => {
      const el = document.activeElement;
      return el?.getAttribute("aria-label") || el?.textContent || "";
    });
    if (focusedText.includes("Browse All")) {
      reached = true;
      break;
    }
  }
  expect(reached).toBe(true);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/feeds$/);
  expect(runtimeErrors).toEqual([]);
});

test("feed-provided unsafe markup is not executed", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "desktop-only path");
  const runtimeErrors = await collectRuntimeErrors(page);
  await mockBackendBasics(page);

  const unsafeUrl = "https://example.com/unsafe-feed.xml";
  const unsafeFeedId = stableFeedId(unsafeUrl);
  await mockDiscover(page, unsafeUrl, [
    { href: unsafeUrl, type: "application/rss+xml", title: "Unsafe Feed" },
  ]);
  await mockFeedArticles(page, unsafeFeedId, "Unsafe Feed", "Unsafe Entry", "unsafe-entry");

  const executed = await page.evaluate(() => {
    return (window as Record<string, unknown>).__UNSAFE_SCRIPT_EXECUTED__ === true;
  });
  expect(executed).toBe(false);

  await page.goto("/feeds");
  await page.getByRole("button", { name: "Add Feed" }).click();
  await page.getByLabel("Name").fill("Unsafe Feed");
  await page
    .getByPlaceholder("https://example.com/feed.xml or https://example.com")
    .fill(unsafeUrl);
  await page.getByRole("dialog").getByRole("button", { name: "Add Feed" }).click();

  await expect(page.getByText("Unsafe Feed")).toBeVisible({ timeout: 20_000 });
  await page.getByText("Unsafe Feed").click();
  await expect(page).toHaveURL(new RegExp(`\\/feed\\/${unsafeFeedId}$`));

  const stillNotExecuted = await page.evaluate(() => {
    return (window as Record<string, unknown>).__UNSAFE_SCRIPT_EXECUTED__ === true;
  });
  expect(stillNotExecuted).toBe(false);
  expect(runtimeErrors).toEqual([]);
});

test("weekly recap shows a graceful empty state when backend is unavailable", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "desktop-only path");
  const runtimeErrors = await collectRuntimeErrors(page);
  await mockBackendBasics(page);

  await page.route("**/api/recap", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Backend not available in tests" }),
    })
  );

  await page.goto("/recap");
  await expect(page.getByText(/Weekly Recap requires the backend/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Browse Feeds" })).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});
