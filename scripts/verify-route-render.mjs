import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import * as esbuild from "esbuild";

const root = process.cwd();
const tmpDir = path.join(root, ".tmp");
fs.mkdirSync(tmpDir, { recursive: true });

const entryPath = path.join(tmpDir, "route-render-entry.tsx");
const bundlePath = path.join(tmpDir, "route-render-bundle.cjs");

fs.writeFileSync(
  entryPath,
  `
import React from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import App from "../src/App";

const storage = new Map<string, string>();
// Seed a user-added override for feed-001 so route-render smoke tests can
// exercise the feed-detail route without a running backend API.
storage.set("civicfeed_v2_user", JSON.stringify({
  version: 1,
  feeds: [{
    id: "feed-001",
    name: "ITA News",
    shortName: "ITA News",
    agency: "International Trade Administration",
    description: "ITA News",
    rssUrl: "https://example.com/feed-001.xml",
    website: "https://example.com/feed-001",
    department: "Commerce",
    category: "Commerce",
    subCategory: "Commerce",
    contentType: "News",
    updateFrequency: "Daily",
    status: "working",
    tags: ["trade"],
    userAdded: true,
    enabled: true,
    addedAt: Date.now(),
  }],
  articleState: { read: [], bookmarked: [], archived: [] },
  preferences: { defaultView: "list", reduceMotion: false },
}));
globalThis.localStorage = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => { storage.set(key, String(value)); },
  removeItem: (key: string) => { storage.delete(key); },
  clear: () => { storage.clear(); },
  key: (index: number) => Array.from(storage.keys())[index] ?? null,
  get length() { return storage.size; },
};

globalThis.window = {
  location: {
    reload: () => undefined,
  },
};

const cases = [
  { route: "/", expected: ["U.S. Government RSS Feeds", "Browse by Category"] },
  { route: "/feeds", expected: ["All Feeds", "ITA News"] },
  { route: "/feed/feed-001", expected: ["ITA News", "Raw Feed"] },
  { route: "/feed/not-real", expected: ["Feed not found", "Back to Directory"] },
];

const failures: string[] = [];
for (const testCase of cases) {
  let html = "";
  try {
    html = renderToString(
      <MemoryRouter initialEntries={[testCase.route]}>
        <App />
      </MemoryRouter>,
    );
  } catch (error) {
    failures.push(\`\${testCase.route} threw: \${error instanceof Error ? error.message : String(error)}\`);
    continue;
  }
  if (html.trim().length < 100) {
    failures.push(\`\${testCase.route} rendered too little HTML\`);
  }
  for (const expected of testCase.expected) {
    if (!html.includes(expected)) {
      failures.push(\`\${testCase.route} missing expected text "\${expected}"\`);
    }
  }
}

if (failures.length > 0) {
  console.error(\`Route render verification failed with \${failures.length} issue(s):\`);
  for (const failure of failures) console.error(\`- \${failure}\`);
  process.exit(1);
}

console.log(\`Route render verification passed: \${cases.length} routes rendered.\`);
`
);

await esbuild.build({
  entryPoints: [entryPath],
  outfile: bundlePath,
  bundle: true,
  platform: "node",
  format: "cjs",
  jsx: "automatic",
  logLevel: "silent",
});

await import(`${pathToFileURL(bundlePath).href}?t=${Date.now()}`);
