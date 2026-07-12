import { XMLParser } from "fast-xml-parser";
import type { Feed, UserFeed } from "../types";
import { createUserFeed } from "./userData";

interface OpmlOutline {
  "@_text"?: string;
  "@_title"?: string;
  "@_xmlUrl"?: string;
  "@_htmlUrl"?: string;
  "@_type"?: string;
  outline?: OpmlOutline | OpmlOutline[];
}

interface OpmlBody {
  outline?: OpmlOutline | OpmlOutline[];
}

interface OpmlDocument {
  opml?: {
    body?: OpmlBody;
  };
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function collectOutlines(node: OpmlOutline): OpmlOutline[] {
  const results: OpmlOutline[] = [];
  if (node["@_xmlUrl"]) results.push(node);
  for (const child of asArray(node.outline)) {
    results.push(...collectOutlines(child));
  }
  return results;
}

export interface ParsedOpmlFeed {
  name: string;
  rssUrl: string;
  website?: string;
  category?: string;
}

export function parseOpml(xmlText: string): ParsedOpmlFeed[] {
  const parser = new XMLParser({
    attributeNamePrefix: "@_",
    ignoreAttributes: false,
    parseAttributeValue: false,
    parseTagValue: false,
    trimValues: true,
  });

  const parsed = parser.parse(xmlText) as OpmlDocument;
  const body = parsed?.opml?.body;
  if (!body) return [];

  const rootOutlines = asArray(body.outline);
  const flat: OpmlOutline[] = [];
  for (const outline of rootOutlines) {
    flat.push(...collectOutlines(outline));
  }

  return flat
    .map((outline): ParsedOpmlFeed | null => {
      const rssUrl = outline["@_xmlUrl"]?.trim();
      if (!rssUrl) return null;
      const name = outline["@_title"]?.trim() || outline["@_text"]?.trim() || "Untitled Feed";
      const website = outline["@_htmlUrl"]?.trim();
      return { name, rssUrl, website };
    })
    .filter((f): f is ParsedOpmlFeed => f !== null);
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function generateOpml(feeds: Feed[], title = "CivicFeed Subscriptions"): string {
  const date = new Date().toUTCString();
  const outlines = feeds
    .map(
      (feed) =>
        `    <outline type="rss" text="${escapeXml(feed.name)}" title="${escapeXml(feed.name)}" xmlUrl="${escapeXml(feed.rssUrl)}" htmlUrl="${escapeXml(feed.website || "")}" />`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>${escapeXml(title)}</title>
    <dateCreated>${date}</dateCreated>
  </head>
  <body>
${outlines}
  </body>
</opml>`;
}

export function parsedOpmlToUserFeeds(
  parsed: ParsedOpmlFeed[],
  defaultCategory = "General"
): UserFeed[] {
  return parsed.map((p) =>
    createUserFeed({
      name: p.name,
      shortName: p.name,
      agency: "",
      description: "",
      rssUrl: p.rssUrl,
      website: p.website || "",
      department: "",
      category: p.category || defaultCategory,
      subCategory: p.category || defaultCategory,
      contentType: "",
      updateFrequency: "",
      tags: [],
    })
  );
}
