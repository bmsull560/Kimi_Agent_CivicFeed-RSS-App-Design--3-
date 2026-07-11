import { expect, test, type Page } from "@playwright/test";

const cacheKey = "civicfeed_v2_cache";

function sampleRss(title = "CivicFeed Test Entry") {
  return `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <item>
      <title>${title}</title>
      <link>https://example.com/test-entry</link>
      <description>Deterministic browser test entry.</description>
      <pubDate>Mon, 15 Jun 2026 12:00:00 GMT</pubDate>
      <guid>browser-test-entry</guid>
    </item>
  </channel>
</rss>`;
}

function sampleRssWithScript() {
  return `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
  <channel>
    <title>Unsafe Feed</title>
    <item>
      <title>Unsafe Entry</title>
      <link>https://example.com/unsafe</link>
      <description><![CDATA[<p>Description</p><script>window.__UNSAFE_SCRIPT_EXECUTED__ = true;</script>]]></description>
      <pubDate>Mon, 15 Jun 2026 12:00:00 GMT</pubDate>
      <guid>unsafe-entry</guid>
    </item>
  </channel>
</rss>`;
}

function sampleOpml() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head><title>Test OPML</title></head>
  <body>
    <outline type="rss" text="Imported Feed" title="Imported Feed" xmlUrl="https://example.com/imported.xml" htmlUrl="https://example.com" />
  </body>
