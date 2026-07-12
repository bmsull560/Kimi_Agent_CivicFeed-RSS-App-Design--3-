import { expect, test, type Page } from "@playwright/test";

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

test("live backend: user can open a feed and read entries from the backend", async ({ page }) => {
  const runtimeErrors = await collectRuntimeErrors(page);

  await page.goto("/#/feeds");
  await page.waitForResponse((res) => res.url().includes("/api/feeds") && res.status() === 200);
  await page
    .getByRole("button", { name: /Live Test/i })
    .first()
    .click();
  await expect(page.getByRole("heading", { name: "Live Test" })).toBeVisible();
  await expect(page.getByText("Live Test Entry", { exact: true })).toBeVisible();
  await expect(page.getByText("Second Live Test Entry", { exact: true })).toBeVisible();

  expect(runtimeErrors).toEqual([]);
});

test("live backend: search finds cached backend articles", async ({ page }) => {
  const runtimeErrors = await collectRuntimeErrors(page);

  await page.goto("/#/search?q=Second");
  await expect(page.getByText("Second Live Test Entry")).toBeVisible();

  expect(runtimeErrors).toEqual([]);
});

test("live backend: feed status endpoint reflects successful fetch", async ({ request }) => {
  const response = await request.get("http://127.0.0.1:4000/api/feeds/feed-live-test/status");
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.feedId).toBe("feed-live-test");
  expect(body.attemptCount).toBeGreaterThanOrEqual(1);
  expect(body.successCount).toBeGreaterThanOrEqual(1);
  expect(body.lastSuccessAt).toBeGreaterThan(0);
});

test("live backend: feed health endpoint reports ok for simulated feed", async ({ request }) => {
  const response = await request.get("http://127.0.0.1:4000/api/feeds/feed-live-test/health");
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.feedId).toBe("feed-live-test");
  expect(body.status).toBe("ok");
  expect(body.checks.reachable).toBe(true);
  expect(body.checks.validXml).toBe(true);
  expect(body.checks.validSchema).toBe(true);
});
