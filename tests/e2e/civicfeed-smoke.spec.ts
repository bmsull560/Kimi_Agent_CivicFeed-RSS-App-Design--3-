import { expect, test, type Page } from "@playwright/test";

function makeArticles(feedId: string, feedName: string, title: string, entryId: string) {
  return {
    entries: [
      {
        id: entryId,
        title,
        link: `https://example.com/${entryId}`,
        description: "Deterministic browser smoke entry.",
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

function makeCatalog() {
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
    ],
    categoryList: ["Commerce & Trade"],
    feedStats: { total: 1, working: 1, categories: 1 },
  };
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

async function mockSmokeBackend(page: Page, title = "CivicFeed Test Entry") {
  await page.route("**/api/feeds", route =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(makeCatalog()),
    }),
  );
  await page.route("**/api/feeds/feed-001/articles", route =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(makeArticles("feed-001", "ITA News", title, "browser-smoke-entry")),
    }),
  );
  await page.route("**/api/articles/recent*", route =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ results: [] }),
    }),
  );
}

test("desktop user can search, open, and read a feed entry without runtime errors", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "desktop-only path");
  const runtimeErrors = await collectRuntimeErrors(page);
  await mockSmokeBackend(page);

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

test("feed failures show an explicit empty/error state instead of a blank screen", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "desktop-only path");
  const runtimeErrors = await collectRuntimeErrors(page);
  await page.route("**/api/feeds", route =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(makeCatalog()),
    }),
  );
  await page.route("**/api/feeds/feed-001/articles", route =>
    route.fulfill({
      status: 502,
      contentType: "application/json",
      body: JSON.stringify({ entries: [], cached: false, error: "Feed unavailable" }),
    }),
  );
  await page.route("**/api/articles/recent*", route =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ results: [] }),
    }),
  );

  await page.goto("/#/feed/feed-001");
  await expect(page.getByText("Failed to load entries")).toBeVisible();
  await expect(page.getByRole("button", { name: "Try Again" })).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});

test("mobile layout exposes the directory and navigates to detail", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "mobile-only path");
  const runtimeErrors = await collectRuntimeErrors(page);
  await mockSmokeBackend(page, "Mobile CivicFeed Entry");

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
