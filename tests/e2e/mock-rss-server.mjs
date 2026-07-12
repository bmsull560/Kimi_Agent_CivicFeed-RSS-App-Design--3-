import http from "node:http";
import { parse as parseUrl } from "node:url";

const PORT = Number(process.env.MOCK_RSS_PORT) || 9876;

const now = new Date();
const pubDateNow = now.toUTCString();
const pubDateRecent = new Date(now.getTime() - 60 * 60 * 1000).toUTCString();

function singleEntryRss(title, description, guid, link) {
  return `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
  <channel>
    <title>Mock Feed</title>
    <link>https://example.com</link>
    <description>Deterministic mock RSS feed for browser tests.</description>
    <item>
      <title>${title}</title>
      <link>${link}</link>
      <description>${description}</description>
      <pubDate>${pubDateNow}</pubDate>
      <guid>${guid}</guid>
    </item>
  </channel>
</rss>`;
}

function liveTestRss(title = "Live Test Entry") {
  return `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
  <channel>
    <title>Live Test Feed</title>
    <link>https://example.com/live</link>
    <description>A faithfully simulated external RSS feed for live usability tests.</description>
    <item>
      <title>${title}</title>
      <link>https://example.com/live/1</link>
      <description>This entry is served by the live test mock RSS server.</description>
      <pubDate>${pubDateNow}</pubDate>
      <guid>live-test-entry-1</guid>
    </item>
    <item>
      <title>Second Live Test Entry</title>
      <link>https://example.com/live/2</link>
      <description>Another entry for live search and list verification.</description>
      <pubDate>${pubDateRecent}</pubDate>
      <guid>live-test-entry-2</guid>
    </item>
  </channel>
</rss>`;
}

const feeds = {
  "/feed.xml": () => liveTestRss(),
  "/feed-001.xml": () =>
    singleEntryRss(
      "Smoke Test Entry",
      "Deterministic browser smoke entry.",
      "browser-smoke-entry",
      "https://www.trade.gov/test-entry"
    ),
  "/test-feed.xml": () =>
    singleEntryRss(
      "Added Feed Entry",
      "Deterministic browser test entry.",
      "browser-test-entry",
      "https://example.com/test-entry"
    ),
  "/discovered.xml": () =>
    singleEntryRss(
      "Discovered Entry",
      "Discovered from a website URL.",
      "discovered-entry",
      "https://example.com/discovered"
    ),
  "/imported.xml": () =>
    singleEntryRss(
      "Imported Entry",
      "Imported via OPML.",
      "imported-entry",
      "https://example.com/imported"
    ),
  "/unsafe-feed.xml": () => `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
  <channel>
    <title>Unsafe Feed</title>
    <item>
      <title>Unsafe Entry</title>
      <link>https://example.com/unsafe</link>
      <description><![CDATA[<p>Description</p><script>window.__UNSAFE_SCRIPT_EXECUTED__ = true;</script>]]></description>
      <pubDate>${pubDateNow}</pubDate>
      <guid>unsafe-entry</guid>
    </item>
  </channel>
</rss>`,
  "/bad-feed.xml": () => "<not-rss></not-rss>",
};

const server = http.createServer((req, res) => {
  const parsed = parseUrl(req.url ?? "/", true);

  if (parsed.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("ok");
    return;
  }

  if (parsed.pathname === "/feed.xml") {
    const title = typeof parsed.query.title === "string" ? parsed.query.title : "Live Test Entry";
    res.writeHead(200, { "Content-Type": "application/rss+xml" });
    res.end(liveTestRss(title));
    return;
  }

  if (feeds[parsed.pathname]) {
    res.writeHead(200, { "Content-Type": "application/rss+xml" });
    res.end(feeds[parsed.pathname]());
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found");
});

server.listen(PORT, () => {
  console.log(`Mock RSS server listening on http://127.0.0.1:${PORT}`);
});
