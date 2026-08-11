import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

export default defineConfig({
  testDir: "./tests/e2e",
  testIgnore: ["civicfeed-live.spec.ts"],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  reporter: [["list"]],
  globalSetup: path.resolve("tests/e2e/global-setup.ts"),
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    storageState: {
      cookies: [],
      origins: [
        {
          origin: "http://127.0.0.1:4173",
          localStorage: [
            {
              name: "civicfeed_v2_user",
              value: JSON.stringify({
                version: 1,
                feeds: [],
                articleState: { read: [], bookmarked: [], archived: [] },
                preferences: {
                  defaultView: "list",
                  reduceMotion: false,
                  onboardingComplete: true,
                  onboardingDismissed: false,
                  followedHubs: [],
                  digestFrequency: null,
                },
              }),
            },
          ],
        },
      ],
    },
  },
  projects: [
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox-desktop",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit-desktop",
      use: { ...devices["Desktop Safari"] },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 5"] },
    },
  ],
});
