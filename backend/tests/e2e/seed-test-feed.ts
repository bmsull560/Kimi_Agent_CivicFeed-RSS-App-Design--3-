import Database from "better-sqlite3";
import { seedFeeds } from "../../src/db.js";

const dbPath = process.env.CIVICFEED_DB_PATH;
const mockUrl = process.env.MOCK_RSS_URL;

if (!dbPath || !mockUrl) {
  console.error("CIVICFEED_DB_PATH and MOCK_RSS_URL are required");
  process.exit(1);
}

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

// Seed the catalog first, then add a test feed that points to the mock RSS server.
seedFeeds();

const insert = db.prepare(`
  INSERT INTO feeds
  (id, name, short_name, agency, description, rss_url, website, department, category, sub_category, content_type, update_frequency, status, tags)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    name = excluded.name,
    short_name = excluded.short_name,
    agency = excluded.agency,
    description = excluded.description,
    rss_url = excluded.rss_url,
    website = excluded.website,
    department = excluded.department,
    category = excluded.category,
    sub_category = excluded.sub_category,
    content_type = excluded.content_type,
    update_frequency = excluded.update_frequency,
    status = excluded.status,
    tags = excluded.tags
`);

insert.run(
  "feed-live-test",
  "Live Test Feed",
  "Live Test",
  "CivicFeed Test Agency",
  "Simulated external RSS feed for live end-to-end tests.",
  mockUrl,
  "https://example.com/live",
  "",
  "General",
  "test",
  "Test feed",
  "",
  "working",
  JSON.stringify(["general", "test", "live"])
);

// Point the built-in ITA News feed to the mock RSS server so default browser
// tests have a deterministic, locally-served feed instead of hitting trade.gov.
const feed001Url = mockUrl.replace(/\/feed\.xml$/, "/feed-001.xml");
db.prepare("UPDATE feeds SET rss_url = ? WHERE id = ?").run(feed001Url, "feed-001");
console.log(`Updated feed-001 to point to ${feed001Url}`);

console.log(`Seeded live test feed pointing to ${mockUrl}`);
db.close();
