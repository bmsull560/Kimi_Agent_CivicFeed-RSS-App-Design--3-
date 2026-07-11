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

for (const { path, name } of pages) {
  test.describe(`${name} accessibility`, () => {
    test(`should not have automatically detectable a11y violations on ${name}`, async ({ page }) => {
      test.setTimeout(120_000);
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
