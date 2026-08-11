import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const USER_DATA_KEY = "civicfeed_v2_user";

test.beforeEach(async ({ page }) => {
  await page.addInitScript((key) => {
    if (sessionStorage.getItem("civicfeed-onboarding-test-initialized")) return;
    localStorage.removeItem(key);
    sessionStorage.setItem("civicfeed-onboarding-test-initialized", "true");
  }, USER_DATA_KEY);
  await page.route("**/api/feeds", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        feeds: [],
        categoryList: [],
        feedStats: { total: 0, working: 0, categories: 0 },
      }),
    })
  );
  await page.route("**/api/articles/recent*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ results: [] }),
    })
  );
});

test("first use validates choices, manages focus, and persists completion", async ({ page }) => {
  await page.goto("/");

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Choose topics that matter to you" })
  ).toBeFocused();
  await expect(dialog.getByRole("button", { name: "Continue" })).toBeDisabled();

  await dialog.getByText("Health & Environment", { exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "Health & Environment" })).toBeChecked();
  await dialog.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Choose your briefing rhythm" })).toBeFocused();
  await expect(dialog.getByRole("button", { name: "Continue" })).toBeDisabled();

  await page.getByRole("radio", { name: /Daily briefing/ }).check();
  await dialog.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Your CivicFeed is ready" })).toBeFocused();
  await expect(page.getByRole("list", { name: "Getting started" })).toBeVisible();
  await dialog.getByRole("button", { name: "Start reading" }).click();
  await expect(dialog).toBeHidden();

  const preferences = await page.evaluate((key) => {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored).preferences : null;
  }, USER_DATA_KEY);
  expect(preferences).toMatchObject({
    onboardingComplete: true,
    onboardingDismissed: false,
    followedHubs: ["health-environment"],
    digestFrequency: "daily",
  });

  await page.reload();
  await expect(dialog).toBeHidden();
});

test("Not now dismisses first use and Personalize resumes it", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("dialog").getByRole("button", { name: "Not now" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();

  await page.reload();
  await expect(page.getByRole("dialog")).toBeHidden();
  await page.getByRole("button", { name: "Personalize" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("Escape dismisses onboarding and prevents repeated prompts", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByRole("button", { name: /Browse All Feeds/ })).toBeVisible();

  const dismissed = await page.evaluate((key) => {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored).preferences.onboardingDismissed : false;
  }, USER_DATA_KEY);
  expect(dismissed).toBe(true);

  await page.reload();
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("topic checkboxes and frequency radios support keyboard interaction", async ({ page }) => {
  await page.goto("/");
  const firstTopic = page.getByRole("checkbox", { name: "Health & Environment" });
  await firstTopic.focus();
  await page.keyboard.press("Space");
  await expect(firstTopic).toBeChecked();
  await page.getByRole("dialog").getByRole("button", { name: "Continue" }).click();

  const realtime = page.getByRole("radio", { name: /Real-time stream/ });
  await realtime.focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("radio", { name: /Daily briefing/ })).toBeChecked();
});

test("first-use dialog has no automatically detectable accessibility violations", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("dialog")).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});