</opml>`;
}

async function collectRuntimeErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(`pageerror: ${error.message}`));
  page.on("console", message => {
    const text = message.text();
    const isExpectedNetworkDiagnostic =
      text.startsWith("Failed to load resource:") ||
      text.includes("Cross-Origin Request Blocked:");
    if (message.type() === "error" && !isExpectedNetworkDiagnostic) errors.push(`console: ${text}`);
  });
  return errors;
}

async function mockExampleFeed(page: Page, title?: string) {
  await page.route("https://example.com/test-feed.xml", route =>
    route.fulfill({
      contentType: "application/rss+xml",
      body: sampleRss(title),
    }),
  );
}

async function mockImportedFeed(page: Page) {
  await page.route("https://example.com/imported.xml", route =>
    route.fulfill({
      contentType: "application/rss+xml",
      body: sampleRss("Imported Entry"),
    }),
  );
}

async function blockFeedBackends(page: Page) {
  await page.route("**/*", route => {
    const url = route.request().url();
    if (url.includes("/api/feeds/") && url.endsWith("/articles")) {
      return route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: "Backend not available in tests" }),
      });
    }
    if (url.includes("/api/search") || url.includes("/api/recap")) {
      return route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Backend not available in tests" }),
      });
    }
    if (/allorigins\.win|codetabs\.com|corsproxy\.io/.test(url)) {
      return route.fulfill({
        status: 503,
        contentType: "text/plain",
        body: "Proxy unavailable in tests",
      });
    }
    return route.fallback();
  });
}

test("first launch shows a useful feed with a clear empty-state fallback", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "desktop-only path");
  const runtimeErrors = await collectRuntimeErrors(page);
  await page.goto("/#/");
  await expect(page.getByRole("heading", { name: "U.S. Government RSS Feeds" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Browse All/i })).toBeVisible();
  await expect(page.getByText("No cached entries yet")).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});

test("user adds a valid RSS feed and its articles appear", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "desktop-only path");
  const runtimeErrors = await collectRuntimeErrors(page);
  await mockExampleFeed(page, "Added Feed Entry");
  await blockFeedBackends(page);

  await page.goto("/#/feeds");
  await page.getByRole("button", { name: "Add Feed" }).click();
  await page.getByLabel("Name").fill("My Test Feed");
  await page.getByPlaceholder("https://example.com/feed.xml").fill("https://example.com/test-feed.xml");
  await page.getByRole("dialog").getByRole("button", { name: "Add Feed" }).click();

  await expect(page.getByText("My Test Feed")).toBeVisible();

  // Load the feed entries by visiting its detail page.
  await page.getByText("My Test Feed").click();
  await expect(page).toHaveURL(/#\/feed\/user-/);
  await expect(page.getByText("Added Feed Entry")).toBeVisible({ timeout: 20_000 });

  await page.goto("/#/reading");
  await expect(page.getByText("Added Feed Entry")).toBeVisible({ timeout: 20_000 });
  expect(runtimeErrors).toEqual([]);
});

test("adding a duplicate RSS feed is prevented", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "desktop-only path");
  const runtimeErrors = await collectRuntimeErrors(page);
  await mockExampleFeed(page, "Duplicate Feed Entry");
  await blockFeedBackends(page);

  await page.goto("/#/feeds");
  await page.getByRole("button", { name: "Add Feed" }).click();
  await page.getByLabel("Name").fill("Original Feed");
  await page.getByPlaceholder("https://example.com/feed.xml").fill("https://example.com/test-feed.xml");
  await page.getByRole("dialog").getByRole("button", { name: "Add Feed" }).click();

  await expect(page.getByText("Original Feed")).toBeVisible();

  await page.getByRole("button", { name: "Add Feed" }).click();
  await page.getByLabel("Name").fill("Duplicate Feed");
  await page.getByPlaceholder("https://example.com/feed.xml").fill("https://example.com/test-feed.xml");

  const dialogPromise = new Promise<string>((resolve) => {
    page.once("dialog", (d) => {
      resolve(d.message());
      d.accept();
    });
  });

  await page.getByRole("dialog").getByRole("button", { name: "Add Feed" }).click();
  const alertMessage = await dialogPromise;
  expect(alertMessage).toContain("already exists");

  // Dialog should still be open so the user can change the URL.
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});

test("user discovers a feed from a website URL", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "desktop-only path");
  const runtimeErrors = await collectRuntimeErrors(page);

  await page.route("**/api/discover?url=*", route =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        feeds: [
          {
            href: "https://example.com/discovered.xml",
            type: "application/rss+xml",
            title: "Discovered Feed",
          },
        ],
      }),
    }),
  );

  await page.route("https://example.com/discovered.xml", route =>
    route.fulfill({
      contentType: "application/rss+xml",
      body: sampleRss("Discovered Entry"),
    }),
  );

  await blockFeedBackends(page);

  await page.goto("/#/feeds");
  await page.getByRole("button", { name: "Add Feed" }).click();
  await page.getByLabel("Name").fill("Discovered Test Feed");
  await page.getByPlaceholder("https://example.com/feed.xml or https://example.com").fill("https://example.com/news");

  await page.getByRole("button", { name: "Discover" }).click();
  await page.getByRole("button", { name: /Select feed Discovered Feed/i }).click();

  await page.getByRole("dialog").getByRole("button", { name: "Add Feed" }).click();

  await expect(page.getByText("Discovered Test Feed")).toBeVisible();

  await page.getByText("Discovered Test Feed").click();
  await expect(page.getByText("Discovered Entry")).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});

test("invalid or unreachable feed produces an actionable error", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "desktop-only path");
  const runtimeErrors = await collectRuntimeErrors(page);
  await page.route("https://example.com/bad-feed.xml", route => route.fulfill({
    contentType: "application/xml",
    body: "<not-rss></not-rss>",
  }));
  await blockFeedBackends(page);

  await page.goto("/#/feeds");
  await page.getByRole("button", { name: "Add Feed" }).click();
  await page.getByLabel("Name").fill("Bad Feed");
  await page.getByPlaceholder("https://example.com/feed.xml").fill("https://example.com/bad-feed.xml");
  await page.getByRole("dialog").getByRole("button", { name: "Add Feed" }).click();

  await expect(page.getByText(/Could not fetch|No entries found|valid feed|valid HTTP|RSS URL is required/i)).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});

test("feed detail shows backend fetch diagnostics for a failing feed", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "desktop-only path");
  const runtimeErrors = await collectRuntimeErrors(page);

  await page.route("**/api/feeds/*/status", route =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        feedId: "diagnostics-feed",
        lastSuccessAt: null,
        lastErrorAt: Date.now(),
        lastErrorMessage: "HTTP 500",
        attemptCount: 3,
        successCount: 0,
        failureCount: 3,
        nextFetchAt: Date.now() + 5 * 60 * 1000,
      }),
    }),
  );

  await page.goto("/#/feeds");
  await page.locator("h3").first().click();
  await expect(page).toHaveURL(/#\/feed\//);

  await expect(page.getByText("Fetch diagnostics")).toBeVisible();
  await expect(page.getByText("Recent fetch failures")).toBeVisible();
  await expect(page.getByText("HTTP 500")).toBeVisible();
  await expect(page.getByText(/Failures: ?3/i)).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});

test("user filters by source or category", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "desktop-only path");
  const runtimeErrors = await collectRuntimeErrors(page);
  await page.goto("/#/feeds");
  await page.getByPlaceholder("Search...").fill("ITA News");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#\/feeds\?q=ITA/);
  await expect(page.locator("h3").filter({ hasText: "ITA News" }).first()).toBeVisible();

  await page.goto("/#/feeds?category=Commerce%20%26%20Trade");
  await expect(page.getByRole("heading", { name: "Commerce & Trade" })).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});

test("user searches for an article", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "desktop-only path");
  const runtimeErrors = await collectRuntimeErrors(page);
  await page.addInitScript(({ key }) => {
    window.localStorage.setItem(key, JSON.stringify([
      {
        feedId: "feed-001",
        fetchedAt: Date.now(),
        accessedAt: Date.now(),
        entries: [
          {
            id: "searchable-entry",
            title: "Searchable Article Title",
            link: "https://example.com/searchable",
            description: "A searchable description.",
            pubDate: new Date("2026-06-15T12:00:00.000Z").toISOString(),
            feedId: "feed-001",
            feedName: "ITA News",
            fetchedAt: Date.now(),
          },
        ],
      },
    ]));
  }, { key: cacheKey });

  await page.goto("/#/search?q=Searchable");
  await expect(page.getByText("Searchable Article Title")).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});

test("search shows local results and indicates backend is unavailable", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "desktop-only path");
  const runtimeErrors = await collectRuntimeErrors(page);
  await blockFeedBackends(page);
  await page.addInitScript(({ key }) => {
    window.localStorage.setItem(key, JSON.stringify([
      {
        feedId: "feed-001",
        fetchedAt: Date.now(),
        accessedAt: Date.now(),
        entries: [
          {
            id: "searchable-entry",
            title: "Searchable Article Title",
            link: "https://example.com/searchable",
            description: "A searchable description.",
            pubDate: new Date("2026-06-15T12:00:00.000Z").toISOString(),
            feedId: "feed-001",
            feedName: "ITA News",
            fetchedAt: Date.now(),
          },
        ],
      },
    ]));
  }, { key: cacheKey });

  await page.goto("/#/search?q=Searchable");
  await expect(page.getByText("Searchable Article Title")).toBeVisible();
  await expect(page.getByText(/local cache only — backend unavailable/i)).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});

test("user bookmarks and marks an article as read", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "desktop-only path");
  const runtimeErrors = await collectRuntimeErrors(page);
  await page.addInitScript(({ key }) => {
    window.localStorage.setItem(key, JSON.stringify([
      {
        feedId: "feed-001",
        fetchedAt: Date.now(),
        accessedAt: Date.now(),
        entries: [
          {
            id: "state-entry",
            title: "State Test Entry",
            link: "https://example.com/state",
            description: "State test.",
            pubDate: new Date("2026-06-15T12:00:00.000Z").toISOString(),
            feedId: "feed-001",
            feedName: "ITA News",
            fetchedAt: Date.now(),
          },
        ],
      },
    ]));
  }, { key: cacheKey });

  await page.goto("/#/reading");
  await page.getByRole("article").getByRole("button", { name: "Bookmark" }).click();
  await page.getByRole("article").getByRole("button", { name: "Mark read" }).click();

  await expect(page.getByRole("button", { name: "Remove bookmark" })).toBeVisible();
  await expect(page.locator("article").getByText("Read")).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});

test("state persists after reload", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "desktop-only path");
  const runtimeErrors = await collectRuntimeErrors(page);
  await page.addInitScript(({ key }) => {
    window.localStorage.setItem(key, JSON.stringify([
      {
        feedId: "feed-001",
        fetchedAt: Date.now(),
        accessedAt: Date.now(),
        entries: [
          {
            id: "persist-entry",
            title: "Persist Entry",
            link: "https://example.com/persist",
            description: "Persistence test.",
            pubDate: new Date("2026-06-15T12:00:00.000Z").toISOString(),
            feedId: "feed-001",
            feedName: "ITA News",
            fetchedAt: Date.now(),
          },
        ],
      },
    ]));
  }, { key: cacheKey });

  await page.goto("/#/reading");
  await page.getByRole("article").getByRole("button", { name: "Bookmark" }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: "Remove bookmark" })).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});

test("user edits and removes a feed", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "desktop-only path");
  const runtimeErrors = await collectRuntimeErrors(page);
  await mockExampleFeed(page, "Edit Feed Entry");
  await blockFeedBackends(page);

  await page.goto("/#/feeds");
  await page.getByRole("button", { name: "Add Feed" }).click();
  await page.getByLabel("Name").fill("Feed To Edit");
  await page.getByPlaceholder("https://example.com/feed.xml").fill("https://example.com/test-feed.xml");
  await page.getByRole("dialog").getByRole("button", { name: "Add Feed" }).click();

  await expect(page.getByText("Feed To Edit")).toBeVisible();

  // Switch to grid view for direct action buttons.
  await page.getByRole("button", { name: "Grid view" }).click();

  // Edit
  await page.locator(".card-hover").filter({ hasText: "Feed To Edit" }).getByTestId("edit-feed").click();
  await page.getByLabel("Name").fill("Edited Feed Name");
  await page.getByRole("button", { name: "Save Changes" }).click();
  await expect(page.getByText("Edited Feed Name")).toBeVisible();

  // Remove
  await page.locator(".card-hover").filter({ hasText: "Edited Feed Name" }).getByTestId("remove-feed").click();
  await expect(page.getByText("Edited Feed Name")).not.toBeVisible();
  expect(runtimeErrors).toEqual([]);
});

test("user imports and exports OPML", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "desktop-only path");
  const runtimeErrors = await collectRuntimeErrors(page);
  await mockImportedFeed(page);

  await page.goto("/#/feeds");

  // Import
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

  // Export
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export" }).click(),
  ]);
  const path = await download.path();
  expect(path).toBeTruthy();
  expect(runtimeErrors).toEqual([]);
});

test("core navigation works at mobile and desktop widths", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "mobile-only path");
  const runtimeErrors = await collectRuntimeErrors(page);
  await page.goto("/#/");
  await expect(page.getByRole("heading", { name: "U.S. Government RSS Feeds" })).toBeVisible();
  await page.getByRole("button", { name: "Toggle menu" }).click();
  await page.getByRole("button", { name: /Reading Stream/i }).click();
  await expect(page).toHaveURL(/#\/reading$/);
  await page.getByRole("button", { name: "Toggle menu" }).click();
  await page.getByRole("button", { name: /Bookmarks/i }).click();
  await expect(page).toHaveURL(/#\/bookmarks$/);
  expect(runtimeErrors).toEqual([]);
});

test("keyboard-only interaction completes the principal workflow", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "desktop-only path");
  const runtimeErrors = await collectRuntimeErrors(page);
  await page.goto("/#/");

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
  await expect(page).toHaveURL(/#\/feeds$/);
  expect(runtimeErrors).toEqual([]);
});

test("feed-provided unsafe markup is not executed", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "desktop-only path");
  const runtimeErrors = await collectRuntimeErrors(page);
  await page.route("https://example.com/unsafe-feed.xml", route =>
    route.fulfill({
      contentType: "application/rss+xml",
      body: sampleRssWithScript(),
    }),
  );
  await blockFeedBackends(page);

  const executed = await page.evaluate(() => {
    return (window as Record<string, unknown>).__UNSAFE_SCRIPT_EXECUTED__ === true;
  });
  expect(executed).toBe(false);

  await page.goto("/#/feeds");
  await page.getByRole("button", { name: "Add Feed" }).click();
  await page.getByLabel("Name").fill("Unsafe Feed");
  await page.getByPlaceholder("https://example.com/feed.xml").fill("https://example.com/unsafe-feed.xml");
  await page.getByRole("dialog").getByRole("button", { name: "Add Feed" }).click();

  await expect(page.getByText("Unsafe Feed")).toBeVisible({ timeout: 20_000 });
  await page.getByText("Unsafe Feed").click();
  await expect(page).toHaveURL(/#\/feed\/user-/);

  const stillNotExecuted = await page.evaluate(() => {
    return (window as Record<string, unknown>).__UNSAFE_SCRIPT_EXECUTED__ === true;
  });
  expect(stillNotExecuted).toBe(false);
  expect(runtimeErrors).toEqual([]);
});

test("weekly recap shows a graceful empty state when backend is unavailable", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "desktop-only path");
  const runtimeErrors = await collectRuntimeErrors(page);
  await blockFeedBackends(page);

  await page.goto("/#/recap");
  await expect(page.getByText(/Weekly Recap requires the backend/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Browse Feeds" })).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});
