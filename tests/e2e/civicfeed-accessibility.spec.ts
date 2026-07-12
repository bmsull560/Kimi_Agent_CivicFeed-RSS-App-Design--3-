import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

interface A11yPage {
  name: string;
  path: string;
  waitSelector?: string;
}

const pages: A11yPage[] = [
  { path: "/#/", name: "Dashboard" },
  { path: "/#/feeds?q=ITA+News", name: "Feed Directory" },
  { path: "/#/reading", name: "Reading Stream" },
  { path: "/#/bookmarks", name: "Bookmarks" },
  { path: "/#/archive", name: "Archive" },
  { path: "/#/search", name: "Search" },
  { path: "/#/recap", name: "Recap" },
];

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

async function mockBackendForAccessibility(page: import("@playwright/test").Page) {
  await page.route("**/api/feeds", route =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(makeCatalog()) }),
  );
  await page.route("**/api/articles/recent*", route =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ results: [] }) }),
  );
  await page.route("**/api/stats/feeds", route =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ totalFeeds: 1, workingFeeds: 1, feedsWithStatus: 0, feedsWithRecentError: 0, staleFeeds: 0 }),
    }),
  );
  await page.route("**/api/search*", route =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ query: "", results: [], total: 0 }) }),
  );
  await page.route("**/api/recap", route =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ startDate: new Date().toISOString(), endDate: new Date().toISOString(), totalArticles: 0, categories: [], topTags: [] }),
    }),
  );
  await page.route("**/api/articles/by-ids", route =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ results: [] }) }),
  );
}

for (const { path, name } of pages) {
  test.describe(`${name} accessibility`, () => {
    test(`should not have automatically detectable a11y violations on ${name}`, async ({ page }) => {
      test.setTimeout(120_000);
      await mockBackendForAccessibility(page);
      await page.goto(path);
      // Wait for the main content to render before scanning.
      await page.locator("main, [role=main], #root").first().waitFor({ state: "visible", timeout: 5000 });

      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .exclude(".tox") // exclude rich-text editor if present
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    });
  });
}
