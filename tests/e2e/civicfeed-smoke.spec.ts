import { expect, test, type Page } from "@playwright/test";

const cacheKey = "civicfeed_v2_cache";

function sampleRss(title = "CivicFeed Test Entry") {
  return `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
  <channel>
    <title>ITA News</title>
    <item>
      <title>${title}</title>
      <link>https://www.trade.gov/test-entry</link>
      <description>Deterministic browser smoke entry.</description>
      <pubDate>Mon, 15 Jun 2026 12:00:00 GMT</pubDate>
      <guid>browser-smoke-entry</guid>
    </item>
  </channel>
</rss>`;
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

async function mockTradeFeed(page: Page, title?: string) {
  await page.route("https://www.trade.gov/rss.xml", route =>
    route.fulfill({
      contentType: "application/rss+xml",
      body: sampleRss(title),
    }),
  );
}

test("desktop user can search, open, and read a feed entry without runtime errors", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "desktop-only path");
  const runtimeErrors = await collectRuntimeErrors(page);
  await mockTradeFeed(page);

  await page.goto("/#/");
  await expect(page.getByRole("heading", { name: "U.S. Government RSS Feeds" })).toBeVisible();

  await page.getByRole("combobox", { name: "Search feeds" }).fill("ITA News");
  await page.getByRole("option", { name: /ITA News/i }).first().click();

  await expect(page).toHaveURL(/#\/feed\/feed-001$/);
  await expect(page.getByRole("heading", { name: "ITA News" })).toBeVisible();
  await expect(page.getByText("CivicFeed Test Entry")).toBeVisible();
  await expect(page.getByText("1 entry")).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});

test("cached entries render immediately while a stale refresh is attempted", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "desktop-only path");
  const runtimeErrors = await collectRuntimeErrors(page);
  await page.addInitScript(({ key }) => {
    window.localStorage.setItem(key, JSON.stringify([
      {
        feedId: "feed-001",
        fetchedAt: Date.now() - 60 * 60 * 1000,
        accessedAt: Date.now() - 60 * 60 * 1000,
        entries: [
          {
            id: "cached-entry",
            title: "Cached ITA Entry",
            link: "https://www.trade.gov/cached-entry",
            description: "This entry proves stale cache rendering.",
            pubDate: new Date("2026-06-15T12:00:00.000Z").toISOString(),
            feedId: "feed-001",
            feedName: "ITA News",
            fetchedAt: Date.now() - 60 * 60 * 1000,
          },
        ],
      },
    ]));
  }, { key: cacheKey });
  await page.route("https://www.trade.gov/rss.xml", route => route.abort());

  await page.goto("/#/feed/feed-001");
  await expect(page.getByText("Cached ITA Entry")).toBeVisible();
  await expect(page.getByText(/Showing cached entries\. Refresh failed:/)).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});

test("feed failures show an explicit empty/error state instead of a blank screen", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "desktop-only path");
  const runtimeErrors = await collectRuntimeErrors(page);
  await page.route("https://www.trade.gov/rss.xml", route => route.fulfill({
    contentType: "application/xml",
    body: "<rss><channel></channel></rss>",
  }));
  await page.route(/api\.allorigins\.win|api\.codetabs\.com|corsproxy\.io/, route => route.abort());

  await page.goto("/#/feed/feed-001");
  await expect(page.getByText("Failed to load entries")).toBeVisible();
  await expect(page.getByRole("button", { name: "Try Again" })).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});

test("mobile layout exposes the directory and navigates to detail", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "mobile-only path");
  const runtimeErrors = await collectRuntimeErrors(page);
  await mockTradeFeed(page, "Mobile CivicFeed Entry");

  await page.goto("/#/");
  await expect(page.getByRole("heading", { name: "U.S. Government RSS Feeds" })).toBeVisible();
  await page.getByRole("button", { name: "Toggle menu" }).click();
  await page.getByRole("button", { name: /All Feeds/i }).click();

  await expect(page).toHaveURL(/#\/feeds$/);
  await page.getByRole("button", { name: /ITA News/i }).first().click();
  await expect(page).toHaveURL(/#\/feed\/feed-001$/);
  await expect(page.getByText("Mobile CivicFeed Entry")).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});
