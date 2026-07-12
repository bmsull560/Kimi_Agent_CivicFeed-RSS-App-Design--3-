import { describe, it, expect } from "vitest";
import { parseRssXml } from "./rss-parser.js";

describe("parseRssXml", () => {
  it("parses a standard RSS 2.0 feed", () => {
    const xml = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <item>
      <title>EPA Alert</title>
      <link>https://epa.gov/alert</link>
      <description><![CDATA[<p>Important update.</p>]]></description>
      <pubDate>Mon, 15 Jun 2026 12:00:00 GMT</pubDate>
      <guid>epa-alert-1</guid>
      <category>Environment</category>
      <author>author@epa.gov</author>
    </item>
  </channel>
</rss>`;

    const entries = parseRssXml(xml, "feed-1", "EPA");
    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe("epa-alert-1");
    expect(entries[0].title).toBe("EPA Alert");
    expect(entries[0].link).toBe("https://epa.gov/alert");
    expect(entries[0].description).toContain("Important update.");
    expect(entries[0].categories).toEqual(["Environment"]);
    expect(entries[0].author).toBe("author@epa.gov");
    expect(entries[0].feedId).toBe("feed-1");
  });

  it("parses an Atom feed", () => {
    const xml = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>Legislative Update</title>
    <link href="https://congress.gov/update"/>
    <summary><![CDATA[<p>Bill introduced.</p>]]></summary>
    <published>2026-06-15T12:00:00Z</published>
    <id>congress-update-1</id>
    <category term="Legislation"/>
    <author><name>Congress Staff</name></author>
  </entry>
</feed>`;

    const entries = parseRssXml(xml, "feed-2", "Congress");
    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe("congress-update-1");
    expect(entries[0].title).toBe("Legislative Update");
    expect(entries[0].link).toBe("https://congress.gov/update");
    expect(entries[0].author).toBe("Congress Staff");
    expect(entries[0].categories).toEqual(["Legislation"]);
  });

  it("parses an RDF feed", () => {
    const xml = `<?xml version="1.0"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/">
  <item rdf:about="https://example.com/rdf-item">
    <title>RDF Item</title>
    <link>https://example.com/rdf-item</link>
    <description>RDF description.</description>
    <dc:date xmlns:dc="http://purl.org/dc/elements/1.1/">2026-06-15T12:00:00Z</dc:date>
  </item>
</rdf:RDF>`;

    const entries = parseRssXml(xml, "feed-3", "RDF Source");
    expect(entries).toHaveLength(1);
    expect(entries[0].title).toBe("RDF Item");
    expect(entries[0].link).toBe("https://example.com/rdf-item");
  });

  it("returns an empty array for invalid XML", () => {
    const entries = parseRssXml("<not-xml", "feed-4", "Bad");
    expect(entries).toEqual([]);
  });

  it("returns an empty array when no items are present", () => {
    const entries = parseRssXml("<?xml version='1.0'?><rss><channel></channel></rss>", "feed-5", "Empty");
    expect(entries).toEqual([]);
  });

  it("generates an entry id when guid is missing", () => {
    const xml = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <item>
      <title>No GUID</title>
      <link>https://example.com/no-guid</link>
      <description>Test.</description>
      <pubDate>Mon, 15 Jun 2026 12:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

    const entries = parseRssXml(xml, "feed-6", "No GUID");
    expect(entries).toHaveLength(1);
    expect(entries[0].id).toMatch(/^entry-/);
  });

  it("skips entries that have neither title nor link", () => {
    const xml = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <item>
      <description>No title or link.</description>
    </item>
    <item>
      <title>Valid</title>
      <link>https://example.com/valid</link>
    </item>
  </channel>
</rss>`;

    const entries = parseRssXml(xml, "feed-7", "Mixed");
    expect(entries).toHaveLength(1);
    expect(entries[0].title).toBe("Valid");
  });
});
